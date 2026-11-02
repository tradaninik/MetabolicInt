// Insight list — findings with their confidence and evidence made visible.
// Confidence is encoded three ways (solid / tinted / dashed) so weight is
// legible at a glance and honest about how much data backs each claim.

import type { Insight, InsightConfidence } from "./types";

const CONF_CHIP: Record<InsightConfidence, string> = {
  high: "bg-[#0a8e5f] text-white",
  moderate: "bg-[#0a8e5f]/10 text-[#0a8e5f]",
  low: "border border-dashed border-neutral-300 bg-neutral-50 text-neutral-500",
};

const CONF_LABEL: Record<InsightConfidence, string> = {
  high: "High confidence",
  moderate: "Moderate confidence",
  low: "Low confidence",
};

export function ConfidenceChip({ level }: { level: InsightConfidence }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${CONF_CHIP[level]}`}
    >
      {CONF_LABEL[level]}
    </span>
  );
}

export function InsightList({ insights }: { insights: Insight[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {insights.map((i) => (
        <li key={i.id} className="flex flex-col rounded-xl border border-neutral-200 bg-white p-4">
          <ConfidenceChip level={i.confidence} />
          <h3 className="mt-2.5 text-sm font-semibold leading-snug text-neutral-900">{i.title}</h3>
          <p className="mt-1.5 flex-1 text-sm leading-relaxed text-neutral-600">{i.body}</p>
          {i.evidence ? <p className="mt-3 text-xs text-neutral-400">{i.evidence}</p> : null}
          {i.missingData ? (
            <p className="mt-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">
              {i.missingData}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
