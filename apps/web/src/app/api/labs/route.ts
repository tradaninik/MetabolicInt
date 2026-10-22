import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/session-user';
import { prisma } from '@/lib/prisma';
import { validateHba1cLab, canonicalA1cPercent, hba1cTrend } from '@/lib/clinical-db';

// GET: the user's HbA1c rows (newest first) + the chronological trend series
// (canonical % + eAG in both units), ready for the trend view.
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const labs = await prisma.lab.findMany({
    where: { userId, testType: 'hba1c' },
    orderBy: [{ performedAt: 'desc' }],
  });
  const trend = hba1cTrend(
    labs.map((l) => ({ value: l.value, unit: l.unit, performedAt: l.performedAt })),
  );
  return NextResponse.json({ labs, trend });
}

// POST: one HbA1c row. Canonical a1cPercent is stored regardless of entry
// unit, so the trend never depends on how the lab printed it.
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const b = body as Record<string, unknown>;

  const testType = typeof b.testType === 'string' ? b.testType : 'hba1c';
  if (testType !== 'hba1c') {
    return NextResponse.json({ error: 'Only HbA1c labs are supported in this phase.' }, { status: 400 });
  }

  const value = Number(b.value);
  const unit = typeof b.unit === 'string' ? b.unit : '';
  const performedAt = typeof b.performedAt === 'string' ? b.performedAt : '';
  const labName = typeof b.labName === 'string' ? b.labName.trim().slice(0, 80) : null;

  const err = validateHba1cLab({ value, unit, performedAt });
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const lab = await prisma.lab.create({
    data: {
      userId, testType: 'hba1c', value, unit,
      a1cPercent: canonicalA1cPercent(value, unit),
      performedAt, labName: labName || null,
    },
  });
  return NextResponse.json({ lab });
}