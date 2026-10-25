import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import HealingFoodProfile from '@/components/HealingFoodProfile';

// R-1a - Full profile for one healing food. Session-guarded like every other
// app surface; the profile itself is a client component that consumes the
// existing session-guarded /api/food-as-medicine endpoint unchanged.
// Next 15: page props (params) are async and must be awaited.
export default async function HealingFoodDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect(`/login?callbackUrl=/healing-foods/${slug}`);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <HealingFoodProfile slug={slug} />
        <p className="mt-4 text-xs text-neutral-400">
          Educational information only - not medical advice. Evidence grades describe research
          quality, not certainty for you.
        </p>
      </div>
    </AppShell>
  );
}