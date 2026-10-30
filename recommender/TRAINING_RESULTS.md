# Training results

Last updated 2026-10-29. This file covers four pieces of work on the milk yield recommender:

1. **Training on the 1000-cow dataset** (`cattle_milk_yield_1000.csv`). The models learned nothing usable, so they weren't deployed.
2. **Retraining the app's models on a Kenyan-level synthetic herd** built from the cited breed figures. These are the models now in `server/ml/models/`.
3. **A knowledge graph for cold start**: the estimate for cows with fewer than 3 milking records.
4. **Yield ranges and feed-aware advisory tips**, added after checking the system against the project's conceptual framework.
5. **A backtest of how far ahead yield can be predicted**, from the next session up to 2 months, and the **2-month projection** built from it.

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

Every prediction also comes with a **normal range** (80–120% of the expected yield) and, where the cow's records explain something, **advisory tips** based on her feed, lactation stage and health. See section 4.

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

## 4. Yield range and advisory tips

A check of the system against the conceptual framework diagram (`framework_diagram (2).png`) found two gaps in the **Outputs** box:

- **Yield range:** the forecast was a single number, not a range.
- **Advisory tips:** the advice was the same generic line for every cow, and it ignored the feed records.

Both are now fixed. No retraining or database change was needed.

### Yield range

- Every judgement and forecast now carries a range of 80–120% of the expected yield, the same limits that decide low and high readings.
- The range is calculated from the expected figure whenever it's needed (`rangeFor` in `server/services/recommender.js`), so it isn't stored.
- **Where it shows:**
  - Notes, e.g. *"…below the expected 3.41 L (normal range 2.73–4.09 L)."*
  - The profile's forecast: *"Expected next session: 3.01 L · normal range 2.41–3.61 L"*.
  - The Expected column of the profile's judgements table.
  - The API: `range` on recommendations and forecasts, `expected_range` on stored judgements.

### Advisory tips

`server/services/advice.js` builds the tips from the cow's records:

- **Feed:** today's concentrate against her usual ration, the average of her feed records for the previous 7 days (`feedSignals` in `server/services/features.js`).
- **Stage:** late lactation (250+ days in milk) and close to drying off (210+ days pregnant).
- **Health:** recent illness, treatment or calving.

| Tip | When it's given |
|---|---|
| Feed missing | No feed record for today |
| Ration cut | Concentrate today is below 75% of her usual |
| Ration raised | Concentrate today is above 125% of her usual (explains a high reading) |
| Little concentrate | Under 1 kg today |
| Late lactation / near dry-off | Explains a natural drop |
| Health recovery | Follow the vet's plan and milk withdrawal periods |
| Fresh cow | Recently calved |
| Check the entry | High reading: confirm it was entered correctly |
| Check the udder | Low reading: check water and udder; if nothing else explains it, ask the vet to examine her if it happens again |

What a reading gets:

- **Low:** feed tips, then stage tips, then the udder check.
- **High:** the entry check, plus the ration-raised tip when it applies.
- **Held back by illness:** the health tips.
- **Normal:** no tips.
- **The forecast:** health, feed and stage tips, shown on the profile in a yellow **"Before the next milking"** box.

Example note for a low reading after a ration cut: *"Wambui gave 2 L, about 41% below the expected 3.41 L (normal range 2.73–4.09 L). Concentrate was cut to 1 kg from her usual 4 kg; restore the usual ration. Also check her water supply and udder for signs of mastitis. Expected yield is based on…"*

The profile's **Concentrate today** row now also shows *"· usually X kg"*.

If the optional LLM rewording is turned on, it may use up to three sentences and must keep every action. The range limits and the numbers in the tips count as grounded, so it still can't add numbers of its own.

### Framework walkthrough

A script registers a test cow, logs a week of feed (4 kg a day, cut to 1 kg on the last day), milkings, an illness and a low reading through the live API. It checks each box of the diagram, then deletes everything it created.

| `PREDICTOR` | Result |
|---|---|
| `ma` | All checks pass |
| `auto` | All pass except two "framework literal" checks: once a cow has 7+ records, the neural net replaces the moving average the diagram shows. This is expected. |

