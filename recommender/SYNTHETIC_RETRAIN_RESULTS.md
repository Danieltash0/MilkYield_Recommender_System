# Retraining on a Kenyan-level synthetic herd

Retrained on 2026-10-27 with `recommender/notebooks/dairydan_yield_models.py`, with `DATA_CSV` unset and `OUT_DIR=server/ml/models`. The new files replaced the previous synthetic models in `server/ml/models/`.

Both runs used **synthetic data**, so these models still aren't suitable for real decisions. The app defaults to `PREDICTOR=ma` until they're retrained on exported farm records.

## What changed in the generator

| | Before | After |
|---|---|---|
| Breed figures | Placeholders: Holstein-Friesian 18, Ayrshire 14, Guernsey 12, Jersey 11, Crossbreed 10 L/day | Cited figures from `breed_yield_baselines.csv`, scaled to Kenyan farm levels (below) |
| Breeds | 5 breeds, equally likely | 8 breeds in a Kenyan-style mix: 45% crossbred, 20% Holstein-Friesian, 12% Ayrshire, and small shares of Jersey, Guernsey, Sahiwal, Boran and Zebu |
| Variation between cows | ±12% | ±20%, reflecting Nyeri's 10.7 ± 5.85 L/day |
| Concentrate | 2–7 kg/day; +0.35 L per kg above 4 kg | 0.5–4 kg/day; +5% milk per kg above 2 kg |
| Realism check | none | Training stops if the herd average falls outside 7.6–10.7 L/day (USDA GAIN 2024 to Nyeri County, Ajak et al. 2020) |

### Breed figures

The FarmKenya averages describe well-managed zero-grazing farms, so the exotic breeds are scaled to 35% of them. Sahiwal is scaled to 55%, which matches ILRI's ~5.4 L/day for commercial herds. Figures that were measured in the field are used unchanged.

| Breed | Cited (L/day) | Share used | Farm level (L/day) | Generated herd: average (10th–90th percentile) |
|---|---:|---:|---:|---|
| Holstein-Friesian | 45 | 0.35 | 15.75 | 16.1 (8.6–22.4) |
| Ayrshire | 30 | 0.35 | 10.50 | 9.7 (5.7–13.4) |
| Guernsey | 25 | 0.35 | 8.75 | 9.8 (6.3–13.7) |
| Jersey | 20 | 0.35 | 7.00 | 8.5 (6.1–10.8) |
| Sahiwal | 10 | 0.55 | 5.50 | 5.4 (3.7–7.1) |
| Boran | 4.5 | 1.0 | 4.50 | 3.9 (3.0–4.8) |
| East African Zebu | 1.6 | 1.0 | 1.60 | 1.0 (0.7–1.2) |
| Smallholder crossbred | 8 | 1.0 | 8.00 | 7.7 (5.0–10.5) |
| **Whole herd** | | | | **9.79 L/day**, inside the Kenyan range of 7.6–10.7 |

The herd has 60 cows, so the rarer breeds are represented by only 1–4 cows each.

## Metrics before and after

Both runs used 60 cows, a chronological 70/30 split (19,860 training sessions and 8,520 test sessions) and the same model settings. Errors are per milking session.

| Model | MAE before | MAE after | RMSE before | RMSE after | MAPE before | MAPE after |
|---|---:|---:|---:|---:|---:|---:|
| 7-session moving average | 0.621 L | 0.458 L | 0.734 L | 0.586 L | 12.2% | 12.3% |
| Linear regression | 0.312 L | 0.247 L | 0.405 L | 0.350 L | 6.1% | 6.7% |
| Neural net | 0.338 L | **0.240 L** | 0.436 L | **0.337 L** | 6.9% | **6.6%** |
| Best model | linear regression | **neural net** | | | | |

