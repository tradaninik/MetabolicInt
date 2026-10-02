import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { type = 'walk', minutes, at } = await req.json();
  const m = Number(minutes);
  if (!Number.isFinite(m) || m <= 0 || m > 480) {
    return NextResponse.json({ error: 'Minutes should be between 1 and 480' }, { status: 400 });
  }
  const safeType = String(type).slice(0, 30) || 'walk';
  let atDate: Date | undefined;
  if (at != null) {
    const t = new Date(at).getTime();
    if (!Number.isFinite(t)) return NextResponse.json({ error: 'Invalid at' }, { status: 400 });
    if (t > Date.now() + 5 * 60_000) {
      return NextResponse.json({ error: 'Time cannot be in the future' }, { status: 400 });
    }
    atDate = new Date(t);
  }
  const entry = await prisma.activityEntry.create({
    data: {
      userId: session.user.id,
      type: safeType,
      durationMin: m,
      ...(atDate ? { at: atDate } : {}),
    },
  });
  return NextResponse.json({ entry });
}