Product blueprint: Indian diabetes wellness app — v2
Planning brief · October 2026 · v2: original brief merged with live-product state · Android + iOS · Freemium subscription

v2 supersedes the October 2026 brief. It preserves that document's scope discipline and adds what the live product has since proven: the personalization loop, custom foods, and the existing web estate. Commit-level history lives in docs/PHASE2-STATUS.md; custom-foods specification in docs/CUSTOM-FOODS-V2.md.

1. Product vision and positioning
Working concept: an Indian food-first diabetes wellness companion that helps people with type 2 diabetes make confident daily decisions, build healthier habits, and manage their condition with support from their healthcare team.

The product promise
"Eat the foods you love. Understand your choices. Build healthier habits, one day at a time."

Food-first — Indian meals, recipes, portions, personalized alternatives. Any dish from the user's own kitchen becomes a first-class food.
Intelligent — not just food data: the app learns each user's own glucose responses from their paired check-ins, and shows its work.
Engaging — consistency scoring with grace days, weekly reviews, gentle reminders that taper rather than nag.
Trustworthy — clinically reviewed education, safe boundaries, DPDP-compliant privacy, and predictions governed by an explicit policy (§8).
Target users
Adults living with type 2 diabetes in India who:

eat traditional home-cooked meals or regional restaurant food;
find carbohydrate counting and generic diet plans confusing;
want practical advice without giving up familiar foods;
need motivation to maintain routines over months, not days;
may prefer regional languages, voice input, and simplified health explanations.
Initial focus remains one well-defined audience — urban and semi-urban adults on Android or iPhone comfortable with basic smartphone apps — with older adults and lower-digital-literacy users validated before expanding. The live web app already serves the English-comfortable core of this audience.

What makes the product different
The advantage is not an AI chatbot. It is a trusted Indian food intelligence system backed by structured recipe data, deterministic nutrition calculation, user-defined foods, and practical coaching — plus a second moat the original brief did not yet contain:

Per-user learned glycemic response, visible to the user. Every 2-hour post-meal check-in pairs with its meal and refits the user's carb-sensitivity model (OLS with shrinkage toward a clinical prior — predictions never start from nothing). Progress is shown ("N of 5 check-ins to your personal model") and predictions move off the population prior as data accumulates. A catalog can be copied with effort; a compounding, transparent personalization loop cannot.
Custom foods as first-class objects. Anything from the user's kitchen becomes searchable, model-aware, and private in under 30 seconds — packet-label paste, fork from catalog, or a blend of a logged tray. A generic chat competitor cannot fake this.
Clinical principle (unchanged): nutrition advice individualized and culturally appropriate, not blanket bans on rice, roti, or fruit — consistent with ADA guidance. The learning loop is this principle made literal: individualization computed from the user's own data.

2. Current state (new in v2)
Live: https://metabolic-int-web-vignan-guild.vercel.app — educational positioning throughout.

Shipped on web:

139-food regional catalog (12 categories), region-fallback search, household portions
Meal tray: multi-item meals, combined prediction, engine-computed what-ifs (half portion / 15-min walk), back-time entry, day-so-far summary
Logging: glucose, activity, sleep, weight; quick-add; repeat-last-meal; edit/delete with automatic model refit
The personalization loop: pre-meal reading, 2h check-in prompt, meal-glucose pairing, learned per-user model, visible progress counter
Custom foods v2: private CRUD with validation, packet-label parser, fork, tray-blend, portion memory, My Foods manager, cross-user privacy enforced
Infrastructure: frozen pure-TS engine package (67 unit tests) plus app-level suites; journaled, idempotent Turso migrations; automated production smoke harness
What this de-risks: the original roadmap's Phases 0–2 are partially complete on web, and the vehicles for validation experiments 3 and 4 (§9) already exist.

What it does not: mobile, billing, regional languages, voice, photo recognition, clinical review (no advisor recruited yet), and formal validation datasets. These are the remaining plan.

