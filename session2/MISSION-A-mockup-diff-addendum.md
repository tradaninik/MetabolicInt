# Mission A — Mockup Diff Addendum (v2, regenerated)

> **v2 note:** the original copy of this addendum was lost in a workspace
> reset. Everything marked **[shipped]** below is verifiable fact (commit +
> patch number in your repo). The A11–A13 section is **reconstructed** — the
> original wording is gone; see the honest caveat there.

Reference: `dashboard-mockup-v1.png` is the design truth source (you have
it; I keep a copy too). The pre-mockup gap list A1–A5 lives in
`MISSION-A-gap-list.md`, which you also have.

## A1 — closed as a non-gap **[shipped as "no change"]**

A1 was re-examined side-by-side against mockup v1 during the mockup-diff
pass and closed as **not a gap**: the built dashboard already matched the
mockup on that point, so no code change was made. (The original item-by-item
proof text was lost in the reset; the A1 entry itself is in your copy of the
gap list, so the conclusion can be re-checked against the mockup anytime.)

## A2 / A2b — console fix **[shipped]**

- **A2** (patch 0001): `MeasuredDot` received a key-spread into JSX — the
  React console warning traced to spreading `key` into the dot component.
  Fixed with explicit props.
- **A2b** (patch 0012): completing pass — explicit `key` on `MeasuredDot`
  where it renders in lists; console verified clean afterward.

## A6–A10 — mockup convergence, one commit per item **[shipped]**

| Item | Change (per mockup v1) | Patch |
|------|------------------------|-------|
| A6 | Metabolic timeline moved to sit **directly below the charts row** | 0002 |
| A7 | Seasonal + agni cards rendered **side-by-side** in the bottom row | 0003 |
| A8 | Header **"Log glucose" as an outline button** (not solid) | 0004 |
| A9 | Sidebar brand **"MetabolicInt" + heart mark** per mockup | 0005 |
| A10 | Glucose chart **active pill = green tint** | 0006 |

Series gates after the A-batch: suite 520 → **616 passed** (+3 skipped
constant), tsc ×3, lint, build all clean throughout — 56 pages; delivery as
patch series 0001–0007, one commit per item. (The suite later reached
619+3 after the B1 engine tests — see the Mission B worklog entries.)

Verification shots `dashboard-after-A-1280.png` / `dashboard-after-A-390.png`
were captured after the batch (lost on my side in the reset — after you
apply the patches, the live dashboard is the better evidence anyway).

## A11–A13 — decision items **[reconstructed — original text lost]**

The original addendum listed three decision items found in the mockup diff
that were **deliberately left for your call** (not built). The exact
original wording did not survive the reset. What I can honestly re-derive:

1. **StepsCard sparkline.** The mockup's steps card carries a small trend
   sparkline. This was a known open visual detail from Mission A analysis —
   including a real rendering risk worth deciding deliberately: recharts
   `ResponsiveContainer` inside small fixed-height cards can collapse to
   zero height, so the sparkline wants either a fixed-height wrapper or a
   hand-rolled SVG. Decision: build it (which approach), or drop the
   sparkline and keep the number.
2. **Post-install re-diff.** The remaining A11–A13 candidates are cleanest
   to re-derive by comparing the **live post-patch dashboard** against
   `dashboard-mockup-v1.png` at 1280 and 390 — a ten-minute pass we can do
   together once you're running the build; anything still differing becomes
   the new numbered decision list.

If any of the three original items is something you remember caring about
(specific numbers, spacing, a card you wanted changed), tell me and it goes
straight onto the list — your memory beats my reconstruction.
