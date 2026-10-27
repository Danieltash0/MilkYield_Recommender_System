# Training results

Last updated 2026-10-28. This file covers three pieces of work on the milk yield recommender:

1. **Training on the 1000-cow dataset** (`cattle_milk_yield_1000.csv`). The models learned nothing usable, so they weren't deployed.
2. **Retraining the app's models on a Kenyan-level synthetic herd** built from the cited breed figures. These are the models now in `server/ml/models/`.
3. **A knowledge graph for cold start**: the estimate for cows with fewer than 3 milking records.

The end of the file explains how to run the models in the app.

## How the app predicts yield

For every milking record saved, the recommender works out what the cow was expected to give, then flags the reading if it's below 80% or above 120% of that. It picks the first method that has what it needs:

| Milking records for the cow | Method |
|---|---|
| 7 or more, with `PREDICTOR` set to `auto`, `nn` or `lr` | Neural net or linear regression (ONNX) |
| 3 or more | Average of the last 7 sessions |
| 0–2, when at least one factor applies | Knowledge graph: breed baseline × the factors the cow meets |
| 0–2, when no factor applies | Breed baseline |

Alerts aren't raised when recent illness, treatment or calving explains the reading.

---

## 1. The 1000-cow dataset (not deployed)

Script: `recommender/notebooks/train_daily_yield.py`. Raw numbers: `recommender/results/daily_yield_metrics.json`.

### Summary

- The trained models beat the old placeholder breed baseline by about 17% (**MAE 4.61 → 3.76–3.84 L/day**). That's only because they predict close to the herd average: a model that always predicts the mean scores 3.84, and every trained model has R² ≈ 0.
- Yield in this dataset doesn't depend on any recorded column, so no model can learn from it. This is typical of generated practice datasets.
- These models weren't deployed. The dataset also can't train the app's models, which need each cow's last 7 milkings; it has one row per cow and no history.

### Data

| File | Contents |
|---|---|
| `cattle_milk_yield_1000.csv` | 1000 cows, one row each, 24 attributes plus `Milk_Yield(L/day)` |
| `breed_yield_baselines.csv` | Cited average daily yield per breed |

- **Yield:** mean 12.41 L/day, sd 4.42, range 5.0–20.0.
- **Split:** 800 training cows and 200 held-out test cows, plus 5-fold cross-validation.
- **Breed mapping to the cited baselines:**
  - Holstein → Holstein-Friesian (45)
  - Jersey → Jersey (20)
  - Sahiwal → Sahiwal (10)
  - Gir has no row, so it uses the CSV's crossbred fallback (8).
- **What was trained:** the same two model types as the app (linear regression and a 32-16 neural net), predicting daily yield from a cow's profile.

### Results (held-out test set, 200 cows, L/day)

"Before" is what the app could predict with no history:

| Method | MAE | RMSE | MAPE | R² |
|---|---:|---:|---:|---:|
| Breed baseline, old placeholder table | 4.61 | 5.51 | 43.8% | −0.531 |
| Breed baseline, cited figures unscaled | 11.23 | 16.10 | 110.3% | −12.082 |
| Always predict the training mean | 3.84 | 4.45 | 39.6% | 0.000 |

"After" is the trained models. **App features** are the ones DairyDan records: breed baseline, age, parity, feed quantity, lactation stage, reproductive status, health alert and past disease. **All features** adds every other column, including sensor readings the app doesn't collect.

| Model | Features | MAE | RMSE | MAPE | R² | 5-fold CV MAE |
|---|---|---:|---:|---:|---:|---:|
| Linear regression | app | 3.84 | 4.44 | 39.6% | 0.004 | 3.85 ± 0.17 |
| Neural net (32-16) | app | 3.97 | 4.66 | 40.9% | −0.098 | 3.87 ± 0.18 |
| Random forest* | app | 3.81 | 4.48 | 39.5% | −0.015 | 3.87 ± 0.17 |
| Gradient boosting* | app | 3.90 | 4.58 | 40.2% | −0.061 | 3.97 ± 0.15 |
| Linear regression | all | 3.81 | 4.43 | 39.3% | 0.011 | 3.85 ± 0.20 |
| Neural net (32-16) | all | 3.83 | 4.50 | 39.4% | −0.024 | 3.94 ± 0.14 |
| Random forest* | all | **3.76** | **4.39** | **39.0%** | 0.028 | 3.83 ± 0.21 |
| Gradient boosting* | all | 3.78 | 4.44 | 39.7% | 0.005 | 3.87 ± 0.24 |

\* Not used in the app. They were added only to check for non-linear patterns.

| Comparison | MAE | RMSE | MAPE |
|---|---|---|---|
| Placeholder baseline → linear regression (app features) | 4.61 → 3.84 (−17%) | 5.51 → 4.44 (−19%) | 43.8% → 39.6% |
| Placeholder baseline → best model | 4.61 → 3.76 (−18%) | 5.51 → 4.39 (−20%) | 43.8% → 39.0% |
| Training mean → best model | 3.84 → 3.76 (−2%) | 4.45 → 4.39 (−1%) | 39.6% → 39.0% |

