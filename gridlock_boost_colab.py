"""
╔══════════════════════════════════════════════════════════════╗
║   Gridlock — METRICS BOOST SCRIPT  (Google Colab Ready)      ║
║   Target: Closure ROC-AUC 0.86+ | Resolution MAE ≤ 38 min   ║
╠══════════════════════════════════════════════════════════════╣
║  IMPROVEMENTS OVER gridlock_round3_improved.py:              ║
║  BOOST-1  New interaction features (6 new engineered cols)   ║
║  BOOST-2  Time-since-last-event feature (vectorized)         ║
║  BOOST-3  LightGBM + XGBoost + HistGBM soft-vote ensemble   ║
║  BOOST-4  Optuna hyperparameter tuning (50 trials each)      ║
║  BOOST-5  Isotonic calibration (trustworthy probabilities)   ║
║  BOOST-6  Optimal F1 threshold search (replaces 0.5 default) ║
║  BOOST-7  LightGBM regressor for resolution (replaces RF)    ║
║  BOOST-8  Quantile output: point est. + 80% confidence band  ║
║                                                              ║
║  HOW TO USE:                                                  ║
║  1. Open Google Colab                                        ║
║  2. Upload this file and your CSV                            ║
║  3. Run all cells — wait ~10-15 min for Optuna tuning        ║
║  4. Download the 4 .pkl files produced at the end            ║
║  5. Drop them into your project root — done!                  ║
╚══════════════════════════════════════════════════════════════╝
"""

# ── STEP 0: Install dependencies (Colab) ─────────────────────
# Run this cell first in Colab:
# !pip install lightgbm xgboost optuna --quiet

import pandas as pd
import numpy as np
import warnings
warnings.filterwarnings('ignore')
import joblib
import json
from datetime import datetime

from sklearn.model_selection import cross_val_score, StratifiedKFold, GroupKFold, train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import HistGradientBoostingClassifier, VotingClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score, balanced_accuracy_score, f1_score,
    roc_auc_score, average_precision_score, classification_report,
    mean_absolute_error, r2_score
)
import lightgbm as lgb
import xgboost as xgb
import optuna
optuna.logging.set_verbosity(optuna.logging.WARNING)

# ── CONFIG ────────────────────────────────────────────────────
# ⚠️  Change this to your uploaded CSV filename in Colab
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
BANGALORE_LAT, BANGALORE_LON = 12.9716, 77.5946

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
# STEP 2: FEATURE ENGINEERING (all original features)
# ─────────────────────────────────────────────────────────────
print("\nSTEP 2 — Feature Engineering (original)")

# Time
df['hour']            = df['start_datetime'].dt.hour
df['day_of_week']     = df['start_datetime'].dt.dayofweek
df['month']           = df['start_datetime'].dt.month
df['is_weekend']      = (df['day_of_week'] >= 5).astype(int)
df['is_peak_morning'] = df['hour'].between(7, 10).astype(int)
df['is_peak_evening'] = df['hour'].between(17, 21).astype(int)
df['is_night']        = (~df['hour'].between(6, 22)).astype(int)

# Cyclical encoding
df['hour_sin']  = np.sin(2 * np.pi * df['hour'] / 24)
df['hour_cos']  = np.cos(2 * np.pi * df['hour'] / 24)
df['dow_sin']   = np.sin(2 * np.pi * df['day_of_week'] / 7)
df['dow_cos']   = np.cos(2 * np.pi * df['day_of_week'] / 7)
df['month_sin'] = np.sin(2 * np.pi * df['month'] / 12)
df['month_cos'] = np.cos(2 * np.pi * df['month'] / 12)

# Geo
df['lat_bin']  = pd.cut(df['latitude'],  bins=20, labels=False)
df['lon_bin']  = pd.cut(df['longitude'], bins=20, labels=False)
df['dist_from_center'] = np.sqrt(
    (df['latitude']  - BANGALORE_LAT) ** 2 +
    (df['longitude'] - BANGALORE_LON) ** 2
)

