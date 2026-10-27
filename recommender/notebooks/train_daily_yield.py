# %% [markdown]
# # DairyDan - daily yield models on the 1000-cow dataset
#
# Trains the same two model families the app uses (linear regression and a
# small neural net) on `cattle_milk_yield_1000.csv`, with the cited figures in
# `breed_yield_baselines.csv` as the breed baseline feature.
#
# That dataset has one row per cow and no milking history, so it cannot train
# the lag-based models in server/ml/models. These models predict L/day from a
# cow's profile instead, which is the job the app's breed-baseline tier does
# today. "Before" is that tier; "after" is the trained models, all scored on
# the same held-out cows.
#
# Run from the repo root:  python recommender/notebooks/train_daily_yield.py
# Writes recommender/results/daily_yield_metrics.json

# %%
import csv
import json
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import KFold, cross_val_score, train_test_split
from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

SEED = 42
ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'cattle_milk_yield_1000.csv'
BASELINES = ROOT / 'breed_yield_baselines.csv'
OUT = ROOT / 'recommender' / 'results' / 'daily_yield_metrics.json'
TARGET = 'Milk_Yield(L/day)'

# %% Load
df = pd.read_csv(DATA, encoding='utf-8')
df['Past_Diseases'] = df['Past_Diseases'].fillna('None')
# Some rows have unquoted commas in the trailing notes column, so only the
# leading breed and avg_daily_yield_l fields are read.
with BASELINES.open(encoding='utf-8', newline='') as f:
    rows = list(csv.reader(f))
col = rows[0].index('avg_daily_yield_l')
cited = pd.Series({r[0]: float(r[col]) for r in rows[1:] if r})

# Dataset breed -> row in breed_yield_baselines.csv. Gir has no row, so it gets
# the smallholder crossbred average, the CSV's own fallback for unlisted cattle.
FALLBACK = 'Smallholder mixed/crossbred (Kenya average)'
CITED_MAP = {'Holstein': 'Holstein-Friesian', 'Jersey': 'Jersey', 'Sahiwal': 'Sahiwal'}
df['breed_baseline'] = df['Breed'].map(lambda b: cited[CITED_MAP.get(b, FALLBACK)])

# What the app's breed_yield_baselines table holds today (placeholders), picked
# the way features.pickBaseline does: exact, longest partial match, then Other.
PLACEHOLDER = {'Holstein-Friesian': 18, 'Friesian': 18, 'Ayrshire': 14, 'Guernsey': 12,
               'Jersey': 11, 'Crossbreed': 10, 'Zebu': 3, 'Other': 10}
def pick_placeholder(breed):
    if breed in PLACEHOLDER:
        return PLACEHOLDER[breed]
    hits = [k for k in PLACEHOLDER if k.lower() in breed.lower() or breed.lower() in k.lower()]
    return PLACEHOLDER[max(hits, key=len)] if hits else PLACEHOLDER['Other']
df['placeholder_baseline'] = df['Breed'].map(pick_placeholder)

# %% Feature sets
# "app": only what DairyDan records or can derive (breed, D.O.B., parity,
# calving/conception dates, feed log, health records).
APP_NUM = ['breed_baseline', 'Age', 'Parity', 'Feed_Quantity(kg/day)']
APP_CAT = ['Lactation_Stage', 'Reproductive_Status', 'Health_Alerts', 'Past_Diseases']
# "all": every column in the dataset (needs sensors the app does not have).
ALL_CAT = APP_CAT + ['Breed', 'Feed_Type', 'Vaccination_Status', 'Season', 'Housing_Conditions']
ALL_NUM = [c for c in df.select_dtypes('number').columns
           if c not in (TARGET, 'placeholder_baseline')]
SETS = {'app': (APP_NUM, APP_CAT), 'all': (ALL_NUM, ALL_CAT)}

def pipeline(model, num, cat):
    prep = ColumnTransformer([
        ('num', StandardScaler(), num),
        ('cat', OneHotEncoder(handle_unknown='ignore'), cat),
    ])
    return Pipeline([('prep', prep), ('model', model)])

