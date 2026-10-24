import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import HealingFoodsExplorer from '@/components/HealingFoodsExplorer';

// P4c / U16 - Food as Medicine explorer (multi-lens: Ayurveda, science, lived experience).
// Educational and non-medical; session-guarded like every other app surface.
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
        <p className="mt-4 text-xs text-neutral-400">
          Educational information only - not medical advice. Evidence grades describe research
          quality, not certainty for you.
        </p>
      </div>
    </AppShell>
  );
}
