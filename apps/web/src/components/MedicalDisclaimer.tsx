import { MEDICAL_DISCLAIMER_SHORT, MEDICAL_DISCLAIMER_LONG } from '@/lib/disclaimer';

// Compact, always-visible safety footer rendered by AppShell on every
// authenticated page. One amber line + a native <details> expander so it
// stays unobtrusive but is impossible to miss. No hooks: safe in both
// server and client components.
export default function MedicalDisclaimer() {
  return (
    <div
      role="note"
      aria-label="Medical disclaimer"
      className="mt-10 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <p>{MEDICAL_DISCLAIMER_SHORT}</p>
      <details className="mt-1">
        <summary className="cursor-pointer select-none font-medium">
          Why we show this
        </summary>
        <p className="mt-2">{MEDICAL_DISCLAIMER_LONG}</p>
      </details>
    </div>
  );
}
