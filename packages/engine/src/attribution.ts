// Attribution (dashboard revamp item 4): "Why was it high?"
//
// When a reading sits ABOVE the user's usual pattern at that hour, rank the
// candidate factors recorded around it. The engine speaks EXACTLY three
// labels - observed pattern / possible contributor / insufficient data -
// and every sentence it produces describes ASSOCIATION (what the records
// show), never causation (what made it happen). No factor "raised" glucose;
// at most it "differed from usual on a day the reading did too".
//
// Pure and deterministic: rows in, ranked rows out.

import { MIN_PATTERN_N } from './patterns';

export type AttributionLabel = 'observed pattern' | 'possible contributor' | 'insufficient data';

export const ATTRIBUTION_LABELS: readonly AttributionLabel[] = [
  'observed pattern',
  'possible contributor',
  'insufficient data',
];

export type AttributionFactor = 'meal' | 'medication' | 'activity' | 'sleep' | 'stress';

export interface AttributionRow {
  factor: AttributionFactor;
  label: AttributionLabel;
  /** what the user's own records show - association wording only */
  text: string;
  /** how many of the user's records this row is based on */
  evidenceCount: number;
}

export interface AttributionInput {
  reading: { value: number; takenAt: number };
  usual: { median: number | null; n: number };
  /** reading minus usual median; null when no pattern exists yet */
  deviation: number | null;
  /** meals logged today before the reading (any window) */
  mealsBefore: { takenAt: number; carbsG: number; name: string }[];
  /** carbs of the same-slot meals on prior days (the comparison basis) */
  comparableMealCarbs: number[];
  /** medication slots scheduled today BEFORE the reading */
  medSlotsBefore: { name: string; slotTime: string; status: 'taken' | 'skipped' | 'planned' }[];
  steps: { today: number; usualAvg: number | null };
  sleep: { lastNight: number | null; usualAvg: number | null };
  /** day-context tags recorded today (stress notes, travel, ...) */
  contextNotes: { tag: string; note?: string }[];
}

export interface AttributionResult {
  /** true only when the reading is genuinely above the user's usual pattern */
  triggered: boolean;
  /** always computed - the calm state still shows the factor table */
  rows: AttributionRow[];
  totalEvidence: number;
}

/** A meal counts as "larger than usual" at +20 g carbs over the slot average. */
export const MEAL_CARB_DIFF_G = 20;
/** Steps below 60% of the usual average count as a difference worth flagging. */
export const STEPS_LOW_FRACTION = 0.6;
/** Sleep at least 45 min shorter than usual counts as a difference. */
export const SLEEP_SHORT_H = 0.75;
/** Mg/dL above usual before the investigation card triggers (mirrors the glucose card). */
export const DEVIATION_TRIGGER_MGDL = 15;

/**
 * Rank the candidate factors behind an above-pattern reading. The reading
 * itself decides `triggered`; the rows are computed either way so the UI can
 * show the calm ("within your usual range") state with the same table.
 */
export function attributeDeviation(
  input: AttributionInput,
  opts: { deviationTriggerMgDl?: number } = {},
): AttributionResult {
  const trigger = opts.deviationTriggerMgDl ?? DEVIATION_TRIGGER_MGDL;
  const triggered =
    input.deviation !== null &&
    input.deviation >= trigger &&
    input.usual.n >= MIN_PATTERN_N;

  const rows: AttributionRow[] = [
    mealRow(input),
    medicationRow(input),
    activityRow(input),
    sleepRow(input),
    stressRow(input),
  ];
  return { triggered, rows, totalEvidence: rows.reduce((a, r) => a + r.evidenceCount, 0) };
}

// --- meal ------------------------------------------------------------------

