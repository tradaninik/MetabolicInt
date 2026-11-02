"use client";

// Regional presets — the mockups' drill-down (region → state → dishes),
// cut down to two taps and one tap to add. Same catalog feeds the search,
// so a dish added from here merges with the same item in the tray.

import { useMemo, useState } from "react";

import type { Dish } from "./types";

export interface RegionalPresetsProps {
  dishes: Dish[];
  onAddDish: (dish: Dish) => void;
}

export function RegionalPresets({ dishes, onAddDish }: RegionalPresetsProps) {
  const regions = useMemo(() => Array.from(new Set(dishes.map((d) => d.region))), [dishes]);
  const [region, setRegion] = useState(regions[0] ?? "");

  const subregions = useMemo(
    () => Array.from(new Set(dishes.filter((d) => d.region === region).map((d) => d.subregion))),
    [dishes, region],
  );
  const [sub, setSub] = useState(subregions[0] ?? "");

  const shown = dishes.filter((d) => d.region === region && d.subregion === sub);

  const pickRegion = (r: string) => {
    setRegion(r);
    const subs = Array.from(new Set(dishes.filter((d) => d.region === r).map((d) => d.subregion)));
    setSub(subs[0] ?? "");
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-neutral-900">Regional presets</h3>
      <p className="mt-0.5 text-xs text-neutral-500">
        Quick-add common meals — shown with per-serving estimates.
      </p>

      {/* Region pills — swipeable on mobile */}
      <div className="mt-3 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {regions.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => pickRegion(r)}
            aria-pressed={region === r}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium ${
              region === r
                ? "border-[#0a8e5f] bg-[#0a8e5f]/10 text-[#0a8e5f]"
                : "border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Sub-region pills */}
      <div className="mt-2 flex flex-wrap gap-2">
        {subregions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSub(s)}
            className={`rounded-full px-3 py-1 text-xs ${
              sub === s ? "bg-neutral-100 text-neutral-900" : "text-neutral-400 hover:text-neutral-600"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Dish cards */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {shown.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onAddDish(d)}
            aria-label={`Add ${d.name} to tray`}
            className="rounded-lg border border-neutral-200 bg-white p-3 text-left transition-colors hover:border-[#0a8e5f]"
          >
            <span className="block text-sm font-medium leading-snug text-neutral-900">{d.name}</span>
            <span className="mt-1 block text-xs text-neutral-500">
              {d.kcal} kcal · {d.serving}
            </span>
            <span className="mt-1.5 block text-xs font-semibold text-[#0a8e5f]">Add to tray</span>
          </button>
        ))}
      </div>
    </div>
  );
}