To match the diagram exactly, use `PREDICTOR=ma`, or add the neural net to the diagram as an extension of the time-series path.

### Stored notes refreshed

`npm run backfill:predictions` was re-run so existing notes use the new format: 112 milkings judged (neural net 84, moving average 16, knowledge graph 12; 97 normal, 13 high, 1 low, 1 held back).

---

## 5. How far ahead can yield be predicted?

The app's models predict **one milking ahead**: the cow's next session, about 12 hours away. This backtest measures how the error grows when predicting further ahead.

Code: the last section of `recommender/notebooks/dairydan_yield_models.py` (and the notebook). Raw numbers: `recommender/results/horizon_backtest.json`.

### How it was tested

- **Starting points:** a forecast starts every 3 days for each cow in the synthetic herd. Each forecast uses only what was known on its starting day.
- **Targets:** every target is in the test split, so no model is scored on milkings it was trained on.
- **What's predicted:**
  - A single session 1 week (14 sessions), 1 month (60) and 2 months (120) ahead.
  - The average L/day over each of the next two months.
- **Methods compared:**

| Method | How it predicts further ahead |
|---|---|
| Moving average | The last 7 sessions' average, held flat |
| Linear regression, neural net | Recursive: predict the next session, feed that prediction back in as the newest record, and repeat. Days in milk, pregnancy and age move with the calendar; feed stays at today's level and the cow is assumed to stay healthy. |
| Lactation curve | The cow's current level (the neural net's next two sessions), split by her own morning/evening pattern, then moved along the Wood lactation curve and the late-pregnancy decline |
| Knowledge-graph bands | The same, but using the app's `yield_factors` stage and pregnancy bands instead of the smooth curve |

### Results (MAPE, the average % error)

| Target | Moving average | Linear regression | Neural net | Lactation curve | KG bands |
|---|---:|---:|---:|---:|---:|
| Next session | 14.0% | 6.6% | **6.4%** | 6.7% | 6.7% |
| 1 week ahead | 8.4% | 9.5% | 12.1% | **8.3%** | 9.5% |
| 1 month ahead | 8.7% | 17.0% | 27.0% | **8.1%** | 15.2% |
| 2 months ahead | 15.8% | 24.1% | 39.4% | **7.9%** | 15.7% |
| Month 1 average (L/day) | 9.1% | 8.6% | 15.8% | **4.3%** | 7.7% |
| Month 2 average (L/day) | 19.8% | 17.0% | 31.9% | **4.1%** | 15.3% |

How much of a normal range each method needs:

| Target | Neural net: readings inside ±20% | Neural net: ± that holds 80% | Curve: readings inside ±20% | Curve: ± that holds 80% |
|---|---:|---:|---:|---:|
| Next session | 98% | 9.8% | 98% | 10.5% |
| 1 week ahead | 82% | 18.7% | 92% | 12.6% |
| 1 month ahead | 56% | 40.5% | 93% | 12.2% |
| 2 months ahead | 49% | 46.6% | 94% | 11.6% |
| Month 1 average | 76% | 22.8% | 98% | 6.2% |
| Month 2 average | 56% | 36.9% | 97% | 5.7% |

### What this shows

1. **Predictions get less accurate the further ahead they go.** The neural net is the best method for the next session (6.4%), but fed its own predictions it drifts: 12% at 1 week, 27% at 1 month, 39% at 2 months. That's worse than simply holding the 7-session average flat, so **the current models shouldn't be run forward to forecast months ahead**.
2. **Monthly averages are easier than single sessions.** Morning and evening differences and day-to-day noise cancel out over a month. With the curve method, "her average next month" is about twice as accurate as "her yield on one morning next month" (4.3% vs 8.1%).
3. **Long-range forecasts need the lactation curve and pregnancy dates.** These are the main reasons yield changes over two months, and the models only see them indirectly.
4. **The lactation curve's figures are flattered.** The synthetic herd was generated from this same curve, so its error barely grows with distance. On real cows, whose curves differ, expect something nearer the **knowledge-graph bands** column: about 9–10% at 1 week and 15–16% at 1–2 months.
5. **First-attempt mistake, now fixed:** the first version started the curve from a single session's prediction. Every target in the other session (morning milkings give about 20% more than evening ones here) was then off by about 17%. Starting from a daily level and splitting it by the cow's own morning/evening pattern fixed it. The app would need to do the same.

