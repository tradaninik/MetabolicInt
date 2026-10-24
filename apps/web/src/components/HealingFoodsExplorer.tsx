'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// P4c / U16 - Food as Medicine explorer (multi-lens, educational, non-medical).
// Fetches the session-guarded /api/food-as-medicine endpoint; the lens toggle re-fetches
// with ?lens= so the server re-ranks (under the science lens, grade-D entries are
// actively demoted). Entries that do not carry the selected lens are filtered out.

type LensChoice = 'all' | 'ayurveda' | 'science' | 'stories';
type EvidenceGrade = 'A' | 'B' | 'C' | 'D';

interface AyurvedaLens {
  rasa?: string[];
  virya?: 'heating' | 'cooling';
  pacifies: string[];
  aggravates: string[];
  prakritiFit: Record<string, string>;
  seasons?: string[];
  seasonalNote?: string;
  classicalRef?: string;
  summary: string;
}

interface ScienceLens {
  grade: EvidenceGrade;
  headline: string;
  evidenceSummary: string;
  giNote?: string;
  fiberNote?: string;
  nutrientNote?: string;
  mechanism?: string;
  debunk?: { claim: string; verdict: string };
}

interface StoriesLens {
  prevalence: 'widely' | 'commonly' | 'scattered';
  patterns: string[];
  summary: string;
}

interface HealingFoodView {
  slug: string;
  name: string;
  alsoKnownAs?: string[];
  category: string;
  headline: string;
  cautions?: string[];
  ayurveda?: AyurvedaLens;
  science?: ScienceLens;
  stories?: StoriesLens;
}

interface RankedFood {
  food: HealingFoodView;
  score: number;
  reasons: string[];
  lenses: string[];
}

interface FoodAsMedicineData {
  foods: RankedFood[];
  lenses: Record<string, { id: string; label: string; blurb: string }>;
  grades: Record<string, { grade: string; label: string; meaning: string }>;
  categories: Record<string, { id: string; label: string }>;
  disclaimer: string;
  storiesDisclaimer: string;
  prakriti: string | null;
  season: { id: string; name: string };
}

const LENS_CHOICES: { id: LensChoice; label: string }[] = [
  { id: 'all', label: 'All lenses' },
  { id: 'ayurveda', label: 'Ayurveda' },
  { id: 'science', label: 'Research' },
  { id: 'stories', label: 'Lived experience' },
];

const GRADE_BADGE: Record<EvidenceGrade, string> = {
  A: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  B: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200',
  C: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  D: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
};

const DOSHA_LABEL: Record<string, string> = { vata: 'Vata', pitta: 'Pitta', kapha: 'Kapha' };

const PREVALENCE_LABEL: Record<string, string> = {
  widely: 'Reported widely across community stories',
  commonly: 'Reported commonly across community stories',
  scattered: 'Scattered individual reports',
};

const SCIENCE_NOTES: { key: keyof ScienceLens; label: string }[] = [
  { key: 'giNote', label: 'Glycemic index' },
  { key: 'fiberNote', label: 'Fiber' },
  { key: 'nutrientNote', label: 'Nutrients' },
  { key: 'mechanism', label: 'Mechanism' },
];

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

  const visible = lens === 'all' ? data.foods : data.foods.filter((r) => r.lenses.includes(lens));

  return (
    <div>
      {/* Lens toggle */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a knowledge lens">
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
          ? 'All three lenses, side by side on every card.'
          : data.lenses[lens]?.blurb}
        {lens !== 'all' && ` ${visible.length} of ${data.foods.length} entries carry this lens.`}
      </p>

      {/* Context row: season + Prakriti personalization (or quiz CTA) */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
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

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}{' '}
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="font-medium underline"
          >
            Try again
          </button>
        </p>
      )}

      {/* Ranked cards */}
      <div className="mt-4 space-y-4">
        {visible.map((ranked) => (
          <FoodCard
            key={ranked.food.slug}
            ranked={ranked}
            meta={data}
            selectedLens={lens}
            seasonId={data.season.id}
          />
        ))}
      </div>

      {/* Disclaimers footer */}
      <div className="mt-6 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <p className="text-xs text-neutral-500">{data.disclaimer}</p>
        <p className="mt-2 text-xs text-neutral-500">{data.storiesDisclaimer}</p>
      </div>
    </div>
  );
}

