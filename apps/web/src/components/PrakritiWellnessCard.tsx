'use client';

// S2-B3 — "What this means for your day": optional daily wellbeing ideas
// across Food / Movement / Relaxation / Sleep / Reflection. Selection is keyed
// to the user's own quiz answers (stated preferences) ONLY — never to any
// medical measurement. Dismissals reset with the IST day (Add-to-plan
// pattern); the chosen variant per category persists as the user's
// preference. All state is device-local (B4: zero new stores).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  WELLNESS_CATEGORIES, WELLNESS_CATEGORY_LABEL, WELLNESS_IDEAS, WELLNESS_LINK,
  type DoshaKey, type WellnessCategory,
} from '@/lib/ayurveda-content';
import {
  istDateKey, lsGetNumber, lsHas, lsSet, wellnessDismissKey, wellnessVariantKey,
} from '@/lib/ayurveda-prefs';

export default function PrakritiWellnessCard({ top }: { top: DoshaKey[] }) {
  const day = istDateKey();
  const [mounted, setMounted] = useState(false);
  const [variants, setVariants] = useState<Record<string, number>>({});
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const v: Record<string, number> = {};
    const d: Record<string, boolean> = {};
    for (const cat of WELLNESS_CATEGORIES) {
      v[cat] = lsGetNumber(wellnessVariantKey(cat), 0);
      d[cat] = lsHas(wellnessDismissKey(cat, day));
    }
    setVariants(v);
    setDismissed(d);
    setMounted(true);
  }, [day]);

  /** On a tie the categories alternate between the tied doshas — balanced,
   *  deterministic, and no dosha is presented as the winner. */
  const doshaFor = (i: number): DoshaKey => top[i % Math.max(top.length, 1)] ?? 'vata';

  const cycle = (cat: WellnessCategory) => {
    const next = (variants[cat] ?? 0) + 1;
    setVariants((prev) => ({ ...prev, [cat]: next }));
    lsSet(wellnessVariantKey(cat), String(next));
  };

  const dismiss = (cat: WellnessCategory) => {
    lsSet(wellnessDismissKey(cat, day), '1');
    setDismissed((prev) => ({ ...prev, [cat]: true }));
  };

  if (!mounted) return null; // avoid hydration mismatch on stored state

  const visible = WELLNESS_CATEGORIES.filter((c) => !dismissed[c]);

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold">What this means for your day</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Ideas that fit the preferences you expressed in this self-assessment — not anything medical.
        They reset each day and you can set any of them aside.
      </p>
      {visible.length === 0 ? (
        <p className="mt-3 rounded-lg border border-neutral-200 px-3 py-2.5 text-xs text-neutral-500 dark:border-neutral-800">
          You have set today&rsquo;s ideas aside — they will be back tomorrow.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {WELLNESS_CATEGORIES.map((cat, i) => {
            if (dismissed[cat]) return null;
            const dosha = doshaFor(i);
            const ideas = WELLNESS_IDEAS[dosha][cat];
            const idea = ideas[(variants[cat] ?? 0) % ideas.length];
            const link = WELLNESS_LINK[cat];
            return (
              <li
                key={cat}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-neutral-200 px-3 py-2.5 text-xs dark:border-neutral-800"
              >
                <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
                  {WELLNESS_CATEGORY_LABEL[cat]}
                </span>
                <span className="min-w-0 flex-1 text-neutral-700 dark:text-neutral-300">{idea}</span>
                <span className="flex shrink-0 items-center gap-3">
                  {link && (
                    <Link href={link.href} className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                      {link.label} →
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => cycle(cat)}
                    className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                  >
                    Different idea
                  </button>
                  <button
                    type="button"
                    onClick={() => dismiss(cat)}
                    className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                    aria-label={`Dismiss today's ${WELLNESS_CATEGORY_LABEL[cat].toLowerCase()} idea`}
                  >
                    Not today
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
        Traditional wellbeing ideas for reflection — not medical advice, and never a response to any
        reading. Your medical and nutrition needs always come first.
      </p>
    </div>
  );
}
