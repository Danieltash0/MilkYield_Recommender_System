# How the yield charts and notes work

This explains the two things a user sees from the milk yield recommender:

- **Notes:** the sentence shown after a milking is saved, e.g. *"Bessie gave 6.5 L, about 43% below the expected 11.44 L…"*.
- **Charts:** actual vs expected milk over time, drawn with Recharts.

Both are built from the same stored record, a **judgement**, so it's described first.

## 1. Judgements: where the data comes from

Every time a milking is saved, the server judges it and stores the result.

```
Worker saves a milking (POST /api/milking, or PUT to edit one)
        │
        ▼
milkingController ──► yieldService.evaluateRecord(record)
                          │  1. gather(): the cow, her earlier milkings, feed, health
                          │     records, breed baseline, knowledge-graph factors
                          │  2. recommender.recommend(): expected litres + status
                          │  3. explain.templateText(): the note
                          │  4. YieldPrediction.save(): one row in milk_yield_predictions
                          ▼
Response: { record_id, recommendation: { expected, method, status, message, … } }
```

- **Only earlier milkings count.** A record is judged against the sessions *before* it, never later ones, so judging an old record gives the same answer it would have had on the day.
- **Status rule:**
  - **low** when the reading is below 80% of expected.
  - **high** when it's above 120%.
  - **normal** in between.
  - **suppressed** when a low or high reading is explained by illness, treatment or calving in the last week. No alert is raised for those.
- **Saving never fails because of this.** The judgement is best effort; if anything goes wrong, the milking is still saved and the response carries `recommendation: null`.
- **One row per milking record.** Editing a reading re-judges it and replaces the row (unique on `record_id`). Deleting the milking deletes its judgement too.
- **Records saved before the recommender existed, or loaded by `seed.sql`,** have no judgement. Run this once to judge them:
  ```
  cd server && npm run backfill:predictions          # every record
  npm run backfill:predictions -- --days 30          # only the last 30 days
  ```
  It's safe to re-run, because each record's judgement is replaced rather than duplicated.

### What each row stores (`milk_yield_predictions`)

| Column | Meaning |
|---|---|
| `cattle_id`, `record_id`, `milking_date`, `session` | Which milking was judged |
| `expected_litres` | What the recommender expected for that session |
| `actual_litres` | What was recorded |
| `ratio` | actual ÷ expected, e.g. 0.57 |
| `method` | `neural_net`, `linear_regression`, `moving_average`, `knowledge_graph` or `breed_baseline` |
| `status` | `normal`, `low`, `high` or `suppressed` |
| `reason` | Why an alert was suppressed, e.g. "recently calved" |
| `message` | The note (section 2) |
| `model_source` | `synthetic` while the ONNX models are trained on synthetic data |

## 2. Notes

Code: `server/services/explain.js`.

### Step 1: facts

`buildFacts()` takes the recommender's result and keeps only what a note may mention:

```js
{ cowName: 'Bessie', status: 'low', reason: null, method: 'neural_net',
  expected: 11.44, actual: 6.5, historyUsed: 7, percent: 43, adjustments: [],
  range: { low: 9.15, high: 13.73 },
  tips: [{ text: 'Concentrate was cut to 1.5 kg from her usual 4 kg; restore the usual ration.', numbers: [1.5, 4] }, …] }
```

- `percent` is how far the reading is from expected, rounded to a whole number: |1 − 6.5 ÷ 11.44| = 43%.
- `range` is the normal range, 80–120% of expected. Readings outside it are flagged.
- `tips` are the advisory tips from step 2.

### Step 2: advisory tips

Code: `server/services/advice.js`. `adviceFor()` turns what's known about the cow into specific feed and health actions:

- **Feed:** today's concentrate is compared with her usual ration, which is the average of the feed logged in the 7 days before. This comes from `feedSignals()` in `features.js`.
- **Lactation stage and pregnancy.**
- **Recent illness, treatment or calving.**

| Status | Tips, in order | Example |
|---|---|---|
| **low** | 1. A feed tip, if one applies:<br>• **cut ration:** at or below 75% of usual<br>• **missing feed:** no feed logged today, although feed is normally logged<br>• **very little concentrate:** under 1 kg<br>2. A stage tip, if one applies: **late lactation** (day 250+) or **close to drying off** (210+ days pregnant)<br>3. Always last, an udder and water check. If no feed or stage tip explains the drop, it also says to ask the vet if it happens again. | *"Concentrate was cut to 1 kg from her usual 4 kg; restore the usual ration. Also check her water supply and udder for signs of mastitis."* |
| **high** | 1. Check the reading was entered correctly.<br>2. If concentrate was **raised** to 125%+ of usual, say that may explain it. | *"Check that the reading was entered correctly. Concentrate was raised to 6 kg from her usual 4 kg, which may explain the rise."* |
| **suppressed** | A health action: follow the vet's treatment plan and observe withdrawal periods (illness or treatment), or keep a fresh cow well fed (calving). | *"Follow the vet's treatment plan and observe milk withdrawal periods; yield usually recovers within a week or two."* |
| **normal** | None | |
| **forecast** (no reading yet) | Anything to act on before the next milking: health, then feed, then stage | Shown on the profile as "Before the next milking: …" |

