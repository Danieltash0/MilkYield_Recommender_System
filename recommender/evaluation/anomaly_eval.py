# Anomaly-detection evaluation for DairyDan's 80% rule (Chapter 5, Section 5.5.3).
#
# Rebuilds the synthetic herd, features, 70/30 chronological split and models
# exactly as recommender/notebooks/dairydan_yield_models.py does (seed 42,
# features base+age as deployed), then scores the "flag below 80% of expected"
# rule against (a) recorded illness days and (b) injected yield drops.
#
# Run from this folder:  python anomaly_eval.py
# Writes anomaly_results.json, by_session.json and three figures (fig_*.png).
import json, os
import numpy as np, pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
NOTEBOOK = os.path.join(HERE, '..', 'notebooks', 'dairydan_yield_models.py')
src = open(NOTEBOOK).read().split('# %% [markdown]\n# ## Export to ONNX')[0]
src = src.replace("USE_GROUPS = 'auto'", "USE_GROUPS = ['age']")
exec(src)
os.chdir(HERE)

LOW = 0.8
out = {'check_mae': {k: round(v['mae'], 4) for k, v in scores.items()}}

# Ground truth: sessions on days the cow was ill (generator cuts yield by 25%)
test = test.copy()
test['pred_ma'] = test['mean7']
test['pred_lr'] = lr_model.predict(test[FEATURES].to_numpy(np.float32))
test['pred_nn'] = nn_model.predict(test[FEATURES].to_numpy(np.float32))
y_true = test['health_active'].to_numpy() == 1

def prf(flag, truth):
    tp = int(np.sum(flag & truth)); fp = int(np.sum(flag & ~truth)); fn = int(np.sum(~flag & truth)); tn = int(np.sum(~flag & ~truth))
    p = tp / (tp + fp) if tp + fp else 0.0; r = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * p * r / (p + r) if p + r else 0.0
    return {'tp': tp, 'fp': fp, 'fn': fn, 'tn': tn, 'precision': round(p, 3), 'recall': round(r, 3), 'f1': round(f1, 3),
            'false_alarm_rate': round(fp / (fp + tn), 4) if fp + tn else 0.0}

# Episode-level: an illness episode is a run of consecutive sick days for one cow
def episodes(frame, flagcol):
    res = []
    for cow, g in frame.groupby('cow_id'):
        g = g.sort_values(['date', 'session_idx'])
        sick_dates = sorted(set(g.loc[g.health_active == 1, 'date']))
        if not sick_dates: continue
        runs, cur = [], [sick_dates[0]]
        for d in sick_dates[1:]:
            if (pd.Timestamp(d) - pd.Timestamp(cur[-1])).days == 1: cur.append(d)
            else: runs.append(cur); cur = [d]
        runs.append(cur)
        for run in runs:
            sess = g[g.date.isin(run)]
            flagged = sess[sess[flagcol]]
            if len(flagged):
                first = flagged.iloc[0]
                delay_days = (pd.Timestamp(first.date) - pd.Timestamp(run[0])).days
                res.append({'detected': True, 'delay_days': delay_days})
            else:
                res.append({'detected': False, 'delay_days': None})
    n = len(res); det = [r for r in res if r['detected']]
    delays = [r['delay_days'] for r in det]
    return {'episodes': n, 'detected': len(det), 'episode_recall': round(len(det) / n, 3) if n else None,
            'same_day_detection': sum(1 for d in delays if d == 0),
            'mean_delay_days': round(float(np.mean(delays)), 2) if delays else None}

out['test_sessions'] = int(len(test)); out['sick_sessions'] = int(y_true.sum())
out['natural'] = {}
for m in ('ma', 'lr', 'nn'):
    flag = (test['litres'] < LOW * test[f'pred_{m}']).to_numpy()
    test[f'flag_{m}'] = flag
    out['natural'][m] = {**prf(flag, y_true), **episodes(test, f'flag_{m}')}

# Threshold sensitivity for the MA path (the default predictor)
out['threshold_ma'] = {}
for thr in (0.75, 0.80, 0.85, 0.90):
    flag = (test['litres'] < thr * test['pred_ma']).to_numpy()
    out['threshold_ma'][thr] = prf(flag, y_true)
