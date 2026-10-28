// "Today's suggestions" (dashboard revamp item 6, approved v1 layout).
// Server component. Replaces the old hardcoded "AI Daily Recommendations"
// card: every suggestion arrives from the pure engine (suggestions.ts)
// derived from the user's own records, with its evidence inline. No
// evidence, no suggestion - the card never pads itself with filler.

import Link from 'next/link';
import type { Suggestion, SuggestionSource } from '@mi/engine';
import AddToPlanButton from './AddToPlanButton';

const SOURCE_STYLE: Record<SuggestionSource, { className: string }> = {
  'from pattern': { className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  'from model': { className: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' },
  reminder: { className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
};

export default function SuggestionsCard({
  suggestions, today,
}: {
  suggestions: Suggestion[];
  /** IST 'YYYY-MM-DD' for the plan storage key */
  today: string;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mb-3">
        <h2 className="text-base font-semibold">Today&rsquo;s suggestions</h2>
        <p className="text-xs text-neutral-500">
          derived from your own patterns — with the evidence behind each one
        </p>
      </div>

      {suggestions.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No suggestions yet — keep logging meals, walks and readings. Your patterns need a few more days of records before they can say anything honest.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {suggestions.map((s) => (
              <article
                key={s.id}
                className="flex flex-col rounded-xl border border-neutral-200 p-3.5 dark:border-neutral-800"
              >
                <span className={`mb-1.5 w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SOURCE_STYLE[s.source].className}`}>
                  {s.source}
                </span>
                <h3 className="text-sm font-semibold">{s.title}</h3>
                <p className="mt-1 flex-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">{s.body}</p>
                <p className="mt-2 text-[11px] text-neutral-400">evidence: {s.evidence.text}</p>
                <div className="mt-2 border-t border-neutral-100 pt-2 dark:border-neutral-900">
                  {s.action.kind === 'plan' ? (
                    <AddToPlanButton id={s.id} label={s.action.label} today={today} />
                  ) : (
                    <Link href="/meds" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
                      {s.action.label} →
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-neutral-400">
            Associations from your records, not medical advice. Add-to-plan saves on this device until the planner ships.
          </p>
        </>
      )}
    </section>
  );
}
