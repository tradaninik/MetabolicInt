import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { loadDashboardData } from '@/lib/engine-service';
import AppShell from '@/components/AppShell';
import ReportPrint from '@/components/ReportPrint';
import VisitSummary from '@/components/VisitSummary';
import DoctorQuestions from '@/components/DoctorQuestions';

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login?callbackUrl=/reports');
  const data = await loadDashboardData(session.user.id);
  if (!data) redirect('/onboarding');

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-neutral-500">Export your metabolic data. PDF prints to file; CSV opens in Excel/Sheets.</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <a href="/api/reports?format=csv" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            â¬‡ Download CSV (Excel)
          </a>
          <a href="/api/export?format=json" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900">
            Download full backup (JSON)
          </a>
          <ReportPrint />
        </div>

        {/* Printable report preview */}
        <div id="print-area" className="mt-6 rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-4 dark:border-neutral-800">
            <div>
              <h2 className="text-lg font-semibold">Metabolic Health Report</h2>
              <p className="text-xs text-neutral-500">{new Date().toLocaleDateString()}</p>
            </div>
            <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
              Score {data.healthScore.score}/100
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            {Object.entries(data.healthScore.components).map(([k, v]) => (
              <div key={k}>
                <div className="text-xs capitalize text-neutral-500">{k}</div>
                <div className="font-semibold">{Math.round(v)}/100</div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-neutral-500">
            Sensitivity: {data.sensitivity.toFixed(2)} mg/dL per g carb Â· {data.isPrior ? 'prior estimate' : `learned from ${data.sampleSize} meals`}
          </div>
          <VisitSummary userId={session.user.id} />
          <DoctorQuestions />
          <p className="mt-4 border-t border-neutral-200 pt-4 text-[11px] text-neutral-400 dark:border-neutral-800">
            Educational report, not a medical document. Consult a clinician for treatment decisions.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