### Why the improvement isn't real

1. **Variance explained:** R² is between −0.10 and 0.03 for every model, so they explain almost none of the differences between cows.
2. **Cross-validation:** every model lands within one standard deviation of the mean-only predictor.
3. **Shuffled-yield test:** linear regression retrained 20 times on randomly shuffled yields scored a mean MAE of 3.89 and a best of 3.76. That equals the best real model.
4. **Raw relationships:**
   - No column correlates with yield beyond |r| = 0.07.
   - The breeds' averages are almost identical (Gir 12.64, Holstein 12.57, Sahiwal 12.42, Jersey 12.06).

### Data issue

Lines 7, 9 and 10 of `breed_yield_baselines.csv` (Boran, Smallholder and Formal sector) have unquoted commas in the `notes` column, so standard CSV readers fail on it. The script reads only the breed and yield columns, and the file was left unchanged.

---

## 2. The deployed models: Kenyan-level synthetic herd

Notebook: `recommender/notebooks/dairydan_yield_models.py`, or `DairyDan_yield_models.ipynb` for Colab. Details: `recommender/SYNTHETIC_RETRAIN_RESULTS.md`.

### How the synthetic data is made

The notebook generates a herd whenever no real data file is supplied:

- **Herd:**
  - 60 cows, each followed for up to 240 days, with a morning and an evening milking.
  - That gives 28,800 sessions; 28,380 have the 7 previous sessions needed for training.
  - The breed mix is Kenyan-style: 45% crossbred, 20% Holstein-Friesian, 12% Ayrshire, and small shares of Jersey, Guernsey, Sahiwal, Boran and Zebu.
- **Breed figures:** the cited figures from `breed_yield_baselines.csv`, scaled to Kenyan smallholder levels:
  - **Exotic breeds:** the cited averages come from well-managed zero-grazing farms, so they're scaled to 35%. Holstein-Friesian becomes 15.75 L/day, Ayrshire 10.5, Guernsey 8.75 and Jersey 7.
  - **Sahiwal:** scaled to 55%, giving 5.5 L/day.
  - **Boran (4.5), Zebu (1.6) and crossbred (8):** these were measured on farms, so they're used as they are.
- **Built-in effects:**
  - Lactation curve: yield rises after calving, peaks around day 50, then falls.
  - Each cow's own ability, ±20%.
  - Parity: first-calf cows give 80%, second-calf cows 93%.
  - Concentrate: 0.5–4 kg a day, about +5% milk per kg above 2 kg.
  - Late pregnancy and old age both lower yield.
  - Illness: −25% while sick, −10% for the week after.
  - Random noise on every milking.
- **Gaps:** some values are blanked out on purpose so the models learn to cope with missing data.
- **Realism check:** the herd averages **9.79 L/day**, inside the Kenyan smallholder range of 7.6–10.7 L/day. Training stops if the average falls outside that range.

### Results, before and after the Kenyan scaling

Error is per milking session. "Before" is the first synthetic herd, which used the placeholder breed figures.

| Model | MAE before | MAE after | MAPE before | MAPE after |
|---|---:|---:|---:|---:|
| 7-session moving average | 0.62 L | 0.46 L | 12.2% | 12.3% |
| Linear regression | 0.31 L | 0.25 L | 6.1% | 6.7% |
| Neural net | 0.34 L | **0.24 L** | 6.9% | **6.6%** |

- **Litre errors fell** mostly because the herd now gives less milk. MAPE, the percentage error, is the fairer comparison.
- **On MAPE,** the neural net improved slightly and linear regression got slightly worse. Both still make about half the moving average's error.
- **The neural net is now the best model,** so `PREDICTOR=auto` uses it.
- **The models take 12 inputs:**
  - The last 7 sessions and their average.
  - Days in milk, parity, breed baseline and age.
  - The notebook keeps an optional input only if it lowers the neural net's error; this time only age did.

The models learned the patterns the generator built in. That proves the training, ONNX export and serving all work, but it doesn't show they'll be accurate on your cows.

### Database changes that go with these models

- **Breed baselines:** `breed_yield_baselines` holds the same Kenyan farm-level figures, so the breed baseline the app sends to the models matches what they were trained on.
- **New breeds:** Sahiwal and Boran were added, and `Crossbreed` and `Other` are 8 L/day.
- **Migration:** `db/migrations/2026-10-27_yield_factors_kenya_baselines.sql` makes these changes and only replaces rows still holding placeholder values.

---

## 3. Knowledge graph for cold start

A cow with fewer than 3 milking records has no history to average and can't use the models, which need 7. The knowledge graph estimates her yield from what's known about her instead.

