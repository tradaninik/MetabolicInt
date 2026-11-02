/**
 * RhythmCurve — the 24h median glucose pattern card (mockup R1, top card).
 * Inline SVG only: zero new dependencies. Pure presentational, server-safe.
 */
import type { RhythmData, RhythmPoint } from './types';

const GREEN = '#0a8e5f';
const GREEN_DARK = '#08724c';
const AMBER = '#b45309';
const INK = '#111827';
const GRAY_L = '#9ca3af';

const W = 330;
const H = 150;
const PAD_T = 8;
const PLOT_H = 132;
const Y_MIN = 95;
const Y_MAX = 125;

const hourToX = (h: number) => (h / 24) * W;
const mgdlToY = (v: number) => PAD_T + ((Y_MAX - v) / (Y_MAX - Y_MIN)) * PLOT_H;

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

function hourLabel(h: number): string {
  const hr = ((h % 24) + 24) % 24;
  if (hr === 0) return '12 AM';
  if (hr === 12) return '12 PM';
  return hr < 12 ? `${hr} AM` : `${hr - 12} PM`;
}

function band(startHour: number, endHour: number) {
  const x = hourToX(startHour);
  const w = hourToX(endHour) - x;
  return { x, w };
}

export function RhythmCurve({ data }: { data: RhythmData }) {
  const pts = data.curve.map((p: RhythmPoint) => ({ x: hourToX(p.hour), y: mgdlToY(p.mgdl) }));
  const line = smoothPath(pts);
  const area = `${line} L${W},${PAD_T + PLOT_H} L0,${PAD_T + PLOT_H} Z`;

  const carb = band(data.carbFriendlyWindow.startHour, data.carbFriendlyWindow.endHour);
  const rise = band(data.eveningRise.startHour, data.eveningRise.endHour);
  const nowX = hourToX(data.nowHour);
  const nowY = mgdlToY(data.curve[Math.floor(data.nowHour) % 24]?.mgdl ?? 110);
  const axisHours = [0, 4, 8, 12, 16, 20, 24];

  return (
    <section className="rounded-[14px] border border-[#e5e7eb] bg-white p-3.5">
      <header className="mb-2.5 flex flex-wrap items-baseline gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#9ca3af]">
          Your 24h pattern
        </span>
        <span className="rounded-full bg-[#e8f5ef] px-2.5 py-[3px] text-[11px] font-semibold text-[#08724c]">
          Now {data.nowLabel} · {data.nowPhaseLabel}
        </span>
      </header>

      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img"
        aria-label="Median glucose by hour of day with carb-friendly window and evening rise highlighted">
        {/* highlight bands */}
        <rect x={carb.x} y={PAD_T} width={carb.w} height={PLOT_H} rx="5" fill={GREEN} opacity="0.08" />
        <rect x={rise.x} y={PAD_T} width={rise.w} height={PLOT_H} rx="5" fill={AMBER} opacity="0.08" />
        {/* grid */}
        <line x1="0" y1={mgdlToY(105)} x2={W} y2={mgdlToY(105)} stroke="#eef1f0" strokeWidth="1" />
        <line x1="0" y1={mgdlToY(115)} x2={W} y2={mgdlToY(115)} stroke="#eef1f0" strokeWidth="1" />
        {/* curve */}
        <path d={area} fill={GREEN} opacity="0.06" />
        <path d={line} fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {/* now marker */}
        <line x1={nowX} y1={14} x2={nowX} y2={PAD_T + PLOT_H - 5} stroke={INK} strokeWidth="1.5"
          strokeDasharray="3 3" opacity="0.55" />
        <circle cx={nowX} cy={nowY} r="4" fill="#fff" stroke={GREEN} strokeWidth="2.5" />
        <text x={nowX + 4} y={22} fontSize="9.5" fontWeight={600} fill={INK}>Now</text>
      </svg>

      <div className="flex justify-between px-0.5 pt-1">
        {axisHours.map((h) => (
          <span key={h} className="text-[10px] text-[#9ca3af]">{hourLabel(h)}</span>
        ))}
      </div>

      <div className="mt-2.5 flex items-center gap-3.5">
        <span className="flex items-center gap-1.5 text-[11px] text-[#6b7280]">
          <i className="inline-block h-[9px] w-3.5 rounded-[3px]" style={{ background: GREEN, opacity: 0.25 }} />Carb-friendly
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-[#6b7280]">
          <i className="inline-block h-[9px] w-3.5 rounded-[3px]" style={{ background: AMBER, opacity: 0.25 }} />Evening rise
        </span>
        <span className="ml-auto text-[11px] text-[#9ca3af]">median mg/dL</span>
      </div>

      <div className="mt-3 flex gap-2.5">
        <div className="flex-1 rounded-[11px] border border-[#e5e7eb] p-2.5">
          <span className="block text-[10px] text-[#6b7280]">BEST WINDOW FOR CARBS</span>
          <b className="mt-0.5 block text-[13px] font-bold text-[#111827]">
            {hourLabel(data.carbFriendlyWindow.startHour)} – {hourLabel(data.carbFriendlyWindow.endHour)}
          </b>
          <span className="mt-1.5 inline-block rounded-full bg-[#e8f5ef] px-[7px] py-px text-[10px] font-semibold text-[#08724c]">
            {data.carbFriendlyWindow.confidence}% conf
          </span>
        </div>
        <div className="flex-1 rounded-[11px] border border-[#e5e7eb] p-2.5">
          <span className="block text-[10px] text-[#6b7280]">EVENING RISE</span>
          <b className="mt-0.5 block text-[13px] font-bold text-[#111827]">+{data.eveningRise.deltaMgDl} mg/dL</b>
          <span className="mt-1 block text-[10px] text-[#6b7280]">
            {hourLabel(data.eveningRise.startHour)} – {hourLabel(data.eveningRise.endHour)} · taper before {data.eatingWindow.closeLabel}
          </span>
        </div>
      </div>

      <span className="mt-2.5 block text-[11px] text-[#9ca3af]">
        {data.windowDays}-day median · your CGM, nights included
      </span>
    </section>
  );
}
