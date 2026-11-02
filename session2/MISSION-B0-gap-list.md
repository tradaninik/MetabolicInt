# MetabolicInt — Session 2 — Mission B0: Current-State Map & Gap List vs Spec

## Current state (all read & live-verified at main @ 25ed988)

**Engine — `packages/engine/src/prakriti.ts`** (139 lines)
- 12 questions, 3 options each, exactly ONE dosha tag per option (`PRAKRITI_QUESTIONS`).
- `scorePrakriti(answers)` counts tags; integer-only percentage math (floor + largest-remainder)
  that always sums to 100 — share-of-answers semantics are already mathematically correct.
- Line-2 comment documents the deterministic tie-break `vata > pitta > kapha`; ranking sort
  falls back to `DOSHA_ORDER` on equal counts. Returns `{counts, pcts, primary, secondary}` —
  NO profile-label concept.
- Tests — `prakriti.test.ts` (6 tests). Lines 29–49 assert tie→dominance
  (4/4/4 → vata primary; 5/5/2 → vata 42/42/16 → "vata primary"; 2/5/5 → pitta primary).
  These are the tests B1 will deliberately update (documented in WORKLOG, never silently deleted).

**API — `apps/web/src/app/api/ayurveda/prakriti/route.ts`**
- GET: 401 without session; returns questions + latest profile (rescored pcts from stored
  answers). POST: 401; validates all 12 answers; creates a NEW row per retake (history
  preserved). No versioning, no history endpoint.

**UI — `apps/web/src/app/prakriti/page.tsx` + `components/PrakritiQuiz.tsx`**
- Server page (auth redirect) + client quiz: all 12 questions on one page grouped by domain,
  option-card radios, submit disabled until complete.
- Result view: "Your profile: **Vata primary · Pitta secondary**" + 3 static bars (X/12 + %)
  + retake (clears answers) + back-to-dashboard. **Live-reproduced the spec's exact complaint:**
  submitted a 5/5/2 tie → displays "Vata primary · Pitta secondary" at 42%/42%
  (`prakriti-tie-result-42-42.png`). No history list, no compare, no explainer, no dosha
  detail, no preference links.

**Schema — `prisma/schema.prisma`**
- `PrakritiProfile`: answersJson + vataScore/pittaScore/kaphaScore + primaryDosha/secondaryDosha
  + takenAt, `@@index([userId, takenAt])` — full retake history already queryable. Kapha is
  derivable from stored answers (12 − Vata − Pitta) or from kaphaScore directly.
- `UserSettings`: glucoseUnit + 8 glucose-target floats ONLY. No prefs column, no
  Ayurveda-disable flag, no prefsJson anywhere.
- Existing localStorage precedent: SuggestionsCard "Add to plan" persists on-device
  (IST-day keyed) — the "equivalent existing pattern" B4 alludes to.

**Existing modules available for B2/B3 links (no new data stores needed)**
healing-foods (already dual-lens: `AyurvedaLens` / `ScienceLens` / `TraditionLens` — a ready-made
traditional-vs-evidence labelling pattern), recipes + by-ingredients, log (meals/activity/sleep),
SeasonalCard (ritucharya), AgniRhythmCard, ancientPractices, insights.

## Numbered gap list vs the B1–B5 spec

**B0-1 — Tie/near-tie semantics (B1).** `scorePrakriti` resolves ties via deterministic
tie-break and the UI leads with "X primary". Fix (engine-first, tests BEFORE UI): add a
`profileLabel` to the result — ties → "Vata–Pitta profile" (both named, en-dash, ordered by
score then alphabetical); clear winner keeps current naming. Keep `primary`/`secondary` fields
for backward compat; UI leads with the profile label. Update the 3 tie-break tests
(prakriti.test.ts:29–49) deliberately; WORKLOG documents every test change; count may only rise.

**B0-2 — Percentage framing (B1).** Engine math is share-of-answers by construction, but the
result UI shows bare "X/12 (Y%)" with no framing. Fix: copy changes only — label shares as
"share of your 12 answers", add the explicit "not a biological constitution %" guard; never
"your body is 42% Vata".