3. MVP: what to build first
Aim unchanged: prove users log meals, receive useful Indian-food guidance, and return consistently. v2 marks what is already live.

P0 — Indian food database (partially live)
Search by dish name, ingredient, region, or meal — live, with region fallback (biryani findable from any default region)
Household portions: katori, roti, dosa, ladle, glass — live, with per-user portion memory ("last time: 2 katori")
Recipe variants, vegetarian/non-vegetarian filters, nutrition estimates — live for catalog entries
User-defined foods — live (custom foods v2): private, searchable, model-aware; name-only creates with Atwater-validated kcal; packet-label paste (per-Xg rescale, kJ); fork from catalog; tray-as-food blend (GI weighting mirrors the tray preview); 100-food cap; owner-scoped visibility (foreign logging returns 404); My Foods manager
Corrections for portion and ingredients — live via portion memory plus edit/delete with model refit
Catalog: 139 live; 300–500 remains the growth target, reached through pilot-usage-driven curation and the reviewed promotion pipeline (§5) — never by padding
P0 — Meal journal and planner (partially live)
Record breakfast, lunch, dinner, snacks — live
Practical swaps, not prohibitions — live as engine-computed what-if options
Save favorite meals and repeat previous entries — live (repeat-last-meal; custom foods extend this)
Adaptable meal suggestions by preference and budget — planned
P0 — Wellness dashboard and glucose log (live)
Manual glucose logging with timing and units; activity, sleep, weight
Quick-add for non-meal logs
Weekly trends and summaries — basic live; full weekly review is Phase 2d
Self-selected goals — planned (2d)
Medication schedules optional and user-controlled — planned, adherence-only (P1 below)
P0 — Personalization loop (live; this card exists to keep it protected)
Optional pre-meal reading; 2h post-meal check-in prompt; meal-glucose pairing; per-user model refit with shrinkage to a clinical prior; visible progress ("N of 5"); predictions personalize as data accumulates
Governed by the prediction policy (§8): prior-anchored, data-gated, labeled, measured, never dosing-adjacent
P0 — Diabetes education (planned; Phase 2d)
Short lessons: food, glucose, activity, sleep, foot care
Myth-busting quizzes; beginner learning paths
Indian-occasion content: festival playbook (Diwali, wedding season), fasting days (Navratri, Karva Chauth, Ramzan), eating-out guides
Food sequencing and post-meal walks as early cards
Clinically reviewed, versioned, review-dated — requires the clinical advisor (§11)
P0 — Appointment preparation (planned; Phase 2c)
HbA1c entry with date and units; eAG trend where comparable
Doctor-questions list generated from the user's own patterns
Summary of meals, glucose, symptoms, medication history — recorded facts clearly separated from app interpretation
Export/share with explicit user permission, DPDP-compliant
(v1 required this journey but never funded it; v2 fixes that.)

