// P7.1 — /api/lab-tests: the user's custom lab tests, created at import from
// unmatched report rows ("create custom test" - name + unit + value). The
// definition carries the display name/unit; the VALUE lives on the panel row
// being imported, never here. testKey format used by LabResult: "custom:<id>".
//
// GET  : list the user's tests -> { tests: [{ id, key, name, unit, refLow?, refHigh? }] }
// POST : create one -> 201 { id, key } | 409 with a plain-language reason when
//        the name already exists (case-insensitive - "Vitamin E" is "vitamin e").
//
// No DELETE in this wave: a deleted definition would strip the label off every
// panel row that referenced it. Delete/rename arrives with settings work later.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/session-user';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tests = await prisma.customLabTest.findMany({
    where: { userId },
    orderBy: [{ name: 'asc' }],
    select: { id: true, name: true, unit: true, refLow: true, refHigh: true, createdAt: true },
  });
  return NextResponse.json({
    tests: tests.map((t) => ({
      id: t.id,
      key: `custom:${t.id}`,
      name: t.name,
      unit: t.unit,
      ...(t.refLow != null ? { refLow: t.refLow } : {}),
      ...(t.refHigh != null ? { refHigh: t.refHigh } : {}),
    })),
  });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ').slice(0, 60) : '';
  const unit = typeof body?.unit === 'string' ? body.unit.trim().slice(0, 16) : '';
  const refLow = Number(body?.refLow);
  const refHigh = Number(body?.refHigh);

  if (name.length < 2) {
    return NextResponse.json({ error: 'Give the test a name (at least 2 letters).' }, { status: 400 });
  }

  // Case-insensitive uniqueness (the DB unique is exact-case; we are stricter).
  // SQLite/libSQL has no case-insensitive equals in Prisma, so compare in JS -
  // a user's custom test list is tiny.
  const mine = await prisma.customLabTest.findMany({
    where: { userId },
    select: { name: true },
  });
  const clash = mine.find((t) => t.name.toLowerCase() === name.toLowerCase());
  if (clash) {
    return NextResponse.json(
      { error: `You already have a custom test named "${clash.name}".` },
      { status: 409 },
    );
  }

  const created = await prisma.customLabTest.create({
    data: {
      userId,
      name,
      unit,
      ...(Number.isFinite(refLow) && refLow >= 0 ? { refLow } : {}),
      ...(Number.isFinite(refHigh) && refHigh >= 0 ? { refHigh } : {}),
    },
  });
  return NextResponse.json(
    { id: created.id, key: `custom:${created.id}`, name: created.name, unit: created.unit },
    { status: 201 },
  );
}
