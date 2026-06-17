"""
retrain_job.py — Nightly ML Retraining Pipeline
================================================
Auto-Calibrating Feedback Loop: 6-Step Nightly CRON Job

Can be run three ways:
  1. Automatically: BackgroundScheduler in main.py triggers at 2:00 AM daily
  2. Manually via API: POST /api/trigger-retrain
  3. From CLI: python retrain_job.py

Pipeline Steps:
  Step 1 — Fetch new feedback rows (is_retrained == False)
  Step 2 — Calculate delta (actual - predicted)
  Step 3 — Filter outliers (scale down extreme delay reasons)
  Step 4 — Append cleaned rows to master dataset
  Step 5 — Retrain model (.fit() with augmented data + sample weights)
  Step 6 — Save new .pkl and mark rows as retrained
"""

import os
import sys
import csv
import json
import logging
import warnings
import numpy as np
import pandas as pd
import joblib
from datetime import datetime

warnings.filterwarnings('ignore')

# ── Paths ──────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CSV_PATH         = os.path.join(BASE_DIR, "Astram event data_anonymized - Astram event data_anonymizedb40ac87.csv")
FEEDBACK_FILE    = os.path.join(BASE_DIR, "feedback_log.csv")
CORRECTION_FILE  = os.path.join(BASE_DIR, "correction_table.json")
RETRAIN_LOG_FILE = os.path.join(BASE_DIR, "retrain_log.json")

MODEL_RES_PATH   = os.path.join(BASE_DIR, "model_resolution.pkl")
MODEL_CLF_PATH   = os.path.join(BASE_DIR, "model_road_closure.pkl")
LE_PATH          = os.path.join(BASE_DIR, "label_encoders.pkl")
TE_PATH          = os.path.join(BASE_DIR, "target_encoders.pkl")

# ── Domain Lookups (mirrors main.py) ───────────────────────────────
HIGH_RISK_CORRIDORS = [
    'Mysore Road', 'Bellary Road 1', 'Tumkur Road', 'Bellary Road 2',
    'Hosur Road', 'ORR North 1', 'Old Madras Road', 'Magadi Road', 'ORR East 1',
]
IMPACT_RADIUS = {
    'vehicle_breakdown': 0.5, 'accident': 1.5, 'construction': 2.0, 'pot_holes': 0.3,
    'water_logging': 1.0, 'public_event': 3.0, 'procession': 2.5, 'protest': 2.0,
    'vip_movement': 3.5, 'tree_fall': 0.5, 'congestion': 1.0,
    'road_conditions': 1.0, 'others': 0.5, 'debris': 0.5,
}
TRAVEL_DELAY = {
    'vehicle_breakdown': 10, 'accident': 25, 'construction': 20, 'pot_holes': 5,
    'water_logging': 15, 'public_event': 35, 'procession': 30, 'protest': 25,
    'vip_movement': 40, 'tree_fall': 10, 'congestion': 15,
    'road_conditions': 10, 'others': 5, 'debris': 10,
}
CORRIDOR_MULTIPLIER = {
    'Mysore Road': 1.8, 'Bellary Road 1': 1.7, 'Tumkur Road': 1.6,
    'Bellary Road 2': 1.5, 'Hosur Road': 1.5, 'ORR North 1': 1.4,
    'Old Madras Road': 1.3, 'Magadi Road': 1.2, 'ORR East 1': 1.2, 'Non-corridor': 0.6,
}
BANGALORE_LAT, BANGALORE_LON = 12.9716, 77.5946

# STEP 3 — Outlier weight scaling by delay reason
# These are "acts of god" — don't let them skew the model
OUTLIER_WEIGHT_MAP = {
    'Secondary Accident':  0.2,  # Very rare compounding event — nearly ignore
    'Heavy Rain':          0.3,  # Weather anomaly — low weight
    'VIP Movement':        0.3,  # External, non-learnable
    'Public Interference': 0.5,  # Somewhat learnable
    'Tow Truck Delayed':   0.8,  # Operational — model CAN learn this
    'Equipment Failure':   0.6,
    '':                    1.0,  # No special reason — full weight
}

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s %(message)s',
    datefmt='%H:%M:%S'
)
log = logging.getLogger('retrain_job')


