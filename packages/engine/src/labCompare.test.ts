// P6-e — comparison tests: delta math, direction-aware tones, derived-marker
// inclusion, between-reports aggregation, and the hedged-association phrasing
// ("logged together, not proven cause") that the content policy requires.
import { describe, expect, it } from 'vitest';
import {
  compareLabPanels,
  derivedPanelValues,
  betweenReportsContext,
  comparisonNotes,
  type PanelInput,
  type BetweenContextInput,
} from './labCompare';

const panel = (performedAt: string, values: Record<string, number>): PanelInput => ({
  performedAt,
  values: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { value: v }])),
});

describe('compareLabPanels', () => {
  it('computes absolute + percent deltas with b - a convention', () => {
    const r = compareLabPanels(panel('2026-07-15', { hba1c: 7.4 }), panel('2026-10-15', { hba1c: 6.8 }));
    const a1c = r.rows[0];
    expect(a1c.a).toBe(7.4);
    expect(a1c.b).toBe(6.8);
    expect(a1c.deltaAbs).toBeCloseTo(-0.6, 2);
    expect(a1c.deltaPct).toBeCloseTo(-8.11, 1);
    expect(a1c.arrow).toBe('down');
  });

  it('direction-aware tones: HDL up = better, LDL up = worse, context neutral', () => {
    const r = compareLabPanels(
      panel('2026-07-15', { hdl: 38, ldl: 120, tsh: 2.0 }),
      panel('2026-10-15', { hdl: 44, ldl: 132, tsh: 2.6 }),
    );
    const byKey = new Map(r.rows.map((x) => [x.testKey, x]));
    expect(byKey.get('hdl')?.tone).toBe('better'); // higher-better, up
    expect(byKey.get('hdl')?.arrow).toBe('up');
    expect(byKey.get('ldl')?.tone).toBe('worse'); // lower-better, up
    expect(byKey.get('tsh')?.tone).toBe('neutral'); // context
    expect(byKey.get('tsh')?.direction).toBe('context');
  });

  it('same-direction flip: HDL down = worse, LDL down = better, flat = neutral', () => {
    const r = compareLabPanels(
      panel('2026-07-15', { hdl: 44, ldl: 132 }),
      panel('2026-10-15', { hdl: 38, ldl: 118 }),
    );
    const byKey = new Map(r.rows.map((x) => [x.testKey, x]));
    expect(byKey.get('hdl')?.tone).toBe('worse');
    expect(byKey.get('ldl')?.tone).toBe('better');
  });

  it('derived markers (HOMA-IR, non-HDL) are computed per panel and compared too', () => {
    const a = panel('2026-07-15', { fasting_insulin: 16, fbg: 112, total_cholesterol: 210, hdl: 40 });
    const b = panel('2026-10-15', { fasting_insulin: 11, fbg: 102, total_cholesterol: 195, hdl: 46 });
    const r = compareLabPanels(a, b);
    const byKey = new Map(r.rows.map((x) => [x.testKey, x]));
    // A: 16*112/405 = 4.42; B: 11*102/405 = 2.77
    expect(byKey.get('homa_ir')?.a).toBeCloseTo(4.42, 1);
    expect(byKey.get('homa_ir')?.b).toBeCloseTo(2.77, 1);
    expect(byKey.get('homa_ir')?.tone).toBe('better'); // lower-better, down
    expect(byKey.get('homa_ir')?.derived).toBe(true);
    // A: 170; B: 149
    expect(byKey.get('non_hdl')?.a).toBeCloseTo(170, 0);
    expect(byKey.get('non_hdl')?.b).toBeCloseTo(149, 0);
    // A stored homa_ir value would win over the derivation:
    expect(derivedPanelValues({ homa_ir: { value: 5 }, fasting_insulin: { value: 16 }, fbg: { value: 112 } })).toEqual({});
  });

  it('one-sided rows show nulls with no tone, union of keys is sorted by category', () => {
    const r = compareLabPanels(
      panel('2026-07-15', { hba1c: 7.0, vitamin_d: 18 }),
      panel('2026-10-15', { hba1c: 6.4 }),
    );
    const byKey = new Map(r.rows.map((x) => [x.testKey, x]));
    expect(byKey.get('vitamin_d')?.a).toBe(18);
    expect(byKey.get('vitamin_d')?.b).toBeNull();
    expect(byKey.get('vitamin_d')?.tone).toBeNull();
    expect(byKey.get('vitamin_d')?.deltaAbs).toBeNull();
    // hba1c (category A) sorts before vitamin_d (category D).
    expect(r.rows[0].testKey).toBe('hba1c');
  });
});

