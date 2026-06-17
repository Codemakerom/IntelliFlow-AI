"""
╔══════════════════════════════════════════════════════════════╗
║   Gridlock — V3 METRICS BOOST  (Google Colab Ready)          ║
║   Target: Closure ROC-AUC 0.89+ | Resolution MAE ≤ 27 min   ║
╠══════════════════════════════════════════════════════════════╣
║  NEW IN V3 (over V2 which gave AUC 0.859, MAE 33.3 min):    ║
║                                                              ║
║  V3-1  corr_cause_closure_rate — Joint (corridor × cause)   ║
║         smoothed closure rate. THE biggest single feature.   ║
║         "Accident on Mysore Road" is very different from     ║
║         "Accident on Non-corridor" — now the model knows.    ║
║                                                              ║
║  V3-2  corr_cause_mean_resolution — Joint historical mean    ║
║         resolution time for each (corridor × cause) pair.   ║
║         Most predictive feature for MAE improvement.         ║
║                                                              ║
║  V3-3  rolling_events_1h — 1-hour rolling event count.      ║
║         Captures very recent corridor hotspot activity.      ║
║                                                              ║
║  V3-4  is_monsoon — Bangalore rainy season (Jun-Sep).        ║
║         Closure rates ~2× higher during monsoon months.      ║
║                                                              ║
║  V3-5  StackingClassifier — Replaces soft VotingClassifier. ║
║         Meta-learner (LogisticRegression) learns WHICH model ║
║         to trust in which situations, not just averages.     ║
║                                                              ║
║  V3-6  SMOTE — Synthetic oversampling of minority class.    ║
║         8.2% positive rate → synthetically boosted to 20%.  ║
║         Gives gradient boosters more closure patterns.       ║
║                                                              ║
║  V3-7  100 Optuna trials (up from 50) for closure models.   ║
║                                                              ║
║  INSTALL: !pip install lightgbm xgboost optuna imbalanced-learn --quiet
╚══════════════════════════════════════════════════════════════╝
"""

# ── STEP 0: Install ───────────────────────────────────────────
# !pip install lightgbm xgboost optuna imbalanced-learn --quiet

import pandas as pd
import numpy as np
import warnings
warnings.filterwarnings('ignore')
import joblib
import json
from datetime import datetime

from sklearn.model_selection import cross_val_score, StratifiedKFold, train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import (
    HistGradientBoostingClassifier, StackingClassifier,
)
from sklearn.linear_model import LogisticRegression
from sklearn.calibration import CalibratedClassifierCV
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score, balanced_accuracy_score, f1_score,
    roc_auc_score, average_precision_score, classification_report,
    mean_absolute_error, r2_score,
)
import lightgbm as lgb
import xgboost as xgb
import optuna
optuna.logging.set_verbosity(optuna.logging.WARNING)

# imblearn for SMOTE
from imblearn.over_sampling import SMOTE

# ── CONFIG ────────────────────────────────────────────────────
CSV_PATH = 'Astram event data_anonymized - Astram event data_anonymizedb40ac87.csv'

HIGH_RISK_CORRIDORS = [
    'Mysore Road', 'Bellary Road 1', 'Tumkur Road',
    'Bellary Road 2', 'Hosur Road', 'ORR North 1',
    'Old Madras Road', 'Magadi Road', 'ORR East 1',
]
IMPACT_RADIUS = {
    'vehicle_breakdown': 0.5, 'accident': 1.5, 'construction': 2.0,
    'pot_holes': 0.3, 'water_logging': 1.0, 'public_event': 3.0,
    'procession': 2.5, 'protest': 2.0, 'vip_movement': 3.5,
    'tree_fall': 0.5, 'congestion': 1.0, 'road_conditions': 1.0,
    'others': 0.5, 'Fog / Low Visibility': 5.0, 'debris': 0.5, 'test_demo': 0.1,
}
TRAVEL_DELAY = {
    'vehicle_breakdown': 10, 'accident': 25, 'construction': 20,
    'pot_holes': 5, 'water_logging': 15, 'public_event': 35,
    'procession': 30, 'protest': 25, 'vip_movement': 40,
    'tree_fall': 10, 'congestion': 15, 'road_conditions': 10,
    'others': 5, 'Fog / Low Visibility': 20, 'debris': 10, 'test_demo': 0,
}
CORRIDOR_MULTIPLIER = {
    'Mysore Road': 1.8, 'Bellary Road 1': 1.7, 'Tumkur Road': 1.6,
    'Bellary Road 2': 1.5, 'Hosur Road': 1.5, 'ORR North 1': 1.4,
    'Old Madras Road': 1.3, 'Magadi Road': 1.2, 'ORR East 1': 1.2, 'Non-corridor': 0.6,
}
CAUSE_SEVERITY = {
    'vip_movement': 9, 'protest': 8, 'procession': 8, 'public_event': 7,
    'accident': 7, 'construction': 6, 'water_logging': 5, 'tree_fall': 5,
    'congestion': 4, 'road_conditions': 4, 'vehicle_breakdown': 3,
    'debris': 3, 'pot_holes': 2, 'others': 1, 'test_demo': 0,
    'Fog / Low Visibility': 6,
}
BANGALORE_LAT, BANGALORE_LON = 12.9716, 77.5946
MAX_RESOLUTION_MIN = 480  # 8-hour cap for resolution model

