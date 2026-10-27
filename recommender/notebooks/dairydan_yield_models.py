# %% [markdown]
# # DairyDan milk yield models
#
# Trains the models behind DairyDan's yield recommender and exports them as ONNX
# for `server/ml/models/`. Same code as `DairyDan_yield_models.ipynb` (Colab).
#
# 1. Export farm data from the app: `cd server && npm run export:training`
#    (writes `recommender/data/milk_records.csv`).
# 2. Upload that CSV to Colab and set `DATA_CSV` below. Leave it as `None` to
#    run on SYNTHETIC data, which is only good for testing the pipeline.
# 3. Run everything, download `yield_nn.onnx`, `yield_lr.onnx`,
#    `model_meta.json` and `sample_input.json`, and copy them into
#    `server/ml/models/`. Then set `PREDICTOR=auto` (or `lr` / `nn`) in `server/.env`.
#
# Each row is one milking session. The lag features are the cow's previous 7
# sessions, oldest to newest, exactly as `server/services/features.js` builds
# them for the live API.
#
# In Colab, install the export tools first:
# `%pip install -q skl2onnx onnx onnxruntime`

# %%
import json
import os
from datetime import date, timedelta

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

# Path to milk_records.csv from `npm run export:training`, or None for synthetic data
DATA_CSV = os.environ.get('DATA_CSV') or None
# Where the model files are written
OUT_DIR = os.environ.get('OUT_DIR', 'models_out')
# Feature groups on top of the base features: 'auto' keeps only the groups that
# lowered the neural network's MAE in the ablation; or list them, e.g. ['feed', 'health']
USE_GROUPS = 'auto'

WINDOW = 7
TRAIN_SHARE = 0.7
MILKINGS_PER_DAY = 2
SEED = 42

LAGS = [f'lag{k}' for k in range(1, WINDOW + 1)]
BASE = LAGS + ['mean7', 'days_in_milk', 'parity', 'breed_baseline']
GROUPS = {
    'age': ['age_months'],
    'pregnancy': ['days_pregnant'],
    'feed': ['concentrate_kg'],
    'prev_lactation': ['prev_lactation_l'],
    'health': ['health_active', 'days_since_illness'],
}
CSV_COLUMNS = ['cow_id', 'date', 'session_idx', 'litres', 'parity', 'days_in_milk', 'breed_baseline', 'age_months',
               'days_pregnant', 'concentrate_kg', 'prev_lactation_l', 'health_active', 'days_since_illness']

# %% [markdown]
# ## Data
#
# The synthetic herd follows a Wood lactation curve with breed, parity, feed,
# pregnancy and illness effects plus noise. It exists so the pipeline can be
# run end to end before there is enough farm data; models trained on it must
# not be used for real decisions.
#
# Breed figures are the cited averages from `breed_yield_baselines.csv`
# (L/day). The FarmKenya figures for exotic breeds describe well-managed
# zero-grazing farms, so they are scaled down to what Kenyan smallholders get;
# field-measured figures (ILRI, Cambridge, USDA GAIN) are used as they are.
# The farm-level result is what the `breed_yield_baselines` table holds and
# what the app sends as the `breed_baseline` feature.

# %%
# breed: (cited avg L/day, share of it reached on a Kenyan smallholder farm, share of herd)
BREEDS = {
    # FarmKenya / Standard Media (2020), well-managed zero-grazing
    'Holstein-Friesian': (45.0, 0.35, 0.20),
    'Ayrshire':          (30.0, 0.35, 0.12),
    'Guernsey':          (25.0, 0.35, 0.04),
    'Jersey':            (20.0, 0.35, 0.06),
    # FarmKenya 10 L/day; ILRI AGTR commercial herds average ~5.4 L/day
    'Sahiwal':           (10.0, 0.55, 0.06),
    # Field figures: ILRI AGTR (Boran), Cambridge AGR 2011 (Zebu), USDA GAIN 2024 (crossbred)
    'Boran':             (4.5, 1.0, 0.03),
    'Zebu':              (1.6, 1.0, 0.04),
    'Crossbreed':        (8.0, 1.0, 0.45),
}
FARM_LEVEL = {b: round(avg * share, 2) for b, (avg, share, _) in BREEDS.items()}
HERD_MIX = np.array([mix for _, _, mix in BREEDS.values()])
# Kenyan smallholder average daily yield: 7.6 L (USDA GAIN 2024) to 10.7 L (Nyeri County, Ajak et al. 2020)
KENYA_RANGE = (7.6, 10.7)