# ══════════════════════════════════════════════════════════════════
# STEP 1 — FETCH NEW FEEDBACK ROWS (is_retrained == False)
# ══════════════════════════════════════════════════════════════════

def fetch_new_feedback() -> pd.DataFrame:
    """Reads feedback_log.csv and returns rows not yet used for retraining."""
    if not os.path.exists(FEEDBACK_FILE):
        log.info("No feedback_log.csv found. Nothing to retrain.")
        return pd.DataFrame()

    df = pd.read_csv(FEEDBACK_FILE)
    if df.empty:
        log.info("feedback_log.csv is empty.")
        return pd.DataFrame()

    # Add is_retrained column if missing (backwards compat)
    if 'is_retrained' not in df.columns:
        df['is_retrained'] = False

    new_rows = df[df['is_retrained'] == False].copy()
    log.info(f"Step 1 ✓ — Found {len(new_rows)} new feedback rows (of {len(df)} total).")
    return new_rows


# ══════════════════════════════════════════════════════════════════
# STEP 2 — CALCULATE DELTA (already stored in feedback_log)
# ══════════════════════════════════════════════════════════════════

def compute_deltas(df: pd.DataFrame) -> pd.DataFrame:
    """Validates and recalculates delta_min from actual - predicted."""
    df = df.copy()
    df['predicted_time_min'] = pd.to_numeric(df['predicted_time_min'], errors='coerce').fillna(0)
    df['actual_time_min']    = pd.to_numeric(df['actual_time_min'], errors='coerce')
    df = df.dropna(subset=['actual_time_min'])
    df = df[df['actual_time_min'] > 0]
    df['delta_min'] = (df['actual_time_min'] - df['predicted_time_min']).round(1)
    log.info(f"Step 2 ✓ — Deltas computed. Mean delta: {df['delta_min'].mean():.1f} min, "
             f"MAE: {df['delta_min'].abs().mean():.1f} min")
    return df


# ══════════════════════════════════════════════════════════════════
# STEP 3 — FILTER OUTLIERS (sample weight by delay reason)
# ══════════════════════════════════════════════════════════════════

def assign_sample_weights(df: pd.DataFrame) -> pd.DataFrame:
    """
    Assigns a sample_weight to each feedback row.
    Outlier delay reasons (rain, secondary accident) get low weight
    so they don't bias the model toward abnormal conditions.
    """
    df = df.copy()

    def parse_delay_reason(notes_str):
        """Extract delay reason from notes field."""
        if not isinstance(notes_str, str):
            return ''
        for key in OUTLIER_WEIGHT_MAP:
            if key and key.lower() in notes_str.lower():
                return key
        return ''

    df['delay_reason'] = df['notes'].apply(parse_delay_reason) if 'notes' in df.columns else ''
    df['sample_weight'] = df['delay_reason'].map(OUTLIER_WEIGHT_MAP).fillna(1.0)

    n_downweighted = (df['sample_weight'] < 1.0).sum()
    log.info(f"Step 3 ✓ — {n_downweighted} outlier rows down-weighted. "
             f"Avg weight: {df['sample_weight'].mean():.2f}")
    return df


# ══════════════════════════════════════════════════════════════════
# STEP 4 — FEATURE ENGINEERING (convert feedback → model features)
# ══════════════════════════════════════════════════════════════════