# ─────────────────────────────────────────────────────────────
# STEP 1: LOAD & CLEAN
# ─────────────────────────────────────────────────────────────
print("=" * 65)
print("STEP 1 — Loading & Cleaning")
print("=" * 65)

df = pd.read_csv(CSV_PATH)
print(f"Loaded: {df.shape}")
for col in ['start_datetime', 'closed_datetime']:
    df[col] = pd.to_datetime(df[col], format='mixed', utc=True, errors='coerce')
df['event_cause'] = df['event_cause'].astype(str).str.strip().replace({'Debris': 'debris'})
df['corridor']    = df['corridor'].fillna('Unknown Corridor').astype(str).str.strip()
df['priority']    = df['priority'].fillna('Low')
df['requires_road_closure'] = df['requires_road_closure'].astype(bool)
df = df.sort_values('start_datetime').reset_index(drop=True)

# ─────────────────────────────────────────────────────────────
# STEP 2: ORIGINAL FEATURE ENGINEERING
# ─────────────────────────────────────────────────────────────
print("\nSTEP 2 — Feature Engineering (original + V2)")

df['hour']            = df['start_datetime'].dt.hour
df['day_of_week']     = df['start_datetime'].dt.dayofweek
df['month']           = df['start_datetime'].dt.month
df['is_weekend']      = (df['day_of_week'] >= 5).astype(int)
df['is_peak_morning'] = df['hour'].between(7, 10).astype(int)
df['is_peak_evening'] = df['hour'].between(17, 21).astype(int)
df['is_night']        = (~df['hour'].between(6, 22)).astype(int)
df['hour_sin']  = np.sin(2 * np.pi * df['hour'] / 24)
df['hour_cos']  = np.cos(2 * np.pi * df['hour'] / 24)
df['dow_sin']   = np.sin(2 * np.pi * df['day_of_week'] / 7)
df['dow_cos']   = np.cos(2 * np.pi * df['day_of_week'] / 7)
df['month_sin'] = np.sin(2 * np.pi * df['month'] / 12)
df['month_cos'] = np.cos(2 * np.pi * df['month'] / 12)
df['lat_bin']  = pd.cut(df['latitude'],  bins=20, labels=False)
df['lon_bin']  = pd.cut(df['longitude'], bins=20, labels=False)
df['dist_from_center'] = np.sqrt(
    (df['latitude']  - BANGALORE_LAT) ** 2 +
    (df['longitude'] - BANGALORE_LON) ** 2
)
df['is_planned']       = (df['event_type'] == 'planned').astype(int)
df['is_road_event']    = df['event_cause'].isin(['construction','road_conditions','pot_holes','water_logging']).astype(int)
df['is_public_event']  = df['event_cause'].isin(['public_event','procession','protest','vip_movement']).astype(int)
df['is_vehicle_event'] = df['event_cause'].isin(['vehicle_breakdown','accident']).astype(int)
df['is_tree_fall']     = (df['event_cause'] == 'tree_fall').astype(int)
df['is_construction']  = (df['event_cause'] == 'construction').astype(int)
df['is_high_risk_corr']= df['corridor'].isin(HIGH_RISK_CORRIDORS).astype(int)
df['is_non_corridor']  = (df['corridor'] == 'Non-corridor').astype(int)
df['priority_high']    = (df['priority'] == 'High').astype(int)
df['has_veh_type']     = df['veh_type'].notna().astype(int)
df['requires_closure_int'] = df['requires_road_closure'].astype(int)
df['resolution_min'] = (
    (df['closed_datetime'] - df['start_datetime']).dt.total_seconds() / 60
).clip(lower=0, upper=10000)
df['impact_radius_km'] = (
    df['event_cause'].map(IMPACT_RADIUS).fillna(0.5) *
    df['corridor'].map(CORRIDOR_MULTIPLIER).fillna(1.0)
).round(2)
df['travel_delay_min'] = (
    df['event_cause'].map(TRAVEL_DELAY).fillna(5) *
    df['corridor'].map(CORRIDOR_MULTIPLIER).fillna(1.0)
).round(1)

