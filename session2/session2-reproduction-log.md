# MetabolicInt — Session 2 — Reproduction & Baseline Log (pre-build record)

Sandbox: fresh clone of https://github.com/tradaninik/MetabolicInt, main @ 25ed988 verified
("Merge pull request #1 … session1-dashboard"), clean tree. Date: 2026-10-28 (IST).

## Baseline gates (all green, before any work)

| Gate | Result |
|---|---|
| `npm test` (root, vitest) | **616 passed | 3 skipped (619), 51 files** — exact baseline match |
| `tsc --noEmit` engine / food-db / web | silent ×3 |
| `npm run lint` (apps/web) | exactly the 3 known `<img>` warnings: log/page.tsx:597, CookWithWhatIHave.tsx:452, RecipeCatalog.tsx:497 (+ the `next lint` deprecation notice Mission E will address) |
| `next build` w/ `DATABASE_URL="file:./build-check.db"` | "✓ Compiled successfully in 15.0s" + the 6 documented pre-existing `prisma:error … no such table` lines (User ×3, FoodEntry, Food, GlucoseReading) on the empty build DB — identical to baseline, not failures |

## Environment notes (for reproducibility)

- Sandbox npm ALSO blocks install scripts (mirrors the owner's Windows setup). `npm install`
  at root + explicit `npm run db:generate` in apps/web → Prisma client generated; vitest/esbuild
  ran fine without their postinstall scripts.
- Local `.env` created from `.env.example` with `NEXTAUTH_URL="http://127.0.0.1:3000"`
  (gitignored; aligned with the browsing origin — the login POST otherwise risks CSRF/origin
  mismatch). `npm run db:push` + `npm run db:seed` → 256 foods, demo user
  (demo@metabolic.dev / demo1234) + 14-day history, 300 catalog recipes.
- Sandbox reaps background processes between tool calls → every browser capture runs as a
  single-call script (saved under scripts/): session2-capture.sh, session2-probe2.sh,
  session2-tooltip*.sh, session2-predict-tip.sh, pw-tooltip-test.cjs.
- **Local-only DB writes for reproduction:** a 5/5/2 (vata/pitta/kapha) PrakritiProfile row was
  POSTed as the demo user on LOCAL dev.db to live-reproduce the tie-break display. Nothing was
  written to production (prod was logged into read-only, screenshots only).

## Reproduction results (Mission A)

- Local /dashboard at 390 / 768 / 1280: all charts render (2 recharts surfaces + health-ring
  SVG); screenshots dashboard-{390,768,1280}.png with console logs/errors captured per width.
- Production https://metabolic-int-web.vercel.app: up; /login 200; /dashboard 307→login when
  signed out; after demo login, charts render at 1280 AND 390 (prod-dashboard-*.png). No
  SSR/hydration failure. Prod demo account "today" is data-sparse (steps 0, glucose mostly
  forecast) — honest rendering, flagged as A4 observation.
- Console: one error type only — React key-spread warning from MeasuredDot
  (GlucoseTodayChart.tsx:182), all widths, local + prod.
- Tooltips: verified WORKING via real Playwright mouse events (pw-tooltip-dashboard.png shows
  "3:42 pm · 134 mg/dL ▼ 3 vs your usual at this hour … this is your latest reading").
  Two agent-browser CLI mouse probes failed to trigger them — automation artifact, not a bug;
  worth knowing if you ever script UI checks with that tool.
- Mobile nav exists (bottom tab bar + More sheet). Timeline horizontal scroll is by design.
- Steps sparkline = 7 CSS bar divs (MetricCards.tsx:137–148) — mockup deviation confirmed.
- WeightForecastChart height is 190px fixed (prompt guessed ≈220) — renders correctly.

## Reproduction results (Mission B0)

- Live-reproduced the B1 complaint: 5/5/2 tie → "Your profile: Vata primary · Pitta secondary"
  at 42%/42% (prakriti-tie-result-42-42.png). Quiz-state screenshot prakriti-before-quiz-state.png.
- Full code map in MISSION-B0-gap-list.md (engine, tests, API, page, quiz component, schema,
  linkable modules).

## Mission D baseline data (captured for the later triage, nothing changed)

`npm audit` = 18 vulnerabilities (6 moderate / 8 high / 4 critical) — matches your baseline.
Saved: npm-audit-baseline.json. Fix-type summary:
- **critical `next` + `next-auth`: semver-safe fixes exist** (runtime deps — top priority).
- vitest family (vitest/vite/vite-node/tinypool/esbuild/@vitest/mocker): fixes need
  **vitest@5 major bump** → written proposal only, per your rules (dev/test chain exposure).
- Remaining 10 (browserslist, brace-expansion, js-yaml, nanoid, postcss,
  postcss-selector-parser, sharp, source-map-js, baseline-browser-mapping, uuid):
  semver-safe transitive bumps, mostly build/dev chain.
- `npm audit fix --force` was NOT run; nothing has been upgraded.

## Deliverables in this folder

- MISSION-A-gap-list.md — numbered A1–A5 + proposed build order (awaiting sign-off + mockup)
- MISSION-B0-gap-list.md — numbered B0-1…B0-14 + proposed build order (awaiting sign-off;
  open decisions B0-10 placement, B0-11 storage)
- session2-reproduction-log.md — this file
- ../session2-screens/ — all screenshots, console logs, audit JSON
