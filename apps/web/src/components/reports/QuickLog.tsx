"use client";

// Quick log — carried in from the production dashboard, refined.
// This is the feature users reach for most ("No time? One number is enough"),
// so it belongs in the kit: the same seven one-tap loggers as production,
// with a swipeable, snap-scrolling mobile row and a de-cluttered meal tile
// (dish name only — the "Again:" prefix is gone, per review).

export type QuickLogKind =
  | "blood-sugar"
  | "walk"
  | "sleep"
  | "weight"
  | "exercise"
  | "bp"
  | "meal";

export interface QuickLogProps {
  /** Last logged meal — powers the "log again" tile. */
  lastMeal?: string;
  onQuickLog?: (kind: QuickLogKind) => void;
}

const TILES: Array<{ kind: QuickLogKind; icon: string; label: string }> = [
  { kind: "blood-sugar", icon: "🩸", label: "Blood sugar" },
  { kind: "walk", icon: "🚶", label: "Walk" },
  { kind: "sleep", icon: "😴", label: "Sleep" },
  { kind: "weight", icon: "⚖", label: "Weight" },
  { kind: "exercise", icon: "🏋", label: "Exercise" },
  { kind: "bp", icon: "🩺", label: "BP" },
];

export function QuickLog({ lastMeal, onQuickLog }: QuickLogProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-neutral-900">Quick log</h3>
      <p className="mt-0.5 text-xs text-neutral-500">
        No time? One number is enough — log it in seconds.
      </p>

      <div
        role="list"
        className="mt-3 -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {TILES.map((t) => (
          <button
            key={t.kind}
            type="button"
            role="listitem"
            onClick={() => onQuickLog?.(t.kind)}
            className="flex min-w-[96px] snap-start flex-col items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-3.5 transition-colors hover:border-[#0a8e5f] active:bg-neutral-50"
          >
            <span className="text-xl leading-none" aria-hidden="true">
              {t.icon}
            </span>
            <span className="text-xs font-medium text-neutral-900">{t.label}</span>
          </button>
        ))}

        {lastMeal ? (
          <button
            type="button"
            role="listitem"
            onClick={() => onQuickLog?.("meal")}
            aria-label={`Log ${lastMeal} again`}
            className="flex min-w-[140px] snap-start flex-col items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-3.5 transition-colors hover:border-[#0a8e5f] active:bg-neutral-50"
          >
            <span className="text-xl leading-none" aria-hidden="true">
              🍜
            </span>
            <span className="max-w-[130px] truncate text-xs font-medium text-neutral-900">
              {lastMeal}
            </span>
            <span className="text-[10px] text-neutral-400">log again</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
