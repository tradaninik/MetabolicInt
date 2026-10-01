import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import AppShell from '@/components/AppShell';
import { GlucoseChart } from '@/components/dashboard/Charts';
import GlucoseLogger from '@/components/GlucoseLogger';
import CheckInCard from '@/components/CheckInCard';
import { getPendingCheckIns } from '@/lib/pairing';

export default async function GlucosePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login?callbackUrl=/glucose');
  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
    glucoseReadings: { orderBy: { takenAt: 'desc' }, take: 200 },
    learnedModel: true,
  },
  });
  if (!u) redirect('/onboarding');
  const pendingCheckIns = await getPendingCheckIns(session.user.id);
  const isPrior = u.learnedModel ? u.learnedModel.isPrior : true;
  const sampleSize = u.learnedModel ? u.learnedModel.sampleSize : 0;

  const series = u.glucoseReadings.map((g) => ({ t: g.takenAt.getTime(), value: g.value })).sort((a, b) => a.t - b.t);
  const last30 = u.glucoseReadings.slice(0, 30).map((g) => g.value);
  const avg = last30.length ? last30.reduce((a, b) => a + b, 0) / last30.length : 0;
  const inRange = last30.filter((v) => v >= 70 && v <= 140).length;
  const tir = last30.length ? Math.round((inRange / last30.length) * 100) : 0;
  const variability = last30.length > 1 ? Math.round(stddev(last30)) : 0;
  const gmi = avg ? ((avg + 46.7) / 28.7).toFixed(1) : '—';

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold tracking-tight">Glucose Intelligence</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Manual readings now · CGM sync is an integration slot for later.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Avg (recent)" value={avg ? avg.toFixed(0) : '—'} unit="mg/dL" />
          <Stat label="Time in range" value={`${tir}`} unit="%" />
          <Stat label="Variability" value={`${variability}`} unit="SD" />
          <Stat label="GMI" value={gmi} unit="%" />
        </div>

        <div className="mt-4 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="mb-3 text-sm font-semibold">Glucose trend</h2>
          <GlucoseChart data={series} />
        </div>

        <div className="mt-4 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="mb-3 text-sm font-semibold">Log a reading</h2>
          <CheckInCard pending={pendingCheckIns} sampleSize={sampleSize} isPrior={isPrior} />
          <GlucoseLogger />
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value} {unit && <span className="text-xs font-normal text-neutral-400">{unit}</span>}</div>
    </div>
  );
}
function stddev(xs: number[]): number {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}
