# Project Log

---

## 2026-10-22 - Phase 3 closeout (KI-1, P3-5, prod redeploy)
- KI-1 CLOSED: son@metabolic.dev 401 root cause = account never existed in prod DB (anti-enumeration message). Auth verified end-to-end (bcryptjs $2a$10 write + verify). No code defect.
- P3-5 smoke (login / session / reports-csv / glucose / meals): 5/6 accounts FULL GREEN on fresh prod build. Transient PS keep-alive drops documented (demo@ recovered; priya@ retry queued). arjun@ removed from smoke list by request (account intact in DB).
- Credentials: all 6 demo accounts now share demo1234 (reset tool, bcryptjs cost 10, verify-after-write).
- Deploy: metabolic-int-mndc36krb -> metabolic-int-web.vercel.app (Ready 1m). PENDING: Vercel Functions region to bom1 (Mumbai) to co-locate with Turso ap-south - applies on next deploy, should cut cold-start/keep-alive transients.
- Phase 4 order (locked): P4a Safety First (U25 hypoglycemia guardrails, P0, clinical review gate) -> P4b Know Your Body (U11+U14) -> P4c Food as Medicine (U16+U17+U19) -> P4d Rhythm and Digestion (U12+U13+U20) -> P4e Movement and Mind (U21+U22+U23) -> P4f Kitchen Pharmacy and Herbs (U18+U15, clinical review gate) -> P4g Medication Stewardship and Doctor Report (U26+U24, CSV injection fix gate).
- Payment / monetization: deferred until after all Phase 4 features; planned as pre-launch workstream.
- Known debt: CSV formula injection in apps/web/src/app/api/reports/route.ts csvCell - neutralize leading =,+,-,@ characters before U24 ships.

---

## 2026-10-23 - P4a shipped: U25 Hypoglycemia Guardrails (P0)
- Always-on educational guardrails. No flag, no migration; verdicts computed on read, never stored.
- Engine: packages/engine/src/glucoseGuard.ts + vitest unit tests (boundaries 70/69/54/53, validation 20-600, 24h pattern).
- POST /api/glucose: rejects <20 or >600 mg/dL (400), returns guard verdict alongside reading; 24h pattern aggravator (>=2 readings <70).
- UI: GlucoseGuardBanner (red <54, amber 54-69) on /glucose latest reading + after each save in GlucoseLogger.
- Drive-by fix: apps/web/src/app/glucose/page.tsx had lass30 typo (ReferenceError crashing the /glucose page) - corrected to last30.
- Smoke: POST 65->level1, 50->level2, 5->400, 105->none; /glucose page returns 200 again.

## 2026-10-23 - P4b deployed (commit c62c582)

- Shipped U11 Prakriti quiz + U14 Ritucharya seasonal guidance (Know Your Body).
- Engine + tests verified locally (esbuild + harness) before delivery; 11 files / 81 engine tests, 175 total.
- Prod Turso migration 0004 applied; Prisma client types regenerated after stale-client build failure.
- Commit initially missed the dashboard patch; amended to c62c582 before push.
- Prod smoke: /prakriti 404 -> 200 after Vercel deploy; API GET/POST guard 401 with Unauthorized body.
- Browser E2E: quiz submit + dosha result + dashboard SeasonalCard confirmed.
- Prod 500 root cause: prod Turso DB missing 0004 tables (no such table main.PrakritiProfile); db:migrate:status first hit LibsqlError SERVER_ERROR HTTP 404 from a stale Turso token - fresh dashboard token captured via clipboard-watch (never printed) unblocked it; 0004 applied (2 statements), 22 -> 23 tables, tracker 0001-0004 green.
- Signed-in E2E re-verified on prod: {"profile":null} -> quiz -> dosha percentages -> persisted profile on re-GET; SeasonalCard confirmed (Sharad - autumn; initially missed below the charts fold).
- Nav follow-up: /prakriti added to AppShell NAV (desktop + mobile) in commit 76d4fed.
- libsql-probe.mjs committed under apps/web/scripts as a reusable read-only DB diagnostic.
