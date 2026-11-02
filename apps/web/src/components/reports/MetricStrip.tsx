// Metric strip — the mockups' best pattern for "latest values": every number
// carries its freshness, its source, its baseline comparison and a status.
// Mobile-first: a swipeable, snap-scrolling row; becomes a grid from `sm:` up.

import type { Metric, MetricStatus, TrendDirection } from "./types";

const STATUS_CHIP: Record<MetricStatus, string> = {
  good: "bg-[#0a8e5f]/10 text-[#0a8e5f]",
  watch: "bg-amber-100 text-amber-800",
  alert: "bg-red-100 text-red-700",
  neutral: "bg-neutral-100 text-neutral-600",
};

const TREND_TONE: Record<string, string> = {
  positive: "text-[#0a8e5f]",
  negative: "text-red-600",
  neutral: "text-neutral-500",
};

const TREND_ARROW: Record<TrendDirection, string> = { up: "↑", down: "↓", flat: "→" };

export function MetricStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <ul
      aria-label="Latest measurements"
      className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3"
    >
      {metrics.map((m) => {
        const tone = m.trend?.tone ?? "neutral";
        return (
          <li
            key={m.id}
            className="min-w-[200px] snap-start rounded-xl border border-neutral-200 bg-white p-4 sm:min-w-0"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
                {m.label}
                {m.isNew ? (
                  <span className="rounded-full bg-[#0a8e5f] px-1.5 py-px text-[10px] font-semibold uppercase tracking-normal text-white">
                    New
                  </span>
                ) : null}
              </span>
              {m.status && m.statusLabel ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CHIP[m.status]}`}
                >
                  {m.statusLabel}
                </span>
              ) : null}
            </div>

            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tabular-nums tracking-tight text-neutral-900">
                {m.value}
              </span>
              {m.unit ? <span className="text-xs text-neutral-500">{m.unit}</span> : null}
            </div>

            <p className="mt-1.5 text-xs text-neutral-400">
              {m.timestamp} · {m.source}
            </p>

            {m.trend ? (
              <p className={`mt-1 text-xs font-medium ${TREND_TONE[tone]}`}>
                {TREND_ARROW[m.trend.direction]} {m.trend.display}
                {m.trend.note ? (
                  <span className="font-normal text-neutral-400"> · {m.trend.note}</span>
                ) : null}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
