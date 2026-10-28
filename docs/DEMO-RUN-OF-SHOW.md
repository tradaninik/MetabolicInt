# MetabolicInt — 3-Minute Demo Run-of-Show

> P8 Day 4 demo materials. Target: one live 3-minute walkthrough on a laptop
> (or the demo account on any device). Every step below is real app behavior —
> nothing is mocked. Timings assume a warmed-up dev or production build.
>
> **Demo account:** `demo@metabolic.dev` / `demo1234` (prefilled on the login
> page — just click **Sign in**). The account carries seeded history: 42 food
> entries and 28 glucose readings, so every dashboard chart has real shape.
>
> **After the meeting:** remove the account and ALL its data with
> `apps/web/scripts/demo-account-cleanup.mjs` (dry-run by default, `--yes`
> to delete; FK-safe child-first order). See repo README "Demo account".

---

## Pre-demo checklist (5 minutes before)

1. App running and logged out (shows the login page with prefilled demo creds).
2. `/recipes` seeded catalog present (300 recipes; verify the page shows cards).
3. Browser zoom ~110%, sidebar collapsed on laptop for max content width.
4. The ingredient words you will type are confirmed in the picker: `curd`,
   `rice`, `onion`, `poha` (all verified in the seeded leftover core).
5. Know your fallback: if typing is slow, suggestions appear after 2 chars —
   click instead of typing.

## The story you are telling (one sentence)

"You told us the hardest moment is 8pm with a half-empty kitchen — today the
app answers that moment."

---

## 0:00 — 0:20 | Login + one glance at the dashboard

- Click **Sign in** (credentials are already prefilled).
- Land on Dashboard. Point once at the glucose trend and the day strip —
  "this is the seeded demo history, real shape, real engine numbers".
- **Do not tour other pages here.** Discipline: the demo is about tonight's
  dinner problem.

## 0:20 — 0:50 | Set up the problem

- Say: "It's 8pm. I have curd, some rice, an onion, and poha. Old me would
  order in."
- Click **Recipes** in the sidebar.
- Click the **Cook with what I have** toggle (top of the page).
- Type `curd` → click the suggestion. Repeat for `rice`, `onion`, `poha`.
  Four chips appear.

## 0:50 — 1:40 | The match (the payoff)

- Leave mode on **Pantry cooking**. Click **Find**.
- Read one card out loud, exactly as rendered: "you have 6 of 8 — need
  mustard seeds and curry leaves". This is the honest-coverage line: the app
  never pretends you can cook it, it tells you the two things missing.
- Point at the coverage bar and the carb-tier badge on the card — "LOW tier
  means under 20g net carbs per serving, computed by the same engine that
  scores every log entry".
- Now click **Leftover night** and **Find** again. Leftover-friendly recipes
  float to the top — "curd rice is the answer it gives most Indian kitchens".
- Say the no-promises line if asked what it means for sugar: "the app shows
  carb tiers and your own logged responses; it does not make treatment claims."

## 1:40 — 2:20 | Browse the catalog behind it

- Click **Browse catalog** toggle.
- One sweep: 300 recipes, meal/cuisine/tag chips, and the tier split —
  "169 LOW, 124 MODERATE, only 7 HIGHER, because the catalog was seeded with
  the tier computed per serving, not hand-labeled".
- Click one cuisine chip (e.g. Telugu) — category card images render lazy
  with fixed aspect, no layout jump.
- Click **Save** on one card → toast + it lands in My Recipes.

## 2:20 — 2:50 | The architecture credibility beat (30 seconds, talk over any screen)

- "The matcher is a pure library with 29 new unit tests — 520 passing
  overall, three type-checks clean, and both live smokes green this morning."
- "Same API-first rules as every feature: 401 without a session, plain-text
  400 on bad input, idempotent saves."

## 2:50 — 3:00 | Close

- "Tonight the answer to 'what can I make' is already on your phone."
- Q&A off the clock.

---

## Fallbacks

| Risk | Recovery |
| --- | --- |
| Ingredient suggestions lag | Pick from the first suggestion list; it loads on focus |
| Wrong recipe ranked first | That is honest ranking — read the coverage line, move on |
| No network / app down | The PPT deck's product slides carry the same story |
| Question drifts into medical advice | Point at the medical-disclaimer footer: information + tracking, not treatment advice |

## Cleanup (after the meeting)

```bash
cd apps/web
DEMO_EMAIL=demo@metabolic.dev node scripts/demo-account-cleanup.mjs        # dry-run
DEMO_EMAIL=demo@metabolic.dev node scripts/demo-account-cleanup.mjs --yes  # delete
```
