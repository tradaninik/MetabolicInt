import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { systolic, diastolic, takenAt } = await req.json();
  const sys = Number(systolic);
  const dia = Number(diastolic);
  if (!Number.isFinite(sys) || sys < 70 || sys > 250) {
    return NextResponse.json({ error: 'Systolic should be between 70 and 250' }, { status: 400 });
  }
  if (!Number.isFinite(dia) || dia < 40 || dia > 150) {
    return NextResponse.json({ error: 'Diastolic should be between 40 and 150' }, { status: 400 });
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
  const entry = await prisma.bloodPressureEntry.create({
    data: {
      userId: session.user.id,
      systolic: Math.round(sys),
      diastolic: Math.round(dia),
      ...(takenDate ? { takenAt: takenDate } : {}),
    },
  });
  return NextResponse.json({ entry });
}