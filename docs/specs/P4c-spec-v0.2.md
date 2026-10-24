# P4c — Food as Medicine, multi-lens (U16 + U17 + U19) — Spec v0.2

Status: APPROVED 2026-10-24 — supersedes v0.1. Base commit for P4c-a: 723e1f0 (origin/main,
post-P4b close-out). Posture unchanged: educational, non-medical, session-guarded, no public
surface.

§11 open questions resolved by the owner on 2026-10-24:

1. U16/U17/U19 as re-expressed on the lens framework — **Confirmed**.
2. One new nav entry /healing-foods ("Food as Medicine") — **Approved**.
3. The 16-entry starter list (§5) — **Approved as-is** (grade mix A×1, B×7, C×7, D×1).

What changed from v0.1 (user direction, 2026-10-23): Food as Medicine must NOT be Ayurveda-only.
It now spans THREE knowledge lenses — Ayurveda, scientific research, and lived experience (what
actually worked and healed people living with diabetes). The lens framework is the phase's spine;
U16/U17/U19 are re-expressed on top of it. Everything else from v0.1 (zero-migration posture,
artifact delivery protocol, block-plan shape) is kept.

---

## 1. Phase goal

Build Food as Medicine as a multi-lens knowledge system: the same food or habit can be viewed
through Ayurveda, through scientific research, and through the lived experience of diabetic
people who report it worked for them. The user picks a lens (or sees all three side by side),
gets an honest evidence grade for every claim, and receives Prakriti-personalized ranking when
they have taken the U11 quiz.

## 2. The three lenses (user-confirmed direction)

- **Ayurveda lens** — classical properties: rasa (taste), virya (potency), dosha effects
  (pacifies/aggravates V/P/K), Prakriti fit, Ritucharya (seasonal) notes, classical references
  (e.g., yava/barley among prameha-hara grains; shatapavali ~100 steps after meals; amalaki as
  rasayana). Personalized via the stored PrakritiProfile from migration 0004.
- **Science lens** — research properties: glycemic index/load, fiber, key nutrients, mechanism
  notes, and an evidence grade A–D with a descriptive summary. This lens also carries HONEST
  NEGATIVES: a popular claim with weak human evidence gets grade D and a plain-language verdict.
- **Lived-experience lens** — community patterns: what people living with diabetes widely report
  helped them (millet-first plates, soaked methi seeds, 10-minute post-meal walks, early dinners).
  Always prevalence-labeled (widely / commonly / scattered), always with caveats, never presented
  as clinical proof.

Extensibility: lens ids are an open set. A future "clinical guidance" lens (post-P4g doctor
report) and DB-backed user-submitted stories can plug in without re-architecture.

## 3. Trust & safety policy (phase-wide, non-negotiable)

1. Educational only. No "cure"/"treatment"/"reverse" language anywhere. Disclaimers on every
   surface, and a dedicated lived-experience disclaimer on every story section.
2. Evidence grades, integer and honest:
   - A = multiple randomized controlled trials / meta-analyses
   - B = several trials plus observational support
   - C = early or limited human evidence
   - D = popular claim that human trials do not (yet) support
3. No fabricated citations. Evidence summaries are descriptive (e.g., "meta-analyses of small
   trials report roughly 10–15 mg/dL fasting-glucose reduction with fenugreek"). Named studies
   only where rock-solid (e.g., post-meal walking RCTs in Diabetes Care, food-order RCT 2017).
4. Lived-experience framing: individual anecdotes, prevalence-labeled, always carrying the
   medication caution — "if you take glucose-lowering medication (especially insulin or
   sulfonylureas), adding/removing foods or habits can cause low blood sugar; keep your care
   team informed."
5. Debunk pattern: D-grade entries show the popular claim AND the verdict side by side
   (flagship example: okra water — grade D; whole okra remains a healthy vegetable).
6. Ranking safety: when the user prefers the science lens, D-grade entries are actively demoted.

## 4. Story definitions on the lens framework

### U16 — Food as Medicine explorer + dosha overlay (multi-lens)
- New engine module `packages/engine/src/foodAsMedicine.ts` (pure, no I/O — house rule):
  lens types (`ayurveda | science | stories`), `EvidenceGrade`, `HealingFood` interface with
  three optional lens payloads, `lensesOf`, `validateHealingFood`, `rankHealingFoods(foods, ctx)`
  with integer-only scoring (lens completeness + evidence bonus + Prakriti fit good/moderate/
  avoid ± lens preference + D-grade demotion under science preference), `LENS_META`,
  `EVIDENCE_GRADE_META`, `CATEGORY_META`, `FOOD_AS_MEDICINE_DISCLAIMER`, `STORIES_DISCLAIMER`.
  Reuses `Dosha` (prakriti.ts) and `RitucharyaSeason` (ritucharya.ts) via type-only imports —
  never re-exported (barrel `export *` collision rule).
