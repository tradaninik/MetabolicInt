// Phase 2c clinical data layer: pure math + validation + typed constants.
// Engine stays frozen; all Phase 2c logic lives app-side (pattern: food-validation.ts).
// No DB access in here on purpose - routes stay thin, this stays unit-testable.

// ---------- HbA1c <-> eAG (ADAG study) ----------

export const ADAG_SLOPE = 28.7;   // eAG (mg/dL) = 28.7 x A1c(%) - 46.7
export const ADAG_OFFSET = 46.7;

export function a1cToEagMgDl(a1cPercent: number): number {
  return Math.round(ADAG_SLOPE * a1cPercent - ADAG_OFFSET);
}

export function eagMgDlToMmolL(eagMgDl: number): number {
  return Math.round((eagMgDl / 18) * 10) / 10;
}

// IFCC: mmol/mol = 10.929 x (A1c% - 2.152), both directions.
export function percentToMmolMol(a1cPercent: number): number {
  return Math.round(10.929 * (a1cPercent - 2.152));
}

export function mmolMolToPercent(mmolMol: number): number {
  return Math.round((mmolMol / 10.929 + 2.152) * 100) / 100;
}

// Canonicalize any HbA1c lab row to percent, regardless of entry unit.
export function canonicalA1cPercent(value: number, unit: string): number {
  return unit === 'mmol/mol' ? mmolMolToPercent(value) : value;
}

export interface Hba1cLabInput {
  value: number;
  unit: string;        // '%' | 'mmol/mol'
  performedAt: string; // YYYY-MM-DD
}

export function validateHba1cLab(input: Hba1cLabInput): string | null {
  if (!Number.isFinite(input.value) || input.value <= 0) return 'Value must be a positive number.';
  if (input.unit !== '%' && input.unit !== 'mmol/mol') return "Unit must be '%' or 'mmol/mol'.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.performedAt)) return 'Date must be YYYY-MM-DD.';
  const a1c = canonicalA1cPercent(input.value, input.unit);
  if (a1c < 3 || a1c > 20) return 'HbA1c looks outside a plausible range (3-20%).';
  return null;
}

export interface Hba1cTrendPoint {
  date: string;      // YYYY-MM-DD
  a1cPercent: number;
  eagMgDl: number;
  eagMmolL: number;
}

