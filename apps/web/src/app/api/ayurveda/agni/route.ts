import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { loadAgniRhythm } from '@/lib/agni';

export const dynamic = 'force-dynamic';

// P4c-b / U17 - Agni rhythm API (educational, non-medical).
// GET returns the current IST agni window, today's rhythm score (computed on read,
// zero persistence), prioritized nudges, and the three rhythm habits from the Food
// as Medicine knowledge base with their evidence grades. 401 unauthenticated.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const snapshot = await loadAgniRhythm(session.user.id);
  return NextResponse.json(snapshot);
}