describe('betweenReportsContext', () => {
  const base: BetweenContextInput = {
    from: '2026-07-15',
    to: '2026-10-15',
    meals: [],
    activity: [],
    sleep: [],
    weights: [],
    glucose: [],
    medsExpected: 0,
    medsTaken: 0,
    bp: [],
  };

  it('aggregates meals per LOGGED day (not calendar day) and keeps the window inclusive', () => {
    const ctx = betweenReportsContext({
      ...base,
      meals: [
        { kcal: 500, carbsG: 60, fiberG: 8, proteinG: 20, loggedAt: '2026-07-20T10:00:00Z' },
        { kcal: 700, carbsG: 80, fiberG: 10, proteinG: 30, loggedAt: '2026-07-20T20:00:00Z' },
        { kcal: 300, carbsG: 30, fiberG: 4, proteinG: 10, loggedAt: '2026-09-01T08:00:00Z' },
        { kcal: 999, carbsG: 99, fiberG: 9, proteinG: 99, loggedAt: '2026-11-01T08:00:00Z' }, // outside
      ],
    });
    expect(ctx.mealsLogged).toBe(3);
    expect(ctx.days).toBe(94); // Jul 15 - Oct 15 inclusive
    expect(ctx.avgDailyKcal).toBe(750); // 1500 kcal over 2 logged days
    expect(ctx.avgDailyFiberG).toBe(11); // (8+10+4)/2
    expect(ctx.avgDailyCarbsG).toBe(85);
  });

  it('activity, sleep, weight change, glucose + CGM count, meds %, and BP averages', () => {
    const ctx = betweenReportsContext({
      ...base,
      activity: [
        { durationMin: 30, at: '2026-08-01T07:00:00Z' },
        { durationMin: 45, at: '2026-08-15T07:00:00Z' },
      ],
      sleep: [
        { hours: 7, wokeAt: '2026-08-01T07:00:00Z' },
        { hours: 6, wokeAt: '2026-08-15T07:00:00Z' },
        { hours: 8, wokeAt: '2026-09-01T07:00:00Z' },
      ],
      weights: [
        { kg: 78.2, takenAt: '2026-07-16T07:00:00Z' },
        { kg: 76.4, takenAt: '2026-10-10T07:00:00Z' },
      ],
      glucose: [
        { value: 140, source: 'manual', takenAt: '2026-08-01T09:00:00Z' },
        { value: 150, source: 'cgm', takenAt: '2026-08-02T09:00:00Z' },
        { value: 160, source: 'cgm', takenAt: '2026-08-03T09:00:00Z' },
      ],
      medsExpected: 100,
      medsTaken: 82,
      bp: [
        { systolic: 128, diastolic: 82, takenAt: '2026-08-01T08:00:00Z' },
        { systolic: 132, diastolic: 86, takenAt: '2026-09-01T08:00:00Z' },
      ],
    });
    expect(ctx.activitySessions).toBe(2);
    expect(ctx.activityMinutes).toBe(75);
    expect(ctx.avgSleepHours).toBe(7);
    expect(ctx.weightChangeKg).toBeCloseTo(-1.8, 1);
    expect(ctx.avgGlucoseMgDl).toBe(150);
    expect(ctx.cgmReadings).toBe(2);
    expect(ctx.medsTakenPct).toBe(82);
    expect(ctx.avgSystolic).toBe(130);
    expect(ctx.avgDiastolic).toBe(84);
  });

  it('empty window yields nulls, never NaN', () => {
    const ctx = betweenReportsContext(base);
    expect(ctx.avgDailyKcal).toBeNull();
    expect(ctx.avgSleepHours).toBeNull();
    expect(ctx.weightChangeKg).toBeNull();
    expect(ctx.avgGlucoseMgDl).toBeNull();
    expect(ctx.medsTakenPct).toBeNull();
    expect(ctx.avgSystolic).toBeNull();
  });
});

describe('comparisonNotes (hedged associations, never causes)', () => {
  const rows = compareLabPanels(
    panel('2026-07-15', { hba1c: 7.4, ldl: 120, hdl: 38 }),
    panel('2026-10-15', { hba1c: 6.8, ldl: 108, hdl: 44 }),
  ).rows;

  it('pairs the HbA1c fall with fiber and hedges explicitly', () => {
    const ctx = betweenReportsContext({
      from: '2026-07-15',
      to: '2026-10-15',
      meals: [{ kcal: 1800, carbsG: 200, fiberG: 26, proteinG: 70, loggedAt: '2026-08-01T10:00:00Z' }],
      activity: [],
      sleep: [],
      weights: [],
      glucose: [],
      medsExpected: 0,
      medsTaken: 0,
      bp: [],
    });
    const notes = comparisonNotes(rows, ctx, { performedAt: '2026-07-15' }, { performedAt: '2026-10-15' });
    const fiberNote = notes.find((n) => n.includes('fiber'));
    expect(fiberNote).toBeDefined();
    expect(fiberNote).toContain('fell 0.6 points');
    expect(fiberNote).toContain('not proven cause');
  });

  it('activity note is an association, meds note carries no judgment', () => {
    const ctx = betweenReportsContext({
      from: '2026-07-15',
      to: '2026-10-15',
      meals: [],
      activity: [{ durationMin: 30, at: '2026-08-01T07:00:00Z' }],
      sleep: [],
      weights: [{ kg: 78, takenAt: '2026-07-16T07:00:00Z' }, { kg: 76.5, takenAt: '2026-10-10T07:00:00Z' }],
      glucose: [],
      medsExpected: 60,
      medsTaken: 51,
      bp: [],
    });
    const notes = comparisonNotes(rows, ctx, { performedAt: '2026-07-15' }, { performedAt: '2026-10-15' });
    expect(notes.some((n) => n.includes('association, not a proven effect'))).toBe(true);
    expect(notes.some((n) => n.includes('Weight went down 1.5 kg'))).toBe(true);
    expect(notes.some((n) => n.includes('85%') && n.includes('not a judgment'))).toBe(true);
    expect(notes.length).toBeLessThanOrEqual(4);
  });

  it('no notes when nothing changed and no context exists', () => {
    const flatRows = compareLabPanels(panel('2026-07-15', { hba1c: 6.8 }), panel('2026-10-15', { hba1c: 6.8 })).rows;
    const ctx = betweenReportsContext({
      from: '2026-07-15', to: '2026-10-15', meals: [], activity: [], sleep: [],
      weights: [], glucose: [], medsExpected: 0, medsTaken: 0, bp: [],
    });
    expect(comparisonNotes(flatRows, ctx, { performedAt: '2026-07-15' }, { performedAt: '2026-10-15' })).toEqual([]);
  });
});
