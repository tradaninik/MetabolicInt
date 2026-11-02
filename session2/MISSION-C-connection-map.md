# Mission C — Phase 2 Connection Map (v2, regenerated)

> **v2 note:** the original copy was lost in a workspace reset. This
> regeneration is grounded in the actual code at the session-2 base (main @
> 25ed988, re-verified against your repo): every module and route named
> below exists today. The map shows what connects to what, and where Phase 2
> plugs in. Docs only — nothing here is built.

## The systems that exist (and talk to each other)

**Capture:** meals (tray + recipes + saved combos), glucose (manual + CGM),
BP, activity, sleep, weight, meds — all owner-scoped API routes under
`/api/*`, all frozen-number semantics where meals are logged.

**Understand:** engine modules `patterns.ts`, `attribution.ts`,
`insights.ts`, `forecast.ts`, `glucoseGuard.ts`, `glucose.ts`, `hba1c.ts`,
`healthScore.ts` — fed by the capture tables, rendered on `/insights`,
`/predict`, and the dashboard.

**Labs:** `labs.ts` (A–E catalog), `labReportParser.ts` (deterministic
import), `labCompare.ts` (deltas + between-reports context + hedged notes);
panel API dual-writes HbA1c so the legacy trend stays the single source;
report documents vault with owner/doctor/caregiver access.

**Ayurveda Phase 1:** `prakriti.ts` (quiz + B1 tie semantics:
`profileLabel` / `isTie` / `QUIZ_VERSION` + retake history), `ritucharya.ts`
(seasonal), `agniRhythm.ts`, `tastes.ts`, `viruddha.ts` — gated end-to-end
by the Settings Ayurveda off-switch.

**Care circle:** `/doctor` and `/family` views over linked patients/wards,
including the documents vault; adherence computed by the shared
`computeAdherence` used by lab comparisons too.

## The connections (today)

| From | Through | To |
|------|---------|-----|
| Meals + glucose | `patterns.ts` / `attribution.ts` | Insights cards ("what moved your glucose") |
| Glucose history | `forecast.ts` / `glucoseGuard.ts` | `/predict` + coaching guardrails |
| Lab panels | `labCompare.ts` + adherence + logged-day context | Compare tab deltas and hedged notes |
| Prakriti profile | B1 fields on `/api/prakriti` | Results page, daily wellness card, tradition lens |
| Healing foods | engine ranking + TraditionLensData | "For you today" shortlist + food profiles |
| Any capture page | offline queue (IndexedDB + sw.js) | replays to `/api/meals` on reconnect |

## Phase 2 extension points (the plugs, not yet wired)

1. **Prakriti → food ranking.** B1 gives a stable `profileLabel` + quiz
   version. The tradition lens is deliberately ranking-neutral today; Phase
   2 can feed profile-aware defaults into the healing-foods shortlist and
   the planner — behind the existing Ayurveda off-switch.
2. **Forecast → planner.** `forecast.ts` already projects glucose; a planner
   surface can consume the same projection to score planned meals before
   they are logged (Mission F proposal 1).
3. **Personal-response loop.** Meals + glucose are both captured, but
   post-meal responses do not yet flow back into any ranking. Phase 2's
   four-layer personalization (Mission F proposal 2) closes this loop;
   layer 3 is the only new engine work.
4. **Lab compare → insights hub.** `labCompare.ts` already merges lab deltas
   with behavior context; the hub (Mission F proposal 4) is the surface that
   unifies it with patterns and forecast instead of living only on `/labs`.
5. **Documents vault → doctor/family summaries.** The vault + latest-panel
   summary already render per-ward; Phase 2 can extend summaries with
   trends and flagged deltas without new access rules.
6. **Coach threading.** `/api/coach` (with thread persistence) is consumed
   by the unified insights page; any Phase 2 surface can reuse the same
   thread rather than adding chat UIs.

## Deliberately out of scope

No new databases or tables (Phase 2 should fit the existing schema), no OCR
(kept out of report import by design), no cause-and-effect claims anywhere —
the "logged together, not proven cause" phrasing is a product invariant.
