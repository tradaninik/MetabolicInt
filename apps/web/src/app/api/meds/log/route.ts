import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/session-user';
import { prisma } from '@/lib/prisma';
import { istNow } from '@/lib/clinical-db';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLOT_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// POST: mark a slot taken/skipped (upsert - changing your mind overwrites).
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const b = body as Record<string, unknown>;

  const medicationId = typeof b.medicationId === 'string' ? b.medicationId : '';
  const logDate = typeof b.logDate === 'string' ? b.logDate : '';
  const slotTime = typeof b.slotTime === 'string' ? b.slotTime : '';
  const status = b.status === 'taken' || b.status === 'skipped' ? b.status : null;
  if (!medicationId || !DATE_RE.test(logDate) || !SLOT_RE.test(slotTime) || !status) {
    return NextResponse.json({ error: 'medicationId, logDate (YYYY-MM-DD), slotTime (HH:MM), status (taken|skipped) required.' }, { status: 400 });
  }
  if (logDate > istNow().slice(0, 10)) {
    return NextResponse.json({ error: 'Cannot log for a future date.' }, { status: 400 });
  }

  const med = await prisma.medication.findFirst({ where: { id: medicationId, userId } });
  if (!med) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  let slots: string[] = [];
  try {
    const p = JSON.parse(med.scheduleTimes);
    if (Array.isArray(p)) slots = p.map(String);
  } catch { /* invalid schedule JSON - the slot check below rejects safely */ }
  if (!slots.includes(slotTime)) {
    return NextResponse.json({ error: 'That time is not in this medication schedule.' }, { status: 400 });
  }

  const log = await prisma.medicationLog.upsert({
    where: { medicationId_logDate_slotTime: { medicationId, logDate, slotTime } },
    create: { medicationId, userId, logDate, slotTime, status },
    update: { status },
  });
  return NextResponse.json({ log });
}

// DELETE: undo - removes the row entirely (schema design: 'skipped' stays
// scheduled-but-untaken; an undo deletes the row).
export async function DELETE(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const medicationId = url.searchParams.get('medicationId') ?? '';
  const logDate = url.searchParams.get('logDate') ?? '';
  const slotTime = url.searchParams.get('slotTime') ?? '';
  if (!medicationId || !DATE_RE.test(logDate) || !SLOT_RE.test(slotTime)) {
    return NextResponse.json({ error: 'medicationId, logDate, slotTime query params required.' }, { status: 400 });
  }
  const res = await prisma.medicationLog.deleteMany({
    where: { medicationId, logDate, slotTime, userId },
  });
  return NextResponse.json({ deleted: res.count });
}