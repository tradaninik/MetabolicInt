import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { loadDashboardData } from '@/lib/engine-service';
import AppShell from '@/components/AppShell';
import InsightsTabs from '@/components/InsightsTabs';

// P6-b: Insights hosts BOTH lenses in one tab - the auto-discovered pattern
// cards (server-rendered here from loadDashboardData, unchanged) and the
// coach chat (client pane over POST /api/coach, unchanged). /coach redirects
// here via next.config.mjs so old links keep working.
export default async function InsightsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login?callbackUrl=/insights');
  const data = await loadDashboardData(session.user.id);
  if (!data) redirect('/onboarding');

  const cards = data.insights.map((c) => ({
    id: c.id,
    title: c.title,
    body: c.body,
    effectPct: c.effectPct,
    confidence: c.confidence,
    evidence: c.evidence,
  }));

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Your patterns and your coach, side by side - both grounded in what you actually logged.
        </p>
        <div className="mt-5">
          <InsightsTabs cards={cards} />
        </div>
      </div>
    </AppShell>
  );
}