Each tip lists the numbers in its text, e.g. `[1, 4]` for the ration cut, so the grounding check in step 4 knows they're allowed.

### Step 3: template

`templateText()` writes the note from the facts. Every note starts with the reading, the expected yield and its normal range, then gives the tips:

| Status | Example note |
|---|---|
| low | *"Bessie gave 6.5 L, about 43% below the expected 11.44 L (normal range 9.15–13.73 L). Concentrate was cut to 1.5 kg from her usual 4 kg; restore the usual ration. Also check her water supply and udder for signs of mastitis."* |
| high | *"Bessie gave 15 L, about 31% above the expected 11.44 L (normal range 9.15–13.73 L). Check that the reading was entered correctly."* |
| suppressed | *"Bessie gave 6.5 L against an expected 11.44 L (normal range 9.15–13.73 L). No alert was raised because of the cow's condition (illness or injury recorded recently). Follow the vet's treatment plan…"* |
| normal | *"Bessie gave 11 L, in line with the expected 11.44 L (normal range 9.15–13.73 L)."* |

A final sentence then says what the expected figure was based on:

| Method | Ending |
|---|---|
| `neural_net` | *"Expected yield is based on the neural network model."* |
| `linear_regression` | *"…based on the linear regression model."* |
| `moving_average` | *"…based on the average of the last 7 sessions."* (the real count) |
| `knowledge_graph` | *"…based on the breed average adjusted for peak lactation and first lactation (not enough history yet)."* |
| `breed_baseline` | *"…based on the breed average (not enough history yet)."* |

For the knowledge graph, the factor names are joined into a list ("a", "a and b", "a, b and c"). The factor labels in the `yield_factors` table contain no digits, so they can't add numbers to the note.

The template never fails and needs nothing outside the app, so every judgement gets a note immediately.

### Step 4: optional rewording by an LLM

If `LLM_API_KEY` and `LLM_MODEL` are set in `server/.env`, the note can be reworded more naturally:

1. **Template first:** the template note is saved and returned straight away, so the worker never waits.
2. **Rewording in the background:** the server sends the template to an OpenAI-compatible API (`LLM_API_URL`, OpenAI by default). The instructions are to rewrite it in at most three short sentences, keeping every recommended action, using only its numbers and adding no diagnoses or advice. The request times out after 8 seconds.
3. **Grounding check:** `numbersAreGrounded()` checks the reply. Every number in it must be one of the facts (expected, actual, sessions used, percent, the range limits, or a number from a tip), to within 0.05. Digits in the cow's name or tag are ignored.
4. **The result:**
   - If the check passes, the stored `message` is replaced with the reworded note.
   - If it fails, the API errors or it times out, the template note stays.

So the LLM can change the wording but can never invent a number.

Without `LLM_API_KEY` there's no network call; this is the default. The backfill script always turns the LLM off, so judging hundreds of old records doesn't call a paid API hundreds of times.

### Where notes appear

- **Milking → Log milking:** an alert above the form after saving: green for normal or suppressed, red for low or high.
- **Cow profile → Yield insight:**
  - The expected next session with its normal range, e.g. "3.01 L · normal range 2.41–3.61 L".
  - The cow's usual concentrate next to today's.
  - A yellow **"Before the next milking"** box listing the forecast's tips.
  - The Note column in the recent-judgements table, where each expected figure has its range underneath.
- **Milking → Yield trends:** the Note column in the low and high readings table.

## 3. Charts (Recharts)

### Why Recharts

The client is React, and Recharts charts are ordinary React components fed with JSON from the API. That means no Python service and no images: the chart is drawn in the browser as SVG, with hover tooltips. It adds about 112 KB to the client bundle.

### Data flow

```
milk_yield_predictions
   │  YieldPrediction.dailyTrend({ days, cattleId, breed })   one SQL query, grouped by day
   ▼
GET /api/recommendations/trend?days=30&cattle_id=&breed=      any signed-in role
   │  useYieldTrend({ days, cattleId, breed })                React hook, refetches when a filter changes
   ▼
<YieldTrendChart series={…} />                                 client/src/components/YieldTrendChart.js
```

**The API response** has one point per day that has judged milkings:

