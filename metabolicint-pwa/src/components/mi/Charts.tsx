import { type ReactNode } from "react";

/* Flat 2D charts, "Calm Premium" - soft fills, 3px round strokes, coral only for highs. */

const TEAL = "#0F766E";
const TEAL_600 = "#0D9488";
const CORAL = "#E11D48";
const CORAL_DARK = "#BE123C";
const INK3 = "#5D6E76";

const fmt = (n: number) => n.toFixed(1);

function linePath(pts: [number, number][]) {
  return "M" + pts.map((p) => `${fmt(p[0])},${fmt(p[1])}`).join(" L");
}
function areaPath(pts: [number, number][], baseY: number) {
  return `${linePath(pts)} L${fmt(pts[pts.length - 1][0])},${baseY} L${fmt(pts[0][0])},${baseY} Z`;
}
const scaler = (vMax: number, vMin: number, top: number, bot: number) => (v: number) =>
  top + ((vMax - v) / (vMax - vMin)) * (bot - top);

/* ---------------- Score ring (health score 78/100) ---------------- */
export function ScoreRing({ score, max = 100 }: { score: number; max?: number }) {
  const r = 52;
  const C = 2 * Math.PI * r;
  const filled = (score / max) * C;
  return (
    <svg viewBox="0 0 120 120" className="h-28 w-28 shrink-0" role="img"
      aria-label={`Metabolic health score ${score} of ${max}`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="#E8F2EC" strokeWidth="12" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={TEAL} strokeWidth="12"
        strokeLinecap="round" strokeDasharray={`${fmt(filled)} ${fmt(C)}`}
        transform="rotate(-90 60 60)" />
      <text x="60" y="62" textAnchor="middle" fontSize="30" fontWeight="800" fill="#1C2B33"
        className="num">{score}</text>
      <text x="60" y="80" textAnchor="middle" fontSize="11" fill="#4A5B64">of {max}</text>
    </svg>
  );
}

/* ---------------- Macro ring (kcal + macro split) ---------------- */
export function MacroRing({
  kcal, carbs, protein, fat, size = 96,
}: { kcal: number; carbs: number; protein: number; fat: number; size?: number }) {
  const r = 40;
  const C = 2 * Math.PI * r;
  const kc = carbs * 4, kp = protein * 4, kf = fat * 9;
  const total = Math.max(kc + kp + kf, 1);
  const seg = [
    { v: (kc / total) * C, color: "#0F766E" },
    { v: (kp / total) * C, color: "#0369A1" },
    { v: (kf / total) * C, color: "#64748B" },
  ];
  let acc = 0;
  return (
    <svg viewBox="0 0 96 96" style={{ width: size, height: size }} className="shrink-0"
      role="img" aria-label={`${kcal} kcal with macro split`}>
      <circle cx="48" cy="48" r={r} fill="none" stroke="#E8F2EC" strokeWidth="10" />
      {seg.map((s, i) => {
        const rot = -90 + (acc / C) * 360;
        acc += s.v;
        const gap = 2;
        const len = Math.max(s.v - gap, 0.5);
        return (
          <circle key={i} cx="48" cy="48" r={r} fill="none" stroke={s.color} strokeWidth="10"
            strokeDasharray={`${fmt(len)} ${fmt(C - len)}`} transform={`rotate(${fmt(rot)} 48 48)`} />
        );
      })}
      <text x="48" y="47" textAnchor="middle" fontSize="21" fontWeight="800" fill="#1C2B33"
        className="num">{kcal}</text>
      <text x="48" y="61" textAnchor="middle" fontSize="10" fill="#4A5B64">kcal</text>
    </svg>
  );
}

/* ---------------- Today's glucose sparkline ---------------- */
export function TodaySpark({ values, labels }: { values: number[]; labels: string[] }) {
  const y = scaler(220, 70, 30, 118);
  const pts = values.map((v, i) => [10 + (i * 322) / (values.length - 1), y(v)] as [number, number]);
  const bandTop = y(180), bandBot = y(70);
  const peakI = values.indexOf(Math.max(...values));
  const [px, py] = pts[peakI];
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox="0 0 332 150" className="h-auto w-full" role="img"
      aria-label={`Glucose curve today, fasting ${values[0]}, peak ${Math.max(...values)} after lunch, now ${values[values.length - 1]}`}>
      <rect x="10" y={fmt(bandTop)} width="322" height={fmt(bandBot - bandTop)} rx="6" fill="#F0FDF4" />
      <path d={`M10 ${fmt(bandTop)}H332`} stroke="#C7F0D8" strokeWidth="1" strokeDasharray="3 4" />
      <path d={`M10 ${fmt(bandBot)}H332`} stroke="#C7F0D8" strokeWidth="1" strokeDasharray="3 4" />
      <path d={areaPath(pts, 118)} fill="rgba(15,118,110,.10)" />
      <path d={linePath(pts)} fill="none" stroke={TEAL} strokeWidth="3"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={fmt(px)} cy={fmt(py)} r="4.5" fill={CORAL} />
      <text x={fmt(px)} y={fmt(py - 12)} textAnchor="middle" fontSize="11" fontWeight="700"
        fill={CORAL_DARK} className="num">{Math.max(...values)} high</text>
      <circle cx={fmt(lx)} cy={fmt(ly)} r="4.5" fill={TEAL} stroke="#FFFFFF" strokeWidth="2" />
      <text x={fmt(lx - 6)} y={fmt(ly + 4)} textAnchor="end" fontSize="11" fontWeight="700"
        fill={TEAL} className="num">{values[values.length - 1]}</text>
      {labels.map((l, i) => (
        <text key={l} x={fmt(10 + (i * 322) / (labels.length - 1))} y="139"
          textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"}
          fontSize="10" fill={INK3}>{l}</text>
      ))}
    </svg>
  );
}

