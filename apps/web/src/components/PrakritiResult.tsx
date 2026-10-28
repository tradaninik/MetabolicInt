'use client';

// S2-B (Ayurveda Phase 1) — Know Your Body results view.
// Leads with the no-dominance profileLabel (B0-1/B0-5); shares are framed as
// "share of your 12 answers" with an explicit not-biology guard (B0-2); the
// three doshas are interactive with clearly-labelled traditional panels
// (B0-4); a balanced "what this tradition suggests" section (B0-6); entry
// points to existing modules only (B0-7); and a "how this is calculated"
// explainer (B0-9). Every traditional claim is framed as tradition; nothing
// here describes a dosha as explaining any medical measurement.

import { useState } from 'react';
import Link from 'next/link';
import { DOSHA_INFO, TRADITION_REFLECTIONS, topDoshas, type DoshaKey } from '@/lib/ayurveda-content';

export interface ProfileView {
  answers: Record<string, string>;
  vata: number;
  pitta: number;
  kapha: number;
  vataPct?: number;
  pittaPct?: number;
  kaphaPct?: number;
  profileLabel?: string;
  isTie?: boolean;
  primary: string;
  secondary: string;
  takenAt: string;
}

const DOSHA_BAR: Record<DoshaKey, string> = {
  vata: 'bg-sky-500',
  pitta: 'bg-amber-500',
  kapha: 'bg-emerald-500',
};

function istTaken(takenAt: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(takenAt));
}

