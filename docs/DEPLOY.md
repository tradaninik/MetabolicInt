# Deploy

Two deliverables: the **web app** (deployable now) and the **native Android binary**
(later, on demand).

## 1. Web app → Vercel

The Next.js app in `apps/web` is a standard App Router project. Root directory on Vercel
should be set to `apps/web`.

```bash
# from repo root
npm install
npm run db:push
npm run build      # verify production build locally
```

### Database — local SQLite → managed at deploy

Locally the DB is a file (`apps/web/prisma/dev.db`). For deploy, pick one:

**Option A — Turso (libSQL), zero code change (recommended):**
1. Create a database at https://turso.tech
2. Set env vars on Vercel:
   - `DATABASE_URL=libsql://<your-db>.turso.io`
   - `DATABASE_AUTH_TOKEN=<token>`
3. Run `prisma db push` (or `prisma migrate deploy`) against that URL.

**Option B — Postgres (Neon / Supabase / RDS):**
1. Create a Postgres instance, copy the connection string.
2. Set `DATABASE_URL=postgresql://...` on Vercel.
3. Switch the Prisma `provider` in `apps/web/prisma/schema.prisma` from `sqlite` to
   `postgresql`, then `prisma migrate deploy`.

### Vercel settings

- **Root directory:** `apps/web`
- **Build command:** `npm run build` (run from repo root so workspaces resolve)
- **Install command:** `npm install`
- **Env vars:** `DATABASE_URL`, `DATABASE_AUTH_TOKEN` (Turso), `NEXTAUTH_SECRET`,
  `NEXTAUTH_URL`, and any `NEXT_PUBLIC_*` flags.

### Auth secrets

```bash
openssl rand -base64 32   # → NEXTAUTH_SECRET
```

## 2. Native Android binary → Expo EAS (later, on demand)

The PWA installs on Android immediately (no SDK). When you want a store-ready APK/AAB:

```bash
cd apps/mobile
npm install -g eas-cli      # one-time
eas login                   # your Expo account
eas build:configure         # writes eas.json
eas build --platform android --profile preview   # → installable APK
# or for the store:
eas build --platform android --profile production  # → AAB for Play Console
```

**Nothing is installed on your laptop** — EAS builds in the cloud and returns the binary.
See https://docs.expo.dev/build/introduction/.

## 3. Phase-2 AI keys (optional, deferred)

When you choose to enable real CV food recognition and the LLM coach, set:

- `OPENAI_API_KEY` — enables GPT-4o Vision food parsing + chat coach.

Until then the deterministic engine handles both, and the LLM swap-in points are already
isolated behind interfaces.


## Production schema changes (Turso)

Do not run prisma db push against production Turso. Use the committed migration
runner instead - see docs/DB-MIGRATIONS.md for the full workflow:
diff, review the SQL, apply, status.