/* ---------------- Week chart: 7 days x 4 checks ---------------- */
export function WeekChart({ week }: { week: { label: string; readings: number[] }[] }) {
  const y = scaler(220, 70, 8, 140);
  const DAYW = 298 / 7;
  const FR = [0.12, 0.37, 0.62, 0.87];
  const pts = week.flatMap((d, di) =>
    d.readings.map((v, j) => [10 + (di + FR[j]) * DAYW, y(v)] as [number, number])
  );
  const vals = week.flatMap((d) => d.readings);
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  const bandTop = y(180), bandBot = y(70);
  const peakI = vals.indexOf(Math.max(...vals));
  const [px, py] = pts[peakI];
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox="0 0 332 170" className="h-auto w-full" role="img"
      aria-label="Glucose over the last 7 days">
      <rect x="10" y={fmt(bandTop)} width="298" height={fmt(bandBot - bandTop)} rx="6" fill="#F0FDF4" />
      {[bandTop, bandBot].map((yy) => (
        <path key={yy} d={`M10 ${fmt(yy)}H308`} stroke="#C7F0D8" strokeWidth="1" strokeDasharray="3 4" />
      ))}
      {week.map((_, d) =>
        d > 0 ? <path key={d} d={`M${fmt(10 + d * DAYW)} 8V140`} stroke="#EDF4EF" strokeWidth="1"
          strokeDasharray="2 5" /> : null
      )}
      <path d={areaPath(pts, 140)} fill="rgba(15,118,110,.10)" />
      <path d={`M10 ${fmt(y(avg))}H308`} stroke={TEAL_600} strokeWidth="1.5" strokeDasharray="5 4" opacity=".65" />
      <path d={linePath(pts)} fill="none" stroke={TEAL} strokeWidth="3"
        strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(([x, yy], i) =>
        vals[i] > 180 ? <circle key={i} cx={fmt(x)} cy={fmt(yy)} r="3.5" fill={CORAL} /> : null
      )}
      <text x={fmt(px)} y={fmt(py - 12)} textAnchor="middle" fontSize="11" fontWeight="700"
        fill={CORAL_DARK} className="num">{vals[peakI]} high</text>
      <circle cx={fmt(lx)} cy={fmt(ly)} r="4.5" fill={TEAL} stroke="#FFFFFF" strokeWidth="2" />
      <text x={fmt(lx - 9)} y={fmt(ly + 4)} textAnchor="end" fontSize="11" fontWeight="700"
        fill={TEAL} className="num">{vals[vals.length - 1]}</text>
      <text x="311.5" y={fmt(bandTop + 3.5)} fontSize="9" fill={INK3}>180</text>
      <text x="311.5" y={fmt(bandBot + 3.5)} fontSize="9" fill={INK3}>70</text>
      {week.map((d, i) => (
        <text key={d.label} x={fmt(10 + (i + 0.5) * DAYW)} y="158" textAnchor="middle"
          fontSize="10" fill={INK3}>{d.label}</text>
      ))}
    </svg>
  );
}

