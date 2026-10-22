# Phase 3 Worklog - production launch + data safety
## Step 0: baseline green (HEAD bb90d33, 127/127 tests, tsc clean)
## P3-1: export-format.ts (8 exports) + tests (15 its); paste stalls recovered, zero corruption
## P3-1 gate: npm test 17 files / 142 tests + tsc clean (3h)
## P3-1 (4): export-tables.ts - 21-table registry + scoped loaders + collectors; stub-Prisma tests (5 its); gate 18 files / 147 tests + tsc clean
## P3-1 (6): export-response.ts + /api/export route + reports backup button; route tests (6 its); gate 19 files / 153 tests + tsc clean
## P3-1 (7) DONE: live E2E vs dev server - 9/9 PASS (csrf, signup, cookie, json envelope+21 tables+no passwordHash, csv, 400, 401); temp e2e-export-*@example.com account left in dev.db
## P3-2 DONE (adapted): reuse existing prod DB metabolic-intelligence-db-tradaninik (aws-ap-south-1) via apps/web/.env.turso; app-stack connectivity OK (@libsql/client); all 21 tables + _turso_migrations present; turso CLI abandoned (get.turso.dev DNS-blocked, winget empty) - node scripts only
## P3-3 DONE: diary = numbered folders (0001_baseline, 0002_custom_foods_and_combos, 0003_phase2*) each migration.sql + schema.prisma snapshot; already applied to Turso; parity verified 21/21 (first node run was false-green: case-insensitive guard bug skipped part 3 - fixed and rerun with output-captured gate); zero schema changes -> no new diary entry

## P3-4 note: working tree carries UNCOMMITTED Phase 2c work (M packages/engine/src/index.ts + new engine adherence/hba1c/units.ts; 0003_phase2c diary; labs/meds/day-tags/settings code). Phase 3 adds none; resolution at P3-6: single phase commit includes carry-over, message documents it. Deploy path: local prod build -> vercel link -> env vars (token never printed, cmd-redirect stdin) -> --prod deploy.

## P3-4 (7) - pivot edition (2026-10-22)

- PIVOT: production target is now Vercel project metabolic-int-web (Git-linked), canonical URL https://metabolic-int-web.vercel.app. Project metabolicint (no Git integration; all Ready deployments served 404 - empty prebuilt artifacts) is a stray scheduled for deletion at P3-6.
- Ghost domain: bare metabolicint.vercel.app is squatted by an outside project - permanently ignored, never probed.
- Prebuilt pipeline failure: vercel build + deploy --prebuilt produced empty 404 artifacts on the stray project. Pipeline banned; all deploys use cloud builds (vercel deploy --prod --yes).
- Relink: repo root and apps\web both linked to metabolic-int-web (non-interactive vercel link -p). CLI deploys must run from the repo ROOT - the project Root Directory is apps/web, so deploying from apps\web fails.
- Env inventory: all 4 production vars present (DATABASE_URL, DATABASE_AUTH_TOKEN, NEXTAUTH_SECRET, NEXTAUTH_URL - all Secret type); nothing added (ADD-ONLY). NEXTAUTH_URL = https://metabolic-int-web.vercel.app.
- Deploy 2026-10-22: vercel deploy --prod --yes from repo root, Ready in 1m, aliased to https://metabolic-int-web.vercel.app.
- Public verification (RawProbe, no redirects): / = 200, /login = 200, /api/auth/csrf = 200, /api/export?format=json = 401, no Location headers. Self-gate on export probe = 401.