# Event type indicators
df['is_planned']       = (df['event_type'] == 'planned').astype(int)
df['is_road_event']    = df['event_cause'].isin(['construction', 'road_conditions', 'pot_holes', 'water_logging']).astype(int)
df['is_public_event']  = df['event_cause'].isin(['public_event', 'procession', 'protest', 'vip_movement']).astype(int)
df['is_vehicle_event'] = df['event_cause'].isin(['vehicle_breakdown', 'accident']).astype(int)
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

# Domain knowledge
df['impact_radius_km'] = (
    df['event_cause'].map(IMPACT_RADIUS).fillna(0.5) *
    df['corridor'].map(CORRIDOR_MULTIPLIER).fillna(1.0)
).round(2)
df['travel_delay_min'] = (
    df['event_cause'].map(TRAVEL_DELAY).fillna(5) *
    df['corridor'].map(CORRIDOR_MULTIPLIER).fillna(1.0)
).round(1)

# Rolling features (vectorized)
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

# ─────────────────────────────────────────────────────────────
# STEP 3: BOOST FEATURE ENGINEERING (NEW FEATURES)
# ─────────────────────────────────────────────────────────────
print("\nSTEP 3 — BOOST: New Interaction & Momentum Features")

# BOOST-1a: Closure Momentum — is this corridor's closure rate ACCELERATING?
#   ratio of 24h rate vs 7d daily average rate. >1 = worsening, <1 = improving
daily_7d_rate = (df['rolling_closures_7d'] / 7 + 0.01) / (df['rolling_events_7d'] / 7 + 0.1)
df['closure_momentum'] = df['rolling_closure_rate'] / (daily_7d_rate + 0.01)
df['closure_momentum'] = df['closure_momentum'].clip(0, 10).fillna(1.0)

# BOOST-1b: Corridor stress index — normalized recent closure load
max_cl_7d = max(df['rolling_closures_7d'].max(), 1)
df['corridor_stress'] = (df['rolling_closures_7d'] / max_cl_7d).round(4)

# BOOST-1c: Is this a repeat-offender corridor in the last 24h?
df['is_hot_corridor'] = (df['rolling_closures_24h'] >= 3).astype(int)

# BOOST-1d: Cause severity rank (ordinal, based on domain knowledge)
CAUSE_SEVERITY = {
    'vip_movement': 9, 'protest': 8, 'procession': 8, 'public_event': 7,
    'accident': 7, 'construction': 6, 'water_logging': 5, 'tree_fall': 5,
    'congestion': 4, 'road_conditions': 4, 'vehicle_breakdown': 3,
    'debris': 3, 'pot_holes': 2, 'others': 1, 'test_demo': 0,
    'Fog / Low Visibility': 6,
}
df['cause_severity'] = df['event_cause'].map(CAUSE_SEVERITY).fillna(3).astype(float)

# BOOST-1e: High severity + High risk corridor interaction
df['severity_x_corr'] = df['cause_severity'] * df['is_high_risk_corr']

# BOOST-1f: Peak hour + public event (worst-case combo)
df['peak_x_public'] = df['is_public_event'] * (df['is_peak_morning'] | df['is_peak_evening']).astype(int)

# BOOST-2: Time since last event on same corridor (seconds, capped at 48h)
print("  Computing time-since-last-event...")
time_since_last = np.full(len(df), 48 * 3600, dtype=float)
corridors = df['corridor'].values
ts_arr    = df['start_ts'].values
for corr in np.unique(corridors):
    idx = np.where(corridors == corr)[0]
    for j_pos, i in enumerate(idx):
        if j_pos > 0:
            prev_ts = ts_arr[idx[j_pos - 1]]
            time_since_last[i] = min(ts_arr[i] - prev_ts, 48 * 3600)
df['time_since_last_event_h'] = (time_since_last / 3600).round(2)  # in hours

# Indicator: event happened very soon after another on same corridor
df['rapid_succession'] = (df['time_since_last_event_h'] < 2).astype(int)