/* ---------------- Day chart with meal markers ---------------- */
export function DayChart({
  readings, markers, avg,
}: {
  readings: { t: number; label: string; value: number }[];
  markers: { label: string; t: number; kind: "meal" | "walk" }[];
  avg: number;
}) {
  const y = scaler(220, 70, 8, 140);
  const X = (t: number) => 10 + ((t - 7.5) / 15) * 298;
  const pts = readings.map((r) => [X(r.t), y(r.value)] as [number, number]);
  const bandTop = y(180), bandBot = y(70);
  const peak = readings.reduce((a, b) => (b.value > a.value ? b : a));
  const [px, py] = pts[readings.indexOf(peak)];
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox="0 0 332 192" className="h-auto w-full" role="img"
      aria-label={`Glucose across the day, average ${Math.round(avg)}, peak ${peak.value}`}>
      <rect x="10" y={fmt(bandTop)} width="298" height={fmt(bandBot - bandTop)} rx="6" fill="#F0FDF4" />
      {[bandTop, bandBot].map((yy) => (
        <path key={yy} d={`M10 ${fmt(yy)}H308`} stroke="#C7F0D8" strokeWidth="1" strokeDasharray="3 4" />
      ))}
      {[12, 16, 20].map((t) => (
        <path key={t} d={`M${fmt(X(t))} 8V140`} stroke="#EDF4EF" strokeWidth="1" strokeDasharray="2 5" />
      ))}
      <path d={areaPath(pts, 140)} fill="rgba(15,118,110,.10)" />
      <path d={`M10 ${fmt(y(avg))}H308`} stroke={TEAL_600} strokeWidth="1.5" strokeDasharray="5 4" opacity=".65" />
      <path d={linePath(pts)} fill="none" stroke={TEAL} strokeWidth="3"
        strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(([x, yy], i) =>
        readings[i].value > 180 ? (
          <circle key={i} cx={fmt(x)} cy={fmt(yy)} r="3.5" fill={CORAL} />
        ) : (
          <circle key={i} cx={fmt(x)} cy={fmt(yy)} r="3" fill={TEAL} stroke="#FFFFFF" strokeWidth="1.5" />
        )
      )}
      <text x={fmt(px)} y={fmt(py - 12)} textAnchor="middle" fontSize="11" fontWeight="700"
        fill={CORAL_DARK} className="num">{peak.value} high</text>
      <text x={fmt(lx - 9)} y={fmt(ly + 4)} textAnchor="end" fontSize="11" fontWeight="700"
        fill={CORAL_DARK} className="num">{readings[readings.length - 1].value}</text>
      <text x="311.5" y={fmt(bandTop + 3.5)} fontSize="9" fill={INK3}>180</text>
      <text x="311.5" y={fmt(bandBot + 3.5)} fontSize="9" fill={INK3}>70</text>
      {markers.map((m) => (
        <g key={m.label}>
          {m.kind === "walk" ? (
            <circle cx={fmt(X(m.t))} cy="150.5" r="5.5" fill="none" stroke={TEAL} strokeWidth="2" />
          ) : (
            <path d={`M${fmt(X(m.t) - 6)} 147.5h12c0 5.5-2.7 8.9-6 8.9s-6-3.4-6-8.9z`}
              fill="none" stroke={TEAL} strokeWidth="2" strokeLinejoin="round" />
          )}
          <text x={fmt(X(m.t))} y="172" textAnchor="middle" fontSize="9.5" fill="#4A5B64">{m.label}</text>
        </g>
      ))}
      {[["8 AM", 8, "start"], ["12 PM", 12, "middle"], ["4 PM", 16, "middle"],
        ["8 PM", 20, "middle"], ["10 PM", 22, "end"]].map(([l, t, anc]) => (
        <text key={l as string}
          x={anc === "start" ? 10 : anc === "end" ? 308 : fmt(X(t as number))}
          y="187" textAnchor={anc as "start" | "middle" | "end"} fontSize="10" fill={INK3}>{l}</text>
      ))}
    </svg>
  );
}

/* ---------------- Month bars (daily averages) ---------------- */
export function MonthBars({
  values, diwali, avg, nDays,
}: { values: number[]; diwali: number[]; avg: number; nDays: number }) {
  const STP = 298 / nDays;
  const x = (i: number) => 10 + i * STP + (STP - 6) / 2;
  const top = (v: number) => 130 - ((v - 70) / 110) * 120;
  const avgY = top(avg);
  const dTop = Math.min(...diwali.map((i) => top(values[i])));
  const dX = 10 + ((diwali[0] + diwali[1] + 1) / 2) * STP;
  return (
    <svg viewBox="0 0 332 160" className="h-auto w-full" role="img"
      aria-label="Daily average glucose this month">
      {values.map((v, i) => (
        <rect key={i} x={fmt(x(i))} y={fmt(top(v))} width="6" height={fmt(130 - top(v))} rx="2"
          fill={diwali.includes(i) ? CORAL : TEAL_600} />
      ))}
      <path d={`M10 ${fmt(avgY)}H308`} stroke={TEAL} strokeWidth="1.5" strokeDasharray="5 4" opacity=".65" />
      <text x={fmt(dX)} y={fmt(Math.max(dTop - 8, 12))} textAnchor="middle" fontSize="10"
        fontWeight="700" fill={CORAL_DARK}>Diwali</text>
      <text x="311.5" y="13.5" fontSize="9" fill={INK3}>180</text>
      <text x="311.5" y="133.5" fontSize="9" fill={INK3}>70</text>
      {[0, 7, 14, 21, nDays - 1].map((i) => (
        <text key={i} x={fmt(10 + i * STP + STP / 2)} y="148" textAnchor="middle" fontSize="10"
          fill={INK3}>{i + 1}</text>
      ))}
    </svg>
  );
}