def engineer_features(new_rows: pd.DataFrame, le_dict: dict, te_maps: dict,
                      cause_freq_global: dict, corridor_lookup: dict) -> pd.DataFrame:
    """
    Converts raw feedback rows into the 45-feature vector the resolution
    model expects. Uses corridor_lookup (pre-computed from historical CSV)
    to fill in lat/lon, rolling windows, zone, police_station etc.
    """
    rows_out = []

    FEATURES_RESOLUTION = [
        'hour', 'day_of_week', 'month',
        'hour_sin', 'hour_cos', 'dow_sin', 'dow_cos', 'month_sin', 'month_cos',
        'is_weekend', 'is_peak_morning', 'is_peak_evening', 'is_night',
        'latitude', 'longitude', 'lat_bin', 'lon_bin', 'dist_from_center',
        'is_planned', 'is_road_event', 'is_public_event',
        'is_vehicle_event', 'is_high_risk_corr', 'is_non_corridor',
        'is_tree_fall', 'is_construction',
        'event_cause_enc', 'veh_type_enc', 'corridor_enc',
        'zone_enc', 'police_station_enc', 'event_type_enc',
        'impact_radius_km', 'travel_delay_min',
        'rolling_events_24h', 'rolling_closures_24h', 'rolling_closure_rate',
        'cause_freq', 'priority_high', 'has_veh_type',
        'rolling_events_7d', 'rolling_closures_7d', 'rolling_closure_rate_7d',
        'cause_te', 'corridor_te', 'zone_te', 'police_te',
        'requires_closure_int',
    ]

    def safe_enc(col, val):
        if col in le_dict and val in le_dict[col].classes_:
            return int(le_dict[col].transform([val])[0])
        return 0

    def get_te(feat_name, val):
        enc_map, global_mean = te_maps.get(feat_name, ({}, 0.0))
        return enc_map.get(val, global_mean)

    for _, r in new_rows.iterrows():
        corridor    = str(r.get('corridor', 'Non-corridor'))
        event_cause = str(r.get('event_cause', 'others'))
        event_type  = str(r.get('event_type', 'unplanned'))
        actual_min  = float(r['actual_time_min'])
        actual_closed = int(r.get('actual_closed', 0))
        ts_str      = str(r.get('timestamp', datetime.now().isoformat()))

        # Parse timestamp
        try:
            ts = pd.to_datetime(ts_str)
        except Exception:
            ts = datetime.now()

        hour        = ts.hour
        dow         = ts.dayofweek
        month       = ts.month

        # Corridor lookup (lat/lon, zone, rolling averages)
        cl = corridor_lookup.get(corridor, corridor_lookup.get('Non-corridor', {}))
        lat = cl.get('lat', BANGALORE_LAT)
        lon = cl.get('lon', BANGALORE_LON)
        zone = cl.get('zone', 'Unknown')
        ps   = cl.get('police_station', 'Unknown')
        roll_ev24 = cl.get('rolling_events_24h', 3)
        roll_cl24 = cl.get('rolling_closures_24h', 1)
        roll_ev7  = cl.get('rolling_events_7d', 15)
        roll_cl7  = cl.get('rolling_closures_7d', 3)

        corr_mult   = CORRIDOR_MULTIPLIER.get(corridor, 1.0)
        radius      = IMPACT_RADIUS.get(event_cause, 0.5) * corr_mult
        delay_base  = TRAVEL_DELAY.get(event_cause, 5) * corr_mult
        dist_center = np.sqrt((lat - BANGALORE_LAT)**2 + (lon - BANGALORE_LON)**2)
        roll_rate24 = (roll_cl24 + 0.1) / (roll_ev24 + 1)
        roll_rate7  = (roll_cl7 + 0.1) / (roll_ev7 + 1)

        feat = {
            'hour': hour, 'day_of_week': dow, 'month': month,
            'hour_sin': np.sin(2*np.pi*hour/24), 'hour_cos': np.cos(2*np.pi*hour/24),
            'dow_sin': np.sin(2*np.pi*dow/7),    'dow_cos': np.cos(2*np.pi*dow/7),
            'month_sin': np.sin(2*np.pi*month/12), 'month_cos': np.cos(2*np.pi*month/12),
            'is_weekend': int(dow >= 5),
            'is_peak_morning': int(7 <= hour <= 10),
            'is_peak_evening': int(17 <= hour <= 21),
            'is_night': int(not (6 <= hour <= 22)),
            'latitude': lat, 'longitude': lon,
            'lat_bin': max(0, int((lat - 12.8) / 0.025)),
            'lon_bin': max(0, int((lon - 77.4) / 0.025)),
            'dist_from_center': dist_center,
            'is_planned': int(event_type == 'planned'),
            'is_road_event': int(event_cause in ['construction','road_conditions','pot_holes','water_logging']),
            'is_public_event': int(event_cause in ['public_event','procession','protest','vip_movement']),
            'is_vehicle_event': int(event_cause in ['vehicle_breakdown','accident']),
            'is_high_risk_corr': int(corridor in HIGH_RISK_CORRIDORS),
            'is_non_corridor': int(corridor == 'Non-corridor'),
            'is_tree_fall': int(event_cause == 'tree_fall'),
            'is_construction': int(event_cause == 'construction'),
            'event_cause_enc': safe_enc('event_cause', event_cause),
            'veh_type_enc': 0,
            'corridor_enc': safe_enc('corridor', corridor),
            'zone_enc': safe_enc('zone', zone),
            'police_station_enc': safe_enc('police_station', ps),
            'event_type_enc': safe_enc('event_type', event_type),
            'impact_radius_km': round(radius, 2),
            'travel_delay_min': round(delay_base, 1),
            'rolling_events_24h': roll_ev24,
            'rolling_closures_24h': roll_cl24,
            'rolling_closure_rate': roll_rate24,
            'cause_freq': cause_freq_global.get(event_cause, 0.01),
            'priority_high': 0,
            'has_veh_type': 0,
            'rolling_events_7d': roll_ev7,
            'rolling_closures_7d': roll_cl7,
            'rolling_closure_rate_7d': roll_rate7,
            'cause_te': get_te('cause_te', event_cause),
            'corridor_te': get_te('corridor_te', corridor),
            'zone_te': get_te('zone_te', zone),
            'police_te': get_te('police_te', ps),
            'requires_closure_int': actual_closed,
            # Target
            '_target_log_resolution': np.log1p(max(1.0, actual_min)),
            '_sample_weight': float(r.get('sample_weight', 1.0)),
        }
        rows_out.append(feat)

    if not rows_out:
        return pd.DataFrame()

    result = pd.DataFrame(rows_out)
    log.info(f"Step 4 ✓ — Engineered {len(result)} new training rows.")
    return result


