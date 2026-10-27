// P6-d — /api/lab-panels: the A–E panel world on top of LabPanel/LabResult.
//
// GET  : panels (newest first) with catalog labels + derived markers
//        (HOMA-IR / non-HDL / display-only eGFR estimate), plus per-test
//        trend series for every test with >= 2 datapoints.
// POST : one panel + its results (validateLabPanelInput, engine). HbA1c rows
//        are ALSO mirrored into the legacy Lab table (dual-write) so the
//        existing /api/labs trend - first citizen of the new world - sees one
//        continuous series. The mirror carries panelId for cleanup on delete.
// DELETE ?id= : removes mirrored Lab rows first, then the panel (results
//        cascade).
import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/session-user';
import { prisma } from '@/lib/prisma';
import { canonicalA1cPercent } from '@/lib/clinical-db';
import {
  LAB_TEST_MAP,
  LAB_CATEGORIES,
  pickDefaultRange,
  labFlagFor,
  homaIr,
  nonHdl,
  ckdEpiEgfr,
  validateLabPanelInput,
} from '@mi/engine';

interface ResultRow {
  testKey: string;
  value: number;
  unit: string;
  refLow: number | null;
  refHigh: number | null;
  flag: string | null;
}

interface PanelRow {
  id: string;
  name: string | null;
  labName: string | null;
  performedAt: string;
  sourceNote: string | null;
  results: ResultRow[];
}

/** A user-created custom test definition (P7.1), keyed for LabResult.testKey. */
export interface CustomTestDef {
  key: string; // "custom:<id>"
  name: string;
  unit: string;
  refLow?: number | null;
  refHigh?: number | null;
}

interface DecoratedResult {
  testKey: string;
  label: string;
  category: string | null;
  unit: string;
  value: number;
  refLow: number | null;
  refHigh: number | null;
  flag: string | null;
  direction: string;
  derived: boolean;
}

/** Attach catalog labels, computed derived markers, and the display-only
 * eGFR estimate (only when the panel has creatinine but no lab-printed eGFR).
 * P7.1: custom test rows label from the user's own definitions; the lab's
 * printed range wins, else the sex-aware catalog default (never neutral when
 * the patient's sex is on file). */
