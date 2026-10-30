# Anomaly-detection evaluation

Scores the recommender's "flag below 80% of expected" rule on the synthetic
herd's chronological test split (Chapter 5, Section 5.5.3).

```
pip install numpy pandas scikit-learn matplotlib
python anomaly_eval.py
```

It rebuilds the herd, features, split and models from
`../notebooks/dairydan_yield_models.py` (seed 42, deployed features), then writes:

| File | Contents |
|---|---|
| `anomaly_results.json` | Precision, recall, F1 and episode detection against recorded illness; threshold sensitivity; injected 20/30/40% drops (10 runs each) |
| `by_session.json` | Morning vs evening breakdown for the moving average |
| `fig_f1.png`, `fig_episode.png`, `fig_threshold.png` | Figures 5.4–5.6 |

Results were produced with scikit-learn 1.9.1; the neural network's MAE differs
from `model_meta.json` in the third decimal place because of the library version.
