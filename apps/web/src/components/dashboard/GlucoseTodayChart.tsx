'use client';

// Glucose chart (dashboard revamp item 3, approved v1 layout).
// Today view: measured points as a SOLID line, the user's usual-pattern
// forecast as a DASHED line with an uncertainty band, event markers
// (D dose / M meal / W activity / S context) under the axis — dashed
// chips are planned-but-not-done. Week / 14 d views show the measured
// series against the 70–140 target band. The tooltip reports the value,
// the deviation vs the user's usual hour pattern, and nearby events.
//
// Association only: events are things that happened NEAR the reading,
// never claims about what caused it.

import { useMemo, useState } from 'react';
import {
  Area, ComposedChart, Line, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { ChartEvent, GlucoseChartData } from '@/lib/engine-service';

type Range = 'today' | 'week' | '14d';

const IST_OFFSET_MS = 5.5 * 3_600_000;
const HOUR_MS = 3_600_000;

const EVENT_STYLE: Record<ChartEvent['kind'], { letter: string; color: string; title: string }> = {
  dose: { letter: 'D', color: '#ef4444', title: 'dose' },
  meal: { letter: 'M', color: '#16b077', title: 'meal' },
  activity: { letter: 'W', color: '#0ea5e9', title: 'activity' },
  context: { letter: 'S', color: '#f97316', title: 'context/stress' },
};

function istClock(t: number): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(t));
}

function istAxisHour(t: number): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: true,
  }).format(new Date(t));
}

function istAxisDay(t: number): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short',
  }).format(new Date(t));
}

