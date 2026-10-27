# Yield models (PLACEHOLDERS)

**The models in this folder were trained on SYNTHETIC data.** They exist so the
ONNX code path, the tests (`npm test`) and `npm run smoke` have real files to
load. They know nothing about this farm and must be replaced before
`PREDICTOR` is set to anything other than `ma`.

| File | What it is |
| --- | --- |
| `yield_nn.onnx` | scikit-learn MLP (32, 16) with input scaling |
| `yield_lr.onnx` | scikit-learn linear regression |
| `model_meta.json` | feature order, defaults for optional gaps, metrics, ablation, `data_source`, `best` |
| `sample_input.json` | a few inputs with the Python ONNX outputs, used to check Node gives the same answers |

The server reads `model_meta.json` for the feature order, so retrained models
with a different feature set (from the notebook's `USE_GROUPS` ablation) work
without code changes. It logs a warning whenever `data_source` is `synthetic`.

## Replacing them

1. `cd server && npm run export:training` (writes `recommender/data/milk_records.csv`).
2. Run `recommender/notebooks/DairyDan_yield_models.ipynb` in Colab with `DATA_CSV` set to that file.
3. Copy the four output files here, overwriting these.
4. Run `npm test` and `npm run smoke`, then set `PREDICTOR=auto` (or `lr` / `nn`) in `server/.env`.

The placeholders were produced by running
`recommender/notebooks/dairydan_yield_models.py` with `DATA_CSV` unset and
`OUT_DIR=server/ml/models`. The synthetic herd uses the cited breed figures
scaled to Kenyan smallholder levels (about 9.8 L/day on average); see
`recommender/SYNTHETIC_RETRAIN_RESULTS.md` for the metrics.
