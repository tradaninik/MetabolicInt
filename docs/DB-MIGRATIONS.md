# Turso DB migrations (MetabolicInt)

How schema changes reach the production Turso database.

## Why this exists
- Local dev uses `npm run db:push` against a SQLite file - instant, no migration files.
- Production is Turso (libSQL), where `prisma migrate deploy` is not usable with our
  driver-adapter setup. So we generate SQL with `prisma migrate diff` and apply it with
  `@libsql/client`, tracked by a journal table.

## Commands (from apps/web)
- `node scripts/turso-migrate.mjs diff --name short_name` - generates the next migration
  from prisma/schema.prisma. No DB connection needed. The first ever run creates
  0001_baseline from an empty DB.
- `node scripts/turso-migrate.mjs apply` - applies pending migrations to Turso.
  Idempotent, safe to re-run.
- `node scripts/turso-migrate.mjs status` - journal + pending list.
- npm aliases exist in apps/web and at the repo root: db:migrate:diff, db:migrate:prod,
  db:migrate:status.

## Required shell env (apply/status only)
Set $env:DATABASE_URL and $env:DATABASE_AUTH_TOKEN in the shell. Names only here -
never commit values. They are NOT read from apps/web/.env, and they die with the
PowerShell window.

## Change workflow
1. Edit apps/web/prisma/schema.prisma.
2. Local: `npm run db:push`, then `npx prisma generate`.
3. `node scripts/turso-migrate.mjs diff --name <feature>`
4. REVIEW prisma/prod-migrations/<NNNN>/migration.sql. For feature migrations, paste the
   SQL for approval BEFORE running apply. Never hand-edit a migration.sql; delete the
   folder and re-diff instead.
5. `node scripts/turso-migrate.mjs apply`, then `status` to verify.
6. `npx prisma generate` so the app client matches the new schema, then build.

## How idempotency works
- A `_turso_migrations` journal table lives in Turso (name PK, applied_at).
- Applied migrations are skipped on re-run.
- Auto-baseline: if the journal is empty but tables already exist (this DB predates the
  workflow), 0001 is marked applied without executing its SQL.
- SQL executes statement-by-statement; "already exists" / "duplicate column" errors are
  tolerated so an interrupted run converges on re-run. Any other error fails loudly and
  does not journal.

## Troubleshooting
- "URL 'undefined'" = DATABASE_URL not set in this shell.
- HTTP 400 / UNAUTHORIZED = bad or truncated token (a working Turso token is ~348 chars).
- Env vars vanish when the window closes - re-set per session.

## Never commit
.env, tokens, or throwaway files (apply-turso-schema.mjs, schema-turso.sql,
build-output.txt).