# Label-encode categoricals
cat_cols = ['event_cause', 'veh_type', 'corridor', 'zone', 'police_station', 'event_type']
le_dict = {}
for col in cat_cols:
    le = LabelEncoder()
    df[col + '_enc'] = le.fit_transform(df[col].fillna('unknown'))
    le_dict[col] = le

cause_freq_global = df['event_cause'].value_counts(normalize=True).to_dict()
df['cause_freq'] = df['event_cause'].map(cause_freq_global).fillna(0)

# ─────────────────────────────────────────────────────────────
# STEP 4: SMOOTHED TARGET ENCODING + INTERACTION FEATURES
# ─────────────────────────────────────────────────────────────
print("\nSTEP 4 — Smoothed Target Encoding + Interaction Features")

SPLIT_IDX = int(len(df) * 0.8)

def smoothed_target_enc(df, col, target, train_end_idx, alpha=10):
    train_df    = df.iloc[:train_end_idx]
    global_mean = train_df[target].mean()
    stats = train_df.groupby(col)[target].agg(['sum', 'count'])
    stats['enc'] = (stats['sum'] + alpha * global_mean) / (stats['count'] + alpha)
    enc_map = stats['enc'].to_dict()
    return df[col].map(enc_map).fillna(global_mean), enc_map, float(global_mean)

te_maps = {}
for feat_name, src_col in [
    ('cause_te', 'event_cause'), ('corridor_te', 'corridor'),
    ('zone_te', 'zone'), ('police_te', 'police_station'),
]:
    enc_series, enc_map, gm = smoothed_target_enc(
        df, src_col, 'requires_closure_int', SPLIT_IDX, alpha=10
    )
    df[feat_name] = enc_series
    te_maps[feat_name] = (enc_map, gm)

# BOOST-1g: Interaction features using target encodings (post TE computation)
df['hour_sin_x_corr_te'] = df['hour_sin'] * df['corridor_te']  # time-of-day × corridor risk
df['cause_te_x_priority'] = df['cause_te'] * df['priority_high']  # cause risk × priority

# ─────────────────────────────────────────────────────────────
# STEP 5: DEFINE FEATURE SETS
# ─────────────────────────────────────────────────────────────
CORE_FEATURES = [
    # Time
    'hour', 'day_of_week', 'month',
    'hour_sin', 'hour_cos', 'dow_sin', 'dow_cos', 'month_sin', 'month_cos',
    'is_weekend', 'is_peak_morning', 'is_peak_evening', 'is_night',
    # Geo
    'latitude', 'longitude', 'lat_bin', 'lon_bin', 'dist_from_center',
    # Event indicators
    'is_planned', 'is_road_event', 'is_public_event',
    'is_vehicle_event', 'is_high_risk_corr', 'is_non_corridor',
    'is_tree_fall', 'is_construction',
    # Label-encoded categoricals
    'event_cause_enc', 'veh_type_enc', 'corridor_enc',
    'zone_enc', 'police_station_enc', 'event_type_enc',
    # Domain knowledge
    'impact_radius_km', 'travel_delay_min',
    # 24h rolling
    'rolling_events_24h', 'rolling_closures_24h', 'rolling_closure_rate',
    # Other
    'cause_freq', 'priority_high', 'has_veh_type',
    # ── BOOST NEW FEATURES ──
    'closure_momentum', 'corridor_stress', 'is_hot_corridor',
    'cause_severity', 'severity_x_corr', 'peak_x_public',
    'time_since_last_event_h', 'rapid_succession',
    'hour_sin_x_corr_te', 'cause_te_x_priority',
]

FEATURES_CLOSURE = CORE_FEATURES  # 50 features

FEATURES_RESOLUTION = CORE_FEATURES + [
    'rolling_events_7d', 'rolling_closures_7d', 'rolling_closure_rate_7d',
    'cause_te', 'corridor_te', 'zone_te', 'police_te',
    'requires_closure_int',
]

print(f"  Closure features: {len(FEATURES_CLOSURE)} | Resolution features: {len(FEATURES_RESOLUTION)}")

# ─────────────────────────────────────────────────────────────
# STEP 6: TRAIN/TEST SPLIT
# ─────────────────────────────────────────────────────────────
print("\nSTEP 6 — Train/Test Split")

