'use client';

// U25 Hypoglycemia Guardrails - educational banner (P0: always on, no feature flag).
// Copy below is clinician-approved; do not change wording or thresholds without
// a new clinical review. Renders nothing for 'none'/'invalid' verdicts.

type Guard = { verdict: string; pattern: boolean } | null;

const COPY: Record<string, { heading: string; body: string; cls: string }> = {
  level2: {
    heading: 'Low glucose reading (below 54)',
    body: 'This reading is below 54 mg/dL, a level clinicians treat as significant. If you feel shaky, sweaty, dizzy, or confused, treat now: 15 g of fast carbs (4 oz juice or 3-4 glucose tablets), recheck in 15 minutes, and repeat if still below 70. If symptoms are severe or do not improve, contact your clinician or your local emergency number.',
    cls: 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200',
  },
  level1: {
    heading: 'Low reading (54-69)',
    body: 'This reading is below the usual target of 70. If you feel symptoms, take 15 g of fast carbs and recheck in 15 minutes. If several readings land here in one day, mention it to your clinician - your plan may need adjusting.',
    cls: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
  },
};

const PATTERN_LINE =
  'You have logged 2 or more readings below 70 in the last 24 hours. Show this pattern to your clinician.';

const FOOTER =
  "Educational information only - not medical advice. Follow your clinician's personalized plan.";

export default function GlucoseGuardBanner({ guard }: { guard: Guard }) {
  if (!guard) return null;
  const c = COPY[guard.verdict];
  if (!c) return null;
  return (
    <div role='alert' className={`mt-4 rounded-2xl border p-4 text-sm ${c.cls}`}>
      <p className='font-semibold'>{c.heading}</p>
      <p className='mt-1 leading-relaxed'>{c.body}</p>
      {guard.pattern && <p className='mt-1 leading-relaxed'>{PATTERN_LINE}</p>}
      <p className='mt-2 text-xs opacity-70'>{FOOTER}</p>
    </div>
  );
}