def synthetic_herd(n_cows=60, days=240, seed=SEED):
    rng = np.random.default_rng(seed)
    start = date(2025, 1, 1)
    t = np.arange(1, 306)
    wood = t ** 0.2 * np.exp(-0.004 * t)
    wood = wood / wood.mean()
    rows = []
    for cow in range(1, n_cows + 1):
        breed = rng.choice(list(BREEDS), p=HERD_MIX / HERD_MIX.sum())
        daily_base = FARM_LEVEL[breed]
        # Smallholder herds vary widely (Nyeri: 10.7 +/- 5.85 L/day)
        ability = max(0.5, rng.normal(1.0, 0.2))
        parity = int(rng.integers(1, 7))
        parity_factor = {1: 0.8, 2: 0.93}.get(parity, 1.0)
        age0 = 24 + (parity - 1) * 13 + int(rng.integers(0, 7))
        dim0 = int(rng.integers(5, 60))
        prev_l = 305 * daily_base * ability * rng.normal(0.9, 0.08) if parity > 1 else np.nan
        conceive_dim = int(rng.integers(80, 150)) if rng.random() < 0.7 else None
        # Smallholders feed little dairy meal; zero-grazing farms more
        conc_base = rng.uniform(0.5, 4.0)
        sick_days = set()
        for _ in range(rng.poisson(1.2)):
            onset = int(rng.integers(0, days))
            sick_days.update(range(onset, onset + int(rng.integers(3, 8))))
        last_sick = None
        for d in range(days):
            dim = dim0 + d
            if dim >= 305:
                break
            day = start + timedelta(days=d)
            age = age0 + (dim0 + d) // 30
            pregnant = max(0, dim - conceive_dim) if conceive_dim is not None else 0
            conc = max(0.0, conc_base + rng.normal(0, 0.5))
            sick = d in sick_days
            if sick:
                last_sick = d
            since = 30 if last_sick is None else min(30, d - last_sick)
            daily = daily_base * ability * parity_factor * wood[dim - 1]
            daily *= 1 - 0.002 * max(0, pregnant - 120)
            # About 5% more milk per kg of concentrate above 2 kg
            daily *= 1 + 0.05 * (conc - 2.0)
            daily *= 1 - 0.002 * max(0, age - 90)
            if sick:
                daily *= 0.75
            elif since < 7:
                daily *= 0.9
            for session_idx, share in ((0, 0.55), (2, 0.45)):
                litres = max(0.2, daily * share * rng.normal(1.0, 0.06))
                rows.append({
                    'cow_id': cow, 'date': day.isoformat(), 'session_idx': session_idx, 'litres': round(litres, 2),
                    'parity': parity, 'days_in_milk': dim, 'breed_baseline': daily_base / MILKINGS_PER_DAY,
                    'age_months': age if rng.random() > 0.05 else np.nan,
                    'days_pregnant': pregnant,
                    'concentrate_kg': round(conc, 2) if rng.random() > 0.1 else np.nan,
                    'prev_lactation_l': prev_l,
                    'health_active': 1 if sick else 0,
                    'days_since_illness': since,
                })
    return pd.DataFrame(rows, columns=CSV_COLUMNS)


if DATA_CSV:
    raw = pd.read_csv(DATA_CSV)
    data_source = 'farm'
else:
    raw = synthetic_herd()
    data_source = 'synthetic'
    print('WARNING: training on SYNTHETIC data. These models only test the pipeline; '
          'retrain on exported farm data before using them.')