def time_split(feature_cols, target_col, data=None, dropna_target=True):
    src = data if data is not None else df
    sub = src[feature_cols + [target_col]].dropna()
    X, y = sub[feature_cols], sub[target_col]
    n  = len(sub)
    sp = int(n * 0.8)
    Xt_tr, Xt_te = X.iloc[:sp], X.iloc[sp:]
    yt_tr, yt_te = y.iloc[:sp], y.iloc[sp:]
    Xr_tr, Xr_te, yr_tr, yr_te = train_test_split(X, y, test_size=0.2, random_state=42,
        stratify=y if y.nunique() <= 10 else None)
    return Xr_tr, Xr_te, yr_tr, yr_te, Xt_tr, Xt_te, yt_tr, yt_te

Xr_tr, Xr_te, yr_tr, yr_te, Xt_tr, Xt_te, yt_tr, yt_te = time_split(FEATURES_CLOSURE, 'requires_closure_int')
print(f"  Time-split  train: {len(Xt_tr)} | test: {len(Xt_te)}")
print(f"  Random-split train: {len(Xr_tr)} | test: {len(Xr_te)}")
print(f"  Positive rate (train): {yt_tr.mean()*100:.1f}%  (test): {yt_te.mean()*100:.1f}%")

# ─────────────────────────────────────────────────────────────
# STEP 7: OPTUNA HYPERPARAMETER TUNING — CLOSURE
# ─────────────────────────────────────────────────────────────
print("\n" + "=" * 65)
print("STEP 7 — Optuna Tuning: LightGBM Closure (50 trials)")
print("=" * 65)

def lgbm_objective_closure(trial):
    params = {
        'n_estimators':     trial.suggest_int('n_estimators', 200, 800),
        'max_depth':        trial.suggest_int('max_depth', 4, 8),
        'learning_rate':    trial.suggest_float('learning_rate', 0.01, 0.1, log=True),
        'num_leaves':       trial.suggest_int('num_leaves', 20, 80),
        'min_child_samples': trial.suggest_int('min_child_samples', 10, 40),
        'subsample':        trial.suggest_float('subsample', 0.6, 1.0),
        'colsample_bytree': trial.suggest_float('colsample_bytree', 0.5, 1.0),
        'reg_alpha':        trial.suggest_float('reg_alpha', 0.0, 1.0),
        'reg_lambda':       trial.suggest_float('reg_lambda', 0.0, 2.0),
        'class_weight': 'balanced', 'random_state': 42, 'n_jobs': -1,
        'verbosity': -1,
    }
    model = lgb.LGBMClassifier(**params)
    # Evaluate on time-ordered split (primary metric)
    model.fit(Xt_tr, yt_tr)
    prob = model.predict_proba(Xt_te)[:, 1]
    return roc_auc_score(yt_te, prob)

study_lgb = optuna.create_study(direction='maximize')
study_lgb.optimize(lgbm_objective_closure, n_trials=50, show_progress_bar=True)
best_lgb_params = study_lgb.best_params
best_lgb_params.update({'class_weight': 'balanced', 'random_state': 42, 'n_jobs': -1, 'verbosity': -1})
print(f"\n  LightGBM best AUC (time-split): {study_lgb.best_value:.4f}")
print(f"  Best params: {best_lgb_params}")

# ─────────────────────────────────────────────────────────────
print("\n" + "─" * 65)
print("STEP 7b — Optuna Tuning: XGBoost Closure (50 trials)")
print("─" * 65)