out['threshold_nn'] = {}
for thr in (0.75, 0.80, 0.85, 0.90):
    flag = (test['litres'] < thr * test['pred_nn']).to_numpy()
    out['threshold_nn'][thr] = prf(flag, y_true)

# Injected drops: on healthy test sessions (not sick, no illness in previous 7 days), cut
# yield of a random 5% of sessions by a fixed share; the cut sessions are the anomalies.
healthy = test[(test.health_active == 0) & (test.days_since_illness >= 7)].copy()
rng = np.random.default_rng(7)
out['injected'] = {}
for drop in (0.2, 0.3, 0.4):
    reps = []
    for rep in range(10):
        h = healthy.copy()
        mask = rng.random(len(h)) < 0.05
        h.loc[mask, 'litres'] = h.loc[mask, 'litres'] * (1 - drop)
        truth = mask
        row = {}
        for m in ('ma', 'lr', 'nn'):
            flag = (h['litres'] < LOW * h[f'pred_{m}']).to_numpy()
            row[m] = prf(flag, truth)
        reps.append(row)
    out['injected'][drop] = {m: {k: round(float(np.mean([r[m][k] for r in reps])), 3) for k in ('precision', 'recall', 'f1')} |
                                {'f1_sd': round(float(np.std([r[m]['f1'] for r in reps])), 3)} for m in ('ma', 'lr', 'nn')}
    out['injected'][drop]['anomalies_per_rep'] = int(round(len(healthy) * 0.05))
out['healthy_sessions'] = int(len(healthy))
json.dump(out, open('anomaly_results.json', 'w'), indent=1, default=str)
print(json.dumps(out, indent=1, default=str))

# Morning vs evening breakdown for the moving-average rule
t = test.copy(); t['ratio'] = t['litres'] / t['mean7']; t['flag'] = t['ratio'] < LOW
res = {}
for s, g in t.groupby('session_idx'):
    sick = g.health_active == 1; fl = g.flag
    res['morning' if s == 0 else 'evening'] = dict(
        sessions=len(g), sick=int(sick.sum()), tp=int((fl & sick).sum()), fp=int((fl & ~sick).sum()), fn=int((~fl & sick).sum()),
        median_ratio_healthy=round(float(g.loc[(~sick) & (g.days_since_illness >= 7), 'ratio'].median()), 3),
        median_ratio_sick=round(float(g.loc[sick, 'ratio'].median()), 3))
json.dump(res, open('by_session.json', 'w'), indent=1)
print(json.dumps(res, indent=1))

# Figures
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
d = json.load(open('anomaly_results.json'))
C = {'ma': '#2a78d6', 'lr': '#eb6834', 'nn': '#1baf7a'}
NAME = {'ma': '7-session moving average', 'lr': 'Linear regression', 'nn': 'Neural network'}
INK, MUTED, GRID = '#1f1f1e', '#6b6a63', '#e4e3de'
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 10, 'axes.edgecolor': MUTED, 'axes.labelcolor': INK,
                     'xtick.color': MUTED, 'ytick.color': MUTED, 'axes.spines.top': False, 'axes.spines.right': False})

# Figure A: F1 by scenario
groups = ['Recorded illness\n(about 25% drop)', 'Injected 20% drop', 'Injected 30% drop', 'Injected 40% drop']
vals = {m: [d['natural'][m]['f1']] + [d['injected'][k][m]['f1'] for k in ('0.2', '0.3', '0.4')] for m in C}
fig, ax = plt.subplots(figsize=(7.2, 3.8), dpi=200)
x = np.arange(len(groups)); w = 0.26
for i, m in enumerate(C):
    bars = ax.bar(x + (i - 1) * w, vals[m], w - 0.02, color=C[m], label=NAME[m], zorder=3)
    for b, v in zip(bars, vals[m]):
        ax.text(b.get_x() + b.get_width() / 2, v + 0.015, f'{v:.2f}', ha='center', va='bottom', fontsize=7.5, color=INK)
ax.axhline(0.75, color=INK, lw=1, ls=(0, (4, 3)), zorder=4)
ax.text(-0.45, 0.765, 'Acceptance threshold F1 = 0.75', ha='left', va='bottom', fontsize=8, color=INK)
ax.set_xticks(x); ax.set_xticklabels(groups, fontsize=8.5); ax.set_ylim(0, 1.08); ax.set_ylabel('F1-score (session level)')
ax.yaxis.grid(True, color=GRID, lw=0.8, zorder=0); ax.set_axisbelow(True)
ax.legend(frameon=False, fontsize=8, loc='upper left', ncol=3, bbox_to_anchor=(0, 1.12))
fig.tight_layout(); fig.savefig('fig_f1.png'); plt.close(fig)