print(f'{len(raw)} sessions from {raw.cow_id.nunique()} cows ({data_source})')
herd_daily = raw.groupby(['cow_id', 'date']).litres.sum().mean()
print(f'herd average {herd_daily:.2f} L/day')
if data_source == 'synthetic':
    assert KENYA_RANGE[0] <= herd_daily <= KENYA_RANGE[1], \
        f'synthetic herd averages {herd_daily:.2f} L/day, outside the Kenyan range {KENYA_RANGE}'

# %% [markdown]
# ## Features and chronological split
#
# Lags come from the cow's own earlier sessions in (date, session) order. The
# first 70% of each cow's sessions train the models and the last 30% test them,
# so no model is scored on sessions older than the ones it learned from.

# %%
df = raw.sort_values(['cow_id', 'date', 'session_idx']).reset_index(drop=True)
by_cow = df.groupby('cow_id')['litres']
for k in range(1, WINDOW + 1):
    # lag1 = the session just before, lag7 = seven sessions back
    df[f'lag{k}'] = by_cow.shift(k)
df['mean7'] = df[LAGS].mean(axis=1)

# Base features must be known; optional gaps are filled below
df = df.dropna(subset=LAGS + ['days_in_milk', 'parity', 'breed_baseline']).reset_index(drop=True)
df['pos'] = df.groupby('cow_id').cumcount()
df['n'] = df.groupby('cow_id')['cow_id'].transform('size')
is_train = df['pos'] < np.floor(df['n'] * TRAIN_SHARE)
train, test = df[is_train].copy(), df[~is_train].copy()

# Defaults for optional features, learned from the training split only and
# saved in model_meta.json so the server fills gaps the same way
defaults = {
    'days_pregnant': 0.0,
    'health_active': 0.0,
    'days_since_illness': 30.0,
    'age_months': float(train['age_months'].median()),
    'concentrate_kg': float(train['concentrate_kg'].median()),
    'prev_lactation_l': float(train['prev_lactation_l'].median()),
}
defaults = {k: (v if np.isfinite(v) else 0.0) for k, v in defaults.items()}
for frame in (train, test):
    frame.fillna(value=defaults, inplace=True)

print(f'train {len(train)} rows, test {len(test)} rows')

# %% [markdown]
# ## Moving average vs linear regression vs neural network

# %%
def metrics(y, pred):
    err = pred - y
    return {
        'mae': float(np.mean(np.abs(err))),
        'rmse': float(np.sqrt(np.mean(err ** 2))),
        'mape': float(np.mean(np.abs(err) / np.maximum(y, 1e-6)) * 100),
    }


def make_lr():
    return LinearRegression()


def make_nn():
    return Pipeline([
        ('scale', StandardScaler()),
        ('mlp', MLPRegressor(hidden_layer_sizes=(32, 16), max_iter=500, early_stopping=True, random_state=SEED)),
    ])


def fit_score(make, features):
    model = make().fit(train[features].to_numpy(np.float32), train['litres'].to_numpy())
    return model, metrics(test['litres'].to_numpy(), model.predict(test[features].to_numpy(np.float32)))


y_test = test['litres'].to_numpy()
ma_scores = metrics(y_test, test['mean7'].to_numpy())
print('moving average   ', {k: round(v, 3) for k, v in ma_scores.items()})

# %% [markdown]
# ## Ablation
#
# Start from the base features (7 lags, mean7, days in milk, parity, breed
# baseline) and add one group at a time, then all of them. A group earns its
# place only if it lowers the neural network's MAE on the test split.

# %%
ablation = {}
configs = {'base': BASE, **{f'base+{g}': BASE + cols for g, cols in GROUPS.items()},
           'all': BASE + [c for cols in GROUPS.values() for c in cols]}