- New curated dataset `packages/food-db/src/data/healing-foods.ts` (16 entries, §5) exported
  through the food-db barrel — food-db already depends on @mi/engine, zero package.json changes.
- UI: new `/healing-foods` page (session-guarded, AppShell) + `HealingFoodsExplorer` client
  component: lens toggle (All / Ayurveda / Science / Stories), evidence badge per card, per-lens
  sections, cautions strip, disclaimers footer, Prakriti-personalized ranking when a profile
  exists, quiz CTA when not, current-season note via ritucharyaSeason(IST month).
- API: `GET /api/food-as-medicine` — getServerSession guard, returns ranked foods + lens meta +
  evidence meta + disclaimers (programmatic/future-mobile access).
- Nav: AppShell NAV entry `{ href: '/healing-foods', label: 'Food as Medicine' }` directly after
  the `/prakriti` entry (desktop sidebar + mobile nav both driven by the same array).
- P4c-b continuation (v0.1 U16 kept, now lens-aware): rasa/virya dosha badges on /log results and
  /my-foods ("P+ K-" style), "Tastes in this meal" strip — the Ayurveda lens deepening into the
  logging flow via `doshaFoodAdvice` + `mealTasteBalance` from v0.1.
- Tests: engine scoring/validators/disclaimers; dataset integrity (unique slugs, valid grades,
  valid season ids, every entry has ≥1 lens, D-grade entries carry debunk text).

### U17 — Agni and meal-rhythm guidance (lens-aware habits)
- Unchanged from v0.1: `packages/engine/src/agniRhythm.ts`, IST day windows (kapha 06–10,
  pitta 10–14, vata 14–18, kapha 18–22, night 22–06), largest meal in pitta window, dinner
  light and ≥2.5 h before sleep, agniScore 0–100 + nudges, computed on read, zero persistence.
- Lens upgrade: habit entries from the healing-foods knowledge base (post-meal walk, plate
  order, early dinner) surface inside the rhythm card with their evidence grades — the science
  and lived-experience lenses meet the Ayurvedic rhythm story (e.g., shatapavali ≈ the
  widely-reported post-meal walk ≈ grade-A RCT evidence).
- API `GET /api/ayurveda/agni`; AgniRhythmCard on /dashboard below SeasonalCard; educational
  banner on /log when saving deep in a non-pitta window. Tests: window boundaries in IST
  (no DST), scoring edges, midnight stability.

### U19 — Viruddha Ahara checker (classical + modern note per pair)
- Unchanged core from v0.1: `packages/engine/src/viruddha.ts`, classical pair/triple table
  (milk + sour fruit, milk + fish, ghee + honey equal parts, heated honey, ...), severity
  (info | caution | avoid), one-line classical rationale.