**B0-3 — Questionnaire versioning (B1).** No QUIZ_VERSION exists. Fix: engine constant now,
returned with results (engine + API payloads). NO Prisma column this session; if persistence is
truly needed later, written turso-migrate proposal first (per your rule).

**B0-4 — Three-dosha interactive display (B2).** Current: 3 static bars, no per-dosha content,
Kapha shown as a number but never explained. Fix: Vata/Pitta/Kapha together — score (X/12),
share (%), bar; tap a dosha → short balanced "what the tradition associates with it" panel,
clearly labelled traditional.

**B0-5 — Profile label presentation (B2).** Fix: results lead with the B1 profile label +
"based on the current questionnaire."

**B0-6 — "What this tradition suggests" (B2).** Absent. Fix: short, balanced, explicitly
traditional-interpretation section. Not medical.

**B0-7 — "Explore your preferences" (B2).** Absent. Fix: entry points linking ONLY to existing
modules (healing-foods, recipes, activity/sleep logging, seasonal, agni). No duplicate records,
no new stores.

**B0-8 — Retake history + compare (B2).** Rows already exist + indexed; UI has no history list
and no compare. Fix: extend the API (e.g. GET returns recent history alongside latest) +
results-page history list with score deltas vs previous attempt.

**B0-9 — "How this is calculated" (B2).** Absent. Fix: explainer covering the 12-question
method, one-tag-per-question scoring, share-of-answers math, and the plain statement: not
clinically validated, not a medical measurement.

**B0-10 — "What this means for your day" wellness card (B3).** Absent everywhere. Fix: optional
daily wellness suggestions across Food / Movement / Relaxation / Sleep / Reflection;
preference- and habit-driven framing ONLY ("suggested because it fits your stated preferences
and goals"); dismissible + customisable per suggestion; links into existing modules where one
maps (walk → activity, meal → recipes); never duplicate records. **Open decision — placement:**
prakriti results page (default; keeps the dashboard untouched pending the mockup) vs dashboard
(if the mockup shows it there). Needs your call.

**B0-11 — Preference/dismissal storage (B3+B4 tension to resolve).** B4 says "NO Turso
migration" AND "preferences extend UserSettings (e.g. prefsJson)" — but UserSettings has no
such column today, so (b) would be a schema change. Options: **(a)** localStorage for
dismissals/customisations (zero migration; matches the existing Add-to-plan pattern; per-device)
— default per B4's no-migration rule; **(b)** `UserSettings.prefsJson` via a written
turso-migrate proposal if you want cross-device sync now. **Needs your call.**

**B0-12 — Ayurveda off-switch (B5).** No toggle exists. Fix (depends on B0-11): settings toggle
that hides Ayurvedic personalisation surfaces (wellness card, tradition sections) with ZERO loss
of any medical tracking feature.

**B0-13 — Safety copy (B5).** Good bones already: "traditional self-assessment — not a medical
classification" on the page + the standard medical disclaimer footer (verified both local and
prod screenshots). To add at build time: "self-reported answers, not medical measurements" near
the scores; "discuss with your healthcare professional" wherever herbal interactions could be
implied; hard rule — nothing may suggest a dosha explains/causes/aggravates a glucose reading;
attribution vocabulary stays exactly: observed pattern / possible contributor / insufficient
data; medical/nutritional needs always override dosha-based suggestions.

**B0-14 — Assessment/medical separation (B4).** Data model already separate (PrakritiProfile
has no medical fields). Fix: visual/copy separation on the results page — reuse the
healing-foods dual-lens labelling pattern (traditional vs evidence-based).

**B4 confirmation:** Phase 1 needs NO new tables; NO Turso migration under option (a).
Any perceived need for a new table = written proposal first.

## Proposed build order for B (after your sign-off)

1. B1 engine commit: `profileLabel` + QUIZ_VERSION + updated/new tests (tests first).
2. API commit: version in payloads + history in GET (401-guarded, idempotent POST unchanged).
3. Results-page commit: B0-1/2/4/5/6/7/9 UI (three-dosha display, label, tradition section,
   preference links, explainer, safety copy).
4. History + compare commit (B0-8).
5. Wellness card commit (B0-10) with storage per your B0-11 decision + off-switch (B0-12).