```
Kiki --is_a--> Jersey --has_baseline--> 7 L/day   (3.5 L per session)
Kiki --meets (days_in_milk = 60)--> peak lactation  --multiplies_yield_by--> 1.23
Kiki --meets (parity = 1)-------->  first lactation --multiplies_yield_by--> 0.8
Expected: 3.5 x 1.23 x 0.8 = 3.44 L
```

- **The graph:** the `yield_factors` table holds 16 conditions, each with a multiplier. They cover lactation stage, parity, pregnancy, concentrate fed, illness in the last week, and age over 10 years.
- **Combining factors:** a cow gets at most one factor per attribute. The combined multiplier is capped between 0.3 and 1.6.
- **Where the figures come from:** they're the same effects built into the synthetic herd, so cold-start estimates and the models agree.
- **Explaining the result:**
  - The alert names the factors used, e.g. *"…based on the breed average adjusted for peak lactation and first lactation (not enough history yet)."*
  - The cow's profile page shows the estimate with a table of the factors.
  - The API returns the full path.
- **Editing:** you can change the `yield_factors` rows to suit the farm; the migration never overwrites edited rows.
- **Live check:** a new first-calf Jersey 60 days into lactation was expected to give 3.44 L. Her 3.2 L reading was judged normal.

---

## 4. Verification

| Check | Result |
|---|---|
| ONNX files give the same answers as scikit-learn | Within 2e-6 |
| `npm test` (server) | 134/134 passed |
| `npm run smoke` (server) | Passed, including Node matching Python on the sample inputs |
| Client `npm run build` | Compiled successfully |
| Migrations on the dev database, run twice | Applied once; the second run did nothing |
| Fresh `schema.sql` + `seed.sql` + all migrations (throwaway database) | Loaded cleanly |
| Live API with `PREDICTOR=auto` | Neural net used for cows with history; knowledge graph used for a new cow |

**Not checked:** the new profile-page section in a browser.

---

## 5. Running the models in the app

### First time, or after pulling these changes

From the project root:

```
npm run db:up          # start MySQL in Docker (localhost:3307)
npm run install-all    # installs onnxruntime-node for the server too
npm run db:migrate     # breed baselines, yield factors and the other tables
npm run db:seed        # optional: demo cows, users and milking history
cd server && npm run backfill:predictions && cd ..   # judge existing records so the charts have history
```

### Choose the predictor

In `server/.env`:

```
PREDICTOR=auto
```

| Value | What the app uses for cows with 7+ records |
|---|---|
| `auto` | The model `model_meta.json` marks as best, currently the neural net |
| `nn` | The neural net |
| `lr` | Linear regression |
| `ma`, or not set | The 7-session moving average (no models) |

`server/.env` is already set to `auto`. The knowledge graph runs for cold starts whatever this is set to.

### Check, then start

```
cd server
npm test               # 134 tests
npm run smoke          # loads both ONNX models and the knowledge graph
cd ..
npm run dev            # server and client together
```

The server log should show `Recommender: the ONNX models were trained on SYNTHETIC data…` once, when the first prediction is made. That warning confirms the models loaded.

### See it working

1. **Log a reading:** log in as a worker, manager or admin and go to **Milking → Log milking**. Pick a cow with history (Bessie, Daisy or Rosie in the demo data) and save a reading. The alert at the top shows the result, and the note says *"Expected yield is based on the neural network model."*
2. **Low readings:** a reading well below normal, e.g. 5 L for Bessie, shows **Low yield**.
3. **The profile page:** open the cow's profile. The **Yield insight** card shows:
   - The next-session forecast and the method used.
   - The profile-based (knowledge graph) estimate with its factors.
   - Recent judgements.
4. **The knowledge graph:** add a new cow with category **Cow**, a calving date and parity, then log her first milking. The note says *"…based on the breed average adjusted for …"*.
5. **Charts:**
   - **Milking → Yield trends** shows the herd's daily milk against the expected amount, the 80–120% normal band, and red or orange dots on days with low or high readings. You can filter by period, breed and cow, and a table below lists the alerts.
   - **Cow profile → Yield insight** shows the same chart for that cow.
   - **Manager dashboard → Herd yield** summarises the last 14 days.

From the API directly: `POST /api/milking` returns a `recommendation` with `method: "neural_net"`, and `GET /api/recommendations/cattle/:id` returns the forecast and the `knowledge_graph` estimate.

### Switching the models off

Set `PREDICTOR=ma` and restart the server. The models are synthetic, so this is the safe setting for real farm decisions until they're retrained on your own records.

### Retraining on your farm's records later

1. Once the farm has a few months of milking records, run `cd server && npm run export:training`. It writes `recommender/data/milk_records.csv`.
2. Open `recommender/notebooks/DairyDan_yield_models.ipynb` in Colab, upload the CSV, set `DATA_CSV` to its name and run all cells.
3. Copy `yield_nn.onnx`, `yield_lr.onnx`, `model_meta.json` and `sample_input.json` into `server/ml/models/`.
4. Run `npm test` and `npm run smoke`, then restart the server.