### What this means for building a 2-month forecast

- **Keep the neural net for the next milking.** It's the most accurate there.
- **For anything further ahead, project the cow's level along the lactation curve and the pregnancy decline.** Show monthly averages as the main figure and single sessions only for the near term.
- **Widen the range with distance.**
  - On this data ±20% is fine at every horizon for the curve method.
  - On real cows the KG-bands figures suggest it should grow, to around ±25–30% at two months.
  - Rerun this backtest on exported farm data (`npm run export:training`, then `DATA_CSV`) to set the actual widths.

### Built: the 2-month projection

Added after the backtest. Code: `server/services/projection.js`, `projectAhead` in `server/services/yieldService.js`, and the endpoint `GET /api/recommendations/cattle/:id/projection?days=60` (1–60 days).

**How it works**

1. **Starting level:** the configured predictor's next two sessions, added together as litres per day. Under `PREDICTOR=auto` that's the neural net, under `ma` the moving average, and for cold starts the knowledge graph. Using two sessions means it doesn't matter whether a morning or an evening milking comes next.
2. **Daily path:** each day, the level moves along the Wood lactation curve (peak at 50 days in milk) and the late-pregnancy decline (−0.2% a day after day 120 of pregnancy). Days in milk and days pregnant move forward with the calendar.
3. **Held constant at her recent values:** concentrate (her usual ration over the last 7 days), health, milkings per day, parity and breed. The response lists these as assumptions in plain words. It also warns when she's unwell now, or when her last milking record is over 14 days old.
4. **Dry-off:** a pregnant cow is expected to be dried off at day 220 of pregnancy. From then on her projected yield is 0.
5. **Range:** widens from ±20% tomorrow to ±30% at day 60.
6. **Milestones** crossed in the window are marked on the chart: peak, late lactation (day 200), 305 days, pregnancy affecting yield, dry-off and calving.
7. **Monthly figures:** average L/day and total litres for each 30 days.
8. **No calving date:** the projection isn't available, and the response says to add the calving date.

**Where it shows:**

- **The cow's profile,** under **Yield insight → Projected yield**, with a "Next 30 / 60 days" picker.
- **Milking → Yield trends:** the herd's projection continues the history chart after today. It's every matching cow's projection added up, and follows the breed and cow filters. Endpoint: `GET /api/recommendations/projection?days=60&breed=&cattle_id=`.
- **How the herd figures are built:**
  - Cows that can't be projected (no calving date) are listed, not guessed.
  - Upcoming dry-offs and calvings are listed by cow.
  - The herd range adds up each cow's range, so it's on the wide side. Herd totals should in practice be more accurate than single cows, because individual errors partly cancel out.

