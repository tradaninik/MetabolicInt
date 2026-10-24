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

## 2026-10-24 - P4c deployed (0d07225, 46e50ff, 9f43862) + closeout commit

- All four P4c blocks applied on main via the gated artifact protocol (patch + bundle fallback + SHA256-verified PowerShell script, y/n gates, one commit per block, --reset-author --no-edit so no editor ever opens; rebase/am leftover-state preflight added after a user-side `git am` mishap).
- Suite evolution: 24 files/211 -> 27/267 (user-verified locally after P4c-b) -> 30/324 (P4c-c; user skipped local run, Vercel deploy of 9f43862 is the backstop) -> 31/336 (P4c-d, sandbox-verified).
- Sandbox verification per block: full vitest green + next build clean (49 routes; only the pre-existing /log <img> warning; out-of-repo DATABASE_URL for page-data collection).
- P4c-d closeout: global medical disclaimer shipped - canonical strings (lib/disclaimer.ts) rendered by AppShell footer on every authed page, login page, printed report footer, and PWA manifest description; content + danger-language + wiring tests. ROADMAP forward plan updated (locked P4d-g spine; P5 Mobile and Reach; P6 Stress & Cortisol - user correction, was drafted as kidney care; P7 My Kitchen; P8 Organ Labs platform, kidney first; backlog).
- Zero migration across all of P4c (0005 stays reserved). No package.json changes.

P4c prod smoke checklist (run after the P4c-d deploy goes green):
1. /healing-foods: page loads; three lens tabs switch; evidence badges render; rebuttal box visible on Science lens; seasonal badge correct for current IST month.
2. /log: search results show taste/dosha badges; tray shows "Tastes in this meal" strip with honest coverage count; add milk + fish to tray -> amber viruddha strip with classical rationale AND modern note; save in a low-agni window -> late-meal educational banner.
3. /dashboard: AgniRhythmCard below SeasonalCard; integer agniScore 0-100; rhythm habit entries render.
4. Unauthenticated GET /api/ayurveda/agni and POST /api/ayurveda/viruddha -> 401.
5. Disclaimer footer visible at the bottom of every authed page with expandable "Why we show this"; /login shows the short line under the form; printed report carries the report disclaimer; manifest description shows the not-medical-advice framing.
6. E2E happy path: prakriti quiz -> healing-foods lens browse -> log a meal with taste overlay + viruddha warning -> dashboard agni card -> reports print.

Pending user-side verification: Vercel deploy status for 9f43862 (P4c-c) and the P4c-d commit; optional local npm test (expect 31 files / 336 tests).

## 2026-10-24 - S-0 shipped: CSV formula-injection neutralization (both export paths)

- Shared csvCell in apps/web/src/lib/export-format.ts now prefixes an apostrophe to formula-shaped cells (leading = + @ tab CR LF; leading '-' only when the rest is not a plain number) per the OWASP CSV-injection guidance, applied before RFC 4180 quoting. Pure negative numbers (-3, -2.5, -1e3) keep their numeric form.
- /api/reports dropped its private string-only csvCell and imports the shared helper; /api/export (all 21 tables) inherits the fix through toCsv. Wiring-scan tests pin both paths to the shared escaper so a local copy cannot silently reappear.
- 12 new tests: payload defusal (Excel/DDE classics), numeric round-trip, neutralization+quoting composition, toCsv integration, wiring scans. Suite: 31 files / 348 tests green; next build clean (49 routes, only the pre-existing /log img warning).
- Zero migration (0005 stays reserved); no package.json changes; engine and food-db untouched.
- Context: P4c-d final revision pushed to origin/main as 4be593e (superseded revision-1 33a24df replaced via force-with-lease after two pre-flight checks: exactly one remote commit, delta = ROADMAP.md one line).

S-0 prod smoke checklist (after the deploy goes green):
1. GET /api/reports (signed in) - CSV downloads as before; ordinary rows unchanged.
2. Optional end-to-end proof: create a custom food named =SUM(1) (or +test), log it, then download /api/reports and /api/export?table=customFoods - the cell must render as '=SUM(1) (apostrophe prefix, no formula evaluation in Excel/Sheets); delete the food afterwards.
3. Negative values (if any are logged) still export as numbers, not text.
