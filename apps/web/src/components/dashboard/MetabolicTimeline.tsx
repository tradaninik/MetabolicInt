// Horizontal metabolic timeline (dashboard revamp item 5, approved v1).
// Every event of the IST day in order, as horizontally-scrollable cards
// joined by arrows. Color-coded top borders; the reading-of-interest gets
// the yellow highlight; planned items render dashed. Every card links to
// its edit/inspect page - nothing is display-only.

import Link from 'next/link';
import type { TimelineItem } from '@/lib/engine-service';

const KIND_STYLE: Record<TimelineItem['kind'], { border: string; label: string }> = {
  wake: { border: 'border-t-indigo-500', label: 'sleep' },
  med: { border: 'border-t-red-500', label: 'medication' },
  meal: { border: 'border-t-brand-500', label: 'meal' },
  activity: { border: 'border-t-sky-500', label: 'activity' },
  glucose: { border: 'border-t-amber-500', label: 'glucose' },
  context: { border: 'border-t-orange-500', label: 'context' },
};

function istClock(t: number): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(t));
}

export default function MetabolicTimeline({ items }: { items: TimelineItem[] }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Today&rsquo;s metabolic timeline</h2>
          <p className="text-xs text-neutral-500">every event in order — tap any card to edit or inspect</p>
        </div>
        <Link
          href="/log"
          className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
        >
          + Add missing event
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">Nothing logged yet today — your day will fill in here as you log.</p>
      ) : (
        <div className="overflow-x-auto pb-2">
          <ol className="flex min-w-max items-stretch gap-2">
            {items.map((item, i) => (
              <li key={`${item.t}-${i}`} className="flex items-stretch gap-2">
                <Link
                  href={item.href}
                  className={`block w-40 shrink-0 rounded-xl border border-t-4 border-neutral-200 px-3 py-2 transition hover:border-neutral-300 hover:shadow-sm dark:border-neutral-800 dark:hover:border-neutral-700 ${
                    KIND_STYLE[item.kind].border
                  } ${
                    item.focus
                      ? 'bg-yellow-50 ring-1 ring-amber-300 dark:bg-yellow-950/20 dark:ring-amber-700'
                      : 'bg-white dark:bg-neutral-950'
                  } ${item.planned ? 'border-dashed' : ''}`}
                >
                  <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                    {istClock(item.t)} · {KIND_STYLE[item.kind].label}
                    {item.planned && ' · planned'}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold">{item.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-neutral-500">{item.detail}</p>
                </Link>
                {i < items.length - 1 && (
                  <span aria-hidden className="self-center text-neutral-300 dark:text-neutral-700">
                    ›
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
