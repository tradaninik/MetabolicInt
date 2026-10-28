// "Why was it high?" card (dashboard revamp item 4, approved v1 layout).
// Server component. Every row comes from the pure attribution engine and
// uses EXACTLY the three approved labels. The card never says a factor
// caused anything - it shows what the user's records contain near the
// reading, and how each factor compares to their own usual.

import Link from 'next/link';
import type { AttributionLabel, AttributionResult } from '@mi/engine';
import type { GlucoseCard } from '@/lib/engine-service';

const FACTOR_NAMES: Record<string, string> = {
  meal: 'Meal',
  medication: 'Medication',
  activity: 'Activity',
  sleep: 'Sleep',
  stress: 'Stress',
};

function labelBadgeClass(label: AttributionLabel): string {
  switch (label) {
    case 'observed pattern':
      return 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300';
    case 'possible contributor':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
    default:
      return 'bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400';
  }
}

export default function WhyHighCard({
  attribution, glucose,
}: {
  attribution: AttributionResult;
  glucose: GlucoseCard;
}) {
  const latest = glucose.latest;
  const time = latest
    ? new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true,
      }).format(new Date(latest.takenAt))
    : null;

  const mealRow = attribution.rows.find((r) => r.factor === 'meal');
  const medsRow = attribution.rows.find((r) => r.factor === 'medication');
  const onTrackMealMeds =
    mealRow?.label === 'observed pattern' && medsRow?.label === 'observed pattern';

  return (
    <section className="flex h-full flex-col rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold">
          {attribution.triggered ? `Why was ${time} high?` : `Your ${time} reading`}
        </h2>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            attribution.triggered
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
              : 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
          }`}
        >
          {attribution.triggered ? 'Investigate' : 'Within usual'}
        </span>
      </div>
      <p className="mb-3 text-xs text-neutral-500">
        {attribution.triggered
          ? onTrackMealMeds
            ? 'Diet on plan · medication taken — so what else changed?'
            : 'Candidate factors from your own records — associations, not causes.'
          : `Within your usual range for this hour — nothing to investigate.`}
      </p>

      <ul className="flex-1 space-y-2">
        {attribution.rows.map((row) => (
          <li
            key={row.factor}
            className="flex items-start justify-between gap-2 rounded-lg border border-neutral-100 px-2.5 py-2 dark:border-neutral-900"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium">{FACTOR_NAMES[row.factor]}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{row.text}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${labelBadgeClass(row.label)}`}>
              {row.label}
            </span>
          </li>
        ))}
      </ul>

      {attribution.totalEvidence > 0 && (
        <Link
          href="/insights"
          className="mt-3 inline-block text-xs font-medium text-brand-600 hover:underline"
        >
          View evidence · {attribution.totalEvidence} records →
        </Link>
      )}
    </section>
  );
}
