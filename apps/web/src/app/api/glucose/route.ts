import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateLearnedModel, findPairedMealForReading } from '@/lib/pairing';
import { evaluateGlucoseGuard, isValidGlucoseReading } from '@mi/engine';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { value, source = 'manual', takenAt } = await req.json();
  const v = Number(value);
  if (!Number.isFinite(v) || v <= 0) return NextResponse.json({ error: 'Invalid value' }, { status: 400 });

  // U25 guardrails: reject physiologically implausible entries (data hygiene).
  if (!isValidGlucoseReading(v)) {
    return NextResponse.json({ error: 'Please enter a reading between 20 and 600 mg/dL.' }, { status: 400 });
  }

  // Optional actual measurement time (e.g. a late-dinner reading logged the next
  // morning). Defaults to now when omitted, so existing clients keep working.
  let takenAtDate: Date | undefined;
  if (takenAt != null) {
    const t = new Date(takenAt).getTime();
    if (!Number.isFinite(t)) return NextResponse.json({ error: 'Invalid takenAt' }, { status: 400 });
    if (t > Date.now() + 5 * 60_000) {
      return NextResponse.json({ error: 'takenAt cannot be in the future' }, { status: 400 });
    }
    takenAtDate = new Date(t);
  }

  // U25: prior readings inside the trailing 24h window (pattern aggravator input).
  const when = takenAtDate ?? new Date();
  const priors = await prisma.glucoseReading.findMany({
    where: {
      userId: session.user.id,
      takenAt: { gte: new Date(when.getTime() - 24 * 60 * 60 * 1000), lte: new Date(when.getTime() + 5 * 60_000) },
    },
    orderBy: { takenAt: 'desc' },
    take: 100,
    select: { value: true, takenAt: true },
  });

  const reading = await prisma.glucoseReading.create({
    data: {
      userId: session.user.id,
      value: v,
      source,
      ...(takenAtDate ? { takenAt: takenAtDate } : {}),
    },
  });

  // U25: verdict is computed, never stored.
  const guard = evaluateGlucoseGuard(
    v,
    priors.map((r) => ({ mgdl: r.value, at: r.takenAt })),
    when,
  );

  // Pairing + model update (best-effort: the reading itself is already saved).
  // The model refits only when this reading completes a (meal, glucose) pair.
  let pairedWith: { key: string; label: string; mealType: string; startedAt: number } | null = null;
  let model: Awaited<ReturnType<typeof updateLearnedModel>> | null = null;
  try {
    pairedWith = await findPairedMealForReading(session.user.id, reading.takenAt.getTime());
    if (pairedWith) {
      model = await updateLearnedModel(session.user.id);
    }
  } catch (e) {
    console.error('pairing: glucose post failed', e);
  }

  return NextResponse.json({
    reading,
    guard,
    ...(pairedWith ? { pairedWith } : {}),
    ...(model ? { model } : {}),
  });
}