function decoratePanel(
  p: PanelRow,
  profile: { age: number | null; gender: string | null },
  customDefs: Record<string, CustomTestDef>,
): {
  id: string;
  name: string | null;
  labName: string | null;
  performedAt: string;
  sourceNote: string | null;
  results: DecoratedResult[];
} {
  const byKey = new Map(p.results.map((r) => [r.testKey, r]));
  const sex = profile.gender === 'male' || profile.gender === 'female' ? profile.gender : null;
  const out: DecoratedResult[] = p.results.map((r) => {
    const def = LAB_TEST_MAP[r.testKey];
    const custom = customDefs[r.testKey];
    const defaults = def ? pickDefaultRange(def, sex) : { refLow: custom?.refLow ?? undefined, refHigh: custom?.refHigh ?? undefined };
    return {
      testKey: r.testKey,
      label: def?.label ?? custom?.name ?? r.testKey,
      category: def?.category ?? null,
      unit: r.unit || def?.unit || custom?.unit || '',
      value: r.value,
      // The lab's printed range wins; the catalog default fills in when absent.
      refLow: r.refLow ?? defaults.refLow ?? null,
      refHigh: r.refHigh ?? defaults.refHigh ?? null,
      flag: r.flag ?? labFlagFor(r.value, r.refLow ?? defaults.refLow, r.refHigh ?? defaults.refHigh),
      direction: def?.direction ?? 'context',
      derived: false,
    };
  });

  // Derived markers - computed from THIS panel's inputs, never stored.
  const insulin = byKey.get('fasting_insulin');
  const fbg = byKey.get('fbg');
  if (insulin && fbg && !byKey.has('homa_ir')) {
    out.push({
      testKey: 'homa_ir', label: 'HOMA-IR', category: 'A', unit: '',
      value: homaIr(insulin.value, fbg.value), refLow: LAB_TEST_MAP.homa_ir.refLow ?? null,
      refHigh: LAB_TEST_MAP.homa_ir.refHigh ?? null, flag: null, direction: 'lower-better', derived: true,
    });
  }
  const tc = byKey.get('total_cholesterol');
  const hdl = byKey.get('hdl');
  if (tc && hdl && !byKey.has('non_hdl')) {
    out.push({
      testKey: 'non_hdl', label: 'Non-HDL cholesterol', category: 'B', unit: 'mg/dL',
      value: nonHdl(tc.value, hdl.value), refLow: LAB_TEST_MAP.non_hdl.refLow ?? null,
      refHigh: LAB_TEST_MAP.non_hdl.refHigh ?? null, flag: null, direction: 'lower-better', derived: true,
    });
  }
  const creatinine = byKey.get('creatinine');
  if (creatinine && !byKey.has('egfr') && profile.age) {
    const est = ckdEpiEgfr(creatinine.value, profile.age, (profile.gender as 'male' | 'female' | 'other') || 'other');
    if (est != null) {
      out.push({
        testKey: 'egfr', label: 'eGFR (estimated, display only)', category: 'A', unit: 'mL/min/1.73m2',
        value: est, refLow: LAB_TEST_MAP.egfr.refLow ?? null, refHigh: null, flag: null,
        direction: 'higher-better', derived: true,
      });
    }
  }

  out.sort((a, b) => (a.category ?? 'Z').localeCompare(b.category ?? 'Z') || a.label.localeCompare(b.label));
  return {
    id: p.id,
    name: p.name,
    labName: p.labName,
    performedAt: p.performedAt,
    sourceNote: p.sourceNote,
    results: out,
  };
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [panels, user, allResults, customTests] = await Promise.all([
    prisma.labPanel.findMany({
      where: { userId },
      orderBy: [{ performedAt: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      include: { results: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { age: true, gender: true } }),
    prisma.labResult.findMany({
      where: { userId },
      orderBy: [{ performedAt: 'asc' }],
      select: { testKey: true, value: true, unit: true, performedAt: true },
    }),
    prisma.customLabTest.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, unit: true, refLow: true, refHigh: true },
    }),
  ]);

  const customDefs: Record<string, CustomTestDef> = Object.fromEntries(
    customTests.map((t) => [`custom:${t.id}`, {
      key: `custom:${t.id}`,
      name: t.name,
      unit: t.unit,
      refLow: t.refLow,
      refHigh: t.refHigh,
    }]),
  );

  // Per-test trend series (>= 2 datapoints), catalog-labeled.
  const series = new Map<string, { date: string; value: number; unit: string }[]>();
  for (const r of allResults) {
    if (!series.has(r.testKey)) series.set(r.testKey, []);
    series.get(r.testKey)!.push({ date: r.performedAt, value: r.value, unit: r.unit });
  }
  const trends = [...series.entries()]
    .filter(([, pts]) => pts.length >= 2)
    .map(([testKey, points]) => ({
      testKey,
      label: LAB_TEST_MAP[testKey]?.label ?? customDefs[testKey]?.name ?? testKey,
      unit: LAB_TEST_MAP[testKey]?.unit ?? customDefs[testKey]?.unit ?? points[0].unit,
      direction: LAB_TEST_MAP[testKey]?.direction ?? 'context',
      points: points.map(({ date, value }) => ({ date, value })),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return NextResponse.json({
    categories: LAB_CATEGORIES,
    panels: panels.map((p) =>
      decoratePanel(
        {
          id: p.id, name: p.name, labName: p.labName, performedAt: p.performedAt,
          sourceNote: p.sourceNote,
          results: p.results.map((r) => ({
            testKey: r.testKey, value: r.value, unit: r.unit,
            refLow: r.refLow, refHigh: r.refHigh, flag: r.flag,
          })),
        },
        { age: user?.age ?? null, gender: user?.gender ?? null },
        customDefs,
      ),
    ),
    trends,
    customTests: Object.values(customDefs).map(({ refLow, refHigh, ...rest }) => ({
      ...rest,
      ...(refLow != null ? { refLow } : {}),
      ...(refHigh != null ? { refHigh } : {}),
    })),
  });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  // P7.1: the user's custom tests are valid testKeys alongside the catalog.
  const customTests = await prisma.customLabTest.findMany({
    where: { userId },
    select: { id: true },
  });

  const result = validateLabPanelInput(body as Parameters<typeof validateLabPanelInput>[0], {
    canonicalA1c: canonicalA1cPercent,
    customKeys: customTests.map((t) => `custom:${t.id}`),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const { name, labName, sourceNote, performedAt, results } = result.data;

  const panel = await prisma.labPanel.create({
    data: {
      userId,
      name: name || null,
      labName: labName || null,
      performedAt,
      sourceNote: sourceNote || null,
      results: {
        create: results.map((r) => ({
          userId,
          testKey: r.testKey,
          value: r.value,
          unit: r.unit,
          refLow: r.refLow ?? null,
          refHigh: r.refHigh ?? null,
          performedAt,
        })),
      },
    },
    include: { results: true },
  });

  // Dual-write: keep the legacy Lab/hba1c flow (and its /api/labs trend) fed.
  const a1c = results.find((r) => r.testKey === 'hba1c');
  if (a1c && a1c.unit === '%') {
    await prisma.lab.create({
      data: {
        userId, testType: 'hba1c', value: a1c.value, unit: '%',
        a1cPercent: a1c.value, performedAt,
        labName: labName || null, panelId: panel.id,
      },
    });
  } else if (a1c && a1c.unit === 'mmol/mol') {
    // validateLabPanelInput canonicalized value+unit to % already; reaching
    // here means a converter bypassed - store the canonical percent honestly.
    await prisma.lab.create({
      data: {
        userId, testType: 'hba1c', value: a1c.value, unit: '%',
        a1cPercent: a1c.value, performedAt,
        labName: labName || null, panelId: panel.id,
      },
    });
  }

  return NextResponse.json({ panel: { id: panel.id, performedAt: panel.performedAt, resultCount: panel.results.length } });
}

export async function DELETE(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const panel = await prisma.labPanel.findFirst({ where: { id, userId } });
  if (!panel) return NextResponse.json({ error: 'Panel not found' }, { status: 404 });

  // Mirrored legacy Lab rows go first (plain column - no FK to cascade).
  await prisma.lab.deleteMany({ where: { panelId: id, userId } });
  await prisma.labPanel.delete({ where: { id } }); // results cascade via FK
  return NextResponse.json({ ok: true });
}
