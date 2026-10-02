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

All of the above verified: engine suite 67/67, production builds green, deployments
Ready, live-Turso inspection of the derivation pipeline.

## In final verification (code complete, going through release gates)
- Meal tray: multi-item meals, combined prediction, engine-computed what-if options
  (half portion / 15-min walk), back-time entry, category browsing, day-so-far summary
- Edit/delete of logged entries with automatic model refit

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
  logging (adherence % only), user target ranges, custom foods
- Phase 2d: weekly review ritual, consistency score with grace days, education card
  library (food sequencing, post-meal walks, festival playbook), waist/WHtR emphasis