**How to read the changes:**
- **Errors in litres fell for every model**, by 21–29% in MAE. This is mostly because the new herd gives less milk (about 9.8 L/day instead of the higher placeholder levels), so the same relative error is fewer litres.
- **MAPE is the fairer comparison** because it's relative. On MAPE the neural net improved slightly (6.9% → 6.6%) and linear regression got slightly worse (6.1% → 6.7%). Both still roughly halve the moving average's 12.3% error.
- **The neural net now beats linear regression**, so `PREDICTOR=auto` uses the neural net. The larger differences between cows (Zebu at 1 L/day up to Friesians above 20) are less linear, which favours the neural net.

## Features kept

The notebook keeps an optional feature group only if it lowers the neural net's error. It tests each group on the training data (an ablation) and chooses automatically (`USE_GROUPS='auto'`).

| Variant | LR MAE before | NN MAE before | LR MAE after | NN MAE after |
|---|---:|---:|---:|---:|
| base (lags, days in milk, parity, breed baseline) | 0.316 | 0.382 | 0.247 | 0.243 |
| base + age | 0.316 | 0.322 | 0.247 | **0.240** |
| base + pregnancy | 0.316 | 0.337 | 0.247 | 0.276 |
| base + feed | 0.315 | 0.299 | 0.248 | 0.253 |
| base + previous lactation | 0.317 | 0.316 | 0.246 | 0.253 |
| base + health | 0.315 | 0.353 | 0.246 | 0.249 |
| all groups | 0.312 | 0.338 | 0.248 | 0.255 |
| **Features kept** | **all 17** | | **12 (base + age)** | |

- The feed effect is smaller now (the herd gets 0.5–4 kg of concentrate a day), and the neural net no longer gains from it. Only age helped, so the new models take 12 inputs instead of 17.
- The server reads the feature list from `model_meta.json`, so no code change was needed.

## Changes to the app

- **Breed baselines in the database:** `db/migrations/2026-10-27_yield_factors_kenya_baselines.sql` sets `breed_yield_baselines` to the farm-level figures above and adds Sahiwal and Boran. `Crossbreed` and `Other` get the smallholder average of 8 L/day.
  - It only changes rows still marked as placeholders, so a hand-edited figure is kept. This was tested on a throwaway database.
  - `schema.sql` and `seed.sql` now hold the same figures for fresh installs.
  - The update matters because the app sends the breed baseline as a model input; it must match the figures the models were trained with. It also changes the breed-baseline fallback for cows with fewer than 3 records.
- **Model files:** `server/ml/models/` has new `yield_nn.onnx`, `yield_lr.onnx`, `model_meta.json` (`best: nn`) and `sample_input.json`.
- **Colab notebook:** `DairyDan_yield_models.ipynb` was regenerated from the `.py`.

## Verification

- **Export check:** both ONNX files give the same answers as scikit-learn, to within 2e-6.
- **Automated tests:** `npm test` passed 116/116, and `npm run smoke` passed, including Node matching Python on the sample inputs.
- **Database:**
  - The migration ran on the dev database; running it again did nothing.
  - `db:seed` re-ran cleanly.
  - Separately, `schema.sql`, `seed.sql` (twice) and all migrations loaded cleanly into a throwaway database.
- **Live API (`PREDICTOR=auto`):** `POST /api/milking` used `neural_net` (`modelSource: synthetic`):
  - Bessie at 6.5 L, against an expected 11.44 L, came back **low**.
  - Daisy at 9 L, against an expected 8.03 L, came back **normal**.
  - Rosie at 10 L, against an expected 8.73 L, came back **normal**.
  - The test records were deleted afterwards.

## Caveat: the seeded milking records are above Kenyan levels

The demo milking records in `seed.sql` put Bessie (Holstein-Friesian) at about 13 L per session, roughly 26 L/day. That's above most of the synthetic herd, so the model predicts a little under her own history: 11.4 L against her ~13 L average. Real records exported from the farm and retrained with `DATA_CSV` remove this mismatch.