export default function GlucoseTodayChart({ chart }: { chart: GlucoseChartData }) {
  const [range, setRange] = useState<Range>('today');
  const { today } = chart;

  // One unified point stream: measured + forecast share the x axis. The
  // forecast's anchor row (same t as the last measured reading) is MERGED
  // into the measured row so the tooltip reports the reading, not the model.
  const points = useMemo(() => {
    if (range === 'today') {
      const merged = new Map<number, PointRow>();
      for (const r of today.readings) {
        merged.set(r.t, { t: r.t, value: r.value, dev: r.dev, usualN: r.usualN, forecast: undefined, band: undefined });
      }
      for (const f of today.forecast) {
        const existing = merged.get(f.t);
        if (existing) {
          merged.set(f.t, { ...existing, forecast: f.value ?? undefined, band: f.band ?? undefined });
        } else {
          merged.set(f.t, { t: f.t, value: undefined, dev: null, usualN: 0, forecast: f.value ?? undefined, band: f.band ?? undefined });
        }
      }
      return [...merged.values()].sort((a, b) => a.t - b.t);
    }
    const src = range === 'week' ? chart.week : chart.fortnight;
    return src.map((r) => ({ ...r, dev: null, usualN: 0, forecast: undefined, band: undefined }));
  }, [range, chart, today]);

  // Axis window: the IST day (Today) or the covered span (Week / 14 d).
  const [axisStart, axisEnd] = useMemo(() => {
    if (range === 'today') {
      const firstEvent = today.events[0]?.t;
      const lastEvent = today.events.at(-1)?.t;
      let start = Math.min(today.dayStart + 6 * HOUR_MS, firstEvent ?? Infinity);
      let end = Math.max(today.dayStart + 21 * HOUR_MS, lastEvent ?? -Infinity);
      if (!Number.isFinite(start)) start = today.dayStart + 6 * HOUR_MS;
      if (!Number.isFinite(end)) end = today.dayStart + 21 * HOUR_MS;
      return [Math.floor(start / HOUR_MS) * HOUR_MS, Math.ceil(end / HOUR_MS) * HOUR_MS];
    }
    const src = range === 'week' ? chart.week : chart.fortnight;
    if (!src.length) return [Date.now() - 7 * 24 * HOUR_MS, Date.now()];
    return [src[0].t, src[src.length - 1].t];
  }, [range, chart, today]);

  const title = range === 'today' ? 'Glucose today' : range === 'week' ? 'Glucose · 7 days' : 'Glucose · 14 days';
  // Revamp item 7: every data location carries its basis - reading count,
  // and for Today the latest reading's time + source. Quiet suffix on the
  // existing subtitle line; no layout change vs the approved v1 mockup.
  const latestToday = today.readings.at(-1);
  const basisSuffix =
    range === 'today'
      ? latestToday
        ? ` · ${today.readings.length} reading${today.readings.length > 1 ? 's' : ''} · latest ${istClock(latestToday.t)} · ${latestToday.source}`
        : ' · no readings yet today'
      : ` · ${(range === 'week' ? chart.week : chart.fortnight).length} readings`;
  const subtitle =
    (range === 'today'
      ? 'with meals, medication, activity & context events'
      : 'readings against the 70–140 mg/dL target band') + basisSuffix;

  const hourTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let t = axisStart; t <= axisEnd; t += 3 * HOUR_MS) ticks.push(t);
    return ticks;
  }, [axisStart, axisEnd]);

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-xs text-neutral-500">{subtitle}</p>
        </div>
        <div className="flex rounded-full border border-neutral-200 p-0.5 text-xs dark:border-neutral-700" role="tablist" aria-label="Glucose chart range">
          {(['today', 'week', '14d'] as const).map((r) => (
            <button
              key={r}
              role="tab"
              aria-selected={range === r}
              onClick={() => setRange(r)}
              className={`rounded-full px-3 py-1 transition ${
                range === r
                  ? 'bg-brand-600 font-medium text-white'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              {r === 'today' ? 'Today' : r === 'week' ? 'Week' : '14 d'}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={230}>
        <ComposedChart data={points} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <ReferenceArea y1={70} y2={140} fill="#16b077" fillOpacity={0.06} />
          <ReferenceLine
            y={140}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            strokeOpacity={0.6}
            label={{ value: 'target ceiling 140', position: 'insideTopRight', fontSize: 10, fill: '#b45309' }}
          />
          <XAxis
            dataKey="t"
            type="number"
            domain={[axisStart, axisEnd]}
            ticks={range === 'today' ? hourTicks : undefined}
            tickFormatter={(t: number) => (range === 'today' ? istAxisHour(t) : istAxisDay(t))}
            tick={{ fontSize: 11, fill: '#888' }}
            minTickGap={range === 'today' ? 0 : 32}
          />
          <YAxis domain={[60, 220]} tick={{ fontSize: 11, fill: '#888' }} />
          <Tooltip
            content={<ChartTooltip events={range === 'today' ? today.events : []} focusT={today.focusT} />}
            cursor={{ stroke: '#ccc', strokeDasharray: '3 3' }}
          />
          {range === 'today' && (
            <Area
              type="monotone"
              dataKey="band"
              stroke="none"
              fill="#3fcb93"
              fillOpacity={0.18}
              isAnimationActive={false}
              connectNulls={false}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke="#16b077"
            strokeWidth={2}
            dot={(p: { cx?: number; cy?: number; payload?: { t: number } }) => (
              // Explicit props, never a spread: recharts passes a `key` inside the
              // dot-render props, and spreading a key-carrying object into JSX is
              // the console error this app forbids (was the page's only error).
              <MeasuredDot cx={p.cx} cy={p.cy} payload={p.payload} focusT={today.focusT} />
            )}
            connectNulls
            isAnimationActive={false}
          />
          {range === 'today' && (
            <Line
              type="monotone"
              dataKey="forecast"
              stroke="#3fcb93"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {range === 'today' && <EventMarkers events={today.events} dayStart={today.dayStart} dayEnd={today.dayEnd} />}

      <Legend />
    </section>
  );
}

/** Measured-point dot; the focus reading gets the amber "reading of interest" ring. */
function MeasuredDot({ cx, cy, payload, focusT }: { cx?: number; cy?: number; payload?: { t: number }; focusT: number | null }) {
  if (cx === undefined || cy === undefined || !payload) return null;
  const isFocus = focusT !== null && payload.t === focusT;
  return (
    <g>
      {isFocus && <circle cx={cx} cy={cy} r={6} fill="none" stroke="#f59e0b" strokeWidth={2} />}
      <circle cx={cx} cy={cy} r={isFocus ? 3.5 : 2.5} fill={isFocus ? '#f59e0b' : '#16b077'} />
    </g>
  );
}

/** Event chips under the x-axis, positioned at their actual time. */
function EventMarkers({ events, dayStart, dayEnd }: { events: ChartEvent[]; dayStart: number; dayEnd: number }) {
  if (!events.length) {
    return <p className="mt-1 text-[11px] text-neutral-400">No events logged yet today — meals, doses, activity and day-tags appear here.</p>;
  }
  const span = dayEnd - dayStart;
  // Two lanes are enough to keep close events readable.
  const placed: { ev: ChartEvent; leftPct: number; lane: number }[] = [];
  let lastLeftByLane: number[] = [-100, -100];
  for (const ev of events) {
    const leftPct = Math.min(97, Math.max(3, ((ev.t - dayStart) / span) * 100));
    const lane = leftPct - lastLeftByLane[0] < 9 ? 1 : 0;
    placed.push({ ev, leftPct, lane });
    lastLeftByLane[lane] = leftPct;
  }
  return (
    <div className="relative mt-1 h-12">
      {placed.map(({ ev, leftPct, lane }, i) => {
        const st = EVENT_STYLE[ev.kind];
        return (
          <div
            key={`${ev.t}-${i}`}
            className="absolute flex w-16 -translate-x-1/2 flex-col items-center gap-0.5"
            style={{ left: `${leftPct}%`, top: lane === 0 ? 0 : 26 }}
            title={`${istClock(ev.t)} — ${ev.label}${ev.detail ? ` (${ev.detail})` : ''}${ev.planned ? ' · planned, not yet done' : ''}`}
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-[4px] text-[9px] font-bold text-white ${
                ev.planned ? 'border border-dashed' : ''
              }`}
              style={{ backgroundColor: ev.planned ? 'transparent' : st.color, borderColor: st.color, color: ev.planned ? st.color : '#fff' }}
            >
              {st.letter}
            </span>
            <span className="text-[9px] leading-none text-neutral-400">
              {new Date(ev.t + IST_OFFSET_MS).toISOString().slice(11, 16)}
              {ev.planned ? '?' : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Legend() {
  const items: [string, string, boolean][] = [
    ['measured', '#16b077', false],
    ['model forecast', '#3fcb93', true],
    ['reading of interest', '#f59e0b', false],
    ['D dose', EVENT_STYLE.dose.color, false],
    ['M meal', EVENT_STYLE.meal.color, false],
    ['W activity', EVENT_STYLE.activity.color, false],
    ['S context/stress', EVENT_STYLE.context.color, false],
  ];
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-neutral-100 pt-2 text-[11px] text-neutral-500 dark:border-neutral-900">
      {items.map(([label, color, dashed]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-[3px]"
            style={{ backgroundColor: color, opacity: dashed ? 0.55 : 1, border: dashed ? '1px dashed' : 'none' }}
          />
          {label}
        </span>
      ))}
      <span className="text-neutral-400">dashed events = planned, not yet done</span>
    </div>
  );
}

/** Custom tooltip: value (or forecast), deviation vs usual, nearby events. */
function ChartTooltip({
  active, payload, events, focusT,
}: {
  active?: boolean;
  payload?: { payload: PointRow }[];
  events: ChartEvent[];
  focusT: number | null;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const isForecast = p.forecast !== undefined && p.value === undefined;
  const nearby = events.filter((e) => Math.abs(e.t - p.t) <= 45 * 60_000);
  return (
    <div className="max-w-[260px] rounded-lg border border-neutral-700 bg-neutral-900/95 px-3 py-2 text-xs text-white shadow-lg">
      <p className="font-medium">
        {istClock(p.t)}
        {p.value !== undefined ? ` · ${Math.round(p.value)} mg/dL` : ''}
        {isForecast && p.forecast !== undefined ? ` · ~${Math.round(p.forecast)} mg/dL (model)` : ''}
      </p>
      {p.dev !== null && p.dev !== undefined && (p.usualN ?? 0) >= 3 && (
        <p className={`mt-0.5 ${Math.abs(p.dev) >= 15 ? 'text-red-400' : 'text-neutral-300'}`}>
          {p.dev > 0 ? '▲' : '▼'} {Math.abs(p.dev)} vs your usual at this hour
        </p>
      )}
      {p.band && (
        <p className="mt-0.5 text-neutral-400">
          usual range {Math.round(p.band[0])}–{Math.round(p.band[1])} mg/dL
        </p>
      )}
      {nearby.length > 0 && (
        <div className="mt-1 border-t border-neutral-700 pt-1">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">Nearby</p>
          {nearby.slice(0, 3).map((e, i) => (
            <p key={i} className="text-neutral-300">
              {EVENT_STYLE[e.kind].letter} {e.label}
              {e.detail ? ` · ${e.detail}` : ''}
              {e.planned ? ' · planned' : ''}
            </p>
          ))}
        </div>
      )}
      {focusT !== null && p.t === focusT && (
        <p className="mt-1 text-[10px] text-neutral-500">this is your latest reading</p>
      )}
    </div>
  );
}

interface PointRow {
  t: number;
  value?: number;
  dev?: number | null;
  usualN?: number;
  forecast?: number;
  band?: [number, number];
}