P1 — Engagement layer (planned; 2d / 2.1)
Consistency score with grace days (= v1's "streaks with recovery days" — one concept, one name, non-judgmental framing)
Weekly review ritual: friendly recap of habits, food patterns, one improvement area
Achievements for learning and consistency
Tunable, turn-offable notifications; the virtual wellness garden is deferred until demand is shown
P1 — Medication logging, adherence display only
Record names and times as the user enters them; display adherence %
Hard lines: no dose guidance, no adjustment advice, reminders only from user-recorded instructions (§8)
P1 — AI meal photo recognition (unchanged: launch after catalog and nutrition-engine validation; manual entry always available)
P2 — Voice logging and regional languages
Voice meal entry for low-typing users; regional-language UI
Manual and text entry always remain
Keep out of the first release
Automated medication dosing; diagnosis; reversal or remission promises; ungoverned glucose predictions — ours are prior-anchored, data-gated, labeled, measured, and kept away from anything dosing-adjacent (§8); complex integrations with every glucose device.

4. Core user journeys
Journey A: onboarding and personalization
Welcome and language selection

Explain app and privacy

Basic profile and goals

Food preferences and regional cuisine

Optional health context

Personalized home dashboard

First meal logged

Useful food insight

Collect only what is needed: language, age range, dietary preference, cuisine; user-selected goals and usual meal schedule; optional diabetes duration, medicines, allergies, restrictions; whether the user monitors glucose; budget/cooking-time/ingredient access only if they want meal planning. Never force a medical history before the first meal. Activation event: onboarding complete, one meal logged, one useful insight received.

Journey B: log an Indian meal — extended with verification
Tap Log Meal

Search, quick-repeat, or custom food

Confirm serving and items

Nutrition estimate and prediction

Practical guidance and what-ifs

Save meal

Pre-meal glucose? optional

2h check-in prompt

Post-meal reading pairs with meal

Model refit and progress counter

Daily and weekly summaries update

The core interaction is confirm → understand → save → optionally verify. Verification is optional, gently prompted, and is what feeds the personal model.

Journey C: return and build a habit
Morning: one or two achievable goals. Mealtime: log in a few taps or by voice. Evening: optional activity or glucose entry. Weekly: the review ritual. Nothing mandatory — value at one meal per day.

Journey D: prepare for a health appointment
Enter or import HbA1c; see result, date, units, trend. Generate a summary of meals, glucose, symptoms, medication history; choose questions for the clinician; export or share with explicit permission. Recorded facts are always distinguishable from app interpretation. (Maps to Phase 2c.)

Journey E: learn your own response (new in v2 — the signature journey)
No

Yes

Log a meal

Pre-meal glucose? optional

2h check-in prompt

Post-meal glucose - one tap

Pair with meal, refit your model

Progress: N of 5

5 paired check-ins?

Predictions are now yours

Prompt frequency tapers - burden cap, §8

This journey is the moat. Everything in the product feeds it or gets out of its way.

5. Indian food intelligence
Food data model
Data group
Fields
Status
Identity	dish name, aliases, local-language names, region, category	live; local-language names planned
Recipe	ingredients, quantities, preparation, variant	live for customs (label/fork/blend provenance)
Portion	household unit, grams, typical range; per-user portion memory	live
Nutrition	kcal, carbs, protein, fat, fibre, micronutrients; Atwater-validated for customs	live
Context	veg status, allergens, cooking oil, added sugar	live (subset)
Ownership & visibility	catalog vs. private user-created; owner-scoped access (foreign id → 404)	live
Provenance	source, reviewer, revision date; variant source: label-parsed / forked / tray-blended	live
Confidence	portion confidence, recipe certainty, estimate uncertainty	partial

The dosa principle stands: dish identity is separate from recipe and portion — diameter, thickness, oil, filling, and accompaniments materially change nutrition.

Custom foods (shipped) and the promotion pipeline (new)
Custom foods v2 is shipped and specified in docs/CUSTOM-FOODS-V2.md. v2 adds the opt-in, reviewed path from private custom foods to the public catalog: user consents → entry enters the admin review queue → reviewer validates nutrition and portion → de-identified catalog entry with provenance. This is the honest mechanism behind "the catalog grows from actual pilot usage," and it runs on explicit consent per DPDP.

Food intelligence pipeline
User text, voice, or photo

Food recognition

Candidate dishes and recipe matching

User confirms portion and ingredients

Structured recipe and nutrition engine

Estimate with uncertainty

Reviewed coaching rules

Personalized food guidance

Corrected meal stored

Improve catalog and evaluation

Key engineering rules:

Deterministic nutrition from structured data; AI interprets language and suggests candidates — it never invents nutrition values.
Deterministic-first coaching: today's coach answers by retrieval over the merged food index (catalog + user customs). Any generative surface is graduated into behind the §8 AI pipeline, not started with.
The engine is a frozen, unit-tested package; all product logic is app-side.
Retain corrections (portion memory) so repeat meals get faster to log.
Human review for commonly eaten dishes and low-confidence recognitions.
The personalization loop (second pipeline)
Meal logged

Pre-meal glucose - optional

2h post-meal check-in

Paired record

Refit: OLS, shrinkage to clinical prior

Personal carb-sensitivity model

Personalized predictions and what-ifs

Benchmarks — two datasets, three error axes
Weighed-ingredient, dietitian-validated recipe set → nutrition error
Consented paired meal+glucose logs → prediction error — a unique asset that grows from the loop itself, with consent
Recognition accuracy, nutrition error, and prediction error are measured separately. Identifying a dish does not guarantee a carb estimate; a good carb estimate does not guarantee a good personal prediction.

Launch coverage
South Indian staples (idli, dosa, pesarattu, upma, pongal, rice, sambar, rasam, poriyal, chutneys); North Indian staples (roti, paratha, dal, rajma, chole, sabzi, paneer); common snacks, beverages, fruit, sweets, restaurant meals; homemade variants and household servings. The live 139-food catalog spans 12 categories; expansion follows the pilot audience's cuisine and the promotion pipeline, not an attempt to pre-catalog all of Indian food.

6. Architecture
Current estate (new in v2)
TypeScript web app live on Vercel · frozen pure-TS prediction engine package (runs anywhere TS runs, including React Native, unchanged) · Turso/libSQL with journaled, idempotent, documented migrations · automated test suites plus a production smoke harness · no third-party data flows; health data treated as sensitive.

External

Data layer

Backend platform

Clients

Web client - LIVE

Android and iOS app - planned

Local cache and offline meal logs - planned

API gateway and auth - basic, live

User profile and consent - basic, live

Food catalog and search - live incl. custom foods

Nutrition engine - live, frozen TS package

Meal, habit and glucose services - live

Subscription and entitlement - planned

AI layer - deterministic coach today

Turso / relational

Search index

Private object storage

Analytics and audit events

AI model provider

App Store and Play billing

Optional health APIs

Technology stack
Layer
Decision
Why
Mobile	React Native + TypeScript (leaning decided)	shares the frozen engine, validation library, and types; Flutter + FastAPI would strand them
Backend	TypeScript (existing web API; modularize as it grows)	one language across engine, web, mobile
Database	Turso/libSQL today; PostgreSQL review triggered by billing/entitlements	migrations already formalized; don't migrate without need
Search	DB full-text now; dedicated engine later	aliases and regional terms
Images	private object storage (when photo ships)	controlled access
AI	provider-independent orchestration — deterministic today; generative only via the §8 pipeline	swap models without rewriting
Notifications	FCM + APNs (mobile phase)	cross-platform
Analytics	privacy-conscious	funnels, retention, feature use

On-device inference: the engine runs client-side in React Native. Predictions work offline and no inference data leaves the device — DPDP-friendly and near-zero marginal cost at scale. This is a concrete argument for the TS stack, not a preference.

Module status map
identity basic-live · food_catalog live (incl. custom foods, merged index) · nutrition live (frozen engine) · meal_log live (tray, repeat, edit/delete with refit) · wellness live (check-ins, quick-add); goals and weekly review planned · glucose live (manual) · ai_coach live as deterministic retrieval; generative deferred · billing not started · admin minimal; food-review queue needed for the promotion pipeline.

No AI model writes to clinical records or modifies prescriptions. All writes go through validated APIs with authorization checks.

7. Freemium business model
The free tier is genuinely useful — and the personal model stays free. Users build it from their own check-in effort; paywalling it later would be extractive and would strangle the loop that drives retention.

Free: food search including custom foods · manual meal and glucose logging · the personalization loop · basic dashboard · essential education and safety guidance · the appointment report.

Premium (₹199–₹299/month hypothesis): long-horizon trend reports · polished exportable doctor reports · advanced meal planning and personalized swaps · raised custom-food cap (above the validation-driven 100) · photo/voice limits when those ship · additional languages · optional discounted dietitian consultations.

Monetization principles: monthly and annual plans with transparent annual discount · preview before subscribing · disclose AI usage limits clearly · simple cancellation, store rules honored · never sell identifiable health data · no fear-based upgrades · never paywall a feature retroactively.

Unit economics — two scenarios (illustrative; excludes taxes, store fees, refunds, acquisition, and fixed costs):

AI-heavy (post-photo)
Near-zero-AI (today)
Monthly active users	5,000	5,000
Premium conversion	5% → 250	5% → 250
Price	₹249	₹249
Variable cost / premium user / month	₹45	~₹10
Gross revenue / month	₹62,250	₹62,250
Variable costs / month	₹11,250	₹2,500
Contribution / month	₹51,000	₹59,750

The ₹45 assumption applies only once photo recognition ships. Today's deterministic architecture makes premium nearly pure margin; the early financial question is acquisition cost, not AI burn. Test willingness to pay before committing to a price.

8. Safety, clinical governance, and privacy
Clinical safety requirements
Clinical content governance — appoint a clinical lead and qualified dietitian reviewers; documented approval, review dates, sources, and version history for all health content and coaching rules.
Hypoglycemia and urgent symptoms — reviewed guidance for low glucose, severe symptoms, and urgent care. Never substitute a chatbot for emergency services or a clinician.
No unsupervised medication changes — the AI must not prescribe, stop, or adjust medication. Reminders reflect only user-recorded or clinician-provided instructions.
Food-estimate transparency — label calories and macros as estimates; ask for confirmation when food, recipe, or portion is uncertain; never claim a photo yields exact nutrition.
Respectful, non-judgmental language — no failure labels for high readings, missed goals, or sweets; no reversal or cure promises. (Already the shipped tone: motivational-interviewing style throughout.)
Monitoring-burden cap (new) — structured check-in windows; prompt frequency tapers once the personal model activates; never encourage perpetual post-meal checking. Routine long-term self-monitoring is not clinically indicated for most non-insulin T2D users, and the product must not manufacture the habit. Checking guidance defers to the user's clinician.
Personalized glucose-prediction policy (new in v2 — resolves the keep-out tension)
v1 excluded "unvalidated glucose predictions." This policy is what makes ours validated rather than excluded:

Anchored — every prediction starts from a clinically reviewed population prior; the user's own data moves the model (shrinkage), never invents from nothing.
Gated — 5 paired check-ins before any personal model activates; progress visible to the user.
Labeled — educational positioning on every prediction surface; uncertainty displayed; never framed as a target or score to chase.
Separated — predictions never appear adjacent to medication or dosing surfaces; no medication guidance exists anywhere in the product.
Measured — prediction error (median |predicted − actual| 2h rise, activated models only) is a release gate, with error bands set and reviewed by the clinical advisor.
Bounded in burden — checking tapers after activation, per the monitoring cap above.
Regulatorily assessed — named as the feature most likely to require a medical-device-software (SaMD) assessment under Indian rules; qualified regulatory review before mobile launch. Educational positioning, prior anchoring, no diagnosis, and no dosing are the mitigations — counsel confirms they suffice.
AI safety architecture
For every AI request: (0) prefer not to generate — deterministic retrieval over the merged index answers most coaching queries today; generative output is a later capability admitted only behind this full pipeline; (1) classify intent — food information, general education, personal health interpretation, or urgent/safety; (2) retrieve approved food records or clinician-reviewed content; (3) generate only within the permitted use case; (4) validate for unsupported medical claims, dangerous medication advice, missing safety guidance; (5) route high-risk situations to reviewed instructions or professional care; (6) record privacy-conscious audit events.

A disclaimer alone is not sufficient: defined prohibited responses, adversarial testing, clinical review, and a process for fixing failures.

Indian data protection and regulatory planning
DPDP Act 2023 and the notified DPDP Rules 2025 are part of legal review; the Rules have phased commencement dates, so map obligations to the actual launch date. Current posture already exceeds the minimum: no third-party data flows, no uploads, health data treated as sensitive, and export/delete flows planned in Phase 2.1 before any change to either — and required before launch regardless. Before launch: clear privacy notices and consent; collect only what is needed; secure records and photos with restricted access; define retention, deletion, export, breach response, account closure; review AI vendor data use; assess SaMD triggers (prediction feature named); obtain qualified legal and clinical review.

9. Success metrics and validation plan
North-star unchanged: weekly engaged users completing at least one meaningful food or wellness action (log, check-in, review, or lesson). New rows marked hypothesis are to be calibrated from pilot data, not asserted.

Metric
Initial target
Why it matters
Onboarding completion	≥70%	friction
First meal within 24h	≥60% of new users	time to value
Week-4 retention	≥25%	recurring usefulness
Weekly meal logging	≥3 days for engaged users	adoption
2h check-in completion	≥40% of prompted meals hypothesis	loop conversion — the moat's intake
Personal-model activation	≥50% of weekly-engaged users within 30 days hypothesis	moat compounding
Median time-to-activation	≤14 days hypothesis	loop value to the user
Prediction error	median |predicted − actual| 2h rise within clinically reviewed band; release-blocking	trustworthiness of the moat
Catalog extension	custom creations, fork rate, portion-memory reuse, repeat-meal share — baselines from pilot	food-intelligence health
Food identification acceptance	≥85% on eligible attempts (post-photo)	recognition usability
Nutrition estimate quality	dietitian-approved error limits	trustworthiness
Premium conversion	3–5% hypothesis	willingness to pay
Critical unsafe AI responses	zero, release-blocking	launch readiness

Precision definitions: photo acceptance only on eligible recognition attempts; nutrition error against weighed ingredients or validated recipes; prediction error only on activated models with paired data.

Clinical outcome evaluation
With a clinical partner, once stable: HbA1c change with comparable baselines; self-management knowledge and confidence; adherence to self-selected habits; burden, satisfaction, quality of life; appropriate glucose metrics for users with compatible devices. Do not claim HbA1c improvement or remission until evidence supports it — and note that prediction accuracy is not itself a clinical benefit; whether personalized predictions improve self-management is its own study question.

Pre-launch validation — status
Interviews (20–30 people with T2D) — partially informed by live usage; formal interviews still required.
Consented real-meal dataset — begun (139 catalog + label parser); dietitian review pending the advisor.
Prototype testing (10–15 users incl. older adults) — vehicle exists: run on the live web app.
Small pilot — vehicle exists: run on the live web app before mobile completes.
10. Roadmap (merged)
Indicative durations, not promises; solo-developer sequencing stretches calendars.

Phase 2c — depth on web (~3–4 wks; schema/migration-gated): lab results with HbA1c/eAG trend, doctor-questions list, day-context tags ("why this spike?" attribution), medication logging (adherence % only), user target ranges. Exit: shipped with migrations, tests, smoke green.
Phase 2d — habit layer (~3–4 wks): weekly review ritual, consistency score with grace days, education card library (sequencing, post-meal walks, festival playbook, eating out), waist/WHtR emphasis. Exit: shipped; education clinically reviewed (requires advisor).
Phase 2.1 — user-driven priorities (parallel): persistent 2h check-in reminders with one-tap glucose logging (highest model-data leverage — pull forward), settings page (profile/region; home of DPDP export/delete), streaks/achievements surface, visual depth pass. Exit: export/delete live before any third-party flow or launch.
Phase M — mobile (8–12 wks): React Native + TypeScript; shared engine on-device (offline predictions); local cache and offline meal logs; push (FCM/APNs); store billing. Exit: core-loop parity with web + offline logging + billing entitlements.
Phase P — closed pilot (4 wks; may start on web before M completes): recruit target users; validate dishes and portions; accessibility including older adults; notification preferences; AI and clinical safety testing; prediction-error baseline. Exit: quality thresholds met, critical safety issues resolved.
Phase L — controlled launch: limited audience; pricing tests; monitor crashes, corrections, retention, support; photo recognition and advanced personalization planned from validated demand. Exit: stable, returning users, plausible unit economics.
11. Team and budget
Role
Status / allocation
Founder/engineer	full-time — currently shipping solo (web)
UI/UX designer	part-time; full-time during mobile design
Mobile engineer	1–2, Phase M
Backend/AI engineer	founder now; second engineer at billing/pilot
Dietitian/clinical advisor	OPEN — most urgent non-code item; blocks 2d content review, prediction-error bands, and the promotion pipeline's review step
QA	automated suites + smoke harness cover regression; human QA near launch
Security/privacy advisor	engagement before launch (DPDP + SaMD assessment)

The biggest non-code investment remains food data and its QA — now including the promotion pipeline's review capacity and both benchmark datasets. A polished app with unreliable portions will not earn trust.

Budget: v1's ₹20–45 lakh six-month frame assumed greenfield. Web phases 2c/2d/2.1 are low incremental cost; the material remaining spend is mobile, clinical review, pilot, and launch. Prepare a bottom-up plan before committing funds.

12. Decisions before development (updated)
 Launch audience — urban/semi-urban Indian T2D adults; English-first web live (mobile expansion to confirm)
[x→] Stack — TS monorepo; RN-leaning mobile; frozen shared engine (Turso-vs-PostgreSQL trigger logged in §6)
 Initial languages — English live; regional set undecided
 Clinical advisor — OPEN, highest priority
[~] Food-data sources — 139 catalog + custom pipeline live; validation process needs the dietitian
 Mobile-phase budget and delivery owner
[~] Safety/launch criteria — prediction policy drafted (§8); acceptance criteria to finalize with the advisor
13. Standing guardrails — what we are deliberately not doing
No CGM or device integration beyond manual entry this phase
No freeform generative chat coach until the full §8 pipeline exists
No reversal or remission claims
No retroactive paywalls; the personal model stays free
No P0 additions however tempting — including built-but-unvalidated features
No medication guidance of any kind
Final recommendation
Build around one excellent experience: help someone log a familiar Indian meal, understand its composition, see what it does to them, and make one practical improvement — without feeling deprived.

Everything else — the coach, gamification, subscriptions, advanced integrations — reinforces that experience or gets out of its way.

Four highest-priority investments:

A trustworthy Indian food and recipe database — now including user-defined foods and the reviewed promotion pipeline.
A frictionless, culturally appropriate logging and coaching experience.
The personalization loop — the moat. Protect it (policy, burden cap), feed it (reminders, one-tap check-ins), measure it (activation, error).
Clinical governance and privacy that make users comfortable relying on the app over time.
Get those four right and the foundation is a sustainable wellness product — not a generic health app with Indian dishes bolted on.

Delta log, v1 → v2 (audit that "all" landed):

§2 Current state — new section (estate, de-risked phases, remaining gaps)
§1 — two shipped differentiators claimed; Intelligent pillar upgraded
§3 — personalization-loop and appointment-prep cards added as P0; custom foods folded into the food-DB card; education additions (festival, fasting, eating-out, sequencing, WHtR); voice gets a real card (fixes v1's inconsistency); medication adherence-only as P1; keep-out line reworded, resolving the prediction contradiction
§4 — Journey B extended with the verify step; Journey E added; consistency-score terminology unified across both documents
§5 — data-model rows (ownership, portion memory, provenance variants); promotion pipeline; personalization-loop diagram; deterministic-first rule; second benchmark dataset; three error axes
§6 — estate, annotated architecture diagram, stack re-decided (RN+TS; Turso with a PostgreSQL trigger), on-device inference, module status map
§7 — personal model free (ratify this), no retroactive paywalls, two-scenario unit economics
§8 — prediction policy (7 points), monitoring-burden cap, SaMD named, step-0 "prefer not to generate," DPDP aligned with shipped posture
§9 — five new metric rows, hypothesis-labeled; validation experiments status-annotated
§10 — roadmap merged (2c/2d/2.1/M/P/L), reminders flagged for pull-forward
§11 — advisor marked OPEN/urgent; budget re-scoped to remaining work
§12 — checklist carries decision statuses; §13 guardrails new
Cleanup — paste artifacts ("+1", "0/7", "Copy checklist") stripped, mermaid fences fixed, voice moved to first person