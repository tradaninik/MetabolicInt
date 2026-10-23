// U25 Hypoglycemia Guardrails - educational low-glucose classification.
//
// Pure & deterministic. No I/O, no persistence: verdicts are computed on read
// by the app layer. Thresholds follow the ADA consensus glucose levels:
//   Level 2 (clinically significant): below 54 mg/dL
//   Level 1 (alert value):            54-69 mg/dL
// Educational only - NOT a substitute for professional medical advice.

export const GUARD_THRESHOLDS = {
  /** below this = level2 (clinically significant low) */
  LEVEL2_BELOW: 54,
  /** below this (and >= LEVEL2_BELOW) = level1 (alert low) */
  LEVEL1_BELOW: 70,
  /** entry validation floor - readings below are implausible entry errors */
  VALID_MIN: 20,
  /** entry validation ceiling - typical meter max */
  VALID_MAX: 600,
  /** pattern aggravator window in hours */
  PATTERN_WINDOW_HOURS: 24,
  /** lows needed inside the window to raise the pattern flag */
  PATTERN_MIN_COUNT: 2,
} as const;

export type GlucoseGuardVerdict = 'none' | 'level1' | 'level2' | 'invalid';

export interface GlucoseGuardInputReading {
  /** reading value in mg/dL */
  mgdl: number;
  /** when the reading was taken (Date, epoch ms, or ISO string) */
  at: Date | number | string;
}

export interface GlucoseGuardResult {
  verdict: GlucoseGuardVerdict;
  /** true when 2+ readings below LEVEL1_BELOW fall inside the 24h window (incl. current) */
  pattern: boolean;
}

/** Entry validation: plausible meter range only. */
export function isValidGlucoseReading(mgdl: number): boolean {
  return (
    Number.isFinite(mgdl) &&
    mgdl >= GUARD_THRESHOLDS.VALID_MIN &&
    mgdl <= GUARD_THRESHOLDS.VALID_MAX
  );
}

function toTime(at: Date | number | string): number {
  const t = at instanceof Date ? at.getTime() : new Date(at).getTime();
  return Number.isFinite(t) ? t : NaN;
}

/**
 * Classify one glucose reading and flag a 24h low pattern.
 * `priorReadings` must NOT include the current reading.
 * `now` anchors the pattern window (injectable for tests).
 */
export function evaluateGlucoseGuard(
  mgdl: number,
  priorReadings: GlucoseGuardInputReading[] = [],
  now: Date = new Date(),
): GlucoseGuardResult {
  if (!isValidGlucoseReading(mgdl)) return { verdict: 'invalid', pattern: false };

  let verdict: GlucoseGuardVerdict = 'none';
  if (mgdl < GUARD_THRESHOLDS.LEVEL2_BELOW) verdict = 'level2';
  else if (mgdl < GUARD_THRESHOLDS.LEVEL1_BELOW) verdict = 'level1';

  const windowStart = now.getTime() - GUARD_THRESHOLDS.PATTERN_WINDOW_HOURS * 3_600_000;
  const windowEnd = now.getTime() + 5 * 60_000; // small clock-skew allowance
  let lows = mgdl < GUARD_THRESHOLDS.LEVEL1_BELOW ? 1 : 0;
  if (lows < GUARD_THRESHOLDS.PATTERN_MIN_COUNT) {
    for (const r of priorReadings) {
      const t = toTime(r.at);
      if (Number.isNaN(t) || t < windowStart || t > windowEnd) continue;
      if (r.mgdl < GUARD_THRESHOLDS.LEVEL1_BELOW) lows++;
      if (lows >= GUARD_THRESHOLDS.PATTERN_MIN_COUNT) break;
    }
  }

  return { verdict, pattern: lows >= GUARD_THRESHOLDS.PATTERN_MIN_COUNT };
}