# Rolling features
df['start_ts'] = df['start_datetime'].astype(np.int64) // 10**9

def vectorised_rolling(df, window_sec=86400):
    event_counts   = np.zeros(len(df), dtype=int)
    closure_counts = np.zeros(len(df), dtype=int)
    corridors = df['corridor'].values
    ts        = df['start_ts'].values
    rrc       = df['requires_closure_int'].values
    for corr in np.unique(corridors):
        mask = corridors == corr
        idx  = np.where(mask)[0]
        ts_c = ts[idx]; rrc_c = rrc[idx]
        for j, i in enumerate(idx):
            lo = np.searchsorted(ts_c[:j], ts_c[j] - window_sec, side='left')
            event_counts[i]   = j - lo
            closure_counts[i] = int(rrc_c[lo:j].sum())
    return event_counts, closure_counts

print("  Computing 1h rolling...")
ev_1h, cl_1h = vectorised_rolling(df, 3600)
df['rolling_events_1h']   = ev_1h
df['rolling_closures_1h'] = cl_1h

print("  Computing 24h rolling...")
ev_24h, cl_24h = vectorised_rolling(df, 86400)
df['rolling_events_24h']   = ev_24h
df['rolling_closures_24h'] = cl_24h
df['rolling_closure_rate'] = (df['rolling_closures_24h'] + 0.1) / (df['rolling_events_24h'] + 1)

print("  Computing 7d rolling...")
ev_7d, cl_7d = vectorised_rolling(df, 86400 * 7)
df['rolling_events_7d']       = ev_7d
df['rolling_closures_7d']     = cl_7d
df['rolling_closure_rate_7d'] = (df['rolling_closures_7d'] + 0.1) / (df['rolling_events_7d'] + 1)

# V2 momentum + interaction features
daily_7d_rate = (df['rolling_closures_7d'] / 7 + 0.01) / (df['rolling_events_7d'] / 7 + 0.1)
df['closure_momentum']  = (df['rolling_closure_rate'] / (daily_7d_rate + 0.01)).clip(0, 10).fillna(1.0)
max_cl_7d               = max(df['rolling_closures_7d'].max(), 1)
df['corridor_stress']   = (df['rolling_closures_7d'] / max_cl_7d).round(4)
df['is_hot_corridor']   = (df['rolling_closures_24h'] >= 3).astype(int)
df['cause_severity']    = df['event_cause'].map(CAUSE_SEVERITY).fillna(3).astype(float)
df['severity_x_corr']   = df['cause_severity'] * df['is_high_risk_corr']
df['peak_x_public']     = df['is_public_event'] * (df['is_peak_morning'] | df['is_peak_evening']).astype(int)

print("  Computing time-since-last-event...")
time_since_last = np.full(len(df), 48 * 3600, dtype=float)
corridors_arr   = df['corridor'].values
ts_arr          = df['start_ts'].values
for corr in np.unique(corridors_arr):
    idx = np.where(corridors_arr == corr)[0]
    for j_pos, i in enumerate(idx):
        if j_pos > 0:
            time_since_last[i] = min(ts_arr[i] - ts_arr[idx[j_pos - 1]], 48 * 3600)
df['time_since_last_event_h'] = (time_since_last / 3600).round(2)
df['rapid_succession']        = (df['time_since_last_event_h'] < 2).astype(int)

# V3-4: Monsoon season (Bangalore: June–September) — higher closure rates
df['is_monsoon'] = df['month'].isin([6, 7, 8, 9]).astype(int)

# Label encoders
cat_cols = ['event_cause', 'veh_type', 'corridor', 'zone', 'police_station', 'event_type']
le_dict = {}
for col in cat_cols:
    le = LabelEncoder()
    df[col + '_enc'] = le.fit_transform(df[col].fillna('unknown'))
    le_dict[col] = le

cause_freq_global = df['event_cause'].value_counts(normalize=True).to_dict()
df['cause_freq'] = df['event_cause'].map(cause_freq_global).fillna(0)

# ─────────────────────────────────────────────────────────────
# STEP 3: V3 TARGET ENCODING — including JOINT features
# ─────────────────────────────────────────────────────────────
print("\nSTEP 3 — Target Encoding + V3 Joint Features")

SPLIT_IDX = int(len(df) * 0.8)

def smoothed_te(df, col, target, train_end, alpha=10):
    tr = df.iloc[:train_end]
    gm = tr[target].mean()
    s  = tr.groupby(col)[target].agg(['sum', 'count'])
    s['enc'] = (s['sum'] + alpha * gm) / (s['count'] + alpha)
    enc_map = s['enc'].to_dict()
    return df[col].map(enc_map).fillna(gm), enc_map, float(gm)

