// "Your usual pattern" math for the dashboard metric cards (revamp item 2)
// and the glucose-chart forecast + attribution (items 3-4).
//
// Everything here is pure and deterministic: epoch-ms in, numbers out. The
// phrase "usual pattern" always means THE USER'S OWN HISTORY at a similar
// time of day — never a population reference — and every result carries its
// sample size so the UI can stay honest about how much evidence it has.
//
// Association, never causation: these functions describe what the user's
// records usually look like. They never claim a factor caused anything.

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Minimum same-hour readings before we call something "your usual pattern". */
export const MIN_PATTERN_N = 3;

/** Deviation (mg/dL) from the usual pattern large enough to flag in the UI. */
export const DEVIATION_ALERT_MGDL = 15;

export interface ReadingPoint {
  value: number;
  /** epoch ms the reading was taken */
  takenAt: number;
}

export interface UsualPattern {
  /** median of same-hour-of-day readings over the trailing window (excludes today) */
  median: number | null;
  /** how many readings went into the median */
  n: number;
  /** interquartile range of those readings (mg/dL) — the "normal for you" band */
  spread: number | null;
  /** half-width of the hour window used, in hours */
  windowHours: number;
  /** how many trailing days the window covered */
  days: number;
}

/**
 * The user's usual glucose at the hour-of-day of `at`. Pure time-of-day
 * matching: readings from the trailing `days` days (excluding the current
 * day, so "usual" is not contaminated by the day being explained) whose
 * hour-of-day is within ±windowHours of the target's.
 *
 * Returns median + IQR (robust to a single odd reading) and the sample size.
 */
export function usualPatternAt(
  readings: ReadingPoint[],
  at: number,
  opts: { days?: number; windowHours?: number; now?: number } = {},
): UsualPattern {
  const days = opts.days ?? 14;
  const windowHours = opts.windowHours ?? 1;
  const now = opts.now ?? at;
  const cutoff = now - days * DAY_MS;
  const startOfAtDay = at - (at % DAY_MS);

  const targetMs = at % DAY_MS;
  const same = readings.filter((r) => {
    if (r.takenAt >= startOfAtDay) return false; // exclude the day being explained
    if (r.takenAt < cutoff) return false;
    const d = Math.abs((r.takenAt % DAY_MS) - targetMs);
    const circular = Math.min(d, DAY_MS - d); // wrap around midnight
    return circular <= windowHours * HOUR_MS;
  });

  const values = same.map((r) => r.value).sort((a, b) => a - b);
  return {
    median: values.length ? median(values) : null,
    n: values.length,
    spread: values.length >= 4 ? quartile(values, 0.75) - quartile(values, 0.25) : null,
    windowHours,
    days,
  };
}

/** How far a reading sits above (+) / below (-) the user's usual pattern. */
export function deviationFromUsual(reading: number, usual: UsualPattern): number | null {
  if (usual.median === null) return null;
  return +(reading - usual.median).toFixed(0);
}

export interface TimeInRange {
  /** % of readings inside [low, high] over the trailing window, rounded */
  pct: number | null;
  belowPct: number;
  abovePct: number;
  inRange: number;
  below: number;
  above: number;
  total: number;
  low: number;
  high: number;
  days: number;
}

/**
 * Time-in-range over the trailing `days` days (default 14) against the
 * 70-140 mg/dL band. Counting readings (not CGM minutes) — the UI labels
 * this as "N readings · D days" so the basis is always visible.
 */
