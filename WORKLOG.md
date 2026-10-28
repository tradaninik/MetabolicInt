# Project Log

---

## 2026-10-29 - Session 2, D-batch-1: critical runtime fixes - next 15.5.28 + next-auth 4.24.15

Mission D (semver-only, small batches, NO --force). Batch 1 = the two CRITICAL runtime advisories, both semver-safe: next 15.5.19 -> 15.5.28 and next-auth 4.24.14 -> 4.24.15 (+ eslint-config-next aligned to 15.5.28; 7 packages changed). Prisma client regenerated after the install. No other dependency touched.

- Gates: 619 passed + 3 skipped · tsc ×3 silent · lint 0/0 · build "Compiled successfully".
- Remaining after this batch: the 10 semver-safe transitive advisories (batch 2) + the 6 vitest-chain advisories that need the vitest@5 MAJOR (written proposal only - see MISSION-D-vitest-proposal.md).

---

## 2026-10-29 - Session 2, E: lint to ZERO + next-lint -> ESLint CLI migration

Mission E (both parts). The 3 known `<img>` warnings are gone and the deprecated `next lint` (removed in Next 16) is replaced by the ESLint CLI.

- E1 img -> next/image: log/page.tsx meal photo (data URL -> `<Image unoptimized>`, identical rendering; the optimizer cannot handle data URLs); CookWithWhatIHave.tsx + RecipeCatalog.tsx category cards (`<Image>` with the same fixed 16:10 box; lazy by default, loading/decoding attrs dropped as redundant).
- E2 lint migration: new eslint.config.mjs (FlatCompat extending next/core-web-vitals - the create-next-app@15 scaffold) + `.next/out/build` global ignores (which `next lint` applied silently) + package.json `"lint": "eslint ."`. `.eslintrc.json` removed. Broader scope than `next lint` (which only scanned source dirs): postcss.config.mjs now linted too - its anonymous-default-export warning fixed with a named const. NO ESLint dependency changes; Prisma untouched (5.22 stays).
- Gates: 619 passed + 3 skipped · tsc ×3 silent · **lint 0 warnings / 0 errors** (was 3 warnings + deprecation notice) · build "Compiled successfully".

---

## 2026-10-29 - Session 2, A2b: explicit key on MeasuredDot (completes the no-console-errors acceptance)

The B-smoke captured a NEW console warning the A-smoke grep missed (it only counted the key-spread string): "Each child in a list should have a unique key prop... passed a child from Line" — 3 occurrences, not present in the pre-session baseline logs. Root cause: A2's first fix removed the spread (which had smuggled recharts' key in) but also removed the key itself.

- Fix: pass an explicit `key` on the MeasuredDot element — `key={p.payload?.t ?? p.index}` (the point's timestamp is its stable identity; index is fallback). This is exactly what React's original error message asked for: keys passed directly to JSX, never via spread.
- Gates: 619 passed + 3 skipped · tsc ×3 silent · lint = the 3 known `<img>` warnings · build "Compiled successfully".
- Verification pending in the final smoke (dashboard console must show ZERO errors of either kind).

---

## 2026-10-29 - Session 2, B-wellness: "What this means for your day" + Ayurveda off-switch (B0-10/11/12)

Mission B step 5, with the two open decisions resolved per the documented defaults (both flagged to the owner): wellness card lives on the PRAKITI RESULTS PAGE (the mockup dashboard shows no dosha-specific card - its three suggestions are pattern/medical), and storage is DEVICE-LOCAL (B4: zero new tables, zero Turso migration).

- New lib/ayurveda-prefs.ts: `mi.ayurveda.personalisation` localStorage preference (default ON, degrades ON on storage failure), mounted-safe useAyurvedaEnabled hook, IST-day helpers, and the wellness dismiss/variant keys - the Add-to-plan device-local pattern, extended.
- New PrakritiWellnessCard (results page, inside "What this tradition suggests"): five categories - Food / Movement / Relaxation / Sleep / Reflection. Ideas are keyed to the user's own quiz answers ONLY (on a tie the categories alternate between the tied doshas - balanced, no winner implied); two variants per category with a "Different idea" cycler (variant persists as the user's preference) and a "Not today" dismissal (resets with the IST day, Add-to-plan pattern). Links only into existing modules (recipes / activity+sleep logging). NEVER a response to any medical reading - the selection deliberately does not read glucose/sleep/steps data (Layer separation: traditional content reacts to stated preferences only).
- Off-switch (Settings -> "Ayurveda personalisation", role=switch): OFF hides the per-dosha tradition panels, "What this tradition suggests", and the wellness card - replaced by a one-line note linking back to Settings. The user's own assessment (label, scores, history) ALWAYS stays visible. Zero loss of any medical feature (nothing on this page is medical). Device-local; if cross-device sync is ever wanted that is a written UserSettings.prefsJson turso-migrate proposal first.
- Safety copy stays hard: every idea is a neutral action or explicitly "the tradition favours/suggests"; nothing claims a medical benefit or mentions any measurement.
- Gates: 619 passed + 3 skipped · tsc ×3 silent · lint = the 3 known `<img>` warnings · build "Compiled successfully".

