import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import PrakritiQuiz from '@/components/PrakritiQuiz';

// U11 Prakriti: Know Your Body self-assessment page (educational, not a medical classification).
export default async function PrakritiPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login?callbackUrl=/prakriti');

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold tracking-tight">Know Your Body</h1>
        <p className="mt-1 text-sm text-neutral-500">
          A 12-question self-assessment in the Ayurvedic tradition. Your answers stay in your account and you can retake it anytime.
        </p>
        <div className="mt-4 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
          <PrakritiQuiz />
        </div>
        <p className="mt-4 text-xs text-neutral-400">
          A traditional self-assessment - not a medical classification.
        </p>
      </div>
    </AppShell>
  );
}