export default function PrakritiResult({
  profile, quizVersion, onRetake,
}: {
  profile: ProfileView;
  quizVersion: number | null;
  onRetake: () => void;
}) {
  const [openDosha, setOpenDosha] = useState<DoshaKey | null>(null);

  const counts: Record<DoshaKey, number> = { vata: profile.vata, pitta: profile.pitta, kapha: profile.kapha };
  const rows: { key: DoshaKey; count: number; pct?: number }[] = [
    { key: 'vata', count: profile.vata, pct: profile.vataPct },
    { key: 'pitta', count: profile.pitta, pct: profile.pittaPct },
    { key: 'kapha', count: profile.kapha, pct: profile.kaphaPct },
  ];

  // B0-1/B0-5: lead with the engine's profileLabel; fall back to legacy naming
  // only for data that predates it.
  const label =
    profile.profileLabel ??
    `${DOSHA_INFO[profile.primary as DoshaKey]?.name ?? profile.primary} primary · ${
      DOSHA_INFO[profile.secondary as DoshaKey]?.name ?? profile.secondary
    } secondary`;
  const isTie = profile.isTie ?? false;
  const reflectionDoshas = topDoshas(counts);

  return (
    <div>
      {/* Profile label (B0-1 / B0-5) */}
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Your profile</p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight">{label}</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Based on the current questionnaire{quizVersion ? ` (v${quizVersion})` : ''} · last taken {istTaken(profile.takenAt)}
      </p>
      {isTie && (
        <p className="mt-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
          Two or more doshas share your top count — this profile names all of them and implies no dominance.
        </p>
      )}

      {/* Three doshas — share of your 12 answers (B0-2 / B0-4) */}
      <h3 className="mt-6 text-sm font-semibold">Your three doshas — share of your 12 answers</h3>
      <div className="mt-2 space-y-1">
        {rows.map((r) => {
          const info = DOSHA_INFO[r.key];
          const open = openDosha === r.key;
          return (
            <div key={r.key} className="rounded-lg border border-neutral-200 dark:border-neutral-800">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenDosha(open ? null : r.key)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
              >
                <span className="w-14 shrink-0 text-sm text-neutral-600 dark:text-neutral-300">{info.name}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <div
                    className={`h-full ${DOSHA_BAR[r.key]}`}
                    style={{ width: `${r.pct ?? Math.round((r.count / 12) * 100)}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right text-sm tabular-nums text-neutral-600 dark:text-neutral-300">
                  {r.count}/12{r.pct !== undefined ? ` · ${r.pct}%` : ''}
                </span>
                <span className="w-4 shrink-0 text-center text-xs text-neutral-400" aria-hidden>{open ? '−' : '+'}</span>
              </button>
              {open && (
                <div className="border-t border-neutral-100 px-3 py-3 text-xs leading-relaxed dark:border-neutral-900">
                  <p className="font-medium text-neutral-700 dark:text-neutral-200">What the tradition associates with {info.name}</p>
                  <p className="mt-1 text-neutral-600 dark:text-neutral-400">{info.tradition}</p>
                  <p className="mt-1.5 text-neutral-600 dark:text-neutral-400"><span className="font-medium">In balance:</span> {info.balanced}</p>
                  <p className="mt-1 text-neutral-600 dark:text-neutral-400"><span className="font-medium">Out of balance:</span> {info.imbalance}</p>
                  <p className="mt-2 text-[11px] text-neutral-400">Traditional account — not a medical description of you.</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        Shares describe your answers, not your body&rsquo;s biology — this is not a &ldquo;how much of you is Vata&rdquo; percentage.
        Self-reported answers — not medical measurements.
      </p>

      {/* What this tradition suggests (B0-6) */}
      <h3 className="mt-6 text-sm font-semibold">What this tradition suggests</h3>
      <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
        traditional interpretation
      </span>
      <div className="mt-2 space-y-3">
        {reflectionDoshas.map((d) => (
          <div key={d}>
            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300">For {DOSHA_INFO[d].name.toLowerCase()}-leaning answers</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
              {TRADITION_REFLECTIONS[d].map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-neutral-500">
        Traditional reflection points — not medical advice. Your medical and nutrition needs always come first,
        and any herbal remedy or significant dietary change belongs in a conversation with your healthcare professional.
      </p>

      {/* Explore your preferences (B0-7) — existing modules only */}
      <h3 className="mt-6 text-sm font-semibold">Explore your preferences</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Link href="/healing-foods" className="rounded-xl border border-neutral-200 p-3 text-xs hover:border-brand-300 dark:border-neutral-800">
          <span className="font-medium">Food as Medicine</span>
          <span className="mt-0.5 block text-neutral-500">Traditional lens alongside nutrition facts.</span>
        </Link>
        <Link href="/recipes" className="rounded-xl border border-neutral-200 p-3 text-xs hover:border-brand-300 dark:border-neutral-800">
          <span className="font-medium">Recipes</span>
          <span className="mt-0.5 block text-neutral-500">Diabetic-friendly Indian cooking.</span>
        </Link>
        <Link href="/log" className="rounded-xl border border-neutral-200 p-3 text-xs hover:border-brand-300 dark:border-neutral-800">
          <span className="font-medium">Log activity &amp; sleep</span>
          <span className="mt-0.5 block text-neutral-500">Build the habits the tradition refers to.</span>
        </Link>
        <Link href="/dashboard" className="rounded-xl border border-neutral-200 p-3 text-xs hover:border-brand-300 dark:border-neutral-800">
          <span className="font-medium">Seasonal routine &amp; agni rhythm</span>
          <span className="mt-0.5 block text-neutral-500">On your dashboard, bottom row.</span>
        </Link>
      </div>

      {/* How this is calculated (B0-9) */}
      <details className="mt-6 rounded-xl border border-neutral-200 dark:border-neutral-800">
        <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium">How this is calculated</summary>
        <div className="border-t border-neutral-100 px-3 py-3 text-xs leading-relaxed text-neutral-600 dark:border-neutral-900 dark:text-neutral-400">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>12 questions across body, skin &amp; hair, appetite &amp; digestion, sleep &amp; energy, mind, and weather &amp; stress.</li>
            <li>Each answer maps to exactly one dosha category in the tradition&rsquo;s framework.</li>
            <li>Counts are how many of your 12 answers matched each category; the percentage is that count&rsquo;s share of your 12 answers, rounded to whole numbers that always sum to 100.</li>
            <li>When two or three doshas share your top count, your profile is labelled with all of them — no dominance is implied.</li>
            <li>This questionnaire is not clinically validated, does not diagnose anything, and every retake is kept in your history.</li>
          </ul>
        </div>
      </details>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={onRetake}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Retake the quiz
        </button>
        <Link
          href="/dashboard"
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
