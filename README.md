# Milk Yield Recommendation and Management Tool

Role-based dairy farm management system for smallholder and mid-scale dairy
farmers, built around an integrated milk yield recommender (7-session moving
average forecaster with an FAO breed-baseline cold-start fallback).

## Stack

- **Backend:** Node.js / Express (`server/`)
- **Frontend:** React (`client/`)
- **Database:** MySQL 8.x (`db/`)
- **Recommender:** optional Python/FastAPI microservice (`recommender/`)

## Getting started

1. Use Node 20 (`nvm use`).
2. Copy environment files:
   ```
   cp server/.env.example server/.env
   ```
3. Start the database:
   ```
   npm run db:up
   ```
   The Docker MySQL is published on **localhost:3307** (not 3306), so it runs
   alongside a locally installed MySQL. `server/.env.example` already sets
   `DB_PORT=3307`; to use your local MySQL instead, set `DB_PORT=3306` and its
   credentials in `server/.env`.
4. Install dependencies:
   ```
   npm run install-all
   ```
5. Run client + server together:
   ```
   npm run dev
   ```

## Recommender

Every milking record saved through the API is judged against what the cow
was expected to give: a 7-session moving average by default, or an ONNX model
when you opt in. A cow with fewer than 3 records gets a knowledge-graph
estimate instead: her breed's baseline times the factors she meets (lactation
stage, parity, pregnancy, concentrate fed, recent illness, age), each from the
`yield_factors` table with its source, and the alert names the factors used.
Readings below 80% or above 120% of expected are flagged, unless recent
illness, treatment or calving explains them.

1. Apply the database changes (feed records, breed baselines, lactation
   details, yield factors):
   ```
   npm run db:migrate
   ```
   The breed baselines are cited figures scaled to Kenyan smallholder levels,
   and the yield factors mirror the synthetic training herd. Edit either table
   to suit your farm; the migrations never overwrite edited rows.
2. Export training data once the farm has some history:
   ```
   cd server && npm run export:training
   ```
   This writes `recommender/data/milk_records.csv` (git-ignored).
3. Train in Colab: open `recommender/notebooks/DairyDan_yield_models.ipynb`,
   upload the CSV, set `DATA_CSV` and run all cells. It compares the moving
   average, linear regression and a neural network, and exports ONNX files.
4. Copy `yield_nn.onnx`, `yield_lr.onnx`, `model_meta.json` and
   `sample_input.json` into `server/ml/models/` (replacing the synthetic
   placeholders there).
5. Set `PREDICTOR` in `server/.env`: `ma` (default), `lr`, `nn` or
   `auto` (the model the notebook scored best).

Check it with `cd server && npm test && npm run smoke`.

Charts: **Milking → Yield trends** shows the herd's daily milk against what was
expected (filter by breed or cow), each cow's profile has the same chart, and
the manager dashboard has a two-week summary. Milkings are judged when they are
saved, so records loaded by `seed.sql` or saved before the recommender existed
need judging once:
```
cd server && npm run backfill:predictions
```

## Repo layout

```
dairydan/
├── client/        React frontend
├── server/        Express API (routes -> controllers -> models)
├── db/            Schema, seed data, migrations
├── recommender/   Optional Python/FastAPI recommender microservice
└── docs/          Diagrams, ER schema, architecture notes
```

## Git workflow

Feature branches off `develop`, merged back via PR, `develop` merged into
`main` when demo-ready:

- `feature/cattle-management`
- `feature/tasks-milking`
- `feature/vet-health`
- `feature/reports-analytics`
- `feature/admin-users`
- `feature/recommender`
