// P6-e — report-to-report comparison: what went up, what went down, and what
// you logged in between.
//
// Pure logic only. Rows carry direction-aware tones (HDL up = better, LDL up
// = worse, context tests neutral) computed from the catalog's direction
// field - never a medical judgment. The "between your reports" context is
// plain aggregation over existing model rows. Association notes are
// rule-based and HEDGED: "logged together, not proven cause" - the app's
// standing content policy for anything habit-related.

import { LAB_TEST_MAP, homaIr, nonHdl, type LabDirection } from './labs';

export interface PanelInput {
  performedAt: string; // YYYY-MM-DD (A = older, B = newer by convention)
  name?: string | null;
  values: Record<string, { value: number; unit?: string }>;
}

export interface CompareRow {
  testKey: string;
  label: string;
  unit: string;
  category: string | null;
  direction: LabDirection | 'unknown';
  a: number | null;
  b: number | null;
  deltaAbs: number | null; // b - a
  deltaPct: number | null; // (b - a) / a * 100
  arrow: 'up' | 'down' | 'flat' | null;
  tone: 'better' | 'worse' | 'neutral' | null;
  derived: boolean;
}

export interface CompareResult {
  rows: CompareRow[];
  /** derived markers that could be computed for each panel (display hint) */
  derivedKeys: string[];
}

/** Derived markers for one panel from its raw inputs (never stored). */
export function derivedPanelValues(values: PanelInput['values']): PanelInput['values'] {
  const out: PanelInput['values'] = {};
  const insulin = values.fasting_insulin?.value;
  const fbg = values.fbg?.value;
  if (insulin != null && fbg != null && values.homa_ir == null) {
    out.homa_ir = { value: homaIr(insulin, fbg) };
  }
  const tc = values.total_cholesterol?.value;
  const hdl = values.hdl?.value;
  if (tc != null && hdl != null && values.non_hdl == null) {
    out.non_hdl = { value: nonHdl(tc, hdl) };
  }
  return out;
}

/**
 * Compare panel A (older) against panel B (newer). Every test present in
 * EITHER panel gets a row; one-sided rows show nulls with no tone. Derived
 * markers (HOMA-IR, non-HDL) are computed per panel before comparing.
 */
export function compareLabPanels(a: PanelInput, b: PanelInput): CompareResult {
  const aValues = { ...a.values, ...derivedPanelValues(a.values) };
  const bValues = { ...b.values, ...derivedPanelValues(b.values) };
  const derivedKeys = Object.keys({ ...derivedPanelValues(a.values), ...derivedPanelValues(b.values) });

  const keys = [...new Set([...Object.keys(aValues), ...Object.keys(bValues)])].sort((x, y) => {
    const da = LAB_TEST_MAP[x]?.category ?? 'Z';
    const db = LAB_TEST_MAP[y]?.category ?? 'Z';
    return da.localeCompare(db) || (LAB_TEST_MAP[x]?.label ?? x).localeCompare(LAB_TEST_MAP[y]?.label ?? y);
  });

  const rows: CompareRow[] = keys.map((key) => {
    const def = LAB_TEST_MAP[key];
    const av = aValues[key]?.value ?? null;
    const bv = bValues[key]?.value ?? null;
    const deltaAbs = av != null && bv != null ? round2(bv - av) : null;
    const deltaPct =
      av != null && bv != null && av !== 0 ? round2(((bv - av) / Math.abs(av)) * 100) : null;
    const arrow =
      deltaAbs == null ? null : deltaAbs > 0 ? 'up' : deltaAbs < 0 ? 'down' : 'flat';
    const direction: LabDirection | 'unknown' = def?.direction ?? 'unknown';
    let tone: CompareRow['tone'] = null;
    if (arrow === 'up' || arrow === 'down') {
      if (direction === 'lower-better') tone = arrow === 'down' ? 'better' : 'worse';
      else if (direction === 'higher-better') tone = arrow === 'up' ? 'better' : 'worse';
      else tone = 'neutral';
    } else if (arrow === 'flat') {
      tone = 'neutral';
    }
    return {
      testKey: key,
      label: def?.label ?? key,
      unit: def?.unit ?? bValues[key]?.unit ?? aValues[key]?.unit ?? '',
      category: def?.category ?? null,
      direction,
      a: av,
      b: bv,
      deltaAbs,
      deltaPct,
      arrow,
      tone,
      derived: derivedKeys.includes(key),
    };
  });

  return { rows, derivedKeys };
}

