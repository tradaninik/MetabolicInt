"use client";

// Event-overlay glucose chart — the mockups' strongest reporting idea:
// one picture that answers "what happened, when, and how did my body respond".
//
//   • 24h curve inside the target band, with a shaded sleep window
//   • meal / medication / activity markers on the timeline (tap for details,
//     including the glucose response in the following 90 minutes)
//   • always-on peak annotation with the likely cause
//   • honest freshness stamp ("Updated 8:32 AM · CGM")
//
// Improvement over the mockup: the SVG re-measures to its container, so text
// stays at true pixel size and stays crisp from a 360px phone to a wide
// desktop column. Zero chart libraries — plain, dependency-free SVG.

import { useEffect, useMemo, useRef, useState } from "react";

import { BRAND_GREEN, EVENT_COLORS, EVENT_LABELS } from "./theme";
import type { ChartEvent, GlucosePoint } from "./types";

export interface GlucoseEventChartProps {
  points: GlucosePoint[];
  /** e.g. [70, 140] mg/dL. */
  targetRange: [number, number];
  events: ChartEvent[];
  /** Shaded sleep window, as ["HH:MM", "HH:MM"]. */
  sleepWindow?: [string, string];
  unit?: string;
  updatedStamp?: string;
}

const DAY = 24 * 60;

