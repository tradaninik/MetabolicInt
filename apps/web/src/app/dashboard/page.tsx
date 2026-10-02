import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { loadDashboardData } from '@/lib/engine-service';
import AppShell from '@/components/AppShell';
import HealthScoreRing from '@/components/dashboard/HealthScoreRing';
import { GlucoseChart, WeightChart, ForecastChart } from '@/components/dashboard/Charts';
import { REGION_LABELS } from '@mi/food-db';
import { getPendingCheckIns } from '@/lib/pairing';
import CheckInCard from '@/components/CheckInCard';
import QuickAdd from '@/components/QuickAdd';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login?callbackUrl=/dashboard');

  const data = await loadDashboardData(session.user.id);
  if (!data) redirect('/onboarding');
  const pendingCheckIns = await getPendingCheckIns(session.user.id);

  const { healthScore: hs, dailySummary: daily, profile, sensitivity, isPrior } = data;
  const sub = hs.components;
  const latestWeight = data.weightSeries.at(-1)?.kg ?? profile.weightKg;
  const forecastWeight = data.forecast.filter((p) => p.metric === 'weight_kg');

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Your metabolic dashboard</h1>
            <p className="text-sm text-neutral-500">
              {REGION_LABELS[profile.region]} model · sensitivity {sensitivity.toFixed(2)} mg/dL per g carb
              {isPrior ? <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300">prior</span>
                : <span className="ml-1 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">learned</span>}
            </p>
          </div>
          <Link href="/log" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            + Log a meal
          </Link>
        </div>

        {/* Disclaimer */}
        <p className="mb-6 text-xs text-amber-700 dark:text-amber-400">
          ⚕️ Educational insights, not medical advice. Consult a clinician for treatment decisions.
        </p>

        <CheckInCard pending={pendingCheckIns} sampleSize={data.sampleSize} isPrior={data.isPrior} />

        <QuickAdd />

        {/* Top row: score + daily summary */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Metabolic Health Score" subtitle="0–100 composite · last 14 days" className="lg:col-span-1">
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

          <Card title="Today" subtitle="Daily summary" className="lg:col-span-2">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Calories" value={`${Math.round(daily.kcal)}`} unit="kcal" />
              <Stat label="Carbs" value={`${daily.carbsG}`} unit="g" />
              <Stat label="Protein" value={`${daily.proteinG}`} unit="g" />
              <Stat label="Fat" value={`${daily.fatG}`} unit="g" />
              <Stat label="Steps" value={`${Math.round(daily.steps)}`} />
              <Stat label="Sleep" value={daily.sleepHours.toFixed(1)} unit="h" />
              <Stat
                label="Glucose"
                value={daily.glucoseReadings.at(-1) ? `${daily.glucoseReadings.at(-1)!.value}` : '—'}
                unit="mg/dL"
              />
              <Stat label="Weight" value={latestWeight.toFixed(1)} unit="kg" />
            </div>
          </Card>
        </div>

        {/* Charts row */}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card title="Glucose trend" subtitle="14-day series with target band" className="lg:col-span-2">
            <GlucoseChart data={data.glucoseSeries} />
          </Card>
          <Card title="Weight trend" subtitle={`${latestWeight.toFixed(1)} kg`}>
            <WeightChart data={data.weightSeries} />
          </Card>
        </div>

        {/* Forecast + insights */}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card title="30-day weight forecast" subtitle="With confidence interval · educational" className="lg:col-span-2">
            <ForecastChart data={forecastWeight} />
            <p className="mt-2 text-xs text-neutral-500">
              Based on your recent energy balance. Shaded band = model uncertainty.
            </p>
          </Card>

          <Card title="Personal insights" subtitle="Auto-discovered from your data">
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

        {/* AI Daily Recommendations */}
        <div className="mt-4">
          <Card title="AI Daily Recommendations" subtitle="Based on your metabolism and current stats">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-brand-100 bg-brand-50 p-4 dark:border-brand-900/50 dark:bg-brand-950/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🥗</span>
                  <h3 className="font-semibold text-brand-900 dark:text-brand-100">Suggested Meals</h3>
                </div>
                <p className="text-sm text-brand-800 dark:text-brand-300 mb-3">
                  To keep your glucose stable today, your model suggests these {REGION_LABELS[profile.region]} options:
                </p>
                <ul className="space-y-2 text-sm text-brand-700 dark:text-brand-400">
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-500"></span>
                    <span>1 Katori Dal with 1 Chapati</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-500"></span>
                    <span>Moong Dal Chilla (Pesarattu)</span>
                  </li>
                </ul>
              </div>
              <div className="rounded-xl border border-sky-100 bg-sky-50 p-4 dark:border-sky-900/50 dark:bg-sky-950/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">👟</span>
                  <h3 className="font-semibold text-sky-900 dark:text-sky-100">Activity Target</h3>
                </div>
                <p className="text-sm text-sky-800 dark:text-sky-300 mb-3">
                  Your activity score is {Math.round(sub.activity)}. To offset predicted dinner spikes, aim for:
                </p>
                <ul className="space-y-2 text-sm text-sky-700 dark:text-sky-400">
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500"></span>
                    <span>15 min brisk walk after dinner</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500"></span>
                    <span>Avoid sitting for &gt; 2 hours</span>
                  </li>
                </ul>
              </div>
            </div>
          </Card>
        </div>

        {/* Health timeline */}
        <Card title="Health timeline" subtitle="Last 24 hours" className="mt-4">
          {data.timeline.length === 0 ? (
            <p className="text-sm text-neutral-500">Nothing logged in the last 24 hours.</p>
          ) : (
            <ol className="relative space-y-3 border-l border-neutral-200 pl-4 dark:border-neutral-800">
              {data.timeline.slice(0, 10).map((ev, i) => (
                <li key={i} className="relative">
                  <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ${dotColor(ev.type)}`} />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{ev.label}</span>
                    <span className="text-xs text-neutral-400">
                      {new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(ev.t))}
                    </span>
                  </div>
                  {ev.text && <p className="text-xs text-neutral-500">{ev.text}</p>}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

function dotColor(type: string): string {
  switch (type) {
    case 'meal': return 'bg-brand-500';
    case 'glucose': return 'bg-amber-500';
    case 'sleep': return 'bg-indigo-500';
    case 'activity': return 'bg-sky-500';
    case 'weight': return 'bg-neutral-500';
    default: return 'bg-neutral-400';
  }
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

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">
        {value} {unit && <span className="text-xs font-normal text-neutral-400">{unit}</span>}
      </div>
    </div>
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
