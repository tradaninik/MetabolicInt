# Metabolic Rhythm — Phase A kit (additive)

`RhythmHome` (R1) + `RhythmLocked` (R5) + `RhythmCard` (dashboard card ①), with sample data.
Ships **un-wired**: nothing in production imports it until you choose to. Zero new dependencies
(all charts are inline SVG). Server-safe presentational components — no hooks, no client JS.

## Files

| File | Purpose |
|---|---|
| `types.ts` | Data contract (`RhythmData`, `RhythmForming`). Everything is explicit — no `any`. |
| `sampleData.ts` | Sample values mirroring mockups R1/R5. Replace via props; never edit components for data. |
| `RhythmCurve.tsx` | 24h median curve card: carb-friendly window band, evening-rise band, now-marker, duo stats. |
| `EatingWindow.tsx` | Median eating window track with close-time marker. |
| `AgniPhases.tsx` | Ayurvedic phases + measured-overlap bridge + disclaimer (DNA rule). |
| `TonightCard.tsx` | One evidenced evening nudge. |
| `RhythmHome.tsx` | Assembly of the full screen (use in a route or modal). |
| `RhythmLocked.tsx` | Honest "forming" state: progress, checklist, preview, no guesses. |
| `RhythmCard.tsx` | Compact dashboard card; renders forming-state automatically when `forming` prop is passed. |
| `../app/rhythm-preview/page.tsx` | Preview route (this kit's `/insights-preview`). |

## Real-data wiring table

| UI element | Sample source | Real data source | Derivation (suggested) |
|---|---|---|---|
| 24h curve (`curve`) | `sampleRhythm.curve` | CGM readings store (15-min) | Median mg/dL per hour-of-day over trailing 30 days; exclude sensor gaps > 30 min. |
| Carb-friendly window | `carbFriendlyWindow` | meals + CGM | Per meal: peak Δ in 2 h vs pre-meal baseline. Bucket by meal start hour (2 h buckets, n ≥ 3). Lowest-median bucket wins. |
| Evening rise | `eveningRise` | CGM | median(8–10 PM) − median(2–4 PM). Report Δ and taper time. |
| Eating window | `eatingWindow` | meal logs | Per day: first/last log. Median open & close across days with ≥ 2 meals. |
| Agni phases | `phases` | static definitions | Keep as content; the bridge confidence comes from the carb-window overlap. |
| Bridge note | `phaseBridge` | computed | If measured best window ∩ 12–2 PM ≠ ∅ → "your data agrees with the tradition", conf = window conf. |
| Tonight nudge | `tonight` | meals + CGM | Compare next-morning fasting glucose after early (≤ 7:30 PM) vs late dinners. Require n ≥ 5 per side, else show nothing. |
| Forming checklist | `forming.checks` | CGM / meals / sleep / steps | Unlock gate: ≥ 15 CGM days AND ≥ 31 meals AND ≥ 7 sleep nights AND ≥ 15 step days. |
| Confidence labels | `confidence` fields | n-based heuristic | e.g. `clamp(35 + 6 × n_bucket, 35, 85)` — tune with your stats review. Never display > 85 for observational data. |

`nowHour / nowLabel / nowPhaseLabel`: pass current time server-side or from the client clock.

## Promoting into the dashboard (optional, one edit)

```tsx
// In your dashboard screen — the only edit you ever make, and it's opt-in:
import { RhythmCard } from '@/components/rhythm/RhythmCard';
// …after the Health Score card:
<RhythmCard data={rhythm} href="/rhythm-preview" />
// No data layer yet? Show honest progress instead:
<RhythmCard forming={rhythmForming} href="/rhythm-preview" />
```

Until you make that edit, the kit is reachable only at `/rhythm-preview` — production untouched.

## Design tokens used (no config needed)

Brand green `#0a8e5f` / dark `#08724c` / tint `#e8f5ef` · neutral borders `#e5e7eb` · grays `#111827` `#6b7280`
`#9ca3af` · bg `#f6f7f9` · amber (evening rise only) `#b45309` · system-ui via inherited `font-sans` ·
restrained 10–15 px type · every number carries a source/freshness stamp and confidence label.

## Phases

- **A (this kit):** rhythm home + forming state + dashboard card.
- **B:** Meal Story (R2) — tap a logged meal → what it did.
- **C:** Food Radar (R3) — personal food rankings.
- **D:** Weekly Rhythm (R4) — honest weekly report + experiments.

Components are siblings in this folder; later phases drop in the same way.