**Expected error (daily totals, from the notebook's backtest):**

| Horizon | Synthetic herd (same curve) | Mismatched curve (closer to real cows) |
|---|---:|---:|
| Tomorrow | 5.3% | 5.3% |
| 1 week | 6.8% | 8.0% |
| 2 weeks | 6.9% | 10.1% |
| 1 month | 6.8% | 14.4% |
| 2 months | 6.4% | 15.4% |
| Average L/day, next 30 days | 4.3% | 7.7% |
| Average L/day, days 31–60 | 4.2% | 15.3% |

- **The two columns:**
  - The first is what the synthetic data gives. It's optimistic, because that herd was generated from the same curve.
  - The second uses the knowledge graph's coarser bands as the curve. It stands in for a cow whose real curve doesn't match.
- **Range coverage:** ±30% held about 90% of daily totals at every horizon in both tests.
- **Not covered:** none of these figures include future illness, feed changes or a cow being sold or dried off early. The projection can't foresee them.
- **Live check:** on the demo cows, it projected falls of 10–19% over 60 days for cows past peak. Daisy's crossing into late lactation and Rosie's pregnancy were marked.

---

## 6. Verification

| Check | Result |
|---|---|
| ONNX files give the same answers as scikit-learn | Within 2e-6 |
| `npm test` (server) | 184/184 passed (13 suites, including `advice.test.js` and `projection.test.js`) |
| `npm run smoke` (server) | Passed, including Node matching Python on the sample inputs |
| Client `npm run build` | Compiled successfully |
| Migrations on the dev database, run twice | Applied once; the second run did nothing |
| Fresh `schema.sql` + `seed.sql` + all migrations (throwaway database) | Loaded cleanly |
| Live API with `PREDICTOR=auto` | Neural net used for cows with history; knowledge graph used for a new cow |
| Framework walkthrough, `PREDICTOR=ma` | All checks passed |
| Notebook script rerun with the horizon backtest (output to a scratch folder) | Same model scores as the deployed models (neural net MAE 0.240 L); deployed model files unchanged |

| Projection endpoint on the demo cows (`PREDICTOR=auto`) | 60-day series, monthly figures, milestones and assumptions returned; 404 for a missing cow |
| Herd projection endpoint on the demo herd | 4 cows summed: 74.4 L/day now, about 2,149 L over the next 30 days; breed and cow filters work; 400 for a bad `cattle_id` |

**Not checked:** in a browser, the profile page (range, usual ration, the "Before the next milking" box, the Projected yield chart) and the projection on the Yield trends chart.

---

## 7. Running the models in the app

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
npm test               # 184 tests
npm run smoke          # loads both ONNX models and the knowledge graph
cd ..
npm run dev            # server and client together
```

The server log should show `Recommender: the ONNX models were trained on SYNTHETIC data…` once, when the first prediction is made. That warning confirms the models loaded.

### See it working

1. **Log a reading:** log in as a worker, manager or admin and go to **Milking → Log milking**. Pick a cow with history (Bessie, Daisy or Rosie in the demo data) and save a reading. The alert at the top shows the result, and the note says *"Expected yield is based on the neural network model."*
2. **Low readings:** a reading well below normal, e.g. 5 L for Bessie, shows **Low yield**. The note gives the normal range and tips. If you first log a feed record for her with much less concentrate than usual, the note tells you the ration was cut.
3. **The profile page:** open the cow's profile. The **Yield insight** card shows:
   - The next-session forecast with its normal range, and the method used.
   - Today's concentrate next to her usual ration.
   - A **"Before the next milking"** box when there are tips.
   - The profile-based (knowledge graph) estimate with its factors.
   - Recent judgements, each with its range and note.
   - **Projected yield:** the next 30 or 60 days along the lactation curve, with the likely range, milestones and monthly totals.
4. **The knowledge graph:** add a new cow with category **Cow**, a calving date and parity, then log her first milking. The note says *"…based on the breed average adjusted for …"*.
5. **Charts:**
   - **Milking → Yield trends** shows the herd's daily milk against the expected amount, the 80–120% normal band, and red or orange dots on days with low or high readings. You can filter by period, breed and cow, and a table below lists the alerts. After today, the chart continues with the herd's projection for the next 30 or 60 days: a dashed purple line with its likely range.
   - **Cow profile → Yield insight** shows the same chart for that cow.
   - **Manager dashboard → Herd yield** summarises the last 14 days.

From the API directly: `POST /api/milking` returns a `recommendation` with `method: "neural_net"`, and `GET /api/recommendations/cattle/:id` returns the forecast (with `range` and `advice`) and the `knowledge_graph` estimate.

### Switching the models off

Set `PREDICTOR=ma` and restart the server. The models are synthetic, so this is the safe setting for real farm decisions until they're retrained on your own records.

### Retraining on your farm's records later

1. Once the farm has a few months of milking records, run `cd server && npm run export:training`. It writes `recommender/data/milk_records.csv`.
2. Open `recommender/notebooks/DairyDan_yield_models.ipynb` in Colab, upload the CSV, set `DATA_CSV` to its name and run all cells.
3. Copy `yield_nn.onnx`, `yield_lr.onnx`, `model_meta.json` and `sample_input.json` into `server/ml/models/`.
4. Run `npm test` and `npm run smoke`, then restart the server.