- Lens upgrade: every pair also carries a short modern note (science lens: "curdling discomfort,
  not acute danger" / "food-safety overlap with heated honey") — dual-lens honesty instead of
  tradition alone. UI stays amber (educational), never red. Inputs: SavedCombo.items, /log
  basket, POST /api/meals payload. Tests: pair-table integrity, severity ordering, dedup.

## 5. Knowledge base — curated starter set (16 entries)

| slug | category | lenses present | grade | headline |
|---|---|---|---|---|
| barley-jau | grain | all three | B | classical prameha grain; beta-glucan; jau roti swap |
| ragi-finger-millet | grain | all three | B | GI varies with processing; millet-first plates widely reported |
| fenugreek-seeds-methi | legume | all three | B | soaked-seeds practice; ~10–15 mg/dL trial reductions; hypoglycemia caution |
| mixed-pulses-legumes | legume | all three | B | pulses replace refined carbs; chilla/sprouts stories |
| turmeric-haldi | spice | all three | C | anti-inflammatory; glucose effects small/inconsistent |
| cinnamon-dalchini | spice | all three | B | modest effects; Ceylon-over-cassia note |
| bitter-gourd-karela | vegetable | all three | C | classical prameha vegetable; juice-with-meds caution |
| okra-bhindi | vegetable | all three | D | okra-water claim NOT supported; whole okra healthy; metformin-spacing note |
| moringa-drumstick | vegetable | all three | C | shigru; small leaf-powder trials |
| jamun-black-plum | fruit | all three | C | seasonal fruit; kernel-powder studies mixed |
| amla-indian-gooseberry | fruit | all three | C | premier rasayana; limited trials |
| nuts-almonds-walnuts | nut | all three | B | nuts WITH carbs blunt spikes; portion caveat |
| vinegar-before-meals | drink | science + stories | C | diluted ACV before starch; enamel/reflux caveats |
| post-meal-10min-walk | habit | all three | A | strongest evidence in the set; shatapavali; #1 remission-story habit |
| plate-order-veg-first | habit | science + stories | B | food-order RCTs; veg-protein-carb sequence |
| early-dinner | habit | all three | C | early TR trials small; classical light-dinner advice |

Not every entry needs all three lenses — honest coverage beats padding (vinegar and plate-order
deliberately have no classical Ayurvedic content). The list is editable before P4c-a ships;
entries are reviewed like code. **[Approved as-is, 2026-10-24.]**

## 6. Data model decision (unchanged from v0.1: zero migration)

The knowledge base is static, code-reviewed TypeScript data in packages/food-db — not DB rows.
Rationale: (1) today's P4b lesson — a code deploy ahead of a prod migration caused a real 500;
static data deploys with the code and cannot desynchronize; (2) food-db already depends on
@mi/engine, so typed datasets are the established pattern; (3) entries are editorial content
that deserves code review, not runtime mutation. Migration 0005 stays reserved. DB-backed
user-submitted healing stories (with moderation) is a natural future story — candidate P4f
Kitchen Pharmacy territory, explicitly out of scope here.

## 7. UI surfaces (v0.1 question 3 revised)

v0.1 proposed no new nav entries; the multi-lens explorer needs a home. Revised: ONE new nav
entry (/healing-foods, "Food as Medicine") after "Know Your Body". No other placement changes.
**[Approved, 2026-10-24.]**

## 8. Block plan

| Block | Contents | Verify before delivery |
|---|---|---|
| P4c-a | engine lens framework + 16-entry dataset + /healing-foods explorer + API + nav entry + tests + this spec committed to docs/specs/ | full vitest + next build + rehearsal on clean checkout of 723e1f0 |
| P4c-b | U16 overlay badges + taste strip on /log and /my-foods; U17 agniRhythm + AgniRhythmCard + /log banner | same |
| P4c-c | U19 viruddha pair table + combo/meal warnings (dual-lense rationales) | same |
| P4c-d | prod smoke + E2E checklist + ROADMAP/WORKLOG sentinel appends | gated docs commit + push |

Each block ships as one zip artifact (patches/apply script/manifest) under the standing
artifact-delivery protocol: SHA256-in-script, sandbox rehearsal, guards with actionable
messages, fallback chains, least privilege, updateMany-only (n/a — zero migration).

## 9. Acceptance criteria (headline)

- Explorer: signed-in user sees ranked cards with lens sections and evidence badges; toggling a
  lens filters/highlights correctly; user with a quiz sees "ranked for your Prakriti" ordering;
  user without sees the quiz CTA; 401 unauthenticated on the API.
- Honesty: the okra-water entry visibly shows grade D with the debunk verdict; no entry anywhere
  uses cure/treatment language; every stories section shows its disclaimer.
- Safety: cautions strips render for methi/karela/vinegar/early-dinner (med-interaction class);
  D-grade demotion provable by a unit test under science-lens preference.
- Rhythm (P4c-b): agni score stable across midnight IST; late-dinner logging triggers the banner.
- Viruddha (P4c-c): known pair triggers amber warning with BOTH classical rationale and modern
  note; clean combo shows nothing; 401 unauthenticated.
- All: full vitest green, next build clean, prod smoke green per story.

## 10. Out of scope

Medical dosha-treatment plans; CGM × Ayurveda fusion; user-submitted stories and moderation;
honey-heating recipe analysis; doctor-facing Ayurveda views (P4g); payments (post-P4g).

## 11. Open questions (answered 2026-10-24)

1. U16/U17/U19 definitions as re-expressed on the lens framework — confirmed? **Answered: Confirmed.**
2. One new nav entry /healing-foods ("Food as Medicine") — approved? **Answered: Approved.**
3. The 16-entry starter list (§5) — approved as-is, or edit entries/grades before P4c-a?
   **Answered: Approved as-is.**

(The three-lens direction itself was already user-confirmed — not re-asked.)