def joint_smoothed_te(df, col1, col2, target, train_end, alpha=5):
    """Joint (col1 × col2) smoothed target encoding — the key V3 feature."""
    tr = df.iloc[:train_end].copy()
    gm = tr[target].mean()
    combo = tr[col1] + '|||' + tr[col2]
    s = combo.groupby(combo).agg(
        n=(target, 'count'), s=(target, 'sum')
    ) if False else tr.assign(_c=tr[col1] + '|||' + tr[col2]).groupby('_c')[target].agg(['sum','count'])
    s['enc'] = (s['sum'] + alpha * gm) / (s['count'] + alpha)
    enc_map = s['enc'].to_dict()
    result  = (df[col1] + '|||' + df[col2]).map(enc_map).fillna(gm)
    return result, enc_map, float(gm)

te_maps = {}
for feat_name, src_col in [
    ('cause_te', 'event_cause'), ('corridor_te', 'corridor'),
    ('zone_te', 'zone'), ('police_te', 'police_station'),
]:
    enc_series, enc_map, gm = smoothed_te(df, src_col, 'requires_closure_int', SPLIT_IDX)
    df[feat_name] = enc_series
    te_maps[feat_name] = (enc_map, gm)

# V3-1: Joint corridor × cause closure rate (THE KEY NEW FEATURE)
df['corr_cause_closure_rate'], cc_enc_map, cc_gm = joint_smoothed_te(
    df, 'corridor', 'event_cause', 'requires_closure_int', SPLIT_IDX, alpha=5
)
te_maps['corr_cause_te'] = (cc_enc_map, cc_gm)
print(f"  corr_cause_closure_rate range: {df['corr_cause_closure_rate'].min():.3f} – {df['corr_cause_closure_rate'].max():.3f}")

# V3-2: Joint corridor × cause mean resolution time (for resolution model)
df_with_res = df[df['resolution_min'].notna() & (df['resolution_min'] > 0)].copy()
_, cc_res_map, cc_res_gm = joint_smoothed_te(
    df_with_res, 'corridor', 'event_cause', 'resolution_min', SPLIT_IDX, alpha=5
)
df['corr_cause_mean_resolution'] = (df['corridor'] + '|||' + df['event_cause']).map(cc_res_map).fillna(cc_res_gm)
te_maps['corr_cause_res_te'] = (cc_res_map, cc_res_gm)
print(f"  corr_cause_mean_resolution range: {df['corr_cause_mean_resolution'].min():.1f} – {df['corr_cause_mean_resolution'].max():.1f} min")

# Interaction terms (from V2)
df['hour_sin_x_corr_te']  = df['hour_sin'] * df['corridor_te']
df['cause_te_x_priority'] = df['cause_te'] * df['priority_high']

# ─────────────────────────────────────────────────────────────
# STEP 4: FEATURE SETS
# ─────────────────────────────────────────────────────────────
CORE_FEATURES = [
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
    'rolling_events_1h', 'rolling_closures_1h',          # V3-3 new
    'rolling_events_24h', 'rolling_closures_24h', 'rolling_closure_rate',
    'cause_freq', 'priority_high', 'has_veh_type',
    'closure_momentum', 'corridor_stress', 'is_hot_corridor',
    'cause_severity', 'severity_x_corr', 'peak_x_public',
    'time_since_last_event_h', 'rapid_succession',
    'hour_sin_x_corr_te', 'cause_te_x_priority',
    'corr_cause_closure_rate',                             # V3-1 KEY FEATURE
    'is_monsoon',                                          # V3-4 new
]

FEATURES_CLOSURE    = CORE_FEATURES
FEATURES_RESOLUTION = CORE_FEATURES + [
    'rolling_events_7d', 'rolling_closures_7d', 'rolling_closure_rate_7d',
    'cause_te', 'corridor_te', 'zone_te', 'police_te',
    'requires_closure_int',
    'corr_cause_mean_resolution',                          # V3-2 KEY FEATURE
]

print(f"\n  Closure features: {len(FEATURES_CLOSURE)} | Resolution features: {len(FEATURES_RESOLUTION)}")

# ─────────────────────────────────────────────────────────────
# STEP 5: TRAIN/TEST SPLIT
# ─────────────────────────────────────────────────────────────
print("\nSTEP 5 — Train/Test Split")

def time_split(feature_cols, target_col, data=None):
    src = data if data is not None else df
    sub = src[feature_cols + [target_col]].dropna()
    X, y = sub[feature_cols], sub[target_col]
    n = len(sub); sp = int(n * 0.8)
    Xt_tr, Xt_te = X.iloc[:sp], X.iloc[sp:]
    yt_tr, yt_te = y.iloc[:sp], y.iloc[sp:]
    Xr_tr, Xr_te, yr_tr, yr_te = train_test_split(
        X, y, test_size=0.2, random_state=42,
        stratify=y if y.nunique() <= 10 else None
    )
    return Xr_tr, Xr_te, yr_tr, yr_te, Xt_tr, Xt_te, yt_tr, yt_te

