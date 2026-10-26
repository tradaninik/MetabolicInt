// P6-e — GET /api/lab-panels/compare?a=<panelId>&b=<panelId>
//
// Panel A (older) vs panel B (newer): the engine's compareLabPanels builds
// the delta rows (direction-aware tones, derived markers per panel); this
// route assembles the "between your reports" context from the existing
// models (meals, activity, sleep, weight, glucose incl. CGM coverage, meds
// adherence via the shared computeAdherence, BP averages) and the engine
// turns it into hedged association notes. Associations, never causes.
import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/session-user';
import { prisma } from '@/lib/prisma';
import { istNow, computeAdherence } from '@/lib/clinical-db';
import { compareLabPanels, betweenReportsContext, comparisonNotes } from '@mi/engine';

export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const aId = url.searchParams.get('a');
  const bId = url.searchParams.get('b');
  if (!aId || !bId) return NextResponse.json({ error: 'Pick two reports to compare.' }, { status: 400 });
  if (aId === bId) return NextResponse.json({ error: 'Pick two different reports.' }, { status: 400 });

  const [panelA, panelB] = await Promise.all([
    prisma.labPanel.findFirst({ where: { id: aId, userId }, include: { results: true } }),
    prisma.labPanel.findFirst({ where: { id: bId, userId }, include: { results: true } }),
  ]);
  if (!panelA || !panelB) return NextResponse.json({ error: 'Report not found.' }, { status: 404 });

  // A = older, B = newer by convention; swap when the user picked them reversed.
  const [older, newer] =
    panelA.performedAt <= panelB.performedAt ? [panelA, panelB] : [panelB, panelA];

  const toInput = (p: typeof panelA) => ({
    performedAt: p.performedAt,
    name: p.name,
    values: Object.fromEntries(p.results.map((r) => [r.testKey, { value: r.value, unit: r.unit }])),
  });
  const comparison = compareLabPanels(toInput(older), toInput(newer));

  // Context window: from the older report's date to the newer one's.
  const from = older.performedAt;
  const to = newer.performedAt;
  const fromMs = new Date(`${from}T00:00:00Z`).getTime();
  const toMs = new Date(`${to}T23:59:59Z`).getTime();

  const [mealsRaw, activity, sleep, weights, glucose, meds, medLogs, bp] = await Promise.all([
    prisma.foodEntry.findMany({
      where: { userId, loggedAt: { gte: new Date(fromMs), lte: new Date(toMs) } },
      // FoodEntry freezes kcal/carbs/protein/fat at log time; fiber lives on
      // the Food row (per-100g), so it is derived per entry from grams.
      select: {
        kcal: true, carbsG: true, proteinG: true, loggedAt: true, grams: true,
        food: { select: { fiberPer100g: true } },
      },
      take: 2000,
    }),
    prisma.activityEntry.findMany({
      where: { userId, at: { gte: new Date(fromMs), lte: new Date(toMs) } },
      select: { durationMin: true, at: true },
      take: 1000,
    }),
    prisma.sleepEntry.findMany({
      where: { userId, wokeAt: { gte: new Date(fromMs), lte: new Date(toMs) } },
      select: { hours: true, wokeAt: true },
      take: 500,
    }),
    prisma.weightEntry.findMany({
      where: { userId, takenAt: { gte: new Date(fromMs), lte: new Date(toMs) } },
      select: { kg: true, takenAt: true },
      take: 200,
    }),
    prisma.glucoseReading.findMany({
      where: { userId, takenAt: { gte: new Date(fromMs), lte: new Date(toMs) } },
      select: { value: true, source: true, takenAt: true },
      take: 5000,
    }),
    prisma.medication.findMany({ where: { userId }, select: { id: true, scheduleTimes: true, isActive: true } }),
    prisma.medicationLog.findMany({
      where: { userId, logDate: { gte: from, lte: to } },
      select: { medicationId: true, logDate: true, slotTime: true, status: true },
    }),
    prisma.bloodPressureEntry.findMany({
      where: { userId, takenAt: { gte: new Date(fromMs), lte: new Date(toMs) } },
      select: { systolic: true, diastolic: true, takenAt: true },
      take: 500,
    }),
  ]);

  const meals = mealsRaw.map((m) => ({
    kcal: m.kcal,
    carbsG: m.carbsG,
    proteinG: m.proteinG,
    fiberG: Math.round(((m.food?.fiberPer100g ?? 0) * m.grams) / 100 * 10) / 10,
    loggedAt: m.loggedAt,
  }));

  const adherence = computeAdherence(meds, medLogs, { from, to, asOf: istNow() });

  const ctx = betweenReportsContext({
    from,
    to,
    meals,
    activity,
    sleep,
    weights,
    glucose,
    medsExpected: adherence.expected,
    medsTaken: adherence.taken,
    bp,
  });

  const notes = comparisonNotes(comparison.rows, ctx, { performedAt: older.performedAt }, { performedAt: newer.performedAt });

  return NextResponse.json({
    a: { id: older.id, performedAt: older.performedAt, name: older.name, labName: older.labName },
    b: { id: newer.id, performedAt: newer.performedAt, name: newer.name, labName: newer.labName },
    rows: comparison.rows,
    context: ctx,
    notes,
    adherence: { expected: adherence.expected, taken: adherence.taken, pct: adherence.pct },
  });
}