// ---------- Between-reports context (aggregation over existing models) ----------

export interface BetweenContextInput {
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
  meals: { kcal: number; carbsG: number; fiberG: number; proteinG: number; loggedAt: string | number | Date }[];
  activity: { durationMin: number; at: string | number | Date }[];
  sleep: { hours: number; wokeAt: string | number | Date }[];
  weights: { kg: number; takenAt: string | number | Date }[];
  glucose: { value: number; source: string; takenAt: string | number | Date }[];
  medsExpected: number; // scored slots in window (from computeAdherence)
  medsTaken: number;
  bp: { systolic: number; diastolic: number; takenAt: string | number | Date }[];
}

export interface BetweenContext {
  days: number;
  mealsLogged: number;
  avgDailyKcal: number | null;
  avgDailyCarbsG: number | null;
  avgDailyFiberG: number | null;
  avgDailyProteinG: number | null;
  activitySessions: number;
  activityMinutes: number;
  avgSleepHours: number | null;
  weightChangeKg: number | null;
  avgGlucoseMgDl: number | null;
  cgmReadings: number;
  medsTakenPct: number | null;
  avgSystolic: number | null;
  avgDiastolic: number | null;
}

const DAY_MS = 86_400_000;

function inWindow(t: string | number | Date, fromMs: number, toMs: number): boolean {
  const ms = t instanceof Date ? t.getTime() : new Date(t).getTime();
  return Number.isFinite(ms) && ms >= fromMs && ms <= toMs + DAY_MS; // to-date inclusive
}

function mean(xs: number[]): number | null {
  return xs.length === 0 ? null : round1(xs.reduce((s, x) => s + x, 0) / xs.length);
}

export function betweenReportsContext(input: BetweenContextInput): BetweenContext {
  const fromMs = new Date(`${input.from}T00:00:00Z`).getTime();
  const toMs = new Date(`${input.to}T23:59:59Z`).getTime();
  const days = Math.max(1, Math.round((toMs - fromMs) / DAY_MS) + 1);

  const meals = input.meals.filter((m) => inWindow(m.loggedAt, fromMs, toMs));
  const activity = input.activity.filter((a) => inWindow(a.at, fromMs, toMs));
  const sleep = input.sleep.filter((s) => inWindow(s.wokeAt, fromMs, toMs));
  const weights = input.weights.filter((w) => inWindow(w.takenAt, fromMs, toMs));
  const glucose = input.glucose.filter((g) => inWindow(g.takenAt, fromMs, toMs));
  const bp = input.bp.filter((p) => inWindow(p.takenAt, fromMs, toMs));

  // Per-day averaging uses actual distinct logging days when the user logs
  // intermittently (kcal/day over logged days), which stays honest.
  const mealDays = new Set(meals.map((m) => new Date(m.loggedAt).toISOString().slice(0, 10)));
  const dd = Math.max(1, mealDays.size);

  const sortedWeights = [...weights].sort((x, y) => new Date(x.takenAt).getTime() - new Date(y.takenAt).getTime());
  const firstW = sortedWeights[0]?.kg;
  const lastW = sortedWeights.at(-1)?.kg;

  const systolics = bp.map((p) => p.systolic);
  const diastolics = bp.map((p) => p.diastolic);

  return {
    days,
    mealsLogged: meals.length,
    avgDailyKcal: meals.length ? Math.round(meals.reduce((s, m) => s + m.kcal, 0) / dd) : null,
    avgDailyCarbsG: meals.length ? round1(meals.reduce((s, m) => s + m.carbsG, 0) / dd) : null,
    avgDailyFiberG: meals.length ? round1(meals.reduce((s, m) => s + m.fiberG, 0) / dd) : null,
    avgDailyProteinG: meals.length ? round1(meals.reduce((s, m) => s + m.proteinG, 0) / dd) : null,
    activitySessions: activity.length,
    activityMinutes: Math.round(activity.reduce((s, a) => s + a.durationMin, 0)),
    avgSleepHours: mean(sleep.map((s) => s.hours)),
    weightChangeKg: firstW != null && lastW != null ? round1(lastW - firstW) : null,
    avgGlucoseMgDl: mean(glucose.map((g) => g.value)),
    cgmReadings: glucose.filter((g) => g.source === 'cgm').length,
    medsTakenPct: input.medsExpected > 0 ? Math.round((input.medsTaken / input.medsExpected) * 100) : null,
    avgSystolic: mean(systolics),
    avgDiastolic: mean(diastolics),
  };
}