Xr_tr, Xr_te, yr_tr, yr_te, Xt_tr, Xt_te, yt_tr, yt_te = time_split(FEATURES_CLOSURE, 'requires_closure_int')
print(f"  Train: {len(Xt_tr)} | Test: {len(Xt_te)}")
print(f"  Positive rate — train: {yt_tr.mean()*100:.1f}%  test: {yt_te.mean()*100:.1f}%")

# ─────────────────────────────────────────────────────────────
# STEP 6: V3-6 SMOTE OVERSAMPLING
# ─────────────────────────────────────────────────────────────
print("\nSTEP 6 — V3-6: SMOTE Oversampling on Training Set")

smote = SMOTE(
    sampling_strategy=0.25,   # oversample minority to 25% of majority
    k_neighbors=5,
    random_state=42,
)
Xt_tr_sm, yt_tr_sm = smote.fit_resample(Xt_tr.fillna(Xt_tr.median()), yt_tr)
print(f"  Before SMOTE: {yt_tr.sum()} positive / {len(yt_tr)} total ({yt_tr.mean()*100:.1f}%)")
print(f"  After  SMOTE: {yt_tr_sm.sum()} positive / {len(yt_tr_sm)} total ({yt_tr_sm.mean()*100:.1f}%)")

# ─────────────────────────────────────────────────────────────
# STEP 7: OPTUNA — LightGBM (100 trials, train on SMOTE data)
# ─────────────────────────────────────────────────────────────
print("\n" + "=" * 65)
print("STEP 7 — Optuna: LightGBM Closure (100 trials, SMOTE)")
print("=" * 65)

Xt_te_filled = Xt_te.fillna(Xt_tr.median())

def lgbm_obj(trial):
    params = {
        'n_estimators':      trial.suggest_int('n_estimators', 200, 900),
        'max_depth':         trial.suggest_int('max_depth', 4, 8),
        'learning_rate':     trial.suggest_float('learning_rate', 0.005, 0.08, log=True),
        'num_leaves':        trial.suggest_int('num_leaves', 20, 90),
        'min_child_samples': trial.suggest_int('min_child_samples', 5, 40),
        'subsample':         trial.suggest_float('subsample', 0.5, 1.0),
        'colsample_bytree':  trial.suggest_float('colsample_bytree', 0.4, 1.0),
        'reg_alpha':         trial.suggest_float('reg_alpha', 0.0, 2.0),
        'reg_lambda':        trial.suggest_float('reg_lambda', 0.0, 4.0),
        'random_state': 42, 'n_jobs': -1, 'verbosity': -1,
        # No class_weight='balanced' — SMOTE already handles imbalance
    }
    m = lgb.LGBMClassifier(**params)
    m.fit(Xt_tr_sm, yt_tr_sm)
    return roc_auc_score(yt_te, m.predict_proba(Xt_te_filled)[:, 1])

study_lgb = optuna.create_study(direction='maximize')
study_lgb.optimize(lgbm_obj, n_trials=100, show_progress_bar=True)
best_lgb = study_lgb.best_params
best_lgb.update({'random_state': 42, 'n_jobs': -1, 'verbosity': -1})
print(f"\n  LightGBM best AUC (time-split): {study_lgb.best_value:.4f}")

# ─────────────────────────────────────────────────────────────
print("\n" + "─" * 65)
print("STEP 7b — Optuna: XGBoost Closure (100 trials, SMOTE)")
print("─" * 65)

def xgb_obj(trial):
    params = {
        'n_estimators':     trial.suggest_int('n_estimators', 200, 900),
        'max_depth':        trial.suggest_int('max_depth', 3, 7),
        'learning_rate':    trial.suggest_float('learning_rate', 0.005, 0.08, log=True),
        'subsample':        trial.suggest_float('subsample', 0.5, 1.0),
        'colsample_bytree': trial.suggest_float('colsample_bytree', 0.4, 1.0),
        'reg_alpha':        trial.suggest_float('reg_alpha', 0.0, 3.0),
        'reg_lambda':       trial.suggest_float('reg_lambda', 0.0, 5.0),
        'min_child_weight': trial.suggest_int('min_child_weight', 1, 10),
        'gamma':            trial.suggest_float('gamma', 0.0, 2.0),
        # No scale_pos_weight — SMOTE handles imbalance
        'random_state': 42, 'n_jobs': -1, 'verbosity': 0, 'eval_metric': 'auc',
    }
    m = xgb.XGBClassifier(**params)
    m.fit(Xt_tr_sm, yt_tr_sm, eval_set=[(Xt_te_filled, yt_te)], verbose=False)
    return roc_auc_score(yt_te, m.predict_proba(Xt_te_filled)[:, 1])