function mealRow(input: AttributionInput): AttributionRow {
  const within4h = input.mealsBefore.filter(
    (m) => m.takenAt <= input.reading.takenAt && m.takenAt >= input.reading.takenAt - 4 * 3_600_000,
  );
  const last = within4h.at(-1);
  if (!last) {
    return {
      factor: 'meal',
      label: 'insufficient data',
      text: 'no meal logged in the 4 h before this reading',
      evidenceCount: input.mealsBefore.length,
    };
  }
  if (input.comparableMealCarbs.length < 2) {
    return {
      factor: 'meal',
      label: 'insufficient data',
      text: `${last.name} logged, but only ${input.comparableMealCarbs.length} comparable day${input.comparableMealCarbs.length === 1 ? '' : 's'} to compare yet`,
      evidenceCount: 1 + input.comparableMealCarbs.length,
    };
  }
  const avg = mean(input.comparableMealCarbs);
  if (last.carbsG >= avg + MEAL_CARB_DIFF_G) {
    return {
      factor: 'meal',
      label: 'possible contributor',
      text: `${last.name}: ${Math.round(last.carbsG)} g carbs vs your usual ${Math.round(avg)} g for this slot`,
      evidenceCount: 1 + input.comparableMealCarbs.length,
    };
  }
  return {
    factor: 'meal',
    label: 'observed pattern',
    text: `${last.name} on par with your usual ${Math.round(avg)} g — no difference vs comparable days`,
    evidenceCount: 1 + input.comparableMealCarbs.length,
  };
}

// --- medication --------------------------------------------------------------

function medicationRow(input: AttributionInput): AttributionRow {
  const slots = input.medSlotsBefore;
  if (!slots.length) {
    return { factor: 'medication', label: 'insufficient data', text: 'no medication scheduled today', evidenceCount: 0 };
  }
  const missed = slots.filter((s) => s.status !== 'taken');
  if (missed.length) {
    return {
      factor: 'medication',
      label: 'possible contributor',
      text: `${missed.map((m) => `${m.name} ${m.slotTime}`).join(', ')} scheduled but not logged as taken`,
      evidenceCount: slots.length,
    };
  }
  return {
    factor: 'medication',
    label: 'observed pattern',
    text: `${slots.length === 1 ? slots[0].name : `${slots.length} doses`} logged on schedule before this reading`,
    evidenceCount: slots.length,
  };
}

// --- activity ----------------------------------------------------------------

function activityRow(input: AttributionInput): AttributionRow {
  const { today, usualAvg } = input.steps;
  if (usualAvg === null || usualAvg <= 0) {
    return { factor: 'activity', label: 'insufficient data', text: 'building your steps baseline', evidenceCount: 1 };
  }
  if (today < STEPS_LOW_FRACTION * usualAvg) {
    const pct = Math.round(((usualAvg - today) / usualAvg) * 100);
    return {
      factor: 'activity',
      label: 'possible contributor',
      text: `${today.toLocaleString('en-IN')} steps so far vs your ${usualAvg.toLocaleString('en-IN')} usual — ${pct}% below`,
      evidenceCount: 8,
    };
  }
  return {
    factor: 'activity',
    label: 'observed pattern',
    text: `${today.toLocaleString('en-IN')} steps — on par with your usual ${usualAvg.toLocaleString('en-IN')}`,
    evidenceCount: 8,
  };
}

// --- sleep ---------------------------------------------------------------------

function sleepRow(input: AttributionInput): AttributionRow {
  const { lastNight, usualAvg } = input.sleep;
  if (lastNight === null || usualAvg === null) {
    return { factor: 'sleep', label: 'insufficient data', text: 'no sleep history to compare yet', evidenceCount: 0 };
  }
  if (lastNight <= usualAvg - SLEEP_SHORT_H) {
    return {
      factor: 'sleep',
      label: 'possible contributor',
      text: `${lastNight.toFixed(1)} h last night vs your usual ${usualAvg.toFixed(1)} h`,
      evidenceCount: 8,
    };
  }
  return {
    factor: 'sleep',
    label: 'observed pattern',
    text: `${lastNight.toFixed(1)} h — close to your usual ${usualAvg.toFixed(1)} h`,
    evidenceCount: 8,
  };
}

// --- stress / context -------------------------------------------------------------

function stressRow(input: AttributionInput): AttributionRow {
  const notes = input.contextNotes;
  if (!notes.length) {
    return { factor: 'stress', label: 'insufficient data', text: 'no context tags recorded today', evidenceCount: 0 };
  }
  // A single day's note is one observation, not a pattern - the engine
  // refuses to promote it beyond "insufficient data" no matter how
  // suggestive it looks. That restraint is the point.
  const first = notes[0];
  const quoted = first.note ? `"${first.note}"` : first.tag;
  return {
    factor: 'stress',
    label: 'insufficient data',
    text: `${quoted} tagged today — a single note is not yet a pattern`,
    evidenceCount: notes.length,
  };
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