// ---------- Rule-based, hedged association notes ----------

/**
 * Build 0-4 association notes pairing a marker change with context changes.
 * Every sentence is hedged: "logged together, not proven cause" - the app
 * never claims a habit caused a lab change.
 */
export function comparisonNotes(
  rows: CompareRow[],
  ctx: BetweenContext,
  a: { performedAt: string },
  b: { performedAt: string },
): string[] {
  const notes: string[] = [];
  const byKey = new Map(rows.map((r) => [r.testKey, r]));
  const row = (k: string) => byKey.get(k);
  const fmt = (n: number | null | undefined, unit = '') => (n == null ? '?' : `${round2(n)}${unit ? ' ' + unit : ''}`);

  // 1. HbA1c vs fiber.
  const a1c = row('hba1c');
  if (a1c?.deltaAbs != null && a1c.deltaAbs !== 0 && ctx.avgDailyFiberG != null) {
    const dir = a1c.deltaAbs < 0 ? 'fell' : 'rose';
    notes.push(
      `Your HbA1c ${dir} ${fmt(Math.abs(a1c.deltaAbs), 'points')} between ${a.performedAt} and ${b.performedAt}, while your average daily fiber on logged days was about ${ctx.avgDailyFiberG} g - logged together, not proven cause.`,
    );
  }

  // 2. Lipids vs activity.
  const ldl = row('ldl');
  const tg = row('triglycerides');
  if ((ldl?.deltaAbs != null && ldl.deltaAbs !== 0) || (tg?.deltaAbs != null && tg.deltaAbs !== 0)) {
    const moved = ldl?.deltaAbs != null && ldl.deltaAbs !== 0 ? ldl : tg;
    if (moved && ctx.activityMinutes > 0) {
      const dir = (moved.deltaAbs ?? 0) < 0 ? 'fell' : 'rose';
      notes.push(
        `${moved.label} ${dir} ${fmt(Math.abs(moved.deltaAbs ?? 0), moved.unit)} across a period with ${ctx.activitySessions} logged activity sessions (${ctx.activityMinutes} min) - an association, not a proven effect.`,
      );
    }
  }

  // 3. Weight change (always worth a line when present).
  if (ctx.weightChangeKg != null && ctx.weightChangeKg !== 0) {
    const dir = ctx.weightChangeKg < 0 ? 'down' : 'up';
    notes.push(
      `Weight went ${dir} ${fmt(Math.abs(ctx.weightChangeKg), 'kg')} between the reports, with ${ctx.mealsLogged} meals logged.`,
    );
  }

  // 4. Meds adherence stands on its own.
  if (ctx.medsTakenPct != null) {
    notes.push(
      `Medication slots marked taken: ${ctx.medsTakenPct}% of scored slots in the period - context for your doctor, not a judgment.`,
    );
  }

  // 5. Glucose consistency when both moved the same way.
  const glucose = ctx.avgGlucoseMgDl;
  if (a1c?.arrow && glucose != null && a1c.deltaAbs != null && a1c.deltaAbs !== 0) {
    notes.push(
      `Your meter average between the reports was ${glucose} mg/dL (HbA1c ${a1c.a}% -> ${a1c.b}%) - two views of the same months.`,
    );
  }

  return notes.slice(0, 4);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
