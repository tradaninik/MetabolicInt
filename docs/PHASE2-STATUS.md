# MetabolicInt - Phase 2 Status

Live app: https://metabolic-int-web-vignan-guild.vercel.app

## What this product is
An educational metabolic-health companion for Indian users: log meals from a 139-food
regional database, log glucose/activity/sleep/weight, and see personalized,
engine-computed glucose predictions - with a learning loop that tunes the prediction
model to each user from their own paired meal + glucose check-ins.

## Core innovation (live now)
Per-user learned carb sensitivity. Every 2-hour post-meal check-in pairs with its meal
and refits the user's model (pure-TS engine, OLS with shrinkage toward a clinical
prior). Progress is visible to the user ("N of 5 check-ins to your personal model"),
and predictions move off the population prior as data accumulates.

## Shipped and deployed (commit-backed)
- cf5e53b  Formalized Turso migration workflow (journaled, idempotent, documented)
- e61de10  Meal-glucose pairing + learned-model update path (2h check-in derivation)
- e989e69  Check-in prompt UI, pre-meal reading, personalization progress counter
- 6a2f3bf  Quick Add: one-tap sugar/walk/sleep/weight logging + repeat-last-meal
- f5c1188  Food search region fallback (e.g. biryani findable from any default region)
- 4885d81  Hardened activity route input validation
- test:    Automated live-deployment smoke harness (scripts/qa-smoke.mjs)
- Meal tray: multi-item meals, combined prediction, engine-computed what-if options
  (half portion / 15-min walk), back-time entry, category browsing, day-so-far
  summary (promoted from final verification - live and in daily use)
- Edit/delete of logged entries with automatic model refit (likewise promoted)

### Custom foods v2 - shipped (docs/CUSTOM-FOODS-V2.md, C1-C6)
Anything from the user's kitchen becomes a first-class, searchable, model-aware
food - created in under 30 seconds, private to its creator (invisible to other
members; foreign logging returns 404).
- d6ed30e  Per-user merged food index (engine stays frozen: app-side merge)
- 1f3af1d  C1 server core: CRUD /api/foods/custom with spec-section-5 validation
           (name-only creates, Atwater kcal, GI floor 1, 100-food cap, own-name 409,
           reference-counted 409 deletes), /api/foods owner-scoped visibility +
           mine=1 + mine-first ranking, /api/meals foreign-id 404, dashboard and
           coach answers on the merged index
- 2496de0  C2 form + search UX: empty state with failed-query prefill, yours badge,
           Mine chip, live placeholder count, portion memory ("last time: 2 katori")
- e13bad6  C3 accelerators: packet-label paste-parser (per-Xg rescale, kJ), fork
           from catalog, tray-as-food blending (lib/recipe-blend.ts - GI weighting
           mirrors the tray preview exactly)
- da3127a  C4 My Foods manager (/my-foods + nav): edit, delete with plain-language
           409 reasons, logged counts; auto-parse on paste; label cleared on save
- d2338ce  C5 smoke checks 13-21 (cross-user privacy verified) + local QA seed user
- bb90d33  C6 closure: 40195d9 landed the tools only; bb90d33 landed the closure docs (C1-C6 all closed)
Verified: vitest 99/99 (packages 67 unchanged: engine 59 + food-db 8), builds green, production smoke 9/9
against the live deployment.

Deviations from spec (pre-approved rulings):
- Validation lives in lib/food-validation.ts, not inline in the route - shared
  with the form (GI_BANDS) and unit-tested directly.
- Category/region unions hardcoded from packages/engine/src/types.ts: the catalog
  spans 12 of 13 categories (no nut foods), so deriving from FOOD_INDEX would
  reject valid customs.
- Atwater-implied kcal above 900 is rejected with an explanation, not stored.
- qa-smoke-custom.mjs ships standalone rather than merged into qa-smoke.mjs.

Test baseline: 99/99 across 13 files - engine 59, food-db 8, food-index 7,
food-validation 16, label-parser 4, recipe-blend 5. Gate per commit: vitest +
build + browser checklist; production verified via the smoke suite.

## Safety and compliance posture
- Educational positioning throughout: every prediction/coach surface carries the
  disclaimer; reference values labeled as educational, doctor's targets take precedence
- No medication or dose guidance of any kind; no diagnosis
- Person-first, non-judgmental coaching copy (motivational-interviewing tone)
- Health data treated as sensitive under India's DPDP Act: no third-party data flows,
  no uploads this phase; export/delete flows planned before any such change
- Engine math is a frozen, unit-tested package; all product logic is app-side

## Next phases
- Phase 2c (schema, migration-gated): lab results with HbA1c-eAG trend view and
  doctor-questions list, day-context tags ("why this spike?" attribution), medication
  logging (adherence % only), user target ranges
- Phase 2d: weekly review ritual, consistency score with grace days, education card
  library (food sequencing, post-meal walks, festival playbook), waist/WHtR emphasis
- Under consideration (v2.1, user-driven): persistent 2h check-in reminders with
  one-tap glucose logging (highest model-data leverage), settings page (profile and
  region editing; future home for DPDP export/delete), streaks/achievements surface,
  visual depth pass. True 3D visualization remains a spec-first decision.