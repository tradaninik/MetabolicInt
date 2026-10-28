import Link from 'next/link';
import { loadAgniRhythm } from '@/lib/agni';
import type { EvidenceGrade } from '@mi/engine';

// P4c-b / U17 - Agni rhythm card for the dashboard (educational, not medical advice).
// Server component: computes on read, zero persistence. Renders the current IST agni
// window, today's rhythm score with its four explainable components, prioritized
// nudges, and the three rhythm habits from the Food as Medicine knowledge base with
// their evidence grades - the science and lived-experience lenses meeting the
// classical rhythm story.

const GRADE_BADGE: Record<EvidenceGrade, string> = {
  A: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  B: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200',
  C: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  D: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
};

const LEVEL_TINT: Record<string, string> = {
  peak: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  steady: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200',
  rising: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  low: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300',
  'winding-down': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  resting: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
};

function fmtIstMinute(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60);
  const m = minuteOfDay % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function scoreTint(score: number): string {
  return score >= 75
    ? 'bg-brand-500'
    : score >= 50
      ? 'bg-amber-500'
      : 'bg-red-500';
}

export default async function AgniRhythmCard({ userId }: { userId: string }) {
  const snap = await loadAgniRhythm(userId);
  const r = snap.rhythm;

  const components = r
    ? [
        { label: 'Largest meal in the Pitta window', value: r.components.largestMealTiming, max: 40 },
        { label: 'Dinner light', value: r.components.dinnerLightness, max: 20 },
        { label: 'Dinner early (2.5 h+ before sleep)', value: r.components.dinnerLead, max: 20 },
        { label: 'Kitchen closed before the night window', value: r.components.nightDiscipline, max: 20 },
      ]
    : [];

  return (
    <section className="flex h-full flex-col rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Agni rhythm today</h2>
          <p className="text-xs text-neutral-500">
            Meal timing vs the classical day · now {fmtIstMinute(snap.nowIstMinute)} IST
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${LEVEL_TINT[snap.window.agniLevel] ?? 'bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300'}`}
        >
          {snap.window.label} · agni {snap.window.agniLevel}
        </span>
      </div>

      <p className="text-sm text-neutral-700 dark:text-neutral-300">
        {snap.window.note}{' '}
        <span className="text-xs text-neutral-400">({snap.window.window})</span>
      </p>

      {r === null ? (
        <p className="mt-4 rounded-lg border border-dashed border-neutral-300 p-3 text-sm text-neutral-500 dark:border-neutral-700">
          No meals logged yet today. Log your first meal and the rhythm picture appears here -
          computed on read, never stored.
        </p>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-4">
            <div className="text-3xl font-semibold tabular-nums">{r.score}</div>
            <div className="flex-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div className={`h-full ${scoreTint(r.score)}`} style={{ width: `${r.score}%` }} />
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                out of 100 · from {snap.mealsToday} meal{snap.mealsToday === 1 ? '' : 's'} logged today (IST)
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            {components.map((c) => (
              <div key={c.label} className="flex items-center gap-2 text-xs">
                <span className="w-56 shrink-0 text-neutral-500">{c.label}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <div
                    className={`h-full ${c.value >= c.max * 0.75 ? 'bg-brand-500' : c.value >= c.max * 0.5 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${(100 * c.value) / c.max}%` }}
                  />
                </div>
                <span className="w-12 text-right tabular-nums">{c.value}/{c.max}</span>
              </div>
            ))}
          </div>

          {r.nudges.length > 0 && (
            <ul className="mt-4 space-y-2">
              {r.nudges.map((n) => (
                <li
                  key={n}
                  className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
                >
                  {n}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <div className="mt-4">
        <h3 className="text-xs font-semibold text-neutral-500">Habits that fit the rhythm story</h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-3">
          {snap.habits.map((h) => (
            <li key={h.slug} className="rounded-lg border border-neutral-200 p-3 text-xs dark:border-neutral-800">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{h.name}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${GRADE_BADGE[h.grade]}`}>
                  {h.grade}
                </span>
              </div>
              <p className="mt-1 text-neutral-500">{h.headline}</p>
              <Link
                href="/healing-foods"
                className="mt-1 inline-block font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                Explore the lenses →
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-xs text-neutral-400">{snap.disclaimer}</p>
        <Link href="/log" className="text-xs font-medium text-brand-600 hover:underline">
          Log a meal
        </Link>
      </div>
    </section>
  );
}