export function timeInRange(
  readings: ReadingPoint[],
  now: number,
  opts: { days?: number; low?: number; high?: number } = {},
): TimeInRange {
  const days = opts.days ?? 14;
  const low = opts.low ?? 70;
  const high = opts.high ?? 140;
  const cutoff = now - days * DAY_MS;
  const inWindow = readings.filter((r) => r.takenAt >= cutoff && r.takenAt <= now);
  const below = inWindow.filter((r) => r.value < low).length;
  const above = inWindow.filter((r) => r.value > high).length;
  const inR = inWindow.length - below - above;
  const total = inWindow.length;
  return {
    pct: total ? Math.round((inR / total) * 100) : null,
    belowPct: total ? Math.round((below / total) * 100) : 0,
    abovePct: total ? Math.round((above / total) * 100) : 0,
    inRange: inR,
    below,
    above,
    total,
    low,
    high,
    days,
  };
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

/**
 * Steps proxy from logged activity. Walks are entered as minutes; ~110
 * steps/min is the standard casual-brisk cadence used across the app.
 * Non-walk activity does not contribute steps (it is its own signal).
 */
export function stepsFromActivity(type: string, durationMin: number): number {
  if (type !== 'walk' || !Number.isFinite(durationMin) || durationMin <= 0) return 0;
  return Math.round(durationMin * 110);
}

export interface StepsContext {
  /** steps so far today (sum of today's walk entries) */
  today: number;
  /** per-day totals for the trailing 7 days ending today (for the sparkline) */
  last7: { dayStart: number; steps: number }[];
  /** mean of the 7 days BEFORE today — "your usual" */
  usualAvg: number | null;
  /** today vs usualAvg: -61 = 61% below usual. null when usual is unknown */
  pctVsUsual: number | null;
}

/**
 * Steps today vs the user's own 7-day usual. `daySteps` is a precomputed
 * (dayStart, steps) series covering at least the last 8 days; missing days
 * count as 0 only if present in the series (callers decide completeness).
 */
export function stepsContext(
  today: number,
  daySteps: { dayStart: number; steps: number }[],
  todayStart: number,
): StepsContext {
  const prev = daySteps.filter((d) => d.dayStart < todayStart).slice(-7);
  const last7 = [...prev, { dayStart: todayStart, steps: today }].slice(-7);
  const usualAvg = prev.length ? prev.reduce((a, b) => a + b.steps, 0) / prev.length : null;
  return {
    today,
    last7,
    usualAvg: usualAvg === null ? null : Math.round(usualAvg),
    pctVsUsual:
      usualAvg && usualAvg > 0 ? Math.round(((today - usualAvg) / usualAvg) * 100) : null,
  };
}

// ---------------------------------------------------------------------------
// Sleep
// ---------------------------------------------------------------------------

export interface SleepPoint {
  hours: number;
  /** epoch ms the user woke */
  wokeAt: number;
}

export interface SleepContext {
  lastHours: number | null;
  wokeAt: number | null;
  /** mean hours of the 7 nights BEFORE the most recent one */
  usualAvg: number | null;
  /** how many nights the usual average is based on */
  n: number;
  /** last night minus usual, in hours (negative = shorter than usual) */
  deltaHours: number | null;
}

/** Last night's sleep vs the user's own recent usual. */
export function sleepContext(sleeps: SleepPoint[]): SleepContext {
  if (sleeps.length === 0) {
    return { lastHours: null, wokeAt: null, usualAvg: null, n: 0, deltaHours: null };
  }
  const sorted = [...sleeps].sort((a, b) => a.wokeAt - b.wokeAt);
  const last = sorted[sorted.length - 1];
  const prev = sorted.slice(-8, -1); // up to 7 nights before the last
  const usualAvg = prev.length ? prev.reduce((a, b) => a + b.hours, 0) / prev.length : null;
  return {
    lastHours: last.hours,
    wokeAt: last.wokeAt,
    usualAvg: usualAvg === null ? null : +usualAvg.toFixed(1),
    n: prev.length,
    deltaHours: usualAvg === null ? null : +(last.hours - usualAvg).toFixed(1),
  };
}

// ---------------------------------------------------------------------------
// Weight
// ---------------------------------------------------------------------------

export interface WeightPointInput {
  kg: number;
  takenAt: number;
}

export interface WeightContext {
  latestKg: number | null;
  latestAt: number | null;
  /** latest minus the reading closest to 30 days ago (negative = down) */
  delta30d: number | null;
  n: number;
}

/** Latest weight + change over ~30 days (nearest reading to 30d ago wins). */
export function weightContext(weights: WeightPointInput[], now: number): WeightContext {
  if (weights.length === 0) {
    return { latestKg: null, latestAt: null, delta30d: null, n: 0 };
  }
  const sorted = [...weights].sort((a, b) => a.takenAt - b.takenAt);
  const latest = sorted[sorted.length - 1];
  const target = now - 30 * DAY_MS;
  let baseline: WeightPointInput | null = null;
  for (const w of sorted) {
    if (w.takenAt <= latest.takenAt && Math.abs(w.takenAt - target) < Math.abs((baseline?.takenAt ?? target + Infinity) - target)) {
      baseline = w;
    }
  }
  // Only claim a trend when the baseline is a genuinely different, older entry.
  const usable = baseline && baseline.takenAt < latest.takenAt;
  return {
    latestKg: latest.kg,
    latestAt: latest.takenAt,
    delta30d: usable ? +(latest.kg - baseline!.kg).toFixed(1) : null,
    n: sorted.length,
  };
}

// ---------------------------------------------------------------------------
// Medications — "X / Y taken" for today
// ---------------------------------------------------------------------------

export interface MedSchedule {
  name: string;
  /** JSON-stringified array of "HH:MM" slot times (Prisma stores it as string) */
  scheduleTimes: string | string[];
  isActive?: boolean;
}

export interface MedLogInput {
  slotTime: string; // HH:MM
  logDate: string; // YYYY-MM-DD
  status: string; // 'taken' | 'skipped'
  /** epoch ms the log row was created (when the user actually marked it) */
  createdAt?: number;
  /** which medication this log belongs to (required when >1 med exists) */
  medicationId?: string;
}

export interface MedSlotToday {
  name: string;
  /** HH:MM */
  slotTime: string;
  status: 'taken' | 'skipped' | 'planned';
  loggedAt: number | null;
}

export interface MedsToday {
  taken: number;
  /** every slot scheduled today (taken + skipped + still-planned) */
  scheduled: number;
  slots: MedSlotToday[];
  /** epoch ms of the most recent taken log, for the "Logged h:mm" stamp */
  lastLoggedAt: number | null;
}

function parseSlots(raw: string | string[]): string[] {
  const arr = typeof raw === 'string' ? safeJsonArray(raw) : raw;
  return Array.isArray(arr) ? arr.filter((s): s is string => typeof s === 'string' && /^\d{2}:\d{2}$/.test(s)) : [];
}

function safeJsonArray(s: string): unknown {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/**
 * Today's medication slots: schedule minus what the logs already resolved.
 * Slots with a log are 'taken'/'skipped'; slots without one are 'planned'
 * (the planner vocabulary — not yet done, no claim made).
 */
export function medsToday(
  medications: (MedSchedule & { id?: string })[],
  logs: MedLogInput[],
  todayStr: string,
): MedsToday {
  const slots: MedSlotToday[] = [];
  for (const med of medications) {
    if (med.isActive === false) continue;
    for (const slotTime of parseSlots(med.scheduleTimes)) {
      const forThisSlot = (l: MedLogInput) =>
        l.logDate === todayStr && l.slotTime === slotTime &&
        (l.medicationId === undefined || med.id === undefined || l.medicationId === med.id);
      const log = logs.find((l) => forThisSlot(l) && l.status !== 'skipped');
      const skipped = logs.find((l) => forThisSlot(l) && l.status === 'skipped');
      slots.push({
        name: med.name,
        slotTime,
        status: log ? 'taken' : skipped ? 'skipped' : 'planned',
        loggedAt: log?.createdAt ?? null,
      });
    }
  }
  slots.sort((a, b) => a.slotTime.localeCompare(b.slotTime));
  const taken = slots.filter((s) => s.status === 'taken').length;
  const logged = slots.filter((s) => s.status === 'taken' && s.loggedAt).map((s) => s.loggedAt!);
  return {
    taken,
    scheduled: slots.length,
    slots,
    lastLoggedAt: logged.length ? Math.max(...logged) : null,
  };
}

// ---------------------------------------------------------------------------
// Meal-slot labels — "2 h after lunch" on the glucose card
// ---------------------------------------------------------------------------

export type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner';

/** Coarse meal-slot label for an hour of day (0-23, IST). */
export function mealSlotForHour(hour: number): MealSlot {
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 16) return 'lunch';
  if (hour >= 16 && hour < 19) return 'snack';
  return 'dinner'; // 19:00-04:59
}

// ---------------------------------------------------------------------------
// Daily usual curve — the chart's dashed forecast + uncertainty band (item 3)
// ---------------------------------------------------------------------------

export interface UsualCurvePoint {
  /** target epoch ms (an hour mark) */
  at: number;
  /** usual value at this hour; null only when no data anchors it on either side */
  value: number | null;
  low: number | null;
  high: number | null;
  /** same-hour readings behind this point (0 = interpolated between hours) */
  n: number;
  interpolated: boolean;
}

/**
 * The user's usual glucose hour-by-hour across the day, from their own
 * readings (trailing window, excluding today). Hours without readings are
 * LINEARLY INTERPOLATED between the nearest hours that have data, with the
 * uncertainty band widened ~2 mg/dL per hour of interpolation distance —
 * the band is what keeps sparse-data stretches honest. Hours with no
 * defined neighbour on either side stay null (no claim).
 */
export function usualDailyCurve(
  readings: ReadingPoint[],
  hours: number[],
  opts: { days?: number; windowHours?: number; now?: number; minBand?: number } = {},
): UsualCurvePoint[] {
  const days = opts.days ?? 14;
  const windowHours = opts.windowHours ?? 3;
  const minBand = opts.minBand ?? 10;
  const now = opts.now ?? (hours.length ? hours[hours.length - 1] : Date.now());
  const cutoff = now - days * DAY_MS;

  const direct = hours.map((at) => {
    const targetMs = at % DAY_MS;
    const same = readings.filter((r) => {
      if (r.takenAt >= startOfDay(at)) return false; // exclude the day being explained
      if (r.takenAt < cutoff) return false;
      const d = Math.abs((r.takenAt % DAY_MS) - targetMs);
      return Math.min(d, DAY_MS - d) <= windowHours * HOUR_MS;
    });
    const values = same.map((r) => r.value).sort((a, b) => a - b);
    if (!values.length) return null;
    const med = median(values)!;
    const spread = values.length >= 4 ? quartile(values, 0.75) - quartile(values, 0.25) : minBand * 1.2;
    const band = Math.max(minBand, Math.min(40, spread * 0.75));
    return { at, value: med, low: med - band, high: med + band, n: values.length, interpolated: false };
  });

  // Fill the gaps between defined points by linear interpolation, widening
  // the band with distance from the nearest defined hour.
  const out: (UsualCurvePoint | null)[] = [...direct];
  for (let i = 0; i < out.length; i++) {
    if (out[i]) continue;
    let lo = -1;
    for (let j = i - 1; j >= 0; j--) if (out[j]) { lo = j; break; }
    let hi = -1;
    for (let j = i + 1; j < out.length; j++) if (out[j]) { hi = j; break; }
    if (lo < 0 || hi < 0) continue; // no anchor on one side -> stays null-valued
    const a = out[lo]!;
    const b = out[hi]!;
    const f = (i - lo) / (hi - lo);
    const value = a.value! + (b.value! - a.value!) * f;
    const distHours = Math.min(i - lo, hi - i);
    const band = Math.max(a.high! - a.value!, b.high! - b.value!) + 2 * distHours;
    out[i] = { at: hours[i], value: +value.toFixed(1), low: +(value - band).toFixed(1), high: +(value + band).toFixed(1), n: 0, interpolated: true };
  }
  // Unanchored edges become explicit null-valued points (no claim made).
  return out.map((p, i) => p ?? { at: hours[i], value: null, low: null, high: null, n: 0, interpolated: false });
}

// ---------------------------------------------------------------------------
// stats helpers
// ---------------------------------------------------------------------------

function startOfDay(t: number): number {
  return t - (t % DAY_MS);
}

export function median(sorted: number[]): number | null {
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : +((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1);
}

/** Linear-interpolated quantile of an ASC-sorted array (q in [0, 1]). */
export function quartile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
