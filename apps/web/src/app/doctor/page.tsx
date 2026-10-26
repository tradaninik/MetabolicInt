import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import AppShell from '@/components/AppShell';
import PatientDocuments from '@/components/PatientDocuments';

export default async function DoctorPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login?callbackUrl=/doctor');

  const links = await prisma.doctorPatientLink.findMany({
    where: { doctorId: session.user.id },
    include: { patient: { include: { glucoseReadings: { orderBy: { takenAt: 'desc' }, take: 14 } } } },
    orderBy: { createdAt: 'asc' },
  });

  // Sample roster so the portal is explorable without linked patients.
  const sample = [
    { name: 'Ramesh K.', hba1c: 8.4, avgGlucose: 178, adherence: 62, flags: ['Poor sleep', 'Skipped meals'], risk: 'high' },
    { name: 'Lakshmi P.', hba1c: 6.9, avgGlucose: 132, adherence: 81, flags: [], risk: 'moderate' },
    { name: 'Arjun S.', hba1c: 6.1, avgGlucose: 108, adherence: 90, flags: [], risk: 'low' },
  ];
  const roster = links.length > 0
    ? links.map((l) => ({
        name: l.patient.name ?? l.patient.email,
        hba1c: l.patient.hba1c ?? 0,
        avgGlucose: avg(l.patient.glucoseReadings.map((g) => g.value)),
        adherence: l.adherenceScore ?? 0,
        flags: l.riskFlags ? safeParse(l.riskFlags) : [],
        risk: l.riskFlags ? 'high' : 'moderate',
      }))
    : sample;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold tracking-tight">Doctor Portal</h1>
        <p className="mt-1 text-sm text-neutral-500">Patient overview, risk flags, adherence. Exportable reports in the Reports tab.</p>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">HbA1c</th>
                <th className="px-4 py-3">Avg glucose</th>
                <th className="px-4 py-3">Adherence</th>
                <th className="px-4 py-3">Flags</th>
                <th className="px-4 py-3">Risk</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((p) => (
                <tr key={p.name} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">{p.hba1c || '—'}%</td>
                  <td className="px-4 py-3">{p.avgGlucose ? p.avgGlucose.toFixed(0) : '—'} mg/dL</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                        <div className={`h-full ${p.adherence >= 80 ? 'bg-brand-500' : p.adherence >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${p.adherence}%` }} />
                      </div>
                      <span className="text-xs">{p.adherence}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-500">{p.flags.join(', ') || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.risk === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300' : p.risk === 'moderate' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'}`}>
                      {p.risk.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex gap-2">
          <Link href="/reports" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Export patient PDFs
          </Link>
        </div>

        {/* P6-f: per-patient report documents vault (A–E folders) + latest-panel
            comparison summary. Real links only - the sample roster shares nothing. */}
        {links.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold">Reports &amp; documents</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Your linked patients&apos; uploaded reports, organized in their A–E master folders, with the standard
              filenames on download.
            </p>
            <div className="mt-2 space-y-4">
              {links.map((l) => (
                <PatientDocuments key={l.id} userId={l.patientId} whose={l.patient.name ?? l.patient.email} />
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function avg(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
function safeParse(s: string): any[] { try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; } }