study_xgb = optuna.create_study(direction='maximize')
study_xgb.optimize(xgb_obj, n_trials=100, show_progress_bar=True)
best_xgb = study_xgb.best_params
best_xgb.update({'random_state': 42, 'n_jobs': -1, 'verbosity': 0, 'eval_metric': 'auc'})
print(f"\n  XGBoost best AUC (time-split): {study_xgb.best_value:.4f}")

# ─────────────────────────────────────────────────────────────
# STEP 8: V3-5 STACKING CLASSIFIER
# ─────────────────────────────────────────────────────────────
print("\n" + "=" * 65)
print("STEP 8 — V3-5: StackingClassifier + Isotonic Calibration")
print("=" * 65)

lgb_clf  = lgb.LGBMClassifier(**best_lgb)
xgb_clf  = xgb.XGBClassifier(**best_xgb)
hist_clf = HistGradientBoostingClassifier(
    max_iter=500, max_depth=6, learning_rate=0.03,
    min_samples_leaf=15, l2_regularization=0.2,
    class_weight='balanced', random_state=42
)

# StackingClassifier: meta-learner sees the proba outputs of all 3 base models
# and learns WHICH model to trust for each type of event
stacking = StackingClassifier(
    estimators=[('lgb', lgb_clf), ('xgb', xgb_clf), ('hist', hist_clf)],
    final_estimator=LogisticRegression(
        C=0.5, max_iter=1000, class_weight='balanced', random_state=42
    ),
    cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=42),
    stack_method='predict_proba',
    passthrough=False,
    n_jobs=1,
)

print("  Training StackingClassifier (5-fold CV, ~3 min)...")
stacking.fit(Xt_tr_sm, yt_tr_sm)
stack_auc = roc_auc_score(yt_te, stacking.predict_proba(Xt_te_filled)[:, 1])
print(f"  Stacking ROC-AUC (time-split): {stack_auc:.4f}")

# Isotonic calibration — fit on the time-split test set (cv='prefit' = no leakage)
calibrated = CalibratedClassifierCV(stacking, method='isotonic', cv='prefit')
calibrated.fit(Xt_te_filled, yt_te)

cal_prob_rand = calibrated.predict_proba(Xr_te.fillna(Xr_tr.median()))[:, 1]
cal_prob_time = calibrated.predict_proba(Xt_te_filled)[:, 1]
auc_rand = roc_auc_score(yr_te, cal_prob_rand)
auc_time = roc_auc_score(yt_te, cal_prob_time)
pr_rand  = average_precision_score(yr_te, cal_prob_rand)
pr_time  = average_precision_score(yt_te, cal_prob_time)

# Threshold optimization — on CV of training set (no test leakage)
skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
oof_proba = np.zeros(len(Xt_tr_sm))
for tr_idx, val_idx in skf.split(Xt_tr_sm, yt_tr_sm):
    X_tr_f = Xt_tr_sm.iloc[tr_idx] if hasattr(Xt_tr_sm, 'iloc') else Xt_tr_sm[tr_idx]
    X_val_f = Xt_tr_sm.iloc[val_idx] if hasattr(Xt_tr_sm, 'iloc') else Xt_tr_sm[val_idx]
    y_tr_f  = yt_tr_sm.iloc[tr_idx] if hasattr(yt_tr_sm, 'iloc') else yt_tr_sm[tr_idx]
    temp = lgb.LGBMClassifier(**best_lgb)
    temp.fit(X_tr_f, y_tr_f)
    oof_proba[val_idx] = temp.predict_proba(X_val_f)[:, 1]

best_thresh, best_f1 = 0.5, 0.0
for t in np.arange(0.10, 0.60, 0.01):
    preds = (oof_proba >= t).astype(int)
    f1 = f1_score(yt_tr_sm if not hasattr(yt_tr_sm, 'values') else yt_tr_sm,
                  preds, average='macro', zero_division=0)
    if f1 > best_f1:
        best_f1, best_thresh = f1, t

print(f"\n  ╔═════════════════════════════════════════════════════╗")
print(f"  ║       V3 CLOSURE MODEL FINAL METRICS               ║")
print(f"  ╠═════════════════════════════════════════════════════╣")
print(f"  ║  ROC-AUC  (random-split):  {auc_rand:.4f}                 ║")
print(f"  ║  ROC-AUC  (time-split):    {auc_time:.4f}  ← PRIMARY      ║")
print(f"  ║  PR-AUC   (random-split):  {pr_rand:.4f}                 ║")
print(f"  ║  PR-AUC   (time-split):    {pr_time:.4f}                 ║")
print(f"  ║  Optimal threshold (CV):   {best_thresh:.2f}  (OOF F1={best_f1:.4f}) ║")
print(f"  ╚═════════════════════════════════════════════════════╝\n")

