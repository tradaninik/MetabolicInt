// P0 (/log revamp) - PATCH /api/me/region: persist the region choice made
// on the pinned /log selector to User.region. Stores ONE of the 11 catalog
// cuisine values (the group's primary region), so the engine's
// priorSensitivity / UserProfile.region contract and /api/me/profile stay
// untouched. Fire-and-forget from the client; never blocks logging.
import { NextResponse } from 'next/server';
import { REGION_LABELS } from '@mi/food-db';
import { getSessionUserId } from '@/lib/session-user';
import { prisma } from '@/lib/prisma';

const VALID_REGIONS = new Set<string>(Object.keys(REGION_LABELS));

export async function PATCH(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const region =
    body && typeof body === 'object' && typeof (body as { region?: unknown }).region === 'string'
      ? (body as { region: string }).region.trim()
      : '';
  if (!region || !VALID_REGIONS.has(region)) {
    return NextResponse.json({ error: 'Invalid region' }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { region },
    select: { id: true, region: true },
  });
  return NextResponse.json({ region: user.region });
}
