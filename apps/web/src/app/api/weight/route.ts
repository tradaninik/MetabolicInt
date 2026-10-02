import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { kg, takenAt } = await req.json();
  const w = Number(kg);
  if (!Number.isFinite(w) || w < 20 || w > 400) {
    return NextResponse.json({ error: 'Weight should be between 20 and 400 kg' }, { status: 400 });
  }
  let takenDate: Date | undefined;
  if (takenAt != null) {
    const t = new Date(takenAt).getTime();
    if (!Number.isFinite(t)) return NextResponse.json({ error: 'Invalid takenAt' }, { status: 400 });
    if (t > Date.now() + 5 * 60_000) {
      return NextResponse.json({ error: 'Time cannot be in the future' }, { status: 400 });
    }
    takenDate = new Date(t);
  }
  const entry = await prisma.weightEntry.create({
    data: {
      userId: session.user.id,
      kg: w,
      ...(takenDate ? { takenAt: takenDate } : {}),
    },
  });
  return NextResponse.json({ entry });
}