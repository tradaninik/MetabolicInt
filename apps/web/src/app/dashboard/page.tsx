import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { loadDashboardData } from '@/lib/engine-service';
import { greetingForHour, istDayBounds, istHour, relativeTime, sourceLabel } from '@/lib/dashboard-stamp';
import AppShell from '@/components/AppShell';
import HealthScoreRing from '@/components/dashboard/HealthScoreRing';
import MetricCardsRow from '@/components/dashboard/MetricCards';
import GlucoseTodayChart from '@/components/dashboard/GlucoseTodayChart';
import WhyHighCard from '@/components/dashboard/WhyHighCard';
import MetabolicTimeline from '@/components/dashboard/MetabolicTimeline';
import SuggestionsCard from '@/components/dashboard/SuggestionsCard';
import { WeightForecastChart } from '@/components/dashboard/Charts';
import { REGION_LABELS } from '@mi/food-db';
import { getPendingCheckIns } from '@/lib/pairing';
import CheckInCard from '@/components/CheckInCard';
import QuickAdd from '@/components/QuickAdd';
import SeasonalCard from '@/components/SeasonalCard';
import AgniRhythmCard from '@/components/AgniRhythmCard';
import AyurvedaGate from '@/components/AyurvedaGate';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login?callbackUrl=/dashboard');

  // S-1 perf: the dashboard payload and the pending check-ins are independent
  // DB reads - run them together instead of back to back.
  const [data, pendingCheckIns] = await Promise.all([
    loadDashboardData(session.user.id),
    getPendingCheckIns(session.user.id),
  ]);
  if (!data) redirect('/onboarding');

  const { healthScore: hs, profile, sensitivity, isPrior, updatedStamp, metricCards } = data;
  const sub = hs.components;
  const latestWeight = data.weightSeries.at(-1)?.kg ?? profile.weightKg;
  const forecastWeight = data.forecast.filter((p) => p.metric === 'weight_kg');

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        {/* Header (dashboard revamp v1): greeting + honest "Updated <time> · <source>"
            stamp replace the old hero banner. The stamp is the most recent of the
            user's own records, recomputed on every render - QuickAdd saves already
            trigger router.refresh(), so it stays current without any fake liveness. */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {greetingForHour(istHour(Date.now()))}, {session.user.name || 'there'}
            </h1>
            <p className="mt-0.5 text-sm text-neutral-500">
              {updatedStamp
                ? <>Updated {relativeTime(updatedStamp.t, Date.now())} · {sourceLabel(updatedStamp.kind, updatedStamp.source)}</>
                : 'No entries yet — your first log will show up here.'}
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              {REGION_LABELS[profile.region]} model · sensitivity {sensitivity.toFixed(2)} mg/dL per g carb
              {isPrior ? <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300">prior</span>
                : <span className="ml-1 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">learned</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Two header actions per the approved v1 mockup: outline
                "Log glucose" (-> /glucose "Log a reading") + solid "+ Log a meal". */}
            <Link
              href="/glucose"
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900"
            >
              Log glucose
            </Link>
            <Link href="/log" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              + Log a meal
            </Link>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="mb-6 text-xs text-amber-700 dark:text-amber-400">
          ⚕️ Educational insights, not medical advice. Consult a clinician for treatment decisions.
        </p>

        <CheckInCard pending={pendingCheckIns} sampleSize={data.sampleSize} isPrior={data.isPrior} />

        <QuickAdd />

        {/* Six metric cards (dashboard revamp item 2): every "usual" is the
            user's own history, every card carries its source/updated stamp. */}
        <MetricCardsRow cards={metricCards} now={Date.now()} />

        {/* Charts row: glucose chart + "Why was it high?" (revamp items 3-4) */}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <GlucoseTodayChart chart={data.glucoseChart} />
          </div>
          <WhyHighCard attribution={data.attribution} glucose={metricCards.glucose} />
        </div>

        {/* Horizontal metabolic timeline (revamp item 5) - directly below the
            charts row per the approved v1 mockup (was page-bottom before). */}
        <div className="mt-4">
          <MetabolicTimeline items={data.metabolicTimeline} />
        </div>

        {/* Score + forecast + insights (score moved beside them by the v1 layout) */}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card title="Metabolic Health Score" subtitle="0–100 composite · last 14 days">
            <div className="flex items-center gap-4">
              <HealthScoreRing score={hs.score} />
              <div className="flex-1 space-y-1.5 text-xs">
                <Subscore label="Glucose" value={sub.glucose} />
                <Subscore label="Weight" value={sub.weight} />
                <Subscore label="Sleep" value={sub.sleep} />
                <Subscore label="Activity" value={sub.activity} />
                <Subscore label="Blood pressure" value={sub.bloodPressure} />
                <Subscore label="Nutrition" value={sub.nutrition} />
              </div>
            </div>
          </Card>

          <Card
            title="Weight & forecast"
            subtitle={
              metricCards.weight.delta30d !== null
                ? `${latestWeight.toFixed(1)} kg · ${metricCards.weight.delta30d > 0 ? '+' : '−'}${Math.abs(metricCards.weight.delta30d).toFixed(1)} kg over 30 days`
                : `${latestWeight.toFixed(1)} kg`
            }
          >
            <WeightForecastChart history={data.weightSeries} forecast={forecastWeight} now={Date.now()} />
            <p className="mt-2 text-xs text-neutral-500">
              Measured history + 30-day model projection. Shaded band = model uncertainty.
            </p>
          </Card>

          <Card title="Personal insights" subtitle="from your records · every claim traceable">
            {data.insights.length === 0 ? (
              <p className="text-sm text-neutral-500">Keep logging meals, sleep, and glucose — insights appear after a few days.</p>
            ) : (
              <ul className="space-y-3">
                {data.insights.slice(0, 3).map((ins) => (
                  <li key={ins.id} className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{ins.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${ins.confidence > 0.6 ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-900'}`}>
                        {Math.round(ins.confidence * 100)}% conf
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{ins.body}</p>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/insights" className="mt-3 inline-block text-xs font-medium text-brand-600 hover:underline">
              See all insights →
            </Link>
          </Card>
        </div>

        {/* Today's suggestions (revamp item 6): pattern-derived, evidence-inline,
            replacing the old hardcoded AI Daily Recommendations card. */}
        <div className="mt-4">
          <SuggestionsCard suggestions={data.suggestions} today={istDayBounds(Date.now()).dateStr} />
        </div>

        {/* Seasonal + agni side-by-side per the approved v1 mockup bottom row
            (stacked on mobile; each card stretches to equal height).
            S2-B6: gated on the Ayurveda off-switch — both cards are classical
            wellbeing content; with the switch off the whole row (and its gap)
            disappears, medical cards above are untouched. */}
        <AyurvedaGate>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {/* Seasonal guidance (U14 Ritucharya) */}
            <SeasonalCard />

            {/* Agni rhythm (P4c-b U17) */}
            <AgniRhythmCard userId={session.user.id} />
          </div>
        </AyurvedaGate>

        {/* Provenance line (revamp item 7, approved v1 footer): everything on
            this page is the user's own data, and every save re-renders it via
            router.refresh() (QuickAdd / check-in pattern). Honest statement,
            not a live-stream claim - nothing here polls. */}
        <p className="mt-6 text-center text-[11px] text-neutral-400 dark:text-neutral-500">
          MetabolicInt · data shown is yours, entered manually or imported · values update instantly on save
        </p>
      </div>
    </AppShell>
  );
}

function Card({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950 ${className}`}>
      <div className="mb-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-neutral-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Subscore({ label, value }: { label: string; value: number }) {
  const color = value >= 75 ? 'bg-brand-500' : value >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-neutral-500">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-8 text-right tabular-nums">{Math.round(value)}</span>
    </div>
  );
}
