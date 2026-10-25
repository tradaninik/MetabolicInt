'use client';

// R-1a - Full profile for a single healing food at /healing-foods/[slug].
// Lens tabs (All lenses | Ayurveda | Research | Lived experience) keep the
// multi-lens philosophy one tap apart, with side-by-side as the default.
// Debunk panel and cautions are pinned near the top; "Why this rank" is
// preserved at the bottom with the entry's rank number.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AyurvedaLensContent,
  CautionsPanel,
  DebunkPanel,
  GradeBadge,
  LENS_CHOICES,
  LensSection,
  ScienceLensContent,
  StoriesLensContent,
} from '@/components/HealingFoodsShared';
import type { FoodAsMedicineData, LensChoice } from '@/lib/healingFoods';

export default function HealingFoodProfile({ slug }: { slug: string }) {
  const [data, setData] = useState<FoodAsMedicineData | null>(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState<LensChoice>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/food-as-medicine');
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
  }, [reloadKey]);

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

  const ranked = data.foods.find((r) => r.food.slug === slug);
  if (!ranked) {
    return (
      <div role="alert" className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
        <h1 className="text-lg font-semibold">Food not found</h1>
        <p className="mt-1 text-sm text-neutral-500">
          We couldn&apos;t find that food in the knowledge base. It may have been renamed.
        </p>
        <Link
          href="/healing-foods"
          className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Back to all healing foods
        </Link>
      </div>
    );
  }

  const f = ranked.food;
  const grade = f.science?.grade;
  const rankNumber = data.foods.findIndex((r) => r.food.slug === slug) + 1;
  const inSeason = f.ayurveda?.seasons?.includes(data.season.id) ?? false;
  const show = (lens: LensChoice) => view === 'all' || view === lens;

  return (
    <div>
      <Link
        href="/healing-foods"
        className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
      >
        ← All healing foods
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {f.name}
            {f.alsoKnownAs && f.alsoKnownAs.length > 0 && (
              <span className="ml-2 text-base font-normal text-neutral-500">{f.alsoKnownAs.join(', ')}</span>
            )}
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            {data.categories[f.category]?.label ?? f.category}
            {inSeason && (
              <span className="ml-2 font-medium text-brand-700 dark:text-brand-300">In season this month</span>
            )}
          </p>
        </div>
        {grade && <GradeBadge grade={grade} meta={data} />}
      </div>

      <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">{f.headline}</p>

      {/* Disclaimer stays reachable, not buried (R-1 constraint) */}
      <p className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/50">
        {data.disclaimer}
      </p>

      {/* Pinned safety panels */}
      {f.science?.debunk && <DebunkPanel debunk={f.science.debunk} />}
      {f.cautions && f.cautions.length > 0 && <CautionsPanel cautions={f.cautions} />}

      {/* Lens view toggle */}
      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Choose a knowledge lens">
        {LENS_CHOICES.map((choice) => (
          <button
            key={choice.id}
            type="button"
            aria-pressed={view === choice.id}
            onClick={() => setView(choice.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              view === choice.id
                ? 'bg-brand-600 text-white hover:bg-brand-700'
                : 'border border-neutral-300 text-neutral-600 hover:border-brand-300 dark:border-neutral-700 dark:text-neutral-400'
            }`}
          >
            {choice.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        {view === 'all'
          ? 'All three lenses, side by side.'
          : data.lenses[view]?.blurb}
      </p>

      {/* Lens sections, canonical order; the selected lens gets the accent */}
      <div className="mt-4 space-y-4">
        {f.ayurveda && show('ayurveda') ? (
          <LensSection id="ayurveda" label="Ayurveda" meta={data} accent={view === 'ayurveda'}>
            <AyurvedaLensContent lens={f.ayurveda} />
          </LensSection>
        ) : view === 'ayurveda' ? <MissingLens label="Ayurveda" /> : null}

        {f.science && show('science') ? (
          <LensSection id="science" label="Scientific research" meta={data} accent={view === 'science'}>
            <ScienceLensContent lens={f.science} />
          </LensSection>
        ) : view === 'science' ? <MissingLens label="Scientific research" /> : null}

        {f.stories && show('stories') ? (
          <LensSection id="stories" label="Lived experience" meta={data} accent={view === 'stories'}>
            <StoriesLensContent lens={f.stories} meta={data} />
          </LensSection>
        ) : view === 'stories' ? <MissingLens label="Lived experience" /> : null}
      </div>

      {/* Ranking transparency */}
      <p className="mt-4 border-t border-neutral-100 pt-3 text-xs text-neutral-400 dark:border-neutral-900">
        Why ranked #{rankNumber} of {data.foods.length}: {ranked.reasons.join(' · ')}
      </p>
    </div>
  );
}

function MissingLens({ label }: { label: string }) {
  return (
    <p className="rounded-xl border border-dashed border-neutral-300 p-3 text-sm text-neutral-500 dark:border-neutral-700">
      This entry doesn&apos;t carry the {label} lens yet.
    </p>
  );
}