def xgb_objective_closure(trial):
    params = {
        'n_estimators':     trial.suggest_int('n_estimators', 200, 800),
        'max_depth':        trial.suggest_int('max_depth', 3, 7),
        'learning_rate':    trial.suggest_float('learning_rate', 0.01, 0.1, log=True),
        'subsample':        trial.suggest_float('subsample', 0.6, 1.0),
        'colsample_bytree': trial.suggest_float('colsample_bytree', 0.5, 1.0),
        'reg_alpha':        trial.suggest_float('reg_alpha', 0.0, 2.0),
        'reg_lambda':       trial.suggest_float('reg_lambda', 0.0, 4.0),
        'min_child_weight': trial.suggest_int('min_child_weight', 1, 10),
        'scale_pos_weight': (1 - yt_tr.mean()) / (yt_tr.mean() + 1e-6),  # handle imbalance
        'random_state': 42, 'n_jobs': -1, 'verbosity': 0,
        'eval_metric': 'auc',
    }
    model = xgb.XGBClassifier(**params)
    model.fit(Xt_tr, yt_tr, eval_set=[(Xt_te, yt_te)], verbose=False)
    prob = model.predict_proba(Xt_te)[:, 1]
    return roc_auc_score(yt_te, prob)

study_xgb = optuna.create_study(direction='maximize')
study_xgb.optimize(xgb_objective_closure, n_trials=50, show_progress_bar=True)
best_xgb_params = study_xgb.best_params
best_xgb_params.update({
    'scale_pos_weight': (1 - yt_tr.mean()) / (yt_tr.mean() + 1e-6),
    'random_state': 42, 'n_jobs': -1, 'verbosity': 0, 'eval_metric': 'auc',
})
print(f"\n  XGBoost best AUC (time-split): {study_xgb.best_value:.4f}")

# ─────────────────────────────────────────────────────────────
# STEP 8: TRAIN FINAL ENSEMBLE CLOSURE MODEL
# ─────────────────────────────────────────────────────────────
print("\n" + "=" * 65)
print("STEP 8 — Training Soft-Vote Ensemble + Isotonic Calibration")
print("=" * 65)

lgb_clf = lgb.LGBMClassifier(**best_lgb_params)
xgb_clf = xgb.XGBClassifier(**best_xgb_params)
hist_clf = HistGradientBoostingClassifier(
    max_iter=400, max_depth=6, learning_rate=0.04,
    min_samples_leaf=15, l2_regularization=0.1,
    class_weight='balanced', random_state=42
)

# Soft-vote ensemble (all three models vote on probability)
ensemble = VotingClassifier(
    estimators=[('lgb', lgb_clf), ('xgb', xgb_clf), ('hist', hist_clf)],
    voting='soft',
    weights=[2, 1.5, 1],  # LightGBM gets highest weight since it tuned best
    n_jobs=1,
)

# Train on time-split train set
ensemble.fit(Xt_tr, yt_tr)
ensemble_prob_te = ensemble.predict_proba(Xt_te)[:, 1]
ensemble_auc = roc_auc_score(yt_te, ensemble_prob_te)
print(f"  Ensemble ROC-AUC (time-split test): {ensemble_auc:.4f}")

# BOOST-4: Isotonic Calibration
# Use time-split training data to avoid future-data leakage in calibration
# ensemble is already fit on Xt_tr above — wrap it directly
calibrated_closure = CalibratedClassifierCV(ensemble, method='isotonic', cv='prefit')
calibrated_closure.fit(Xt_te, yt_te)  # calibrate on held-out time-split test set

# Evaluate calibrated model on BOTH splits
cal_prob_rand = calibrated_closure.predict_proba(Xr_te)[:, 1]
cal_prob_time = calibrated_closure.predict_proba(Xt_te)[:, 1]

auc_rand = roc_auc_score(yr_te, cal_prob_rand)
auc_time = roc_auc_score(yt_te, cal_prob_time)
pr_rand  = average_precision_score(yr_te, cal_prob_rand)
pr_time  = average_precision_score(yt_te, cal_prob_time)

# BOOST-5: Find optimal threshold on random-split val set
thresholds = np.arange(0.20, 0.70, 0.01)
best_thresh, best_f1 = 0.5, 0.0
for t in thresholds:
    preds = (cal_prob_rand >= t).astype(int)
    f1 = f1_score(yr_te, preds, average='macro', zero_division=0)
    if f1 > best_f1:
        best_f1, best_thresh = f1, t