for label, features in configs.items():
    _, lr_s = fit_score(make_lr, features)
    _, nn_s = fit_score(make_nn, features)
    ablation[label] = {'lr_mae': lr_s['mae'], 'nn_mae': nn_s['mae'], 'features': len(features)}
    print(f'{label:22s} features={len(features):2d}  LR MAE={lr_s["mae"]:.3f}  NN MAE={nn_s["mae"]:.3f}')

helpful = [g for g in GROUPS if ablation[f'base+{g}']['nn_mae'] < ablation['base']['nn_mae']]
groups = helpful if USE_GROUPS == 'auto' else list(USE_GROUPS)
FEATURES = BASE + [c for g in GROUPS if g in groups for c in GROUPS[g]]
print(f'groups kept: {groups or "none"} -> {len(FEATURES)} features')

# %% [markdown]
# ## Final models

# %%
lr_model, lr_scores = fit_score(make_lr, FEATURES)
nn_model, nn_scores = fit_score(make_nn, FEATURES)
scores = {'ma': ma_scores, 'lr': lr_scores, 'nn': nn_scores}
best = min(scores, key=lambda k: scores[k]['mae'])
for name, s in scores.items():
    print(f'{name:3s} MAE={s["mae"]:.3f} L  RMSE={s["rmse"]:.3f} L  MAPE={s["mape"]:.1f}%')
print(f'best by MAE: {best}')

# %% [markdown]
# ## Export to ONNX
#
# The input is named `input` (float32, shape [batch, features]). Every export
# is checked against scikit-learn before it is written.

# %%
import onnxruntime as ort
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

os.makedirs(OUT_DIR, exist_ok=True)
X_check = test[FEATURES].to_numpy(np.float32)[:500]


def export(model, filename):
    onx = convert_sklearn(model, initial_types=[('input', FloatTensorType([None, len(FEATURES)]))],
                          target_opset={'': 17, 'ai.onnx.ml': 3})
    path = os.path.join(OUT_DIR, filename)
    with open(path, 'wb') as f:
        f.write(onx.SerializeToString())
    sess = ort.InferenceSession(path, providers=['CPUExecutionProvider'])
    onnx_pred = sess.run(None, {'input': X_check})[0].ravel()
    diff = np.max(np.abs(onnx_pred - model.predict(X_check)))
    assert diff < 1e-3, f'{filename}: ONNX differs from scikit-learn by {diff}'
    print(f'{filename}: ONNX matches scikit-learn (max diff {diff:.2e})')
    return sess


nn_sess = export(nn_model, 'yield_nn.onnx')
lr_sess = export(lr_model, 'yield_lr.onnx')

meta = {
    'features': FEATURES,
    'defaults': {k: v for k, v in defaults.items() if k in FEATURES},
    'data_source': data_source,
    'window': WINDOW,
    'milkings_per_day': MILKINGS_PER_DAY,
    'groups': groups,
    'rows': {'train': int(len(train)), 'test': int(len(test)), 'cows': int(df.cow_id.nunique())},
    'metrics': scores,
    'ablation': ablation,
    'best': best,
    'trained_on': date.today().isoformat(),
}
with open(os.path.join(OUT_DIR, 'model_meta.json'), 'w') as f:
    json.dump(meta, f, indent=2)

# A few test rows with the ONNX outputs, so the server can check it gets the same answers
cases = []
for row in X_check[:5]:
    x = row.reshape(1, -1)
    cases.append({
        'input': [float(v) for v in row],
        'nn': float(nn_sess.run(None, {'input': x})[0].ravel()[0]),
        'lr': float(lr_sess.run(None, {'input': x})[0].ravel()[0]),
    })
with open(os.path.join(OUT_DIR, 'sample_input.json'), 'w') as f:
    json.dump({'features': FEATURES, 'cases': cases}, f, indent=2)

print(f'Wrote yield_nn.onnx, yield_lr.onnx, model_meta.json and sample_input.json to {OUT_DIR}/')
if data_source == 'synthetic':
    print('WARNING: data_source is "synthetic". Do not use these models for real decisions.')
