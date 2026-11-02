# MetabolicInt — Session 2 — Mission A: Reproduction & Gap List

Repo: main @ 25ed988 (verified clean clone). Baseline gates all green before any work:
`npm test` 616 passed + 3 skipped (51 files) · `tsc --noEmit` ×3 silent · lint = exactly the
3 known `<img>` warnings · `next build` on empty sqlite = "Compiled successfully" + the 6
documented pre-existing `prisma:error no such table` lines.

## Reproduction evidence (all artifacts in `session2-screens/`)

| Check | Result |
|---|---|
| Local dev (sqlite `dev.db`, seeded demo user), `/dashboard` @ 390 / 768 / 1280 | Charts render at ALL three widths — `dashboard-{390,768,1280}.png`. 2 recharts surfaces + 1 health-ring SVG present in DOM. |
| Production (https://metabolic-int-web.vercel.app), logged in as demo | `/dashboard` renders charts at 1280 AND 390 — `prod-dashboard-{1280,390}.png`. Auth gate intact (307 → login when signed out). **No SSR/hydration failure found.** |
| Console errors, all widths, local + prod | Exactly ONE error type: React "props object containing a key prop is being spread into JSX" from `MeasuredDot` (GlucoseTodayChart.tsx:182). Repeats per rendered dot. |
| Tooltips | **Work.** Playwright-driven real mouse events show the dashboard tooltip: "3:42 pm · 134 mg/dL ▼ 3 vs your usual at this hour · this is your latest reading" (`pw-tooltip-dashboard.png`), and /predict tooltip values (`pw-tooltip-predict.png`). (Two earlier headless probes failed — that was an agent-browser CLI mouse-event quirk, NOT a product bug.) |
| Mobile navigation | Bottom tab bar + "More" sheet exist (AppShell.tsx `BottomTabBar`, `lg:hidden`). Not a gap. |
| Timeline card at 390 | Horizontal scroll by design (revamp item 5); last card partially visible = scroll affordance. Not a gap. |
| Glucose chart spec | Already compliant: solid measured line, dashed usual-pattern forecast + uncertainty band, D/M/W/S event chips (dashed border = planned), 70–140 ReferenceArea + target-ceiling line, Today/Week/14d toggle, reading-of-interest amber ring. |
| Weight forecast chart | Already compliant: solid history, dashed 30-day projection, uncertainty band, "today" marker. Fixed h=190 (not ≈220 as guessed) — renders fine; no squash. |

## Numbered gap list (deviation → fix)

**A1 — Steps sparkline is bars, not a line (CONFIRMED).**
`MetricCards.tsx` StepsCard (lines 137–148) renders 7 CSS bar `div`s (`flex h-8 items-end gap-1`
+ per-bar `height:%`). The approved mockup shows a **line sparkline**.
Fix: replace the 7 bars with an SVG mini-line (polyline) sparkline of the same `last7` data,
today's point emphasized per mockup styling. Pure styling → stays in `MetricCards.tsx`;
zero engine change (data shape `s.last7[]` already fits).

**A2 — Console error: `MeasuredDot` key-spread (CONFIRMED).**
`GlucoseTodayChart.tsx:182`: `dot={(p) => <MeasuredDot {...p} focusT={...} />}` — recharts passes
`key` inside `p`; spreading it into JSX is the only console error on the page (fails the
"no console errors" acceptance).
Fix: pass explicit props (`cx`, `cy`, `payload`, `focusT`) instead of the spread. Zero behavior
change.

**A3 — Visual diff vs mockup BLOCKED: `dashboard-mockup-v1.png` was not attached to this session.**
Everything above is code-level + rendering-level verification. The section-by-section visual diff
(spacing, typography, section order, card styling, chart proportions, colors) requires the
re-attached mockup. Per the iron rule, nothing beyond A1/A2 gets coded without it.

**A4 — Observation (your call, not a code bug): sparse-data accounts look "broken".**
On the production demo account, "today" has no steps (seed history has aged) → the steps
sparkline renders as flat minimum-height bars, and the glucose chart is mostly dashed forecast.
An honest render, but plausibly part of "charts aren't seen right" if the report came from a
low-data account. Options: leave as-is, or add a gentle empty-state hint. No action proposed
until you weigh in.

**A5 — No other reproducing defects.** The remaining "known suspects" did NOT reproduce:
fixed-pixel chart heights (230/190) prevent zero-height collapse in grid parents; both charts
render with legends/axes on mobile; tooltips work; Week/14d views show the 70–140 band
(ReferenceArea is unconditional).

## Proposed build order for A (after your sign-off + mockup)

1. A2 (tiny, unblocks the "no console errors" acceptance) — 1 commit.
2. A1 (steps line sparkline) — 1 commit.
3. Mockup diff items (numbered A6…) — only after the PNG is re-attached and you sign off.
