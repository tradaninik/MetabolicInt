# Mission F — Phase 3 Roadmap Proposals (v2, regenerated)

> **v2 note:** the original copy of this report was lost in a workspace
> reset. The five directions below are the committed proposals from the
> session; the original document's fuller elaboration is gone, so treat this
> as the decision-ready summary — once you pick directions, we expand each
> into a proper spec before any code.

Nothing here is built. These are proposals that build on what already
exists, ordered so each one compounds the last.

## 1. Phase 3 planner

A planning surface: plan tomorrow (or the week) meal-by-meal from your own
recipes, healing-foods shortlist, and the glucose forecast — then log the
day with one tap instead of building trays meal-by-meal.

- **Builds on:** `/api/recipes` (per-serving math already exact), the
  healing-foods "For you today" ranked shortlist, `forecast.ts`, and the
  saved-combos tray flow on `/log`.
- **Why now:** logging friction is the biggest dropout risk; planning
  converts logging from a chore into a confirmation.
- **Open questions:** plan granularity (day vs week), how planned-vs-eaten
  deltas should surface in insights.

## 2. Four-layer food personalization

Rank every food through four stacked lenses, each layer narrowing the last:

1. **Evidence base** — GI / glycemic load / net-carb math (exists: engine
   nutrition + GI weighting in the tray and recipes).
2. **Condition lens** — prediabetes/T2D targeting (exists: food-as-medicine
   ranking).
3. **Personal history** — your own logged post-meal responses (exists as
   data: meals + glucose; needs a feedback loop into ranking).
4. **Tradition lens** — prakriti profile + classical properties (exists:
   `profileLabel` from B1, TraditionLensData on the dataset; the Ayurveda
   off-switch already gates it).

- **Why now:** B1 shipped the profile semantics; the ranking-neutral
  tradition lens proved the pattern. Layer 3 is the only genuinely new
  engine work.
- **Open question:** how aggressively layer 3 should re-rank vs merely
  annotate (safety: associations, never causes).

## 3. Learning library

A structured home for the "why": short, sourced explainers linked from
everywhere the app makes a claim — food profiles, insights cards, lab
comparisons. Reuses the amber "Ancient practice" section pattern (classical
text / classical kitchen / household tradition labels) for provenance.

- **Builds on:** healing-foods per-food profiles, the insights card system,
  `/healing-foods` two-tier layout.
- **Open questions:** authoring format, how deep to go, offline caching
  (PWA precache already exists).

## 4. Insights hub

One home for understanding: patterns, attribution, forecast, lab compares,
and the prakriti story in a single browsable surface — evolving the unified
`/insights` (Patterns | Ask coach) that already absorbed `/coach`.

- **Builds on:** `patterns.ts`, `attribution.ts`, `insights.ts`,
  `labCompare.ts` with its between-reports context, all already wired to
  real data.
- **Open question:** whether the hub becomes the dashboard's "Understand"
  zone (see below) or stays a destination page.

## 5. Four-zone IA (the umbrella proposal)

Reorganize navigation into four zones — roughly **Track** (log, glucose, BP,
labs), **Foods** (search, my-foods, recipes, healing-foods), **Understand**
(insights, predict, reports), **Plan** (planner, settings) — instead of the
current long nav. This is the structural change that makes items 1–4
navigable instead of additive.

- **Why now:** the nav has grown one feature at a time; a zone model keeps
  Phase 3 additions from crowding it further.
- **Open question:** zone names and membership; needs a pass against real
  usage before committing.

## Suggested order

Planner (1) → four-zone IA (5) → insights hub (4) → four-layer
personalization (2) → learning library (3). Rationale: the planner creates
the daily habit, the IA makes room, the hub gives the understanding
surface, personalization deepens it, and the library explains it. But this
is your call — pick any subset and we spec it properly first.