# Figure B: MA threshold sensitivity
thr = ['0.75', '0.8', '0.85', '0.9']
fig, ax = plt.subplots(figsize=(6.4, 3.4), dpi=200)
xs = [75, 80, 85, 90]
for key, lab, col, mk in (('precision', 'Precision', '#2a78d6', 'o'), ('recall', 'Recall', '#eb6834', 's'), ('f1', 'F1-score', '#1f1f1e', '^')):
    ys = [d['threshold_ma'][t][key] for t in thr]
    ax.plot(xs, ys, color=col, lw=2, marker=mk, ms=6, label=lab, zorder=3)
    ax.text(xs[-1] + 0.6, ys[-1], lab, va='center', fontsize=8, color=INK)
ax.axvline(80, color=MUTED, lw=1, ls=(0, (3, 3))); ax.text(80.3, 0.62, 'Implemented\nthreshold (80%)', fontsize=7.5, color=MUTED, va='top')
ax.set_xticks(xs); ax.set_xticklabels([f'{v}%' for v in xs]); ax.set_xlim(73, 94); ax.set_ylim(0, 0.65)
ax.set_xlabel('Flag a reading when it falls below this share of the moving average'); ax.set_ylabel('Score')
ax.yaxis.grid(True, color=GRID, lw=0.8, zorder=0)
ax.legend(frameon=False, fontsize=8, loc='upper left', ncol=3, bbox_to_anchor=(0, 1.12))
fig.tight_layout(); fig.savefig('fig_threshold.png'); plt.close(fig)

# Figure C: one cow through an illness episode (test split), MA path
t = test.copy(); t['flag'] = t['litres'] < 0.8 * t['mean7']
cand = []
for cow, g in t.groupby('cow_id'):
    if g.health_active.sum() >= 8: cand.append((cow, g))
cow, g = [c for c in cand if c[0] == 12][0]
g = g.sort_values(['date', 'session_idx']).reset_index(drop=True)
sick = g.index[g.health_active == 1]
lo, hi = max(0, sick.min() - 22), min(len(g), sick.max() + 24)
g = g.iloc[lo:hi].reset_index(drop=True)
fig, ax = plt.subplots(figsize=(7.2, 3.4), dpi=200)
idx = np.arange(len(g))
sk = g.index[g.health_active == 1]
ax.axvspan(sk.min() - 0.5, sk.max() + 0.5, color='#ecebe6', zorder=0)
ax.text((sk.min() + sk.max()) / 2, g.litres.max() * 1.07, 'Illness episode', ha='center', fontsize=8, color=MUTED)
ax.fill_between(idx, 0.8 * g.mean7, 1.2 * g.mean7, color='#2a78d6', alpha=0.12, lw=0, label='Normal range (80–120%)')
ax.plot(idx, g.mean7, color='#2a78d6', lw=2, label='Expected (7-session average)')
ax.plot(idx, g.litres, color='#1f1f1e', lw=1.2, marker='o', ms=3, label='Recorded yield')
f = g[g.flag]
ax.scatter(f.index, f.litres, s=55, facecolor='#d03b3b', edgecolor='white', lw=1.5, zorder=5, label='Flagged low')
ax.set_xlabel('Milking session (two per day)'); ax.set_ylabel('Litres per session')
ax.set_ylim(0, g.litres.max() * 1.15); ax.yaxis.grid(True, color=GRID, lw=0.8, zorder=0); ax.set_axisbelow(True)
ax.legend(frameon=False, fontsize=7.5, loc='upper left', ncol=4, bbox_to_anchor=(0, 1.13))
fig.tight_layout(); fig.savefig('fig_episode.png'); plt.close(fig)
ep = g[g.health_active == 1]
print('cow', cow, 'sick sessions', len(ep), 'flagged in episode', int(ep.flag.sum()), 'first flagged pos', list(ep.index[ep.flag])[:5], 'episode start', ep.index.min())
print('breed baseline', g.breed_baseline.iloc[0])