---

## 2026-10-29 - Session 2, B-history: retake history + deltas on the results page (B0-8)

Mission B step 4. Rows already existed and are indexed — this is UI only, zero schema/API change (GET has returned history[] since the B-API commit).

- PrakritiQuiz captures `history` from the GET payload; after a successful retake it re-runs load() so the latest profile and history always come from the same GET (single source of truth; the POST response is no longer used for state).
- PrakritiResult renders "Your assessment history": newest first, date + no-dominance label + V/P/K counts, the newest tagged "latest", and every older attempt shows "vs previous: V +n · P −n · K ±0" deltas against the attempt just newer than it. Single-attempt accounts get the honest "every retake is kept" line instead of an empty list.
- Gates: 619 passed + 3 skipped · tsc ×3 silent · lint = the 3 known `<img>` warnings · build "Compiled successfully".

---

## 2026-10-29 - Session 2, B-results: Know Your Body results page rebuilt (B0-1/2/4/5/6/7/9 + safety copy)

Mission B step 3. The old result view ("Your profile: Vata primary · Pitta secondary" + 3 static bars) is replaced by a full results page. New components: PrakritiResult.tsx (client) + lib/ayurveda-content.ts (static, clearly-labelled traditional copy).

- B0-1/B0-5: results lead with the engine's profileLabel ("Vata–Pitta profile" on ties) + "Based on the current questionnaire (v1) · last taken …"; ties get an explicit "implies no dominance" note. Legacy primary/secondary is only a fallback for pre-B1 data.
- B0-2: shares are framed "share of your 12 answers" with the guard "Shares describe your answers, not your body's biology — this is not a 'how much of you is Vata' percentage. Self-reported answers — not medical measurements."
- B0-4: the three doshas render as interactive rows (count X/12, share %, bar); tapping expands a per-dosha "What the tradition associates with …" panel (balanced/imbalance qualities), each stamped "Traditional account — not a medical description of you."
- B0-6: "What this tradition suggests" — gentle per-dosha reflection points for the top-count dosha(s), badged "traditional interpretation", footer: medical and nutrition needs always come first; herbal or significant dietary changes belong with a healthcare professional.
- B0-7: "Explore your preferences" links to existing modules ONLY (healing-foods, recipes, log activity & sleep, dashboard seasonal+agni) — no new stores, no duplicate records.
- B0-9: "How this is calculated" collapsible explainer (12 questions, one tag per answer, share-of-answers math summing to 100, ties labelled as ties, not clinically validated, not a diagnosis, retakes kept).
- Safety: no string anywhere describes a dosha as explaining/causing/aggravating a medical measurement; attribution vocabulary untouched (this page makes no medical claims). Internal links use next/link (lint clean).
- Gates: 619 passed + 3 skipped · tsc ×3 silent · lint = the 3 known `<img>` warnings · build "Compiled successfully".