# ══════════════════════════════════════════════════════════════════
# STEP 4b — BUILD CORRIDOR LOOKUP TABLE (from historical CSV)
# ══════════════════════════════════════════════════════════════════

def build_corridor_lookup(df_raw: pd.DataFrame) -> dict:
    """Pre-computes per-corridor feature means for use in feature engineering."""
    lookup = {}
    df = df_raw.copy()
    df['start_datetime'] = pd.to_datetime(df['start_datetime'], format='mixed', utc=True, errors='coerce')

    for corr, grp in df.groupby('corridor'):
        closure_rate = float(grp['requires_road_closure'].mean()) if 'requires_road_closure' in grp else 0.1
        ev_per_day   = len(grp) / max(1, (grp['start_datetime'].max() - grp['start_datetime'].min()).days)
        zone_mode    = grp['zone'].mode()
        ps_mode      = grp['police_station'].mode()
        lookup[corr] = {
            'lat': float(grp['latitude'].mean()),
            'lon': float(grp['longitude'].mean()),
            'zone': str(zone_mode.iloc[0]) if len(zone_mode) > 0 else 'Unknown',
            'police_station': str(ps_mode.iloc[0]) if len(ps_mode) > 0 else 'Unknown',
            'rolling_events_24h': max(1, round(ev_per_day * 2)),
            'rolling_closures_24h': max(0, round(ev_per_day * 2 * closure_rate)),
            'rolling_events_7d': max(1, round(ev_per_day * 7)),
            'rolling_closures_7d': max(0, round(ev_per_day * 7 * closure_rate)),
        }
    return lookup


# ══════════════════════════════════════════════════════════════════
# STEP 5 — RETRAIN THE RESOLUTION MODEL
# ══════════════════════════════════════════════════════════════════