/* ---------------- 3-month curve ---------------- */
export function ThreeMonthCurve({
  values, diwali,
}: { values: number[]; diwali: number }) {
  const N = values.length;
  const sm = values.map((_, i) => {
    const lo = Math.max(0, i - 1), hi = Math.min(N, i + 2);
    return values.slice(lo, hi).reduce((s, v) => s + v, 0) / (hi - lo);
  });
  const y = scaler(210, 70, 8, 128);
  const STP = 298 / (N - 1);
  const pts = sm.map((v, i) => [10 + i * STP, y(v)] as [number, number]);
  const bandTop = y(180), bandBot = y(70);
  const [dx, dy] = pts[diwali];
  return (
    <svg viewBox="0 0 332 160" className="h-auto w-full" role="img"
      aria-label="Daily average glucose over the last 3 months">
      <rect x="10" y={fmt(bandTop)} width="298" height={fmt(bandBot - bandTop)} rx="6" fill="#F0FDF4" />
      {[bandTop, bandBot].map((yy) => (
        <path key={yy} d={`M10 ${fmt(yy)}H308`} stroke="#C7F0D8" strokeWidth="1" strokeDasharray="3 4" />
      ))}
      <path d={areaPath(pts, bandBot)} fill="rgba(15,118,110,.10)" />
      <path d={linePath(pts)} fill="none" stroke={TEAL} strokeWidth="3"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={fmt(dx)} cy={fmt(dy)} r="4" fill={CORAL} />
      <text x={fmt(dx)} y={fmt(dy - 11)} textAnchor="middle" fontSize="10" fontWeight="700"
        fill={CORAL_DARK}>Diwali</text>
      <text x="311.5" y={fmt(bandTop + 3.5)} fontSize="9" fill={INK3}>180</text>
      <text x="311.5" y={fmt(bandBot + 3.5)} fontSize="9" fill={INK3}>70</text>
      {["AUG", "SEP", "OCT"].map((l, c) => (
        <text key={l} x={fmt(10 + [15, 45.5, 75][c] * STP)} y="148" textAnchor="middle"
          fontSize="10" fill={INK3}>{l}</text>
      ))}
    </svg>
  );
}

/* ---------------- CSS bar groups ---------------- */
export function VBars({
  data, big = false,
}: { data: { label: string; pct: number }[]; big?: boolean }) {
  return (
    <div className="flex gap-2">
      {data.map((d) => (
        <div key={d.label}
          className={`flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5 ${big ? "min-h-[8.5rem]" : "min-h-[6.75rem]"}`}>
          <span className={`num font-bold ${big ? "text-[.9375rem] text-ink" : "text-xs text-ink-2"}`}>{d.pct}%</span>
          <span
            className={`w-full rounded-md bg-teal-700 ${big ? "max-w-[4.5rem] rounded-lg" : "max-w-7"}`}
            style={{ height: `${(d.pct / 100) * (big ? 5.5 : 4.2)}rem` }} />
          <span className={`font-semibold tracking-wide ${big ? "text-xs text-ink-2" : "text-[.6875rem] text-ink-3"}`}>
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function HBars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value));
  return (
    <div className="flex flex-col gap-3">
      {data.map((d) => (
        <div key={d.label}>
          <div className="mb-1.5 flex items-baseline justify-between text-[.8125rem] font-semibold text-ink">
            <span>{d.label}</span>
            <b className="num text-[.9375rem] font-extrabold">{d.value} mg/dL</b>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-track">
            <div className="h-full rounded-full bg-teal-700"
              style={{ width: `${Math.round((d.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- small chart card wrapper ---------------- */
export function ChartCard({
  title, pill, note, children, maxW,
}: { title: string; pill?: ReactNode; note: string; children: ReactNode; maxW?: string }) {
  return (
    <section className={`mi-card p-4 ${maxW ?? ""}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-base font-bold tracking-tight">{title}</h3>
        {pill}
      </div>
      {children}
      <p className="num mt-2 text-xs text-ink-3">{note}</p>
    </section>
  );
}