function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function fmt12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export function GlucoseEventChart({
  points,
  targetRange,
  events,
  sleepWindow,
  unit = "mg/dL",
  updatedStamp,
}: GlucoseEventChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(390); // mobile-first default; corrected on mount

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [selected, setSelected] = useState<ChartEvent | null>(null);

  const geo = useMemo(() => {
    const W = width;
    const H = W < 520 ? 250 : 230;
    const pad = { top: 22, right: W < 520 ? 10 : 16, bottom: 40, left: W < 520 ? 30 : 36 };
    const iw = W - pad.left - pad.right;
    const ih = H - pad.top - pad.bottom;
    const vs = points.map((p) => p.v);
    const lo = Math.floor(Math.min(...vs, targetRange[0]) / 50) * 50;
    const hi = Math.ceil((Math.max(...vs, targetRange[1]) + 15) / 20) * 20;
    const x = (t: string) => pad.left + (toMin(t) / DAY) * iw;
    const y = (v: number) => pad.top + (1 - (v - lo) / (hi - lo)) * ih;
    const ticks: number[] = [];
    for (let v = lo; v <= hi; v += 50) ticks.push(v);
    return { W, H, pad, iw, ih, lo, hi, x, y, ticks };
  }, [width, points, targetRange]);

  const peak = useMemo(
    () => points.reduce((a, b) => (b.v > a.v ? b : a), points[0]),
    [points],
  );

  /** The closest event before the peak (within 2h) — its likely cause. */
  const peakCause = useMemo(() => {
    if (!peak) return null;
    const pm = toMin(peak.t);
    let best: ChartEvent | null = null;
    let bestGap = Infinity;
    for (const e of events) {
      const gap = pm - toMin(e.t);
      if (gap >= 0 && gap < 120 && gap < bestGap) {
        bestGap = gap;
        best = e;
      }
    }
    return best;
  }, [peak, events]);

  /** Highest reading within 90 min after the selected event. */
  const response = useMemo(() => {
    if (!selected) return null;
    const start = toMin(selected.t);
    let best: GlucosePoint | null = null;
    for (const p of points) {
      const d = toMin(p.t) - start;
      if (d >= 0 && d <= 90 && (!best || p.v > best.v)) best = p;
    }
    return best;
  }, [selected, points]);

  if (!points.length) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-400">
        No glucose data yet for today.
      </div>
    );
  }

  const baseY = geo.pad.top + geo.ih;
  const lineD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${geo.x(p.t).toFixed(1)} ${geo.y(p.v).toFixed(1)}`)
    .join(" ");
  const areaD = `${lineD} L ${geo.x(points[points.length - 1].t).toFixed(1)} ${baseY.toFixed(1)} L ${geo.x(points[0].t).toFixed(1)} ${baseY.toFixed(1)} Z`;

  // Nudge markers that are <25 min apart into a second lane so they don't collide.
  const sortedEvents = [...events].sort((a, b) => toMin(a.t) - toMin(b.t));
  const lanes = sortedEvents.map((e, i) => ({
    e,
    bump: i > 0 && toMin(e.t) - toMin(sortedEvents[i - 1].t) < 25,
  }));

  const px = geo.x(peak.t);
  const py = geo.y(peak.v);
  const flip = px > geo.W * 0.6;

  const xLabels: Array<[string, string]> = [
    ["00:00", "12 AM"],
    ["06:00", "6 AM"],
    ["12:00", "12 PM"],
    ["18:00", "6 PM"],
  ];

  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <div className="flex items-baseline justify-between gap-2 px-4 pt-4 sm:px-5">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">Glucose · today</h3>
          {updatedStamp ? <p className="mt-0.5 text-xs text-neutral-400">{updatedStamp}</p> : null}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 sm:px-5">
        <span className="flex items-center gap-1.5 text-xs text-neutral-500">
          <svg width="16" height="3" aria-hidden="true">
            <line x1="0" y1="1.5" x2="16" y2="1.5" stroke={BRAND_GREEN} strokeWidth="2.5" />
          </svg>
          Glucose
        </span>
        <span className="flex items-center gap-1.5 text-xs text-neutral-500">
          <span className="inline-block h-2.5 w-4 rounded-sm bg-[#0a8e5f]/10 ring-1 ring-inset ring-[#0a8e5f]/20" />
          Target {targetRange[0]}–{targetRange[1]}
        </span>
        {(["meal", "medication", "activity"] as const).map((t) => (
          <span key={t} className="flex items-center gap-1.5 text-xs text-neutral-500">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: EVENT_COLORS[t] }}
            />
            {EVENT_LABELS[t]}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-xs text-neutral-500">
          <span className="inline-block h-2.5 w-4 rounded-sm bg-slate-500/10" />
          Sleep
        </span>
      </div>

      {/* Chart */}
      <div ref={wrapRef} className="w-full px-1 pb-1 pt-2">
        <svg
          width={geo.W}
          height={geo.H}
          viewBox={`0 0 ${geo.W} ${geo.H}`}
          className="block max-w-full"
          role="img"
          aria-label="Glucose curve for today with meal, medication and activity markers"
        >
          {/* Gridlines + y labels */}
          {geo.ticks.map((v) => (
            <g key={v}>
              <line
                x1={geo.pad.left}
                x2={geo.W - geo.pad.right}
                y1={geo.y(v)}
                y2={geo.y(v)}
                stroke="#ececec"
                strokeWidth="1"
              />
              <text x={geo.pad.left - 6} y={geo.y(v) + 3} textAnchor="end" fontSize="10" fill="#a3a3a3">
                {v}
              </text>
            </g>
          ))}

          {/* Sleep window */}
          {sleepWindow ? (
            <g>
              <rect
                x={geo.x(sleepWindow[0])}
                y={geo.pad.top}
                width={Math.max(0, geo.x(sleepWindow[1]) - geo.x(sleepWindow[0]))}
                height={geo.ih}
                fill="#64748b"
                opacity="0.05"
              />
              <text x={geo.x(sleepWindow[0]) + 4} y={geo.pad.top + 10} fontSize="9" fill="#94a3b8">
                Sleep
              </text>
            </g>
          ) : null}

          {/* Target band */}
          <rect
            x={geo.pad.left}
            y={geo.y(targetRange[1])}
            width={geo.iw}
            height={geo.y(targetRange[0]) - geo.y(targetRange[1])}
            fill={BRAND_GREEN}
            opacity="0.06"
          />
          <text
            x={geo.W - geo.pad.right - 4}
            y={geo.y(targetRange[1]) + 11}
            textAnchor="end"
            fontSize="9"
            fill={BRAND_GREEN}
            opacity="0.8"
          >
            Target {targetRange[0]}–{targetRange[1]}
          </text>

          {/* Area + line */}
          <path d={areaD} fill={BRAND_GREEN} opacity="0.07" />
          <path
            d={lineD}
            fill="none"
            stroke={BRAND_GREEN}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Selected event guide line */}
          {selected ? (
            <line
              x1={geo.x(selected.t)}
              x2={geo.x(selected.t)}
              y1={geo.pad.top}
              y2={baseY}
              stroke={EVENT_COLORS[selected.type]}
              strokeWidth="1.5"
              strokeDasharray="3 3"
              opacity="0.5"
            />
          ) : null}

          {/* Peak annotation */}
          <circle cx={px} cy={py} r="4.5" fill="#fff" stroke={BRAND_GREEN} strokeWidth="2.5" />
          {peakCause ? (
            <text
              x={flip ? px - 9 : px + 9}
              y={py - 22}
              textAnchor={flip ? "end" : "start"}
              fontSize="9.5"
              fill="#a3a3a3"
            >
              after {peakCause.label.toLowerCase()}
            </text>
          ) : null}
          <text
            x={flip ? px - 9 : px + 9}
            y={py - 9}
            textAnchor={flip ? "end" : "start"}
            fontSize="11"
            fontWeight="600"
            fill="#404040"
          >
            {peak.v} {unit} · {fmt12(peak.t)}
          </text>

          {/* Time axis */}
          {xLabels.map(([t, label], i) => (
            <text
              key={t}
              x={geo.x(t)}
              y={geo.H - 8}
              textAnchor={i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"}
              fontSize="10"
              fill="#a3a3a3"
            >
              {label}
            </text>
          ))}

          {/* Event markers (tap targets) */}
          {lanes.map(({ e, bump }) => {
            const cy = baseY + 10 + (bump ? 10 : 0);
            const isSel = selected === e;
            return (
              <g
                key={`${e.t}-${e.label}`}
                onClick={() => setSelected(isSel ? null : e)}
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={geo.x(e.t)}
                  cy={cy}
                  r={isSel ? 6 : 4.5}
                  fill={e.planned ? "#fff" : EVENT_COLORS[e.type]}
                  stroke={EVENT_COLORS[e.type]}
                  strokeWidth="2"
                />
                <circle cx={geo.x(e.t)} cy={cy} r="12" fill="transparent" />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Caption / tapped-event detail */}
      <div className="px-4 pb-4 sm:px-5">
        {selected ? (
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="w-full rounded-lg bg-neutral-50 px-3 py-2 text-left text-xs text-neutral-600"
          >
            <span className="font-medium text-neutral-800">
              {fmt12(selected.t)} · {selected.label}
            </span>
            {response ? (
              <span className="text-neutral-500">
                {" "}
                — glucose {response.v} {unit} at {fmt12(response.t)} (
                {toMin(response.t) - toMin(selected.t)} min later)
              </span>
            ) : null}
            <span className="mt-0.5 block text-neutral-400">Tap again to dismiss</span>
          </button>
        ) : (
          <p className="text-xs text-neutral-400">Tap a marker on the timeline for details.</p>
        )}
      </div>
    </div>
  );
}
