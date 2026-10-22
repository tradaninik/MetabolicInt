import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/session-user';
import { prisma } from '@/lib/prisma';
import { computeAdherence, istNow, type MedScheduleLike, type MedLogLike } from '@/lib/clinical-db';

const SLOT_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_ACTIVE_MEDS = 10;

// GET: meds with this week's logs + adherence over the last 7 days.
// Adherence display only - never a judgment, never dose advice.
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const asOf = istNow();
  const to = asOf.slice(0, 10);
  const from = new Date(Date.parse(`${to}T00:00:00Z`) - 6 * 86400000).toISOString().slice(0, 10);

  const meds = await prisma.medication.findMany({
    where: { userId },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    include: { logs: { where: { logDate: { gte: from } } } },
  });

  const schedules: MedScheduleLike[] = meds.map((m) => ({
    id: m.id, scheduleTimes: m.scheduleTimes, isActive: m.isActive,
  }));
  const logs: MedLogLike[] = meds.flatMap((m) =>
    m.logs.map((l) => ({ medicationId: l.medicationId, logDate: l.logDate, slotTime: l.slotTime, status: l.status })),
  );

  const adherence = computeAdherence(schedules, logs, { from, to, asOf });
  return NextResponse.json({ meds, adherence, window: { from, to, asOf } });
}

// POST: add a medication to track. Name + times only - the safety posture
// (blueprint 8) means no dose, strength, or notes fields exist anywhere.
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const b = body as Record<string, unknown>;

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name || name.length > 60) return NextResponse.json({ error: 'Name must be 1-60 characters.' }, { status: 400 });

  const rawTimes = Array.isArray(b.scheduleTimes) ? b.scheduleTimes : [];
  const unique = [...new Set(rawTimes.map((t) => String(t)).filter((t) => SLOT_RE.test(t)))].sort();
  if (unique.length === 0) return NextResponse.json({ error: 'Add at least one valid time (HH:MM, 24-hour).' }, { status: 400 });
  if (unique.length > 8) return NextResponse.json({ error: 'At most 8 times per day.' }, { status: 400 });

  const activeCount = await prisma.medication.count({ where: { userId, isActive: true } });
  if (activeCount >= MAX_ACTIVE_MEDS) {
    return NextResponse.json({ error: 'You already track 10 active medications. Deactivate one first.' }, { status: 409 });
  }

  const med = await prisma.medication.create({
    data: { userId, name, scheduleTimes: JSON.stringify(unique) },
  });
  return NextResponse.json({ med });
}

// PATCH: activate/deactivate. History stays - deactivating never deletes logs,
// so past adherence stays truthful.
export async function PATCH(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const b = body as Record<string, unknown>;

  const id = typeof b.id === 'string' ? b.id : '';
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  if (typeof b.isActive !== 'boolean') return NextResponse.json({ error: 'isActive (boolean) required' }, { status: 400 });

  const res = await prisma.medication.updateMany({
    where: { id, userId },
    data: { isActive: b.isActive, deactivatedAt: b.isActive ? null : new Date() },
  });
  if (res.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}