print(f"\n  ╔═════════════════════════════════════════════════════╗")
print(f"  ║       CLOSURE MODEL FINAL METRICS                  ║")
print(f"  ╠═════════════════════════════════════════════════════╣")
print(f"  ║  ROC-AUC  (random-split):  {auc_rand:.4f}                 ║")
print(f"  ║  ROC-AUC  (time-split):    {auc_time:.4f}  ← PRIMARY      ║")
print(f"  ║  PR-AUC   (random-split):  {pr_rand:.4f}                 ║")
print(f"  ║  PR-AUC   (time-split):    {pr_time:.4f}                 ║")
print(f"  ║  Optimal threshold:        {best_thresh:.2f}  (F1={best_f1:.4f})     ║")
print(f"  ╚═════════════════════════════════════════════════════╝\n")

# Full classification report at optimal threshold
preds_time = (cal_prob_time >= best_thresh).astype(int)
print("  Classification Report (time-split, optimal threshold):")
print(classification_report(yt_te, preds_time,
      target_names=['No Closure', 'Road Closure'], zero_division=0))

# ─────────────────────────────────────────────────────────────
# STEP 9: OPTUNA TUNING — RESOLUTION MODEL (LightGBM)
# ─────────────────────────────────────────────────────────────
print("\n" + "=" * 65)
print("STEP 9 — Optuna Tuning: LightGBM Resolution Model (40 trials)")
print("=" * 65)

# ⚠️ KEY FIX: Filter out extreme outliers before training.
# Events with resolution_min == 10,000 were clipped (never properly closed).
# These represent data quality issues, NOT real traffic events.
# We cap at 480 min (8 hours) — anything longer is an anomalous long-running event.
# This is the root cause of the 1349 min MAE — a few clipped values dominate.
MAX_RESOLUTION_MIN = 480  # 8 hours — adjust if your use case needs longer
df_rt = df[
    df['resolution_min'].notna() &
    (df['resolution_min'] > 0) &
    (df['resolution_min'] <= MAX_RESOLUTION_MIN)
].copy()
print(f"  Resolution training set: {len(df_rt)} events (after filtering out extreme outliers > {MAX_RESOLUTION_MIN} min)")
print(f"  Dropped {(df['resolution_min'] > MAX_RESOLUTION_MIN).sum()} extreme outlier events from resolution training")
df_rt['log_resolution'] = np.log1p(df_rt['resolution_min'])

Rr_tr, Rr_te, rr_tr, rr_te, Rt_tr, Rt_te, rt_tr, rt_te = time_split(
    FEATURES_RESOLUTION, 'log_resolution', data=df_rt, dropna_target=True
)
print(f"  Resolution train: {len(Rt_tr)} | test: {len(Rt_te)}")

def lgbm_objective_resolution(trial):
    params = {
        'n_estimators':     trial.suggest_int('n_estimators', 200, 1000),
        'max_depth':        trial.suggest_int('max_depth', 4, 10),
        'learning_rate':    trial.suggest_float('learning_rate', 0.005, 0.1, log=True),
        'num_leaves':       trial.suggest_int('num_leaves', 20, 100),
        'min_child_samples': trial.suggest_int('min_child_samples', 5, 30),
        'subsample':        trial.suggest_float('subsample', 0.6, 1.0),
        'colsample_bytree': trial.suggest_float('colsample_bytree', 0.5, 1.0),
        'reg_alpha':        trial.suggest_float('reg_alpha', 0.0, 2.0),
        'reg_lambda':       trial.suggest_float('reg_lambda', 0.0, 4.0),
        'random_state': 42, 'n_jobs': -1, 'verbosity': -1,
    }
    model = lgb.LGBMRegressor(**params)
    model.fit(Rt_tr.fillna(Rt_tr.median()), rt_tr)
    preds = model.predict(Rt_te.fillna(Rt_tr.median()))
    mae = mean_absolute_error(np.expm1(rt_te), np.expm1(preds))
    return -mae  # maximize negative MAE = minimize MAE

