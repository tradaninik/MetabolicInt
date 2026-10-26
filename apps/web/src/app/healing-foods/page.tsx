import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import HealingFoodsExplorer from '@/components/HealingFoodsExplorer';
import { ANCIENT_PRACTICES, ANCIENT_PRACTICES_NOTE, sourceLabel } from '@/lib/ancientPractices';

// P4c / U16 - Food as Medicine explorer (multi-lens: Ayurveda, science, lived experience).
// Educational and non-medical; session-guarded like every other app surface.
// P5 - adds the "Ancient practices" section: classical daily/seasonal eating
// wisdom the user asked for, rendered server-side (static content, zero JS).
export default async function HealingFoodsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login?callbackUrl=/healing-foods');

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold tracking-tight">Food as Medicine</h1>
        <p className="mt-1 text-sm text-neutral-500">
          The same food through three lenses - classical Ayurveda, scientific research, and the lived
          experience of people living with diabetes. Every claim carries an honest evidence grade.
        </p>
        <div className="mt-4 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
          <HealingFoodsExplorer />
        </div>

        {/* P5 - Ancient practices: what the old tradition says about eating itself. */}
        <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/40 p-5 dark:border-amber-900/60 dark:bg-amber-950/20">
          <h2 className="text-lg font-semibold tracking-tight">Ancient practices</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            What the old tradition says about eating itself - the daily rhythm the classical texts
            teach. Open any food&apos;s profile for its own classical story.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {ANCIENT_PRACTICES.map((p) => (
              <article
                key={p.id}
                className="rounded-xl border border-amber-200/70 bg-white/70 p-4 dark:border-amber-900/50 dark:bg-neutral-950/40"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">{p.name}</h3>
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-amber-600/80 dark:text-amber-500/70">
                    {sourceLabel(p.source)}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-amber-800/90 dark:text-amber-300/80">
                  {p.detail}
                </p>
              </article>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-amber-700/80 dark:text-amber-400/70">
            {ANCIENT_PRACTICES_NOTE}
          </p>
        </section>

        <p className="mt-4 text-xs text-neutral-400">
          Educational information only - not medical advice. Evidence grades describe research
          quality, not certainty for you.
        </p>
      </div>
    </AppShell>
  );
}
