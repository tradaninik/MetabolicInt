'use client';

// P0 (/log revamp) - RegionBar: the pinned region selector that sits ABOVE
// every food choice on /log. Six pills, changeable anytime; the choice is
// saved to the profile by the page (best-effort) and drives the food list,
// plate order, default portions and the meal-window hint shown here.
// Mobile-first: pills scroll horizontally; text stays small but tappable
// (min 36px height, same pattern as the category chips).

import { REGION_GROUPS, type RegionGroupKey } from '@/lib/regions';

interface Props {
  group: RegionGroupKey;
  onChange: (g: RegionGroupKey) => void;
}

export default function RegionBar({ group, onChange }: Props) {
  const active = REGION_GROUPS.find((g) => g.key === group) ?? REGION_GROUPS[REGION_GROUPS.length - 1];

  return (
    <section
      aria-label="Your food region"
      className="mt-4 rounded-2xl border border-brand-200 bg-brand-50/40 p-4 dark:border-brand-800 dark:bg-brand-950/20"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-1">
        <h2 className="text-sm font-semibold text-brand-900 dark:text-brand-100">
          Your food region
        </h2>
        <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
          change anytime - saved to your profile
        </span>
      </div>

      <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Choose your food region">
        {REGION_GROUPS.map((g) => {
          const selected = g.key === group;
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => onChange(g.key)}
              aria-pressed={selected}
              title={g.blurb}
              className={`min-h-[36px] shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium ${
                selected
                  ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-950/40 dark:text-brand-300'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-brand-300 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400'
              }`}
            >
              {g.label}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
        <span className="font-medium text-neutral-600 dark:text-neutral-300">{active.label}:</span>{' '}
        {active.blurb} {active.windowsLabel}. Food list, plates and portions follow this choice.
      </p>
    </section>
  );
}