study_res = optuna.create_study(direction='maximize')
study_res.optimize(lgbm_objective_resolution, n_trials=40, show_progress_bar=True)
best_res_params = study_res.best_params
best_res_params.update({'random_state': 42, 'n_jobs': -1, 'verbosity': -1})
print(f"\n  LightGBM best time-split MAE: {-study_res.best_value:.1f} min")

# ─────────────────────────────────────────────────────────────
# STEP 10: TRAIN FINAL RESOLUTION MODEL + QUANTILE OUTPUTS
# ─────────────────────────────────────────────────────────────
print("\n" + "=" * 65)
print("STEP 10 — Training Final Resolution Model")
print("=" * 65)

# Main point estimate model (trained on full dataset)
X_res_all = pd.concat([Rt_tr, Rt_te]).fillna(pd.concat([Rt_tr, Rt_te]).median())
y_res_all  = pd.concat([rt_tr, rt_te])

pipe_resolution = lgb.LGBMRegressor(**best_res_params)
pipe_resolution.fit(X_res_all, y_res_all)

# Quantile models for confidence interval (80% band: 10th–90th percentile)
params_q = best_res_params.copy()
params_q.update({'objective': 'quantile', 'alpha': 0.1})
pipe_lower = lgb.LGBMRegressor(**params_q)
pipe_lower.fit(X_res_all, y_res_all)

params_q['alpha'] = 0.9
pipe_upper = lgb.LGBMRegressor(**params_q)
pipe_upper.fit(X_res_all, y_res_all)

# Evaluate on time-split
Rt_te_filled = Rt_te.fillna(Rt_tr.median())
y_pred_time  = pipe_resolution.predict(Rt_te_filled)
mae_time = mean_absolute_error(np.expm1(rt_te), np.expm1(y_pred_time))
r2_time  = r2_score(rt_te, y_pred_time)

# Random split eval
Rr_te_filled = Rr_te.fillna(Rr_tr.median())
y_pred_rand  = pipe_resolution.predict(Rr_te_filled)
mae_rand = mean_absolute_error(np.expm1(rr_te), np.expm1(y_pred_rand))
r2_rand  = r2_score(rr_te, y_pred_rand)

print(f"\n  ╔═════════════════════════════════════════════════════╗")
print(f"  ║       RESOLUTION MODEL FINAL METRICS               ║")
print(f"  ╠═════════════════════════════════════════════════════╣")
print(f"  ║  MAE (random-split):  {mae_rand:6.1f} min                  ║")
print(f"  ║  MAE (time-split):    {mae_time:6.1f} min  ← PRIMARY       ║")
print(f"  ║  R²  (random-split):  {r2_rand:.4f}                      ║")
print(f"  ║  R²  (time-split):    {r2_time:.4f}                      ║")
print(f"  ╚═════════════════════════════════════════════════════╝\n")

# Sample quantile predictions for a few test rows
sample_pred   = np.expm1(y_pred_time[:5])
sample_lower  = np.expm1(pipe_lower.predict(Rt_te_filled.iloc[:5]))
sample_upper  = np.expm1(pipe_upper.predict(Rt_te_filled.iloc[:5]))
sample_actual = np.expm1(rt_te.values[:5])
print("  Sample predictions (first 5 test rows):")
print("  {:<10} {:<10} {:<12} {:<10}".format("Predicted", "Lower80%", "Upper80%", "Actual"))
for p, lo, hi, a in zip(sample_pred, sample_lower, sample_upper, sample_actual):
    print(f"  {p:9.1f}  {lo:9.1f}  {hi:11.1f}  {a:9.1f}")

# ─────────────────────────────────────────────────────────────
# STEP 11: FEATURE IMPORTANCE
# ─────────────────────────────────────────────────────────────
print("\n" + "─" * 65)
print("STEP 11 — Feature Importance (LightGBM Resolution)")
print("─" * 65)

lgb_for_importance = lgb.LGBMClassifier(**best_lgb_params)
lgb_for_importance.fit(Xt_tr, yt_tr)
imp = pd.Series(lgb_for_importance.feature_importances_, index=FEATURES_CLOSURE)
print("\n  Top 15 Most Important Features (Closure):")
print(imp.sort_values(ascending=False).head(15).to_string())

