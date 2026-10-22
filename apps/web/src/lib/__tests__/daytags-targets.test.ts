import { describe, it, expect } from 'vitest';
import { validateDayTag, resolveTargets, EDUCATIONAL_TARGETS, type TargetSettingsLike } from '../clinical-db';

const nullSettings: TargetSettingsLike = {
  tFastingLow: null, tFastingHigh: null,
  tPremealLow: null, tPremealHigh: null,
  tPostprandialLow: null, tPostprandialHigh: null,
  tBedtimeLow: null, tBedtimeHigh: null,
};

describe('validateDayTag', () => {
  it('accepts a known tag with date and optional note', () => {
    expect(validateDayTag({ tag: 'stress', tagDate: '2026-03-01', note: 'deadline week' })).toBeNull();
    expect(validateDayTag({ tag: 'festival', tagDate: '2026-03-01' })).toBeNull();
  });

  it('rejects an unknown tag', () => {
    expect(validateDayTag({ tag: 'hangover', tagDate: '2026-03-01' })).toBe('Unknown tag.');
  });

  it('rejects a malformed date', () => {
    expect(validateDayTag({ tag: 'stress', tagDate: '2026/03/01' })).toBe('Date must be YYYY-MM-DD.');
  });

  it('rejects a note over 200 chars but accepts exactly 200', () => {
    expect(validateDayTag({ tag: 'stress', tagDate: '2026-03-01', note: 'x'.repeat(200) })).toBeNull();
    expect(validateDayTag({ tag: 'stress', tagDate: '2026-03-01', note: 'x'.repeat(201) })).toBe('Note must be 200 characters or fewer.');
  });
});

describe('resolveTargets', () => {
  it('falls back to educational defaults for null settings', () => {
    expect(resolveTargets(null)).toEqual(EDUCATIONAL_TARGETS);
    expect(resolveTargets(nullSettings)).toEqual(EDUCATIONAL_TARGETS);
  });

  it('lets explicitly set bounds take precedence (e.g. set on a doctor advice)', () => {
    const r = resolveTargets({ ...nullSettings, tFastingLow: 90, tFastingHigh: 140 });
    expect(r.fasting).toEqual({ low: 90, high: 140 });
    expect(r.premeal).toEqual(EDUCATIONAL_TARGETS.premeal);
  });

  it('falls back per bound, not per pair', () => {
    const r = resolveTargets({ ...nullSettings, tPostprandialHigh: 160 });
    expect(r.postprandial).toEqual({ low: EDUCATIONAL_TARGETS.postprandial.low, high: 160 });
    expect(r.bedtime).toEqual(EDUCATIONAL_TARGETS.bedtime);
  });
});