```json
{ "days": 30, "cattle_id": null, "breed": null,
  "series": [ { "date": "2026-10-27", "expected": 76.06, "actual": 75.69,
                "cows": 4, "sessions": 8, "low": 1, "high": 0, "suppressed": 0 } ] }
```

- **Day totals:** `expected` and `actual` are sums over that day's judged sessions. Both cover the same milkings, so they're always comparable even if some cows weren't milked.
- **Counts:** `low`, `high` and `suppressed` count that day's judgements with that status.
- **Filters:** `days` is limited to 1–365 and defaults to 30. `cattle_id` filters to one cow and `breed` to one breed; they can be combined.

### What the chart draws

`YieldTrendChart` is a Recharts `ComposedChart` with three layers, drawn in this order:

| Layer | Recharts element | Shows |
|---|---|---|
| Normal range | `<Area dataKey="band">` | Light green band from 80% to 120% of expected. Each point's `band` is `[expected × 0.8, expected × 1.2]`, which Recharts draws as a range area. |
| Expected | `<Line dataKey="expected">` | Dashed grey line |
| Actual | `<Line dataKey="actual">` | Solid green line. Its dots are drawn by a custom `AlertDot`. |

**`AlertDot`** colours each actual-yield dot by that day's judgements:
- **Red, larger:** at least one low reading that day.
- **Orange, larger:** at least one high reading, and no low one.
- **Green, small:** otherwise.

A dot above the band with no colour isn't a contradiction. The band uses the day's total expected, while each reading is judged per session; suppressed readings also aren't coloured.

**`TrendTooltip`**, shown on hover, lists:
- the date;
- actual and expected litres, with actual as a percentage of expected;
- how many cows and milkings the day covers;
- any low, high or suppressed readings.

**Other details:**
- **Width:** `ResponsiveContainer` makes the chart fill its card on any screen.
- **Animation:** it's off, so filters update instantly.
- **Accessibility:** the chart has an `aria-label` summarising the period (total actual, total expected and the number of alerts) for screen readers.
- **Colours:** they're written as hex values in the component. SVG attributes can't read the CSS variables in `styles/variables.css`, so the same values are repeated.
- **Empty and error states:** a dashed placeholder shows while loading or when there's no data, and an error alert shows if the request fails.

### The three places it's used

| Where | Props | Notes |
|---|---|---|
| **Milking → Yield trends** (`pages/milking/YieldTrends.js`) | `height={340}`, full legend | Filters for period (14–180 days), breed and cow; picking a breed clears the cow. Summary cards show actual, expected, percent of expected and the low/high count. A table below lists the alerts behind the red and orange dots, from `GET /api/recommendations/alerts`, which looks back at most 90 days. |
| **Cow profile → Yield insight** (`components/YieldInsight.js`) | `perCow` | Period picker for 14, 30, 60 or 90 days. The tooltip shows milkings instead of a cow count. |
| **Manager dashboard → Herd yield** (`pages/dashboard/widgets.js`, `HerdYieldCard`) | `compact`, `height={200}` | Last 14 days, no legend, plus "X% of expected · N low or high readings" and a link to the trends page |

## 4. Things to know

- **Gaps in the data:** the charts only show judged milkings. If the charts look empty for older dates, run `npm run backfill:predictions`.
- **Changing the predictor:** changing `PREDICTOR`, the models or the breed baselines doesn't change past judgements. Re-run the backfill to judge everything again with the new settings.
- **Demo data:** the demo milkings in `seed.sql` (about 26 L/day for Bessie) are above the Kenyan-level breed baselines. A cow's first one or two readings, judged by the knowledge graph, therefore often show as high.
- **Notes reflect the moment of judging.** A note explains the expected figure at the time; it isn't updated when later milkings arrive.

## Files

| Part | Files |
|---|---|
| Judging | `server/services/yieldService.js`, `server/services/recommender.js`, `server/services/knowledgeGraph.js` |
| Notes | `server/services/explain.js`, `server/services/advice.js` (tips), `server/services/features.js` (`feedSignals`) |
| Storage | `server/models/YieldPrediction.js` (`save`, `forCattle`, `recentAlerts`, `dailyTrend`) |
| API | `server/controllers/recommendationController.js`, `server/routes/recommendationRoutes.js` |
| Backfill | `server/scripts/backfillPredictions.js` |
| Client data | `client/src/api/useRecommendations.js` (`useYieldInsight`, `useYieldTrend`, `useYieldAlerts`) |
| Chart | `client/src/components/YieldTrendChart.js`, `client/src/styles/charts.css` |
| Pages | `client/src/pages/milking/YieldTrends.js`, `client/src/components/YieldInsight.js`, `client/src/pages/dashboard/widgets.js` |
| Tests | `server/tests/explain.test.js`, `server/tests/recommendationController.test.js`, `server/tests/yieldService.test.js` |
