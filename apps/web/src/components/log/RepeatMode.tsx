'use client';

// P0 (/log revamp) - RepeatMode: one-tap re-logging of recent meals.
// Entries from /api/meals (last 50, newest first) are clustered into meals
// client-side: consecutive entries closer than CLUSTER_GAP_MIN belong to one
// meal (the tray saves items seconds apart, and honest backfilling can take
// a few minutes); anything further apart is a new eating occasion - a snack
// 40 minutes after breakfast is its own meal. Unique meals (same foods +
// portions) are deduped, keeping the most recent occurrence - "what you
// actually eat", not a raw entry dump.
// Primary action saves immediately (same /api/meals POST loop the tray uses,
// so pairing/check-in/offline-queue behavior is identical); "Edit first"
// loads the meal into the tray for tweaks.

import { useMemo } from 'react';
import type { Food } from '@mi/engine';
import { classifyMealType } from '@/lib/meal-bits';

export interface RepeatEntryRow {
  id: string;
  foodId: string;
  portionType: 'serving' | 'katori' | 'grams';
  portionValue: number;
  kcal: number;
  carbsG: number;
  loggedAt: string;
  food: Food;
}

export interface RepeatMeal {
  key: string;
  label: string;
  items: RepeatEntryRow[];
  kcal: number;
  carbsG: number;
  mealType: string;
  lastAt: number;
  whenLabel: string;
  timesEaten: number;
}

interface Props {
  entries: RepeatEntryRow[];
  busy: boolean;
  whenMin: number;
  onWhenChange: (m: number) => void;
  whenLabel: string;
  onRepeat: (card: RepeatMeal) => void;
  onLoadIntoTray: (card: RepeatMeal) => void;
}

const CLUSTER_GAP_MIN = 30;
const MAX_CARDS = 9;

// Same options as the tray's when-select (kept in sync by hand - two lines).
const WHEN_OPTIONS: { label: string; minutes: number }[] = [
  { label: 'Just now', minutes: 0 },
  { label: '30 min ago', minutes: 30 },
  { label: '1 hr ago', minutes: 60 },
  { label: '2 hrs ago', minutes: 120 },
  { label: '3 hrs ago', minutes: 180 },
];

const timeFmt = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

function dayLabel(ms: number): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const today = fmt.format(new Date());
  const yest = fmt.format(new Date(Date.now() - 24 * 3_600_000));
  const d = fmt.format(new Date(ms));
  if (d === today) return 'Today';
  if (d === yest) return 'Yesterday';
  return '';
}

function itemLabel(e: RepeatEntryRow): string {
  const unit =
    e.portionType === 'grams'
      ? `${e.portionValue}g`
      : `${e.portionValue} ${e.portionType}${e.portionValue === 1 ? '' : 's'}`;
  return `${e.food.name} (${unit})`;
}

export function clusterMeals(entries: RepeatEntryRow[]): RepeatMeal[] {
  const rows = entries
    .filter((e) => e && e.foodId && Number.isFinite(new Date(e.loggedAt).getTime()))
    .map((e) => ({ e, ts: new Date(e.loggedAt).getTime() }))
    .sort((a, b) => a.ts - b.ts);

  const clusters: { items: RepeatEntryRow[]; startTs: number; endTs: number; carbs: number }[] = [];
  for (const r of rows) {
    const last = clusters[clusters.length - 1];
    if (last && r.ts - last.endTs <= CLUSTER_GAP_MIN * 60_000) {
      last.items.push(r.e);
      last.endTs = r.ts;
      last.carbs += r.e.carbsG ?? 0;
    } else {
      clusters.push({ items: [r.e], startTs: r.ts, endTs: r.ts, carbs: r.e.carbsG ?? 0 });
    }
  }

  const bySignature = new Map<string, RepeatMeal>();
  for (const c of clusters) {
    const kcal = c.items.reduce((s, i) => s + (i.kcal ?? 0), 0);
    const carbs = Math.round(c.carbs);
    const mealType = classifyMealType(c.startTs, carbs);
    const names = c.items.map((i) => i.food.name);
    const label =
      names.length <= 2 ? names.join(' + ') : `${names.slice(0, 2).join(' + ')} +${names.length - 2} more`;
    const key = c.items
      .map((i) => `${i.foodId}:${i.portionType}:${i.portionValue}`)
      .sort()
      .join('|');

    const prev = bySignature.get(key);
    if (prev) {
      prev.timesEaten += 1;
      if (c.endTs > prev.lastAt) {
        prev.lastAt = c.endTs;
        prev.whenLabel = `${dayLabel(c.endTs)} ${timeFmt.format(new Date(c.endTs))}`.trim();
      }
      continue;
    }
    bySignature.set(key, {
      key,
      label,
      items: c.items,
      kcal: Math.round(kcal),
      carbsG: carbs,
      mealType,
      lastAt: c.endTs,
      whenLabel: `${dayLabel(c.endTs)} ${timeFmt.format(new Date(c.endTs))}`.trim(),
      timesEaten: 1,
    });
  }

  return [...bySignature.values()].sort((a, b) => b.lastAt - a.lastAt).slice(0, MAX_CARDS);
}

export default function RepeatMode({ entries, busy, whenMin, onWhenChange, whenLabel, onRepeat, onLoadIntoTray }: Props) {
  const cards = useMemo(() => clusterMeals(entries), [entries]);

  if (cards.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 p-6 text-center dark:border-neutral-700">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Nothing to repeat yet - your recent meals will appear here as one-tap cards.
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          Log a meal once in Build and it becomes a repeat card forever.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
        <label>
          Log it as{' '}
          <select
            value={whenMin}
            onChange={(e) => onWhenChange(Number(e.target.value))}
            className="ml-1 rounded border border-neutral-300 bg-transparent px-2 py-1 text-xs dark:border-neutral-700"
          >
            {WHEN_OPTIONS.map((o) => (
              <option key={o.minutes} value={o.minutes}>{o.label}</option>
            ))}
          </select>
        </label>
        <span suppressHydrationWarning className="text-neutral-400">({whenLabel})</span>
        <span>- or load a meal into the tray to tweak first.</span>
      </div>
      <ul className="mt-2 space-y-2">
        {cards.map((c) => (
          <li
            key={c.key}
            className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {c.label}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                  <span className="capitalize">{c.mealType}</span>
                  {' \u00b7 '}
                  {Math.round(c.kcal)} kcal
                  {' \u00b7 '}
                  {c.carbsG} g carbs
                  {' \u00b7 '}
                  {c.items.length} item{c.items.length === 1 ? '' : 's'}
                  {c.timesEaten > 1 ? ` \u00b7 eaten ${c.timesEaten} times` : ''}
                </p>
                <p className="mt-0.5 text-[11px] text-neutral-400" suppressHydrationWarning>
                  Last: {c.whenLabel} - {itemLabel(c.items[0])}
                  {c.items.length > 1 ? ` +${c.items.length - 1} more` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => onLoadIntoTray(c)}
                  disabled={busy}
                  className="min-h-[36px] rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
                >
                  Edit first
                </button>
                <button
                  type="button"
                  onClick={() => onRepeat(c)}
                  disabled={busy}
                  className="min-h-[36px] rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  Log again
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