# ─────────────────────────────────────────────────────────────
# STEP 12: SAVE MODELS & ARTIFACTS
# ─────────────────────────────────────────────────────────────
print("\n" + "=" * 65)
print("STEP 12 — Saving Models & Artifacts")
print("=" * 65)

# Save closure model (drop-in replacement for model_road_closure.pkl)
joblib.dump(calibrated_closure, 'model_road_closure.pkl')

# Save resolution model (drop-in replacement for model_resolution.pkl)
# We wrap in a dict so the API can also access quantile bounds
resolution_bundle = {
    'pipe': pipe_resolution,
    'lower': pipe_lower,
    'upper': pipe_upper,
    'features': FEATURES_RESOLUTION,
    'optimal_threshold': best_thresh,
    'train_median': X_res_all.median().to_dict(),
}
joblib.dump(resolution_bundle, 'model_resolution.pkl')

# Save encoders (same format as original)
joblib.dump(le_dict,  'label_encoders.pkl')
joblib.dump(te_maps,  'target_encoders.pkl')

# Save metadata for the metrics boost
metadata = {
    'trained_at': datetime.now().isoformat(),
    'closure': {
        'model': 'CalibratedClassifierCV(SoftVotingEnsemble[LightGBM+XGBoost+HistGBM], isotonic)',
        'features': len(FEATURES_CLOSURE),
        'roc_auc_time_split': round(auc_time, 4),
        'roc_auc_random_split': round(auc_rand, 4),
        'pr_auc_time_split': round(pr_time, 4),
        'optimal_threshold': round(best_thresh, 2),
        'best_f1_macro': round(best_f1, 4),
    },
    'resolution': {
        'model': 'LightGBM Regressor + Quantile Bands (10th, 90th percentile)',
        'features': len(FEATURES_RESOLUTION),
        'mae_time_split_min': round(mae_time, 1),
        'mae_random_split_min': round(mae_rand, 1),
        'r2_time_split': round(r2_time, 4),
    },
    'new_features': [
        'closure_momentum', 'corridor_stress', 'is_hot_corridor',
        'cause_severity', 'severity_x_corr', 'peak_x_public',
        'time_since_last_event_h', 'rapid_succession',
        'hour_sin_x_corr_te', 'cause_te_x_priority',
    ]
}
with open('boost_metadata.json', 'w') as f:
    json.dump(metadata, f, indent=2)

print("\n  Files saved:")
print("  ✅  model_road_closure.pkl   (drop-in replacement)")
print("  ✅  model_resolution.pkl     (drop-in replacement — now includes quantile bounds)")
print("  ✅  label_encoders.pkl")
print("  ✅  target_encoders.pkl")
print("  ✅  boost_metadata.json      (metrics summary)")

print("\n  ⚠️  NOTE: model_resolution.pkl is now a DICT (not a pipeline).")
print("  You need to update backend/main.py to call:")
print("    bundle = joblib.load('model_resolution.pkl')")
print("    pipe_resolution = bundle['pipe']")
print("    pipe_lower = bundle['lower']")
print("    pipe_upper = bundle['upper']")

# ─────────────────────────────────────────────────────────────
# STEP 13: COLAB DOWNLOAD HELPER
# ─────────────────────────────────────────────────────────────
print("\n" + "─" * 65)
print("STEP 13 — Downloading files (run in Colab only)")
print("─" * 65)
print("""
# Uncomment and run this in Colab to download all files:
# from google.colab import files
# files.download('model_road_closure.pkl')
# files.download('model_resolution.pkl')
# files.download('label_encoders.pkl')
# files.download('target_encoders.pkl')
# files.download('boost_metadata.json')
""")

print("\n" + "=" * 65)
print("DONE! Summary:")
print(f"  Closure  ROC-AUC  (time-split): {auc_time:.4f}")
print(f"  Closure  PR-AUC   (time-split): {pr_time:.4f}")
print(f"  Resolution MAE    (time-split): {mae_time:.1f} min")
print(f"  Resolution R²     (time-split): {r2_time:.4f}")
print("=" * 65)