def retrain_resolution_model(new_feature_rows: pd.DataFrame,
                             pipe_resolution, le_dict, te_maps,
                             cause_freq_global: dict,
                             df_raw: pd.DataFrame) -> object:
    """
    Retrains the RandomForestRegressor pipeline using:
      - Original training sample (historical CSV, 20% subsample for speed)
      - + New feedback rows (with sample weights)

    The new feedback rows get 5× higher base weight so recent ground truth
    has a stronger pull than old historical averages.
    """
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.pipeline import Pipeline
    from sklearn.impute import SimpleImputer

    FEATURES_RESOLUTION = [
        'hour', 'day_of_week', 'month',
        'hour_sin', 'hour_cos', 'dow_sin', 'dow_cos', 'month_sin', 'month_cos',
        'is_weekend', 'is_peak_morning', 'is_peak_evening', 'is_night',
        'latitude', 'longitude', 'lat_bin', 'lon_bin', 'dist_from_center',
        'is_planned', 'is_road_event', 'is_public_event',
        'is_vehicle_event', 'is_high_risk_corr', 'is_non_corridor',
        'is_tree_fall', 'is_construction',
        'event_cause_enc', 'veh_type_enc', 'corridor_enc',
        'zone_enc', 'police_station_enc', 'event_type_enc',
        'impact_radius_km', 'travel_delay_min',
        'rolling_events_24h', 'rolling_closures_24h', 'rolling_closure_rate',
        'cause_freq', 'priority_high', 'has_veh_type',
        'rolling_events_7d', 'rolling_closures_7d', 'rolling_closure_rate_7d',
        'cause_te', 'corridor_te', 'zone_te', 'police_te',
        'requires_closure_int',
    ]

    # ── Get historical training data (subsample 30% for speed) ──
    log.info("Step 5 — Building augmented training set...")
    corridor_lookup = build_corridor_lookup(df_raw)

    # Re-engineer a sample from the master historical CSV
    # (We use a subsample to avoid full retraining taking too long on a hackathon machine)
    df_hist = df_raw.copy()
    df_hist['start_datetime'] = pd.to_datetime(df_hist['start_datetime'], format='mixed', utc=True, errors='coerce')
    df_hist['closed_datetime'] = pd.to_datetime(df_hist['closed_datetime'], format='mixed', utc=True, errors='coerce')
    df_hist = df_hist[df_hist['closed_datetime'].notna()].copy()
    df_hist['resolution_min'] = ((df_hist['closed_datetime'] - df_hist['start_datetime'])
                                  .dt.total_seconds() / 60).clip(1, 10000)
    df_hist = df_hist.dropna(subset=['resolution_min'])
    df_hist = df_hist.sample(frac=0.3, random_state=42)

    # Use the existing pipe to get predictions on hist data — we use it to extract features
    # Actually, we just need X_hist and y_hist from the pipe's training data structure.
    # Since we can't easily reconstruct all features, we use a simpler proxy:
    # Score = log1p(resolution_min) ~ f(cause, corridor, hour, weekday) using historical means.
    # We build a feature-compatible dataset row by row from the historical sample.
    hist_rows = engineer_features(
        pd.DataFrame({
            'corridor': df_hist['corridor'].values,
            'event_cause': df_hist['event_cause'].str.strip().replace({'Debris':'debris'}).values,
            'event_type': df_hist.get('event_type', pd.Series(['unplanned']*len(df_hist))).values,
            'actual_time_min': df_hist['resolution_min'].values,
            'actual_closed': df_hist['requires_road_closure'].astype(int).values,
            'timestamp': df_hist['start_datetime'].astype(str).values,
            'notes': '',
            'sample_weight': 1.0,
        }),
        le_dict, te_maps, cause_freq_global, corridor_lookup
    )

    # ── Combine historical + feedback ──
    FEEDBACK_WEIGHT_MULTIPLIER = 5.0  # Recent officer reports count 5× vs old history

    if not hist_rows.empty and not new_feature_rows.empty:
        new_feature_rows_copy = new_feature_rows.copy()
        new_feature_rows_copy['_sample_weight'] *= FEEDBACK_WEIGHT_MULTIPLIER
        combined = pd.concat([hist_rows, new_feature_rows_copy], ignore_index=True)
    elif not new_feature_rows.empty:
        combined = new_feature_rows.copy()
        combined['_sample_weight'] *= FEEDBACK_WEIGHT_MULTIPLIER
    else:
        log.warning("No training data available. Aborting retrain.")
        return pipe_resolution

    combined = combined.dropna(subset=['_target_log_resolution'])
    X = combined[FEATURES_RESOLUTION].values
    y = combined['_target_log_resolution'].values
    w = combined['_sample_weight'].values

    log.info(f"  Training set: {len(combined)} rows "
             f"({len(hist_rows)} historical + {len(new_feature_rows)} feedback). "
             f"Starting .fit()...")

    # ── Rebuild the pipeline (same architecture as gridlock_round3_improved.py) ──
    new_pipe = Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('model', RandomForestRegressor(
            n_estimators=300,
            max_depth=12,
            min_samples_leaf=5,
            random_state=42,
            n_jobs=-1,
        ))
    ])

    new_pipe.fit(X, y, model__sample_weight=w)

    # Quick MAE estimate on feedback data
    y_pred = new_pipe.predict(new_feature_rows[FEATURES_RESOLUTION].values)
    mae = np.mean(np.abs(np.expm1(y_pred) - new_feature_rows['_target_log_resolution'].apply(np.expm1).values))
    log.info(f"Step 5 ✓ — Retrain complete. Feedback MAE: {mae:.1f} min")

    return new_pipe