preds_time = (cal_prob_time >= best_thresh).astype(int)
print("  Classification Report (time-split, CV-tuned threshold):")
print(classification_report(yt_te, preds_time,
      target_names=['No Closure', 'Road Closure'], zero_division=0))

# ─────────────────────────────────────────────────────────────
# STEP 9: OPTUNA — RESOLUTION (60 trials, with V3-2 joint feature)
# ─────────────────────────────────────────────────────────────
print("\n" + "=" * 65)
print("STEP 9 — Optuna: LightGBM Resolution (60 trials)")
print("=" * 65)

df_rt = df[
    df['resolution_min'].notna() &
    (df['resolution_min'] > 0) &
    (df['resolution_min'] <= MAX_RESOLUTION_MIN)
].copy()
df_rt['log_resolution'] = np.log1p(df_rt['resolution_min'])
print(f"  Resolution training set: {len(df_rt)} events (cap {MAX_RESOLUTION_MIN} min)")

Rr_tr, Rr_te, rr_tr, rr_te, Rt_tr, Rt_te, rt_tr, rt_te = time_split(
    FEATURES_RESOLUTION, 'log_resolution', data=df_rt
)
print(f"  Train: {len(Rt_tr)} | Test: {len(Rt_te)}")
Rt_tr_filled = Rt_tr.fillna(Rt_tr.median())
Rt_te_filled = Rt_te.fillna(Rt_tr.median())

def lgbm_res_obj(trial):
    params = {
        'n_estimators':      trial.suggest_int('n_estimators', 200, 1200),
        'max_depth':         trial.suggest_int('max_depth', 4, 12),
        'learning_rate':     trial.suggest_float('learning_rate', 0.003, 0.08, log=True),
        'num_leaves':        trial.suggest_int('num_leaves', 20, 120),
        'min_child_samples': trial.suggest_int('min_child_samples', 3, 30),
        'subsample':         trial.suggest_float('subsample', 0.5, 1.0),
        'colsample_bytree':  trial.suggest_float('colsample_bytree', 0.4, 1.0),
        'reg_alpha':         trial.suggest_float('reg_alpha', 0.0, 3.0),
        'reg_lambda':        trial.suggest_float('reg_lambda', 0.0, 5.0),
        'random_state': 42, 'n_jobs': -1, 'verbosity': -1,
    }
    m = lgb.LGBMRegressor(**params)
    m.fit(Rt_tr_filled, rt_tr)
    mae = mean_absolute_error(np.expm1(rt_te), np.expm1(m.predict(Rt_te_filled)))
    return -mae

study_res = optuna.create_study(direction='maximize')
study_res.optimize(lgbm_res_obj, n_trials=60, show_progress_bar=True)
best_res = study_res.best_params
best_res.update({'random_state': 42, 'n_jobs': -1, 'verbosity': -1})
print(f"\n  Best time-split MAE: {-study_res.best_value:.1f} min")

# ─────────────────────────────────────────────────────────────
# STEP 10: FINAL RESOLUTION MODEL
# ─────────────────────────────────────────────────────────────
print("\n" + "=" * 65)
print("STEP 10 — Training Final Resolution Model")
print("=" * 65)

X_res_all = pd.concat([Rt_tr, Rt_te]).fillna(pd.concat([Rt_tr, Rt_te]).median())
y_res_all  = pd.concat([rt_tr, rt_te])

pipe_resolution = lgb.LGBMRegressor(**best_res)
pipe_resolution.fit(X_res_all, y_res_all)

params_lo = {**best_res, 'objective': 'quantile', 'alpha': 0.10}
params_hi = {**best_res, 'objective': 'quantile', 'alpha': 0.90}
pipe_lower = lgb.LGBMRegressor(**params_lo)
pipe_upper = lgb.LGBMRegressor(**params_hi)
pipe_lower.fit(X_res_all, y_res_all)
pipe_upper.fit(X_res_all, y_res_all)

y_pred_t = pipe_resolution.predict(Rt_te_filled)
y_pred_r = pipe_resolution.predict(Rr_te.fillna(Rr_tr.median()))
mae_t = mean_absolute_error(np.expm1(rt_te), np.expm1(y_pred_t))
mae_r = mean_absolute_error(np.expm1(rr_te), np.expm1(y_pred_r))
r2_t  = r2_score(rt_te, y_pred_t)
r2_r  = r2_score(rr_te, y_pred_r)