function FoodCard({
  ranked,
  meta,
  selectedLens,
  seasonId,
}: {
  ranked: RankedFood;
  meta: FoodAsMedicineData;
  selectedLens: LensChoice;
  seasonId: string;
}) {
  const f = ranked.food;
  const grade = f.science?.grade;
  const inSeason = f.ayurveda?.seasons?.includes(seasonId) ?? false;

  return (
    <article className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">
            {f.name}
            {f.alsoKnownAs && f.alsoKnownAs.length > 0 && (
              <span className="ml-2 text-sm font-normal text-neutral-500">
                {f.alsoKnownAs.join(', ')}
              </span>
            )}
          </h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            {meta.categories[f.category]?.label ?? f.category}
          </p>
        </div>
        {grade && (
          <span
            title={meta.grades[grade]?.meaning}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${GRADE_BADGE[grade]}`}
          >
            Evidence {grade} · {meta.grades[grade]?.label}
          </span>
        )}
      </div>

      {inSeason && (
        <p className="mt-2 text-xs font-medium text-brand-700 dark:text-brand-300">
          In season this month
        </p>
      )}

      <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">{f.headline}</p>

      {/* D-grade debunk: the popular claim and the verdict, side by side (spec §3.5) */}
      {f.science?.debunk && (
        <div className="mt-3 grid gap-3 rounded-xl border border-rose-200 bg-rose-50/60 p-3 dark:border-rose-900/60 dark:bg-rose-950/30 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">The popular claim</p>
            <p className="mt-1 text-sm text-rose-900 dark:text-rose-200">{f.science.debunk.claim}</p>
          </div>
          <div className="border-t border-rose-200 pt-3 dark:border-rose-900/60 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
            <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">The verdict</p>
            <p className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">
              {f.science.debunk.verdict}
            </p>
          </div>
        </div>
      )}

      {/* Cautions strip */}
      {f.cautions && f.cautions.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/60 dark:bg-amber-950/30">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Cautions</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-900 dark:text-amber-200">
            {f.cautions.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Lens sections, canonical order; the selected lens gets the accent */}
      <div className="mt-4 space-y-4">
        {f.ayurveda && (
          <LensSection id="ayurveda" label="Ayurveda" meta={meta} accent={selectedLens === 'ayurveda'}>
            <div className="flex flex-wrap gap-1.5">
              {f.ayurveda.rasa?.map((r) => (
                <span
                  key={r}
                  className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
                >
                  {r}
                </span>
              ))}
              {f.ayurveda.virya && (
                <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                  Virya: {f.ayurveda.virya}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
              {f.ayurveda.pacifies.length > 0 && (
                <>Pacifies {f.ayurveda.pacifies.map((d) => DOSHA_LABEL[d] ?? d).join(', ')}. </>
              )}
              {f.ayurveda.aggravates.length > 0 && (
                <>Aggravates {f.ayurveda.aggravates.map((d) => DOSHA_LABEL[d] ?? d).join(', ')}.</>
              )}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Prakriti fit:{' '}
              {(['vata', 'pitta', 'kapha'] as const)
                .map((d) => `${DOSHA_LABEL[d]} ${f.ayurveda!.prakritiFit[d] ?? '-'}`)
                .join(' · ')}
            </p>
            <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">{f.ayurveda.summary}</p>
            {f.ayurveda.seasonalNote && (
              <p className="mt-2 text-xs italic text-neutral-500">{f.ayurveda.seasonalNote}</p>
            )}
            {f.ayurveda.classicalRef && (
              <p className="mt-1 text-xs italic text-neutral-400">{f.ayurveda.classicalRef}</p>
            )}
          </LensSection>
        )}

        {f.science && (
          <LensSection id="science" label="Scientific research" meta={meta} accent={selectedLens === 'science'}>
            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{f.science.headline}</p>
            <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{f.science.evidenceSummary}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {SCIENCE_NOTES.filter(({ key }) => f.science![key] !== undefined).map(({ key, label }) => (
                <p key={key} className="text-xs text-neutral-500">
                  <span className="font-medium text-neutral-600 dark:text-neutral-400">{label}: </span>
                  {f.science![key] as string}
                </p>
              ))}
            </div>
          </LensSection>
        )}

        {f.stories && (
          <LensSection id="stories" label="Lived experience" meta={meta} accent={selectedLens === 'stories'}>
            <p className="text-xs text-neutral-500">{PREVALENCE_LABEL[f.stories.prevalence]}</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-neutral-700 dark:text-neutral-300">
              {f.stories.patterns.map((pattern) => (
                <li key={pattern}>{pattern}</li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">{f.stories.summary}</p>
            <p className="mt-2 border-t border-neutral-100 pt-2 text-xs text-neutral-400 dark:border-neutral-900">
              {meta.storiesDisclaimer}
            </p>
          </LensSection>
        )}
      </div>

      {/* Ranking transparency */}
      <p className="mt-4 border-t border-neutral-100 pt-3 text-xs text-neutral-400 dark:border-neutral-900">
        Why this rank: {ranked.reasons.join(' · ')}
      </p>
    </article>
  );
}

function LensSection({
  id,
  label,
  meta,
  accent,
  children,
}: {
  id: string;
  label: string;
  meta: FoodAsMedicineData;
  accent: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className={`rounded-xl border p-3 ${
        accent
          ? 'border-brand-300 bg-brand-50/50 dark:border-brand-800 dark:bg-brand-950/20'
          : 'border-neutral-200 dark:border-neutral-800'
      }`}
    >
      <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{label}</h4>
      {meta.lenses[id] && (
        <p className="sr-only">{meta.lenses[id].blurb}</p>
      )}
      <div className="mt-2">{children}</div>
    </section>
  );
}