// Lab rows -> chronological trend series (drops rows with unknown units).
export function hba1cTrend(labs: Hba1cLabInput[]): Hba1cTrendPoint[] {
  return labs
    .filter((l) => l.unit === '%' || l.unit === 'mmol/mol')
    .map((l) => {
      const a1c = canonicalA1cPercent(l.value, l.unit);
      const eag = a1cToEagMgDl(a1c);
      return { date: l.performedAt, a1cPercent: a1c, eagMgDl: eag, eagMmolL: eagMgDlToMmolL(eag) };
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// ---------- Educational target ranges ----------
// Nulls in UserSettings mean "still on educational defaults";
// explicitly set bounds (e.g. set on a doctor's advice) always take precedence.

export const EDUCATIONAL_TARGETS = {
  fasting: { low: 80, high: 130 },
  premeal: { low: 80, high: 130 },
  postprandial: { low: 80, high: 180 },
  bedtime: { low: 100, high: 140 },
} as const;

export type TargetPair = { low: number; high: number };

export interface TargetSettingsLike {
  tFastingLow: number | null;      tFastingHigh: number | null;
  tPremealLow: number | null;      tPremealHigh: number | null;
  tPostprandialLow: number | null; tPostprandialHigh: number | null;
  tBedtimeLow: number | null;      tBedtimeHigh: number | null;
}

const pair = (low: number | null, high: number | null, d: TargetPair): TargetPair => ({
  low: low ?? d.low,
  high: high ?? d.high,
});

export function resolveTargets(s: TargetSettingsLike | null): {
  fasting: TargetPair; premeal: TargetPair; postprandial: TargetPair; bedtime: TargetPair;
} {
  return {
    fasting:      pair(s?.tFastingLow ?? null,      s?.tFastingHigh ?? null,      EDUCATIONAL_TARGETS.fasting),
    premeal:      pair(s?.tPremealLow ?? null,      s?.tPremealHigh ?? null,      EDUCATIONAL_TARGETS.premeal),
    postprandial: pair(s?.tPostprandialLow ?? null, s?.tPostprandialHigh ?? null, EDUCATIONAL_TARGETS.postprandial),
    bedtime:      pair(s?.tBedtimeLow ?? null,      s?.tBedtimeHigh ?? null,      EDUCATIONAL_TARGETS.bedtime),
  };
}

// ---------- Medication adherence (display only - no doses anywhere) ----------

export interface MedScheduleLike {
  id: string;
  scheduleTimes: string; // JSON array of "HH:MM"
  isActive: boolean;
}

export interface MedLogLike {
  medicationId: string;
  logDate: string;  // YYYY-MM-DD
  slotTime: string; // HH:MM
  status: string;   // 'taken' | 'skipped'
}

export interface AdherenceResult {
  expected: number;    // past slots in window (the denominator)
  taken: number;
  skipped: number;     // explicitly marked skipped
  pending: number;     // past slots still without any log row
  pct: number | null;  // null when expected === 0 (nothing to score yet)
}

// Iterate YYYY-MM-DD dates inclusive; empty when from > to or unparseable.
export function eachDate(from: string, to: string): string[] {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return [];
  const out: string[] = [];
  for (let ms = start; ms <= end; ms += 86400000) out.push(new Date(ms).toISOString().slice(0, 10));
  return out;
}

export function computeAdherence(
  meds: MedScheduleLike[],
  logs: MedLogLike[],
  opts: { from: string; to: string; asOf: string }, // asOf = 'YYYY-MM-DDTHH:MM'
): AdherenceResult {
  const logMap = new Map<string, string>();
  for (const l of logs) logMap.set(`${l.medicationId}|${l.logDate}|${l.slotTime}`, l.status);

  const asOfDate = opts.asOf.slice(0, 10);
  const asOfTime = opts.asOf.slice(11, 16);

  let expected = 0, taken = 0, skipped = 0, pending = 0;

  for (const med of meds) {
    if (!med.isActive) continue;
    let times: string[] = [];
    try {
      const parsed = JSON.parse(med.scheduleTimes);
      if (Array.isArray(parsed)) times = parsed.filter((t): t is string => typeof t === 'string');
    } catch { /* invalid JSON -> this med contributes no slots */ }

    for (const d of eachDate(opts.from, opts.to)) {
      const wholeDayPast = d < asOfDate;
      const isToday = d === asOfDate;
      for (const slot of times) {
        if (!(wholeDayPast || (isToday && slot <= asOfTime))) continue; // future slot - not scoreable yet
        expected++;
        const status = logMap.get(`${med.id}|${d}|${slot}`);
        if (status === 'taken') taken++;
        else if (status === 'skipped') skipped++;
        else pending++;
      }
    }
  }

  return {
    expected, taken, skipped, pending,
    pct: expected === 0 ? null : Math.round((taken / expected) * 100),
  };
}

// ---------- Day-context tags (associations from the user's notes, never causes) ----------

export const DAY_CONTEXT_TAGS = [
  'stress', 'poor-sleep', 'travel', 'illness', 'festival', 'eating-out',
  'heavy-meal', 'missed-exercise', 'period', 'fasting',
] as const;

export type DayContextTagValue = (typeof DAY_CONTEXT_TAGS)[number];

export const DAY_TAG_LABELS: Record<DayContextTagValue, string> = {
  'stress': 'Stressful day',
  'poor-sleep': 'Poor sleep',
  'travel': 'Travel day',
  'illness': 'Illness',
  'festival': 'Festival',
  'eating-out': 'Ate out',
  'heavy-meal': 'Heavy meal',
  'missed-exercise': 'Missed exercise',
  'period': 'Period',
  'fasting': 'Fasting day',
};

export function validateDayTag(input: { tag: string; tagDate: string; note?: string | null }): string | null {
  if (!(DAY_CONTEXT_TAGS as readonly string[]).includes(input.tag)) return 'Unknown tag.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.tagDate)) return 'Date must be YYYY-MM-DD.';
  if (input.note && input.note.length > 200) return 'Note must be 200 characters or fewer.';
  return null;
}

// ---------- IST clock helper ----------
// Asia/Kolkata is the app's audience timezone (same convention as fmtWhen on
// the log page). 'YYYY-MM-DDTHH:MM' is exactly what computeAdherence expects.
export function istNow(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}