---

## 2026-10-29 - Session 2, B-API: quizVersion + history in GET, B1 fields in every payload

Mission B step 2. The prakriti API now speaks the B1 engine's language; zero schema change (history rows + index already existed).

- GET: single findMany (latest 10, takenAt desc) replaces the findFirst - rows[0] IS the latest, behavior preserved. Response gains `quizVersion` (top level) and `history[]` (takenAt + stored counts + rescored pcts/profileLabel/isTie per row). Every stored row is RESCORED with the current engine, so pre-B1 rows also display the no-dominance label; rows whose answers no longer validate degrade to counts-only, never an error.
- GET/POST `profile` payloads gain `profileLabel` + `isTie` + `quizVersion` (POST response also carries quizVersion top level). POST stays a new-row-per-retake, owner-guarded, 400 on incomplete answers - untouched semantics.
- Gates: 619 passed + 3 skipped · tsc ×3 silent · lint = the 3 known `<img>` warnings · build "Compiled successfully".

---

## 2026-10-29 - Session 2, B1: engine tie semantics - profileLabel + QUIZ_VERSION (Ayurveda Phase 1)

Mission B step 1 (engine-first, tests updated deliberately - see below). The spec complaint, live-reproduced at 25ed988: a 5/5/2 tie displayed "Vata primary · Pitta secondary" at 42%/42% - a tie implying dominance.

- `packages/engine/src/prakriti.ts`: new `profileLabel` + `isTie` on PrakritiResult. Tie (top count shared by 2+ doshas) -> every sharer named with en-dashes, ordered by count then the engine's canonical vata > pitta > kapha order ("Vata–Pitta profile", "Vata–Pitta–Kapha profile"); clear winner keeps "X primary · Y secondary". `primary`/`secondary` keep the legacy deterministic order ONLY for stored rows / API compat - the UI must lead with `profileLabel`. New `QUIZ_VERSION = 1` constant, stamped on every result (no Prisma column - per B4, zero schema change this session).
- Tie-order note: the canonical order matches the spec's own "Vata–Pitta profile" example for the 42/42 case; strict alphabetical on ties would render that case "Pitta–Vata". Flagged to the owner - one-line change if alphabetical is preferred.
- DELIBERATE TEST CHANGES (prakriti.test.ts, 6 -> 9 tests, suite 616 -> 619 passed): the 3 old tie tests are UPDATED, not deleted - each keeps its legacy primary/secondary assertions and gains profileLabel/isTie assertions ("Vata–Pitta profile" for 42/42/16, "Pitta–Kapha profile", "Vata–Pitta–Kapha profile" for 4/4/4). NEW tests: vata/kapha tie label, 1-answer-gap-is-NOT-a-tie boundary, and the QUIZ_VERSION stamp. The unanimous test gains the three new result fields.
- Gates: 619 passed + 3 skipped (51 files) · tsc ×3 silent · lint = the 3 known `<img>` warnings · build "Compiled successfully".

---

## 2026-10-29 - Session 2, A10: glucose chart active pill = green tint

Mission A (mockup fidelity). Mockup: the selected range pill is a light-green tint with dark-green text; the implementation used a solid dark-green pill with white text.

- Fix (GlucoseTodayChart.tsx): active pill -> bg-brand-100 + text-brand-800 (dark: brand-900/40 + brand-200), matching the app's existing selected-nav pattern; inactive pills unchanged.
- Gates: 616 passed + 3 skipped · tsc ×3 silent · lint = the 3 known `<img>` warnings · build "Compiled successfully".

---

## 2026-10-29 - Session 2, A9: sidebar brand = MetabolicInt + heart mark

Mission A (mockup fidelity). Mockup brand: "MetabolicInt" + "Personal metabolic model" subtitle + heart-in-rounded-square mark; implementation read "Metabolic" with a plain green square.

