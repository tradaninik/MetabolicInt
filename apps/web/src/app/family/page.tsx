import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import AppShell from '@/components/AppShell';
import PatientDocuments from '@/components/PatientDocuments';

export default async function FamilyPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login?callbackUrl=/family');

  // Real: care relationships. Demo: if none, show sample ward cards so the UI is explorable.
  const relationships = await prisma.careRelationship.findMany({
    where: { caregiverId: session.user.id },
    include: { ward: { include: { glucoseReadings: { orderBy: { takenAt: 'desc' }, take: 1 } } } },
  });

  const sampleWards = [
    { name: 'Father (sample)', glucose: 178, status: 'high', alert: 'Post-lunch glucose elevated', lastSeen: '12 min ago' },
    { name: 'Mother (sample)', glucose: 96, status: 'ok', alert: 'All good', lastSeen: '1 h ago' },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold tracking-tight">Family Monitoring</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Caregivers can monitor elderly parents, spouses, or children. Alerts for missed meds and dangerous glucose.
        </p>

        <div className="mt-6 rounded-xl border border-dashed border-neutral-300 p-5 text-sm dark:border-neutral-700">
          <p className="text-neutral-500">
            Invite a ward by having them sign up, then link from this page (invite-by-email is a Phase-2 feature).
            Cards below are sample data so you can see the experience.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {(relationships.length > 0
            ? relationships.map((r) => ({
                name: r.ward.name ?? r.ward.email,
                glucose: r.ward.glucoseReadings[0]?.value ?? 0,
                status: (r.ward.glucoseReadings[0]?.value ?? 0) > 180 ? 'high' : 'ok',
                alert: (r.ward.glucoseReadings[0]?.value ?? 0) > 180 ? 'Elevated glucose' : 'All good',
                lastSeen: r.ward.glucoseReadings[0]?.takenAt ? 'recently' : 'no data',
              }))
            : sampleWards
          ).map((w) => (
            <div key={w.name} className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{w.name}</h2>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${w.status === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300' : 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'}`}>
                  {w.status === 'high' ? 'ATTENTION' : 'OK'}
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold">{w.glucose}</span>
                <span className="text-xs text-neutral-500">mg/dL · {w.lastSeen}</span>
              </div>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{w.alert}</p>
              <div className="mt-3 flex gap-2 text-xs">
                <span className="rounded bg-neutral-100 px-2 py-1 dark:bg-neutral-900">Med alerts on</span>
                <span className="rounded bg-neutral-100 px-2 py-1 dark:bg-neutral-900">Emergency contact set</span>
              </div>
            </div>
          ))}
        </div>

        {/* P6-f: the ward's report documents (A–E folders) + latest-panel summary.
            Real relationships only - the sample cards above share nothing. */}
        {relationships.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold">Reports &amp; documents</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Your wards&apos; uploaded lab reports and screening documents, in their A–E master folders - so a
              doctor visit means one folder, not a shoebox of printouts.
            </p>
            <div className="mt-2 space-y-4">
              {relationships.map((r) => (
                <PatientDocuments key={r.id} userId={r.wardId} whose={r.ward.name ?? r.ward.email} />
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