MODELS = {
    'lr': lambda: LinearRegression(),
    'nn': lambda: MLPRegressor(hidden_layer_sizes=(32, 16), max_iter=500,
                               early_stopping=True, random_state=SEED),
    # Not app models: a check for any non-linear signal the two above miss.
    'random_forest': lambda: RandomForestRegressor(n_estimators=300, min_samples_leaf=5, random_state=SEED),
    'gradient_boosting': lambda: GradientBoostingRegressor(random_state=SEED),
}

def scores(y, pred):
    return {
        'mae': float(mean_absolute_error(y, pred)),
        'rmse': float(np.sqrt(mean_squared_error(y, pred))),
        'mape': float(np.mean(np.abs((y - pred) / y)) * 100),
        'r2': float(1 - np.sum((y - pred) ** 2) / np.sum((y - np.mean(y)) ** 2)),
    }

# %% Split: 80% train / 20% held-out test, same cows for every method
train, test = train_test_split(df, test_size=0.2, random_state=SEED)
y_train, y_test = train[TARGET].to_numpy(), test[TARGET].to_numpy()

# %% Before: what the app predicts today for a cow with no history
before = {
    'breed_baseline_placeholder': scores(y_test, test['placeholder_baseline'].to_numpy()),
    'breed_baseline_cited': scores(y_test, test['breed_baseline'].to_numpy()),
    'training_mean': scores(y_test, np.full(len(y_test), y_train.mean())),
}

# %% After: trained models
after, cv = {}, {}
folds = KFold(n_splits=5, shuffle=True, random_state=SEED)
for set_name, (num, cat) in SETS.items():
    for name, make in MODELS.items():
        key = f'{name}[{set_name}]'
        model = pipeline(make(), num, cat).fit(train, y_train)
        after[key] = scores(y_test, model.predict(test))
        cv_mae = -cross_val_score(pipeline(make(), num, cat), df, df[TARGET],
                                  cv=folds, scoring='neg_mean_absolute_error')
        cv[key] = {'mae_mean': float(cv_mae.mean()), 'mae_std': float(cv_mae.std())}
cv['training_mean'] = {
    'mae_mean': float(-cross_val_score(DummyRegressor(), df[[TARGET]], df[TARGET], cv=folds,
                                       scoring='neg_mean_absolute_error').mean()),
    'mae_std': None,
}

# %% Is there any signal? Same LR on shuffled targets: if the real fit is no
# better than these, the features carry no information about yield.
rng = np.random.default_rng(SEED)
shuffled = []
for _ in range(20):
    m = pipeline(LinearRegression(), *SETS['all']).fit(train, rng.permutation(y_train))
    shuffled.append(mean_absolute_error(y_test, m.predict(test)))

correlations = (df.select_dtypes('number').corr()[TARGET].drop([TARGET, 'placeholder_baseline'])
                .sort_values(key=abs, ascending=False).round(3).to_dict())
by_breed = df.groupby('Breed')[TARGET].mean().round(2).to_dict()

result = {
    'trained_on': date.today().isoformat(),
    'dataset': {'file': DATA.name, 'rows': len(df), 'cows': int(df['Cow_ID'].nunique()),
                'train_rows': len(train), 'test_rows': len(test),
                'yield_mean': float(df[TARGET].mean()), 'yield_std': float(df[TARGET].std()),
                'yield_min': float(df[TARGET].min()), 'yield_max': float(df[TARGET].max())},
    'baselines_file': BASELINES.name,
    'before': before,
    'after': after,
    'cv_5fold': cv,
    'shuffled_target_lr_mae': {'mean': float(np.mean(shuffled)), 'min': float(np.min(shuffled))},
    'yield_by_breed': by_breed,
    'cited_baseline_by_breed': {b: float(cited[CITED_MAP.get(b, FALLBACK)]) for b in by_breed},
    'correlations_with_yield': correlations,
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(result, indent=2), encoding='utf-8')

# %% Report
print(f"{'method':32} {'MAE':>6} {'RMSE':>6} {'MAPE%':>6} {'R2':>7}")
for group in ('before', 'after'):
    for k, s in result[group].items():
        print(f"{group[0].upper()} {k:30} {s['mae']:6.2f} {s['rmse']:6.2f} {s['mape']:6.1f} {s['r2']:7.3f}")
print('shuffled-target LR MAE', result['shuffled_target_lr_mae'])
print('5-fold CV', json.dumps(cv, indent=1))
print('wrote', OUT)