- Fix (AppShell.tsx): brand text -> "MetabolicInt", subtitle line under it (desktop sidebar; mobile top bar stays compact), and a new inline BrandMark component (heart SVG inside the brand square - no new dependencies). Same treatment in the mobile header.
- Gates: 616 passed + 3 skipped · tsc ×3 silent · lint = the 3 known `<img>` warnings · build "Compiled successfully".

---

## 2026-10-29 - Session 2, A8: header "Log glucose" outline button

Mission A (mockup fidelity). The mockup header carries two actions - "Log glucose" (outline) + "+ Log a meal" (solid green); the implementation had only the meal button.

- Fix: add the outline "Log glucose" link to /glucose (its "Log a reading" section) beside the existing solid button, wrapped in a flex gap row. Dark-mode styling included.
- Gates: 616 passed + 3 skipped · tsc ×3 silent · lint = the 3 known `<img>` warnings · build "Compiled successfully".

---

## 2026-10-29 - Session 2, A7: seasonal + agni side-by-side bottom row

Mission A (mockup fidelity). The mockup bottom row shows "Season · Ritucharya" and "Agni rhythm" as two cards side by side; the implementation stacked them full-width.

- Fix: wrap SeasonalCard + AgniRhythmCard in a `lg:grid-cols-2` row on the dashboard (stacked on mobile). Both components drop their own `mt-4` (spacing now owned by the grid) and gain `flex h-full flex-col` so the pair renders equal-height like the mockup. Titles stay honest: "This month: {season}" / "Agni rhythm today" — the mockup's "planner" wording promises Phase-3 planning features that don't exist yet.
- Gates: 616 passed + 3 skipped · tsc ×3 silent · lint = the 3 known `<img>` warnings · build "Compiled successfully".

---

## 2026-10-29 - Session 2, A6: metabolic timeline moved below the charts row

Mission A (mockup fidelity, dashboard-mockup-v1.png). The approved mockup order is metric cards → glucose chart + investigate → **timeline** → score/weight/insights → suggestions → seasonal + agni → footer; the implementation had the timeline dead-last, after Seasonal and Agni.

- Fix: move the MetabolicTimeline block in app/dashboard/page.tsx to directly below the charts row. Pure JSX move; zero component or data changes.
- Gates: 616 passed + 3 skipped · tsc ×3 silent · lint = the 3 known `<img>` warnings · build "Compiled successfully".

---

## 2026-10-29 - Session 2, A2: MeasuredDot key-spread console fix

Mission A (dashboard visual fidelity). The only console error on /dashboard (all widths, local + prod) was React's "props object containing a `key` prop is being spread into JSX" from GlucoseTodayChart's dot renderer: recharts passes `key` inside the dot props, and the callback spread `{...p}` into `<MeasuredDot>`.

- Fix: pass `cx`/`cy`/`payload`/`focusT` explicitly instead of the spread (GlucoseTodayChart.tsx:182). Zero behavior change; the focus-reading amber ring and dot sizes are untouched.
- Gates: 616 passed + 3 skipped (51 files) · tsc ×3 silent · lint = the 3 known `<img>` warnings · build "Compiled successfully" (6 documented pre-existing prisma:no-such-table lines on the empty build DB).

---

## 2026-10-28 - Dashboard revamp v1 shipped (items 1-7, approved redesign)

The approved dashboard redesign v1, implemented commit-by-commit with all gates green per commit. Zero migration (0006 stays reserved); no package.json changes; engine + food-db gained pure modules only.

