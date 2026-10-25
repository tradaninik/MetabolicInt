'use client';

// R-1a - Shared presentation for the Food-as-Medicine experience.
// One source of truth for badges and lens panels so the /healing-foods
// explorer and the /healing-foods/[slug] profile never drift apart.

import type { ReactNode } from 'react';
import type { AyurvedaLens, EvidenceGrade, FoodAsMedicineData, LensChoice, ScienceLens, StoriesLens } from '@/lib/healingFoods';

export const LENS_CHOICES: { id: LensChoice; label: string }[] = [
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

export const DOSHA_LABEL: Record<string, string> = { vata: 'Vata', pitta: 'Pitta', kapha: 'Kapha' };

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

export function GradeBadge({
  grade,
  meta,
  compact = false,
}: {
  grade: EvidenceGrade;
  meta: FoodAsMedicineData;
  compact?: boolean;
}) {
  const g = meta.grades[grade];
  return (
    <span title={g?.meaning} className={`rounded-full px-3 py-1 text-xs font-semibold ${GRADE_BADGE[grade]}`}>
      Evidence {grade}
      {g?.label && !compact ? ` · ${g.label}` : ''}
    </span>
  );
}

/** D-grade debunk: popular claim vs verdict, side by side (spec §3.5). */
export function DebunkPanel({ debunk }: { debunk: { claim: string; verdict: string } }) {
  return (
    <div className="mt-3 grid gap-3 rounded-xl border border-rose-200 bg-rose-50/60 p-3 dark:border-rose-900/60 dark:bg-rose-950/30 sm:grid-cols-2">
      <div>
        <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">The popular claim</p>
        <p className="mt-1 text-sm text-rose-900 dark:text-rose-200">{debunk.claim}</p>
      </div>
      <div className="border-t border-rose-200 pt-3 dark:border-rose-900/60 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
        <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">The verdict</p>
        <p className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">{debunk.verdict}</p>
      </div>
    </div>
  );
}

export function CautionsPanel({ cautions }: { cautions: string[] }) {
  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/60 dark:bg-amber-950/30">
      <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Cautions</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-900 dark:text-amber-200">
        {cautions.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </div>
  );
}

export function LensSection({
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
  children: ReactNode;
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
      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{label}</h3>
      {meta.lenses[id] && <p className="sr-only">{meta.lenses[id].blurb}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function AyurvedaLensContent({ lens }: { lens: AyurvedaLens }) {
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {lens.rasa?.map((r) => (
          <span
            key={r}
            className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
          >
            {r}
          </span>
        ))}
        {lens.virya && (
          <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
            Virya: {lens.virya}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
        {lens.pacifies.length > 0 && <>Pacifies {lens.pacifies.map((d) => DOSHA_LABEL[d] ?? d).join(', ')}. </>}
        {lens.aggravates.length > 0 && <>Aggravates {lens.aggravates.map((d) => DOSHA_LABEL[d] ?? d).join(', ')}.</>}
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        Prakriti fit:{' '}
        {(['vata', 'pitta', 'kapha'] as const)
          .map((d) => `${DOSHA_LABEL[d]} ${lens.prakritiFit[d] ?? '-'}`)
          .join(' · ')}
      </p>
      <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">{lens.summary}</p>
      {lens.seasonalNote && <p className="mt-2 text-xs italic text-neutral-500">{lens.seasonalNote}</p>}
      {lens.classicalRef && <p className="mt-1 text-xs italic text-neutral-400">{lens.classicalRef}</p>}
    </>
  );
}

export function ScienceLensContent({ lens }: { lens: ScienceLens }) {
  return (
    <>
      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{lens.headline}</p>
      <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{lens.evidenceSummary}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {SCIENCE_NOTES.filter(({ key }) => lens[key] !== undefined).map(({ key, label }) => (
          <p key={key} className="text-xs text-neutral-500">
            <span className="font-medium text-neutral-600 dark:text-neutral-400">{label}: </span>
            {lens[key] as string}
          </p>
        ))}
      </div>
    </>
  );
}

export function StoriesLensContent({ lens, meta }: { lens: StoriesLens; meta: FoodAsMedicineData }) {
  return (
    <>
      <p className="text-xs text-neutral-500">{PREVALENCE_LABEL[lens.prevalence]}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-neutral-700 dark:text-neutral-300">
        {lens.patterns.map((pattern) => (
          <li key={pattern}>{pattern}</li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">{lens.summary}</p>
      <p className="mt-2 border-t border-neutral-100 pt-2 text-xs text-neutral-400 dark:border-neutral-900">
        {meta.storiesDisclaimer}
      </p>
    </>
  );
}