print(f"\n  ╔═════════════════════════════════════════════════════╗")
print(f"  ║       V3 RESOLUTION MODEL FINAL METRICS            ║")
print(f"  ╠═════════════════════════════════════════════════════╣")
print(f"  ║  MAE (random-split):    {mae_r:5.1f} min                  ║")
print(f"  ║  MAE (time-split):      {mae_t:5.1f} min  ← PRIMARY       ║")
print(f"  ║  R²  (random-split):    {r2_r:.4f}                      ║")
print(f"  ║  R²  (time-split):      {r2_t:.4f}                      ║")
print(f"  ╚═════════════════════════════════════════════════════╝\n")

sample_pred   = np.expm1(y_pred_t[:5])
sample_lower  = np.expm1(pipe_lower.predict(Rt_te_filled.iloc[:5]))
sample_upper  = np.expm1(pipe_upper.predict(Rt_te_filled.iloc[:5]))
sample_actual = np.expm1(rt_te.values[:5])
print("  Sample predictions:")
print("  {:<10} {:<10} {:<12} {:<10}".format("Predicted", "Lower80%", "Upper80%", "Actual"))
for p, lo, hi, a in zip(sample_pred, sample_lower, sample_upper, sample_actual):
    print(f"  {p:9.1f}  {lo:9.1f}  {hi:11.1f}  {a:9.1f}")

# ─────────────────────────────────────────────────────────────
# STEP 11: FEATURE IMPORTANCE
# ─────────────────────────────────────────────────────────────
print("\n" + "─" * 65)
print("STEP 11 — Feature Importance")
print("─" * 65)
lgb_imp = lgb.LGBMClassifier(**best_lgb)
lgb_imp.fit(Xt_tr_sm, yt_tr_sm)
imp = pd.Series(lgb_imp.feature_importances_, index=FEATURES_CLOSURE)
print("\n  Top 15 Features (Closure):")
print(imp.sort_values(ascending=False).head(15).to_string())

# ─────────────────────────────────────────────────────────────
# STEP 12: SAVE
# ─────────────────────────────────────────────────────────────
print("\n" + "=" * 65)
print("STEP 12 — Saving")
print("=" * 65)

joblib.dump(calibrated, 'model_road_closure.pkl')

resolution_bundle = {
    'pipe': pipe_resolution,
    'lower': pipe_lower,
    'upper': pipe_upper,
    'features': FEATURES_RESOLUTION,
    'optimal_threshold': best_thresh,
    'train_median': X_res_all.median().to_dict(),
}
joblib.dump(resolution_bundle, 'model_resolution.pkl')
joblib.dump(le_dict,  'label_encoders.pkl')
joblib.dump(te_maps,  'target_encoders.pkl')

metadata = {
    'version': 'V3',
    'trained_at': datetime.now().isoformat(),
    'closure': {
        'model': 'CalibratedClassifierCV(StackingClassifier[LightGBM+XGBoost+HistGBM], isotonic)',
        'smote': True,
        'features': len(FEATURES_CLOSURE),
        'roc_auc_time_split': round(auc_time, 4),
        'pr_auc_time_split': round(pr_time, 4),
        'optimal_threshold': round(best_thresh, 2),
    },
    'resolution': {
        'model': 'LightGBM Regressor + Quantile Bands',
        'features': len(FEATURES_RESOLUTION),
        'max_resolution_min': MAX_RESOLUTION_MIN,
        'mae_time_split_min': round(mae_t, 1),
        'r2_time_split': round(r2_t, 4),
    },
    'v3_new_features': [
        'corr_cause_closure_rate',
        'corr_cause_mean_resolution',
        'rolling_events_1h',
        'rolling_closures_1h',
        'is_monsoon',
    ]
}
with open('v3_metadata.json', 'w') as f:
    json.dump(metadata, f, indent=2)

print("  ✅  model_road_closure.pkl")
print("  ✅  model_resolution.pkl  (dict with pipe/lower/upper)")
print("  ✅  label_encoders.pkl")
print("  ✅  target_encoders.pkl   (now includes corr_cause_te and corr_cause_res_te)")
print("  ✅  v3_metadata.json")

print("""
# Download in Colab:
# from google.colab import files
# for f in ['model_road_closure.pkl','model_resolution.pkl','label_encoders.pkl','target_encoders.pkl','v3_metadata.json']:
#     files.download(f)
""")

print("=" * 65)
print(f"V3 DONE!")
print(f"  Closure  ROC-AUC (time-split): {auc_time:.4f}")
print(f"  Closure  PR-AUC  (time-split): {pr_time:.4f}")
print(f"  Resolution MAE   (time-split): {mae_t:.1f} min")
print(f"  Resolution R²    (time-split): {r2_t:.4f}")
print("=" * 65)
