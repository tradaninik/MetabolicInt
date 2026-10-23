import { describe, it, expect } from 'vitest';
import { evaluateGlucoseGuard, isValidGlucoseReading, GUARD_THRESHOLDS } from './glucoseGuard';

const NOW = new Date('2026-10-23T10:00:00.000Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

describe('U25 verdict boundaries (ADA levels)', () => {
  it('pins 70/69/54/53 exactly', () => {
    expect(evaluateGlucoseGuard(70, [], NOW).verdict).toBe('none');
    expect(evaluateGlucoseGuard(69, [], NOW).verdict).toBe('level1');
    expect(evaluateGlucoseGuard(54, [], NOW).verdict).toBe('level1');
    expect(evaluateGlucoseGuard(53, [], NOW).verdict).toBe('level2');
  });

  it('stays silent for normal and high readings', () => {
    expect(evaluateGlucoseGuard(105, [], NOW).verdict).toBe('none');
    expect(evaluateGlucoseGuard(400, [], NOW).verdict).toBe('none');
  });

  it('marks implausible entries invalid', () => {
    expect(evaluateGlucoseGuard(19, [], NOW).verdict).toBe('invalid');
    expect(evaluateGlucoseGuard(601, [], NOW).verdict).toBe('invalid');
    expect(evaluateGlucoseGuard(NaN, [], NOW).verdict).toBe('invalid');
  });

  it('validates the plausible meter window', () => {
    expect(isValidGlucoseReading(GUARD_THRESHOLDS.VALID_MIN)).toBe(true);
    expect(isValidGlucoseReading(GUARD_THRESHOLDS.VALID_MAX)).toBe(true);
    expect(isValidGlucoseReading(GUARD_THRESHOLDS.VALID_MIN - 0.5)).toBe(false);
    expect(isValidGlucoseReading(GUARD_THRESHOLDS.VALID_MAX + 0.5)).toBe(false);
  });
});

describe('U25 24h pattern aggravator', () => {
  it('fires when the current low joins one prior low inside the window', () => {
    const r = evaluateGlucoseGuard(60, [{ mgdl: 65, at: hoursAgo(3) }], NOW);
    expect(r.verdict).toBe('level1');
    expect(r.pattern).toBe(true);
  });

  it('stays quiet for a single low in the window', () => {
    expect(evaluateGlucoseGuard(60, [], NOW).pattern).toBe(false);
  });

  it('ignores lows older than 24h and non-lows', () => {
    expect(evaluateGlucoseGuard(60, [{ mgdl: 65, at: hoursAgo(25) }], NOW).pattern).toBe(false);
    expect(evaluateGlucoseGuard(60, [{ mgdl: 90, at: hoursAgo(2) }], NOW).pattern).toBe(false);
  });

  it('ignores unreadable timestamps', () => {
    expect(evaluateGlucoseGuard(60, [{ mgdl: 50, at: 'not-a-date' }], NOW).pattern).toBe(false);
  });
});