# ══════════════════════════════════════════════════════════════════
# STEP 6 — SAVE MODEL + MARK ROWS AS RETRAINED
# ══════════════════════════════════════════════════════════════════

def save_and_swap(new_pipe, n_rows_retrained: int, mae: float):
    """Saves the new model and writes a retrain log entry."""
    joblib.dump(new_pipe, MODEL_RES_PATH)
    log.info(f"Step 6 ✓ — Saved new model_resolution.pkl ({n_rows_retrained} rows incorporated).")

    # Mark feedback rows as retrained
    if os.path.exists(FEEDBACK_FILE):
        df_fb = pd.read_csv(FEEDBACK_FILE)
        if 'is_retrained' not in df_fb.columns:
            df_fb['is_retrained'] = False
        df_fb.loc[df_fb['is_retrained'] == False, 'is_retrained'] = True
        df_fb.to_csv(FEEDBACK_FILE, index=False)
        log.info(f"  Marked {n_rows_retrained} feedback rows as is_retrained=True.")

    # Write retrain log
    log_entry = {
        'timestamp': datetime.now().isoformat(),
        'rows_incorporated': n_rows_retrained,
        'post_retrain_mae_min': round(mae, 2),
        'model_path': MODEL_RES_PATH,
        'status': 'success'
    }

    history = []
    if os.path.exists(RETRAIN_LOG_FILE):
        try:
            with open(RETRAIN_LOG_FILE, 'r') as f:
                history = json.load(f)
        except Exception:
            history = []

    history.append(log_entry)
    history = history[-30:]  # Keep last 30 entries

    with open(RETRAIN_LOG_FILE, 'w') as f:
        json.dump(history, f, indent=2)


# ══════════════════════════════════════════════════════════════════
# MAIN ENTRY POINT
# ══════════════════════════════════════════════════════════════════

