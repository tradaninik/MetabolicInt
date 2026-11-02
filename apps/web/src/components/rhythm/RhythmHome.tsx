/**
 * RhythmHome — assembles the full rhythm screen (mockup R1).
 * Drop-in for a route or a modal; pure presentational, server-safe.
 */
import type { RhythmData } from './types';
import { RhythmCurve } from './RhythmCurve';
import { EatingWindow } from './EatingWindow';
import { AgniPhases } from './AgniPhases';
import { TonightCard } from './TonightCard';

export function RhythmHome({ data }: { data: RhythmData }) {
  return (
    <div className="flex flex-col gap-3">
      <RhythmCurve data={data} />
      <EatingWindow data={data} />
      <AgniPhases data={data} />
      <TonightCard data={data} />
      <p className="text-center text-[11px] text-[#9ca3af]">
        Rhythm re-computes nightly from your CGM, meals, sleep and steps. Educational, not medical advice.
      </p>
    </div>
  );
}
