# Metabolic Intelligence Platform

A personal metabolic intelligence system that continuously learns how each individual
responds to food, sleep, activity, stress, medication, and lifestyle factors — focused on
diabetes, obesity, metabolic syndrome, hypertension, fatty liver disease, and preventive
health.

> **Non-clinical / educational.** All predictions and recommendations are produced by an
> explainable, deterministic engine and are **not medical advice**. Always consult a
> qualified healthcare professional for medical decisions.

## Quick start

```bash
npm install            # installs all workspaces
npm run db:push        # creates the local SQLite database
npm run db:seed        # loads regional food DB + sample user
npm run dev            # starts the web app at http://localhost:3000
npm test               # runs the engine test suite (Vitest)
```

## What's where

```
apps/web/        Next.js 15 web app (the deployable product)
apps/mobile/     Expo (React Native) scaffold — build native binary later via EAS
packages/engine/  Personal Metabolic Model — pure TS, unit-tested, shared by web & mobile
packages/food-db/ Indian regional + global food nutrition dataset
docs/            architecture, API, data model, differentiators
```

## Monorepo commands

| Command | What it does |
|---|---|
| `npm run dev` | Run the web app |
| `npm run build` | Production build |
| `npm test` | Engine test suite |
| `npm run db:push` | Create / sync the local SQLite schema |
| `npm run db:seed` | Seed food DB + demo data |
| `npm run db:studio` | Open Prisma Studio |

## Demo account

The seed creates `demo@metabolic.dev` / `demo1234` (prefilled on the login
page) with history for demos — see
[`docs/DEMO-RUN-OF-SHOW.md`](docs/DEMO-RUN-OF-SHOW.md) for the 3-minute
run-of-show. After a demo, remove the account and ALL of its data:

```bash
cd apps/web
DEMO_EMAIL=demo@metabolic.dev node scripts/demo-account-cleanup.mjs        # dry-run first
DEMO_EMAIL=demo@metabolic.dev node scripts/demo-account-cleanup.mjs --yes  # deletes
```

## Deploy

See [`docs/DEPLOY.md`](docs/DEPLOY.md) for the Vercel + Turso/Postgres flow and the
later native Android build via Expo EAS.

## License

Proprietary — All rights reserved.
