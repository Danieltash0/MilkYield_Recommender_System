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
4. Install dependencies:
   ```
   npm run install-all
   ```
5. Run client + server together:
   ```
   npm run dev
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
