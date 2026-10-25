'use client';

// R-1a - Food as Medicine explorer, redesigned as a two-tier page:
//   Tier 1 "For you today" - top-3 personalized picks (Prakriti + season),
//     each linking to its full profile at /healing-foods/[slug].
//   Tier 2 - the remaining entries as compact rows grouped by category;
//     the lens toggle re-fetches with ?lens= so the server re-ranks and
//     filters, exactly as before - it now shapes both tiers.
// Multi-lens depth moved to the profile page; every sub-field is preserved there.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GradeBadge, LENS_CHOICES } from '@/components/HealingFoodsShared';
import { DOSHA_LABEL } from '@/components/HealingFoodsShared';
import { groupFoodsByCategory, lensPool, pickForYou } from '@/lib/healingFoods';
import type { FoodAsMedicineData, LensChoice, RankedFood } from '@/lib/healingFoods';

export default function HealingFoodsExplorer() {
  const [lens, setLens] = useState<LensChoice>('all');
  const [data, setData] = useState<FoodAsMedicineData | null>(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/food-as-medicine${lens === 'all' ? '' : `?lens=${lens}`}`);
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? 'Could not load the knowledge base.');
        if (!cancelled) {
          setData(json as FoodAsMedicineData);
          setError('');
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Something went wrong.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lens, reloadKey]);

  if (!data) {
    if (error) {
      return (
        <div role="alert">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="mt-3 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Try again
          </button>
        </div>
      );
    }
    return <p className="text-sm text-neutral-500">Loading the knowledge base...</p>;
  }

  const pool = lensPool(data.foods, lens);
  const { shortlist, library } = pickForYou(pool);
  const groups = groupFoodsByCategory(library);

  return (
    <div>
      {/* Tier 1: personalized shortlist */}
      <section aria-labelledby="for-you-heading">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="for-you-heading" className="text-lg font-semibold">
            For you today
          </h2>
          <span className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
            This month: {data.season.name}
          </span>
          {data.prakriti ? (
            <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-800 dark:bg-brand-900/40 dark:text-brand-200">
              Ranked for your Prakriti: {DOSHA_LABEL[data.prakriti] ?? data.prakriti}
            </span>
          ) : (
            <Link
              href="/prakriti"
              className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              Take the 12-question Know Your Body quiz to rank these for your constitution
            </Link>
          )}
        </div>

        <ul className="mt-3 space-y-3">
          {shortlist.map((ranked, i) => (
            <li key={ranked.food.slug}>
              <ShortlistCard rank={i + 1} ranked={ranked} meta={data} seasonId={data.season.id} />
            </li>
          ))}
        </ul>
      </section>

      {/* Tier 2: grouped library, shaped by the lens toggle */}
      <section aria-labelledby="library-heading" className="mt-8">
        <h2 id="library-heading" className="text-lg font-semibold">
          Browse all foods
        </h2>

        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Choose a knowledge lens">
          {LENS_CHOICES.map((choice) => (
            <button
              key={choice.id}
              type="button"
              aria-pressed={lens === choice.id}
              onClick={() => setLens(choice.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                lens === choice.id
                  ? 'bg-brand-600 text-white hover:bg-brand-700'
                  : 'border border-neutral-300 text-neutral-600 hover:border-brand-300 dark:border-neutral-700 dark:text-neutral-400'
              }`}
            >
              {choice.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          {lens === 'all'
            ? 'All three lenses, side by side in every full profile.'
            : `${data.lenses[lens]?.blurb ?? ''} ${pool.length} of ${data.foods.length} entries carry this lens.`}
        </p>

        {groups.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">
            {pool.length === 0
              ? 'No entries carry this lens yet.'
              : `All ${pool.length} entries for this lens are shown above.`}
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.categoryId} aria-labelledby={`cat-${group.categoryId}`} className="mt-5">
              <h3
                id={`cat-${group.categoryId}`}
                className="text-xs font-semibold uppercase tracking-wide text-neutral-400"
              >
                {data.categories[group.categoryId]?.label ?? group.categoryId}
              </h3>
              <ul className="mt-2 divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white dark:divide-neutral-900 dark:border-neutral-800 dark:bg-neutral-950">
                {group.entries.map((ranked) => (
                  <li key={ranked.food.slug}>
                    <LibraryRow ranked={ranked} meta={data} seasonId={data.season.id} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </section>

      {/* Disclaimers footer */}
      <div className="mt-6 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <p className="text-xs text-neutral-500">{data.disclaimer}</p>
        <p className="mt-2 text-xs text-neutral-500">{data.storiesDisclaimer}</p>
      </div>
    </div>
  );
}

function ShortlistCard({
  rank,
  ranked,
  meta,
  seasonId,
}: {
  rank: number;
  ranked: RankedFood;
  meta: FoodAsMedicineData;
  seasonId: string;
}) {
  const f = ranked.food;
  const grade = f.science?.grade;
  const inSeason = f.ayurveda?.seasons?.includes(seasonId) ?? false;
  const cautionCount = f.cautions?.length ?? 0;

  return (
    <Link
      href={`/healing-foods/${f.slug}`}
      className="block rounded-2xl border border-neutral-200 bg-white p-4 transition hover:border-brand-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-brand-800"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800 dark:bg-brand-900/40 dark:text-brand-200"
        >
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">
              <span className="sr-only">Pick {rank}: </span>
              {f.name}
            </h3>
            {grade && <GradeBadge grade={grade} meta={meta} compact />}
            {inSeason && (
              <span className="text-xs font-medium text-brand-700 dark:text-brand-300">In season</span>
            )}
          </div>
          {f.alsoKnownAs && f.alsoKnownAs.length > 0 && (
            <p className="mt-0.5 text-xs text-neutral-500">{f.alsoKnownAs.join(', ')}</p>
          )}
          <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{f.headline}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {cautionCount > 0 && (
              <span className="rounded-full border border-amber-200 bg-amber-50/60 px-2.5 py-0.5 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                ⚠ {cautionCount} {cautionCount === 1 ? 'caution' : 'cautions'}
              </span>
            )}
            <span className="text-xs text-neutral-400">
              Why this rank: {ranked.reasons.join(' · ')}
            </span>
          </div>
        </div>
        <span aria-hidden="true" className="mt-1 text-neutral-400">
          ›
        </span>
        <span className="sr-only">Open full profile</span>
      </div>
    </Link>
  );
}

function LibraryRow({
  ranked,
  meta,
  seasonId,
}: {
  ranked: RankedFood;
  meta: FoodAsMedicineData;
  seasonId: string;
}) {
  const f = ranked.food;
  const grade = f.science?.grade;
  const inSeason = f.ayurveda?.seasons?.includes(seasonId) ?? false;

  return (
    <Link
      href={`/healing-foods/${f.slug}`}
      className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:hover:bg-neutral-900"
    >
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{f.name}</span>
        {inSeason && (
          <span className="text-xs font-medium text-brand-700 dark:text-brand-300">In season</span>
        )}
        {f.cautions && f.cautions.length > 0 && (
          <span aria-label={`${f.cautions.length} cautions`} title={`${f.cautions.length} cautions`} className="text-xs text-amber-600 dark:text-amber-400">
            ⚠
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {grade && <GradeBadge grade={grade} meta={meta} compact />}
        <span aria-hidden="true" className="text-neutral-400">
          ›
        </span>
        <span className="sr-only">Open full profile</span>
      </span>
    </Link>
  );
}