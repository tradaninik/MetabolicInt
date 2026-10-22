import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/session-user';
import { prisma } from '@/lib/prisma';
import { resolveTargets, EDUCATIONAL_TARGETS } from '@/lib/clinical-db';

const UNITS = ['mg/dL', 'mmol/L'] as const;
const BOUNDS = [
  'tFastingLow', 'tFastingHigh', 'tPremealLow', 'tPremealHigh',
  'tPostprandialLow', 'tPostprandialHigh', 'tBedtimeLow', 'tBedtimeHigh',
] as const;
type BoundKey = (typeof BOUNDS)[number];

const PAIRS: { low: BoundKey; high: BoundKey; label: string }[] = [
  { low: 'tFastingLow', high: 'tFastingHigh', label: 'fasting' },
  { low: 'tPremealLow', high: 'tPremealHigh', label: 'pre-meal' },
  { low: 'tPostprandialLow', high: 'tPostprandialHigh', label: 'post-meal' },
  { low: 'tBedtimeLow', high: 'tBedtimeHigh', label: 'bedtime' },
];

// GET: resolved targets (for displays) + the raw nullable bounds (for form
// prefill). Nulls mean "still on educational defaults".
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const row = await prisma.userSettings.findUnique({ where: { userId } });
  return NextResponse.json({
    glucoseUnit: row?.glucoseUnit ?? 'mg/dL',
    targets: resolveTargets(row),
    educational: EDUCATIONAL_TARGETS,
    raw: row ? Object.fromEntries(BOUNDS.map((k) => [k, row[k]])) : null,
  });
}

// PUT: partial update. Absent key = unchanged; explicit null = back to the
// educational default. Pair checks run on the merged state, so a one-sided
// update can never create low >= high.
export async function PUT(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const b = body as Record<string, unknown>;

  const existing = await prisma.userSettings.findUnique({ where: { userId } });
  const next: Record<BoundKey, number | null> = {
    tFastingLow: existing?.tFastingLow ?? null, tFastingHigh: existing?.tFastingHigh ?? null,
    tPremealLow: existing?.tPremealLow ?? null, tPremealHigh: existing?.tPremealHigh ?? null,
    tPostprandialLow: existing?.tPostprandialLow ?? null, tPostprandialHigh: existing?.tPostprandialHigh ?? null,
    tBedtimeLow: existing?.tBedtimeLow ?? null, tBedtimeHigh: existing?.tBedtimeHigh ?? null,
  };

  for (const k of BOUNDS) {
    if (!(k in b)) continue;
    const v = b[k];
    if (v === null || v === undefined) { next[k] = null; continue; }
    const n = Number(v);
    if (!Number.isFinite(n) || n < 40 || n > 400) {
      return NextResponse.json({ error: 'Targets must be numbers between 40 and 400 mg/dL.' }, { status: 400 });
    }
    next[k] = Math.round(n);
  }

  for (const p of PAIRS) {
    const lo = next[p.low], hi = next[p.high];
    if (lo != null && hi != null && lo >= hi) {
      return NextResponse.json({ error: 'Your ' + p.label + ' target low must be below its high.' }, { status: 400 });
    }
  }

  let glucoseUnit = existing?.glucoseUnit ?? 'mg/dL';
  if (b.glucoseUnit !== undefined) {
    const u = String(b.glucoseUnit);
    if (!(UNITS as readonly string[]).includes(u)) {
      return NextResponse.json({ error: "glucoseUnit must be 'mg/dL' or 'mmol/L'." }, { status: 400 });
    }
    glucoseUnit = u;
  }

  const data = {
    glucoseUnit,
    tFastingLow: next.tFastingLow, tFastingHigh: next.tFastingHigh,
    tPremealLow: next.tPremealLow, tPremealHigh: next.tPremealHigh,
    tPostprandialLow: next.tPostprandialLow, tPostprandialHigh: next.tPostprandialHigh,
    tBedtimeLow: next.tBedtimeLow, tBedtimeHigh: next.tBedtimeHigh,
  };
  const row = await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  return NextResponse.json({ settings: row, targets: resolveTargets(row) });
}