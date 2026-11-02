/**
 * RhythmCard — compact card for the production dashboard (integration ① in mockup R6).
 * Ships un-wired in Phase A: promote it by importing into your dashboard — the only
 * edit you ever make, and it's opt-in. Until then it's reachable via /rhythm-preview.
 * Shows the forming state (progress bar) instead of guesses when data is insufficient.
 */
import type { RhythmData, RhythmForming } from './types';

const GREEN = '#0a8e5f';
const GREEN_DARK = '#08724c';
const GRAY_L = '#9ca3af';

function hourLabel(h: number): string {
  const hr = ((h % 24) + 24) % 24;
  if (hr === 0) return '12 AM';
  if (hr === 12) return '12 PM';
  return hr < 12 ? `${hr} AM` : `${hr - 12} PM`;
}

function MiniCurve({ curve }: { curve: { hour: number; mgdl: number }[] }) {
  const W = 330;
  const H = 60;
  const toX = (h: number) => (h / 24) * W;
  const toY = (v: number) => 6 + ((125 - v) / 30) * (H - 12);
  const d = curve
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.hour).toFixed(1)},${toY(p.mgdl).toFixed(1)}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 block w-full" aria-hidden>
      <rect x={toX(12)} y="4" width={toX(14) - toX(12)} height={H - 8} rx="4" fill={GREEN} opacity="0.07" />
      <path d={d} fill="none" stroke={GREEN} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function RhythmCard({
  data,
  forming,
  href = '/rhythm-preview',
}: {
  data?: RhythmData;
  forming?: RhythmForming;
  href?: string;
}) {
  const isForming = !data && !!forming;

  return (
    <a
      href={href}
      className="block rounded-[14px] border border-[#e5e7eb] bg-white p-3.5 transition-colors hover:border-[#0a8e5f]"
    >
      <header className="flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#9ca3af]">
          🫀 Your rhythm
        </span>
        {isForming ? (
          <span className="ml-auto rounded-full bg-[#f3f4f6] px-2 py-px text-[10px] font-semibold text-[#6b7280]">
            forming
          </span>
        ) : data ? (
          <span className="ml-auto rounded-full bg-[#e8f5ef] px-2 py-px text-[10px] font-semibold text-[#08724c]">
            {data.confidence}% conf
          </span>
        ) : null}
      </header>

      {isForming && forming ? (
        <>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e8ebee]">
            <div
              className="h-1.5 rounded-full"
              style={{ width: `${Math.min(100, Math.round((forming.daysCollected / forming.daysRequired) * 100))}%`, background: GREEN }}
            />
          </div>
          <p className="mt-2 text-[12px] text-[#6b7280]">
            {forming.daysCollected} / {forming.daysRequired} days · unlocks {forming.unlocksOn}
          </p>
        </>
      ) : data ? (
        <>
          <MiniCurve curve={data.curve} />
          <p className="mt-2 text-[12.5px] text-[#111827]">
            Best carbs <b>{hourLabel(data.carbFriendlyWindow.startHour)} – {hourLabel(data.carbFriendlyWindow.endHour)}</b>
            <span className="text-[#6b7280]"> · {data.carbFriendlyWindow.confidence}% conf</span>
          </p>
          <p className="mt-0.5 text-[12px] text-[#6b7280]">
            Evening rise +{data.eveningRise.deltaMgDl} mg/dL · close kitchen {data.eatingWindow.closeLabel}
          </p>
        </>
      ) : null}

      <span className="mt-2 block text-[11px] text-[GRAY_L]">
        {data ? `${data.windowDays}-day median · your CGM, nights included` : 'Educational, not medical advice'}
      </span>
    </a>
  );
}