- Item 1 (hero -> greeting): photo hero replaced by "Good <part of day>, <name>" + honest "Updated <rel> - <source>" stamp (lib/dashboard-stamp.ts: istHour/greetingForHour/latestUpdate/relativeTime/sourceLabel, pure, 12 tests). Stamp = most recent of the user's own records across all seven streams, recomputed every render.
- Item 2 (six metric cards): Glucose-Latest (deviation vs user's own same-hour pattern + source stamp), Time-in-Range (70-140), Steps (7-day sparkline vs own avg + sync stamp), Sleep (vs own usual), Weight (30-day delta), Meds (taken/scheduled from MedicationLog + Medication schedule). New engine module patterns.ts (usualPatternAt, deviationFromUsual, timeInRange, step/stats helpers; 307-line test file). engine-service now loads MedicationLog + DayContextTag + activity source. Seed gains demo metformin schedule + today's taken log.
- Item 3 (glucose chart): GlucoseTodayChart (recharts ComposedChart) - Today/Week/14d toggle; event markers D/M/W/S under the axis (dashed = planned: upcoming med slots are the only planned source until the Phase C planner); measured = solid line, usual-pattern forecast = dashed + uncertainty band; tooltip shows value, deviation vs usual, nearby events; amber ring on the reading of interest.
- Item 4 ('Why was it high?'): engine-first attribution.ts (candidate factors ranked around the latest above-usual reading; three labels ONLY - observed pattern / possible contributor / insufficient data; association never causation) + 184-line test file, then WhyHighCard on the dashboard.
- Item 5 (horizontal timeline): MetabolicTimeline - every event of the IST day as horizontally-scrolling cards joined by arrows, color-coded top borders, planned dashed, focus highlight, every card links to its edit page.
- Item 6 (suggestions): hardcoded "AI Daily Recommendations" replaced by pattern-derived "Today's suggestions" (engine suggestions.ts + tests): from pattern / from model / reminder badges, evidence inline, Add-to-plan persists on-device (localStorage, IST-day keyed) until the Phase C planner ships - the copy says so.
- Item 7 (instant refresh + stamps everywhere): chart subtitle carries its data basis (reading count + latest time + source), insights subtitle aligned to approved copy, page-bottom provenance line ("data shown is yours, entered manually or imported - values update instantly on save"), dashboard-provenance.test.ts wiring scan (11 tests) pins router.refresh() on every save path, bans setInterval/EventSource/WebSocket under components/dashboard, keeps the page a server component. Browser-verified: a QuickAdd save flips the header stamp to "just now" and re-renders cards/chart/timeline with no polling.

Suite: 520 -> 616 passed (+3 skipped constant); tsc x3, lint, build clean throughout (56 pages). Delivery: patch series 0001-0007, one commit per item.

Post-deploy smoke checklist:
1. /dashboard: greeting + Updated stamp (no hero photo); six metric cards each with their own stamp/basis line.
2. Chart: Today/Week/14d pills switch; D/M/W/S markers with dashed-planned; tooltip shows deviation + nearby events; subtitle shows reading count + latest source.
3. "Why was it high?" appears when the latest reading is above the user's usual; three-label vocabulary only; footer keeps the association wording.
4. Suggestions: badges + evidence lines; Add to plan flips to "Added" (device-local until planner).
5. Timeline scrolls horizontally; planned med slots dashed; focus reading highlighted.
6. Quick log any value: header stamp -> "just now", cards/chart/timeline update without a manual reload.

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

## 2026-10-25 - R-1 shipped: healing-foods two-tier redesign + my-foods compact rows (7c0fb56, 956e268, e59c5cd)

- R-1a (7c0fb56): /healing-foods rebuilt two-tier - "For you today" ranked shortlist + full category library, plus per-food profiles at /healing-foods/[slug] (lens tabs, pinned debunk/cautions, "Why this rank"). View-model + pure selection helpers moved to lib/healingFoods.ts (lensPool, pickForYou, groupFoodsByCategory) with 6 tests; same session-guarded /api/food-as-medicine unchanged.
- 956e268: my-foods healing-foods chip switched to next/link Link (client-nav instead of full reload).
- R-1 (e59c5cd): /my-foods rebuilt in the compact-row language of the library - divide-y card list, at-a-glance chips (kcal/GI/logged), classical-property badges inline, full macros behind a native details disclosure; presentation only, same API + edit/delete semantics.
- Suite: 31/348 -> 32/354 green; next build clean (only the pre-existing /log img warning). Zero migration; no package.json changes; engine/food-db untouched.
- Gap noticed post-ship (fixed in S-1): /my-foods never rendered AppShell - sidebar/mobile nav/disclaimer footer were missing since the page was created in C4.

## 2026-10-26 - S-1 hotfix + P5-a/P5-b + ancient-practice tradition lens

User-reported bugs driving S-1: /my-foods showed no left tabs; page loads after login felt slow (was fast before).

- S-1 (hotfix): /my-foods wrapped in AppShell (missing since C4, not an R-1 regression); new appshell-wiring.test.ts pins every authed page to AppShell via page-or-ancestor-layout scan (admin covered by its layout); loadDashboardData runs user+relations and mergedFoodIndex in Promise.all with lean per-relation selects; dashboard page fetches pending check-ins in parallel; apps/web/vercel.json pins functions to bom1 (Mumbai) next to Turso ap-south - the region move noted on 10-22 but never applied. Prod diagnosis: functions were hkg1, dashboard 3.8s cold / 2.7s warm.
- P5-a: public /install page - beforeinstallprompt-backed Install button on Android, step-by-step iOS Share > Add to Home Screen guide, desktop address-bar pointer, standalone "you're in" state; QR is a pre-generated static SVG (public/install-qr.svg, decode-verified outside the repo with qrcode+jsqr so zero runtime deps), shown on desktop only. Discovery links from /login, Settings, and the mobile More sheet.
- P5-b: AppShell's 17-item horizontal mobile strip replaced by a fixed bottom tab bar (Home/Log meal/Foods/Insights + More sheet; 56px cells, aria-current, safe-area padding; desktop sidebar unchanged). sw.js v3 precaches the public shell and falls back unknown navigations to a static /offline page; /api stays never-cached. Offline meal logging: a network-failed tray save queues exact /api/meals POST bodies in IndexedDB (lib/offlineQueue.ts) and replays them on online/visibility/Background Sync/next launch; server rejections never queue, items drop after 5 attempts with a surfaced warning; OfflineQueueStatus badge in AppShell; RecentMeals refreshes via the existing meals-updated event. offline-wiring.test.ts pins the invariants.
- Ancient practices (user ask: "what do the old practices say?"): new optional TraditionLensData on the engine's HealingFood (validator rules + ranking-neutrality tests - content-only lens); 14 of 16 dataset entries carry classical texts (hedged "as commonly taught"), traditional forms (yavagu, sattu, mudde, chyawanprash, triphala, bharwa karela, shatapavali) and 1-4 concrete practices each; vinegar + plate-order stay tradition-free by policy (honest coverage beats padding). Rendered as an amber "Ancient practice" section on every food profile, always visible. /healing-foods gains a server-rendered "Ancient practices" card: 8 classical eating practices (midday main meal, three-quarters rule, six tastes, warm fresh food, eating settled, ginger-lime-salt, shatapavali, ritucharya) each labeled classical text / classical kitchen / household tradition.
- Suite: 32/354 -> 37/381 green (+5 files, +27 tests). next build clean (47 routes; only the pre-existing /log img warning). Zero migration (0005 still reserved); no package.json changes.
- Delivery: gated artifact protocol as usual (patch series + bundle fallback + SHA256-verified PowerShell, y/n gates, per-block commits).

Post-deploy smoke checklist:
1. /my-foods signed in: sidebar on desktop, bottom tab bar on mobile, disclaimer footer present; wiring test ran green in CI-equivalent (vitest).
2. After Vercel deploy: check response headers x-vercel-id contains bom1 (Settings > Functions region if the plan rejects vercel.json - delete the file and set Mumbai there).
3. Dashboard load time after login should drop noticeably (region + parallel queries); compare against the 3.8s/2.7s baseline.
4. /install on Android Chrome shows the Install button; on iOS shows the Share steps; desktop shows the QR (scan it with a phone to confirm it opens /install).
5. Phone: bottom tab bar navigates; More opens the sheet; all pages reachable; 44px+ targets.
6. Log a meal with airplane mode on: amber "saved on this phone" banner; re-enable network: sync badge appears, meals sync, RecentMeals shows them.
7. /healing-foods: Ancient practices card below the library; open Barley / Fenugreek / Amla / Early dinner profiles: amber "Ancient practice" section with classical sources and practices.
8. Signed-out GET /api/food-as-medicine still 401; /install and /offline open signed-out.

## 2026-10-26 - P6 shipped: recipes, unified insights, A-E labs with import + comparison + document vault

The user's asks (verbatim): "can we add recipes here?" / "Integrate AI coach and Insights into one tab" / "add ability to upload reports and data populates in the respective fields automatically. add more fields to enter all data into labs tab. Comparison of one report to the next entered report (say after 3 months) should be available. What went up, what went down, how your food, exercise and other habits played a role" / the A-E master folder + file naming standard.

- P6-a recipes: engine recipe.ts (exact per-serving math = sum ingredients / servings; GI net-carb weighted like the tray; 8 tests); Recipe model (items JSON mirrors SavedCombo but stores only {foodId, portionType, portionValue} - nutrition recomputed at read time via the merged index); /api/recipes (owner-guarded like /api/meals; 409 on duplicate names; delete anytime - logged meals keep frozen numbers); My Foods gains a Recipes tab (create/edit with ingredient search + live per-serving preview) and copy explaining the three concepts (single foods / recipes / saved plates); /log: recipes row + recipe hits in search fill the tray combo-style (one FoodEntry per ingredient); foods/custom DELETE 409 now counts recipe references.
- P6-b unified insights: /insights hosts Patterns | Ask-coach (server-rendered cards + CoachChat extracted verbatim from the old /coach page; coach API + thread persistence untouched); /coach removed as a page, next.config.mjs redirect keeps old links; AppShell NAV 17 -> 16 rows.
- P6-d A-E catalog: engine labs.ts - the user's A-E master structure as data (33 numeric tests + 9 document-first entries, Indian-lab alias table, display-only default adult ranges, direction field, HOMA-IR / non-HDL / CKD-EPI-2021-eGFR display-only derivations, panel validation, standard-filename builder; 18 tests); LabPanel + LabResult models (denormalized userId/performedAt for single-table trends, unique(panelId,testKey)); /api/lab-panels GET/POST/DELETE with hba1c DUAL-WRITE into the legacy Lab table (panelId-tagged mirror; delete cleans both) so the existing /api/labs trend stays the single HbA1c source; /labs rebuilt: HbA1c trend (incl. eAG) first citizen, A-E accordion entry (hba1c keeps %/mmol/mol), panel history with printed-range L/H flags, direction-aware per-test trends; CGM linked to /glucose and BP to the dashboard quick-add, never duplicated.
- P6-c report import: engine labReportParser.ts - deterministic, zero-dep (NO OCR/AI by design): tolerant line/CSV parsing, name-variant alias matching (parentheticals, row numbering, comma suffixes), value/unit/ref-range extraction (glued ranges, "< N" bounds), lab-chain + dd/mm/yyyy date detection, header scan with column inference; unmatched lines surfaced for manual mapping, never silent; 12 fixture tests across Thyrocare/Metropolis/Dr Lal layouts covering A-D. /api/lab-panels/parse (200k cap); ImportReport tab: paste or CSV upload -> review screen (editable pre-filled fields, exact/likely confidence chips, manual mapping dropdowns) -> one save. Photo/PDF-scan auto-fill excluded (OCR = new dep + API key, violates zero-deps); stated in the UI with the P7 offer.
- P6-e comparison: engine labCompare.ts - compareLabPanels (abs + pct deltas, arrows, direction-aware tones: HDL up = emerald, LDL up = red, context gray; derived markers computed per panel), betweenReportsContext (per-logged-day meal macros - fiber derived per entry from Food.fiberPer100g since FoodEntry freezes only kcal/carbs/protein/fat; activity, sleep, weight change, glucose + CGM coverage, meds adherence, BP averages), comparisonNotes (rule-based, hedged: "logged together, not proven cause"; 11 tests); /api/lab-panels/compare assembles context + adherence via the shared computeAdherence; Compare tab: A/B pickers defaulting to the two latest panels, delta table, between-reports context card, amber notes block.
- P6-f document vault: migration 0005 (ONE additive migration for the wave: Recipe, LabPanel, LabResult, ReportDocument CREATE TABLEs + Lab.panelId ADD COLUMN + 6 indexes; chain 0001->0005 applies cleanly to a fresh DB); ReportDocument stores base64 bytes (the only zero-dep option on Vercel's ephemeral FS; @vercel/blob is the approved-only scale-up path); /api/reports/documents (multipart upload, server-side re-checks, plain-language caps 4 MB/file, 200 files, 50 MB total; displayName = YYYY-MM-DD_[Category]_[TestName]_[PatientName].ext from the profile name); /api/reports/documents/[id] (download attachment w/ standard filename or ?inline=1 preview; access = owner OR linked doctor OR caregiver mirroring existing patterns, foreign ids 404; delete owner-only); Documents tab on /labs (A-E folders, upload with live filename preview, usage meter, view/download/delete); /doctor + /family gain "Reports & documents" sections per linked patient/ward (folders + latest-panel comparison summary).
- Suite: 37/381 -> 41 files / 430 tests green (4 new files, 49 new tests; existing 381 unmodified). tsc clean; build clean (47 routes, only the pre-existing /log img warning). Full migration chain + migration-file apply smoke; real 3.5 MB PDF round-trips byte-identical through the storage layer; live API e2e vs the built server (scripts/p6-e2e-api.sh): signup + credentials login, recipe create/list with correct per-serving math, panel saves, /api/labs trend sees dual-written hba1c, parser (date + lab chain + aliases), compare with derived HOMA-IR + notes, 3.5 MB upload with exact standard filename, download byte-identical + Content-Disposition attachment/inline, oversized + wrong-mime rejections with plain language, stranger 401/404, /coach 307 -> /insights. ALL 22 PASS.
- Constraint review: zero new npm dependencies; one additive migration (0005); API request/response shapes of existing routes untouched (me/profile gained additive fields; foods/custom DELETE gained a 409 reason); offline meal queue untouched (/api/meals unchanged); no dose/strength anywhere; "associations, never causes" phrasing in comparison notes; disclaimers stay visible.
- Known limits (deliberate): JSON full-backup export does not yet include Recipe/LabPanel/LabResult/ReportDocument (EXPORT_TABLE_DEFS is pinned at 21 by an unmodifiable existing test - extend together in P7 with a test update); document search/filtering by test not built (folders only); photo/scan import deferred as an explicit P7 decision.

Post-deploy smoke checklist:
1. /my-foods -> Recipes tab: create a recipe (name, servings, ingredients via search) -> per-serving numbers shown -> Log it from /log: recipe chip row + search hit loads the tray, save logs one entry per ingredient.
2. Bottom tab Insights -> Patterns | Ask coach both work; /coach URL redirects to /insights.
3. /labs: A-E accordion entry; save a panel with hba1c -> trend updates (incl. old rows); HOMA-IR / non-HDL / estimated eGFR appear as "computed" rows; panel history expand + delete also cleans the mirrored HbA1c row.
4. Import tab: paste a report text (or CSV) -> fields pre-fill -> unmatched lines offered for manual mapping -> save creates one panel; manual A-E entry still works.
5. Compare tab: two panels -> arrows + colors (HDL up green, LDL up red, context gray) + between-reports context card + hedged notes.
6. Documents tab: upload a PDF -> lands in the right A-E folder -> filename shows YYYY-MM-DD_[Category]_[TestName]_[PatientName].ext on download; >4 MB rejected with a plain message; doctor/caregiver login sees the vault under their linked patient/ward (with the latest-panel summary).
7. Migration: from apps/web run npm run db:migrate:status then npm run db:migrate:prod (0005 applies: 10 statements).
8. Mobile: new controls >= 44px, dark mode everywhere; airplane-mode meal log still queues and replays.
9. x-vercel-id still shows bom1 on dynamic routes.
