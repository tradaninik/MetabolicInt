import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { hours, wokeAt } = await req.json();
  const h = Number(hours);
  if (!Number.isFinite(h) || h <= 0 || h > 16) {
    return NextResponse.json({ error: 'Hours should be between 0.5 and 16' }, { status: 400 });
  }
  let wokeDate: Date | undefined;
  if (wokeAt != null) {
    const t = new Date(wokeAt).getTime();
    if (!Number.isFinite(t)) return NextResponse.json({ error: 'Invalid wokeAt' }, { status: 400 });
    if (t > Date.now() + 5 * 60_000) {
      return NextResponse.json({ error: 'Time cannot be in the future' }, { status: 400 });
    }
    wokeDate = new Date(t);
  }
  const entry = await prisma.sleepEntry.create({
    data: {
      userId: session.user.id,
      hours: h,
      ...(wokeDate ? { wokeAt: wokeDate } : {}),
    },
  });
  return NextResponse.json({ entry });
}