def run_retrain_job(pipe_resolution=None, le_dict=None, te_maps=None,
                   cause_freq_global=None, df_raw=None) -> dict:
    """
    Main 6-step retraining pipeline.
    Can be called from main.py (passing already-loaded assets)
    or standalone (loads assets from disk).
    Returns a status dict for the API response.
    """
    log.info("=" * 60)
    log.info("NIGHTLY ML RETRAINING JOB — STARTED")
    log.info("=" * 60)
    start_time = datetime.now()

    # Load assets if not provided (standalone mode)
    if pipe_resolution is None:
        log.info("Loading assets from disk (standalone mode)...")
        try:
            pipe_resolution = joblib.load(MODEL_RES_PATH)
            le_dict         = joblib.load(LE_PATH)
            te_maps         = joblib.load(TE_PATH)
        except Exception as e:
            return {'success': False, 'error': f'Could not load model files: {e}'}

    if df_raw is None:
        try:
            df_raw = pd.read_csv(CSV_PATH)
            df_raw['event_cause'] = df_raw['event_cause'].astype(str).str.strip().replace({'Debris':'debris'})
            df_raw['corridor']    = df_raw['corridor'].astype(str).str.strip()
            df_raw['priority']    = df_raw['priority'].fillna('Low')
        except Exception as e:
            return {'success': False, 'error': f'Could not load master CSV: {e}'}

    if cause_freq_global is None:
        cause_freq_global = df_raw['event_cause'].value_counts(normalize=True).to_dict()

    # ── STEP 1 ──
    new_rows = fetch_new_feedback()
    if new_rows.empty:
        return {'success': True, 'message': 'No new feedback rows. Model unchanged.',
                'rows_processed': 0}

    # ── STEP 2 ──
    new_rows = compute_deltas(new_rows)
    if new_rows.empty:
        return {'success': False, 'error': 'All feedback rows had invalid actual times.'}

    # ── STEP 3 ──
    new_rows = assign_sample_weights(new_rows)

    # ── STEP 4: Feature engineering ──
    corridor_lookup = build_corridor_lookup(df_raw)
    new_feature_rows = engineer_features(new_rows, le_dict, te_maps,
                                          cause_freq_global, corridor_lookup)
    if new_feature_rows.empty:
        return {'success': False, 'error': 'Feature engineering produced no rows.'}

    # ── STEP 5: Retrain ──
    new_pipe = retrain_resolution_model(
        new_feature_rows, pipe_resolution, le_dict, te_maps, cause_freq_global, df_raw
    )

    # Compute post-retrain MAE on feedback data
    FEATURES_RESOLUTION = [
        'hour','day_of_week','month','hour_sin','hour_cos','dow_sin','dow_cos',
        'month_sin','month_cos','is_weekend','is_peak_morning','is_peak_evening','is_night',
        'latitude','longitude','lat_bin','lon_bin','dist_from_center',
        'is_planned','is_road_event','is_public_event','is_vehicle_event',
        'is_high_risk_corr','is_non_corridor','is_tree_fall','is_construction',
        'event_cause_enc','veh_type_enc','corridor_enc','zone_enc',
        'police_station_enc','event_type_enc','impact_radius_km','travel_delay_min',
        'rolling_events_24h','rolling_closures_24h','rolling_closure_rate',
        'cause_freq','priority_high','has_veh_type',
        'rolling_events_7d','rolling_closures_7d','rolling_closure_rate_7d',
        'cause_te','corridor_te','zone_te','police_te','requires_closure_int',
    ]
    y_pred_fb = new_pipe.predict(new_feature_rows[FEATURES_RESOLUTION].values)
    mae = float(np.mean(np.abs(
        np.expm1(y_pred_fb) -
        new_feature_rows['_target_log_resolution'].apply(np.expm1).values
    )))

    # ── STEP 6: Save + swap ──
    save_and_swap(new_pipe, len(new_rows), mae)

    elapsed = (datetime.now() - start_time).total_seconds()
    log.info(f"Retraining complete in {elapsed:.1f}s")
    log.info("=" * 60)

    return {
        'success': True,
        'rows_processed': len(new_rows),
        'post_retrain_mae_min': round(mae, 1),
        'elapsed_seconds': round(elapsed, 1),
        'message': (f"Model retrained on {len(new_rows)} new events. "
                    f"Post-retrain MAE: {mae:.1f} min. "
                    f"Completed in {elapsed:.1f}s."),
        'timestamp': datetime.now().isoformat(),
    }


# ── CLI entry point ──────────────────────────────────────────────
if __name__ == '__main__':
    result = run_retrain_job()
    print("\n" + "="*60)
    print("RESULT:", json.dumps(result, indent=2))
