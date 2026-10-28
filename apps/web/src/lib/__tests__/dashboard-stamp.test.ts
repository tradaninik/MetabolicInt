// Unit tests for the dashboard header helpers (dashboard revamp item 1).
// Pure functions - every input is a literal, including `now`.
import { describe, expect, it } from 'vitest';
import {
  greetingForHour,
  istDayBounds,
  istHour,
  istSlotEpoch,
  latestUpdate,
  relativeTime,
  sourceLabel,
  type UpdateCandidate,
} from '../dashboard-stamp';

describe('istHour', () => {
  it('converts UTC epochs to IST hours (UTC+5:30)', () => {
    expect(istHour(Date.UTC(2026, 9, 28, 0, 0, 0))).toBe(5); // 00:00Z = 05:30 IST
    expect(istHour(Date.UTC(2026, 9, 28, 6, 30, 0))).toBe(12); // 06:30Z = 12:00 IST
    expect(istHour(Date.UTC(2026, 9, 28, 18, 30, 0))).toBe(0); // 18:30Z = 00:00 IST next day
  });

  it('floors to the whole hour', () => {
    expect(istHour(Date.UTC(2026, 9, 28, 15, 59, 59))).toBe(21); // 21:29:59 IST
    expect(istHour(Date.UTC(2026, 9, 28, 16, 0, 0))).toBe(21); // 21:30:00 IST
    expect(istHour(Date.UTC(2026, 9, 28, 16, 30, 0))).toBe(22); // 22:00 IST
  });
});

describe('greetingForHour', () => {
  it('maps IST hour bands to greetings', () => {
    expect(greetingForHour(5)).toBe('Good morning');
    expect(greetingForHour(11)).toBe('Good morning');
    expect(greetingForHour(12)).toBe('Good afternoon');
    expect(greetingForHour(16)).toBe('Good afternoon');
    expect(greetingForHour(17)).toBe('Good evening');
    expect(greetingForHour(20)).toBe('Good evening');
  });

  it('nights are 21:00-04:59 IST', () => {
    expect(greetingForHour(21)).toBe('Good night');
    expect(greetingForHour(0)).toBe('Good night');
    expect(greetingForHour(4)).toBe('Good night');
  });

  it('is total (no undefined band)', () => {
    for (let h = 0; h < 24; h += 1) expect(typeof greetingForHour(h)).toBe('string');
  });
});

describe('latestUpdate', () => {
  it('returns null for no candidates', () => {
    expect(latestUpdate([])).toBeNull();
  });

  it('picks the most recent candidate across kinds', () => {
    const candidates: UpdateCandidate[] = [
      { t: 1_000, kind: 'meal' },
      { t: 5_000, kind: 'glucose', source: 'cgm' },
      { t: 3_000, kind: 'sleep' },
    ];
    expect(latestUpdate(candidates)).toEqual({ t: 5_000, kind: 'glucose', source: 'cgm' });
  });

  it('ignores non-finite timestamps instead of crashing', () => {
    const candidates: UpdateCandidate[] = [
      { t: Number.NaN, kind: 'meal' },
      { t: 2_000, kind: 'bp' },
    ];
    expect(latestUpdate(candidates)).toEqual({ t: 2_000, kind: 'bp' });
  });
});

describe('relativeTime', () => {
  const now = Date.UTC(2026, 9, 28, 12, 0, 0);

  it('buckets into just-now / minutes / hours / days', () => {
    expect(relativeTime(now - 30_000, now)).toBe('just now');
    expect(relativeTime(now - 90_000, now)).toBe('1m ago');
    expect(relativeTime(now - 5 * 60_000, now)).toBe('5m ago');
    expect(relativeTime(now - 3 * 3_600_000, now)).toBe('3h ago');
    expect(relativeTime(now - 2 * 86_400_000, now)).toBe('2d ago');
  });

  it('never renders negative ages for future-dated entries', () => {
    expect(relativeTime(now + 5 * 60_000, now)).toBe('just now');
  });
});

describe('sourceLabel', () => {
  it('labels glucose by its provenance field', () => {
    expect(sourceLabel('glucose', 'cgm')).toBe('CGM reading');
    expect(sourceLabel('glucose', 'manual')).toBe('manual reading');
    expect(sourceLabel('glucose')).toBe('glucose reading');
  });

  it('labels the other record kinds plainly', () => {
    expect(sourceLabel('meal')).toBe('meal log');
    expect(sourceLabel('activity')).toBe('activity log');
    expect(sourceLabel('sleep')).toBe('sleep log');
    expect(sourceLabel('weight')).toBe('weight log');
    expect(sourceLabel('bp')).toBe('BP log');
    expect(sourceLabel('med')).toBe('med log');
  });
});

describe('istDayBounds / istSlotEpoch (dashboard revamp item 3)', () => {
  it('finds the IST calendar day for a UTC instant', () => {
    // 2024-06-15T20:00Z == 2024-06-16T01:30 IST → the IST day is the 16th.
    const b = istDayBounds(Date.UTC(2024, 5, 15, 20, 0, 0));
    expect(b.dateStr).toBe('2024-06-16');
    // day start is 2024-06-15T18:30Z (IST midnight)
    expect(b.start).toBe(Date.UTC(2024, 5, 15, 18, 30, 0));
    expect(b.end).toBe(b.start + 86_400_000);
  });

  it('maps an IST wall-clock slot to the right epoch (matches /api/meds/log convention)', () => {
    // 07:30 IST on 2024-06-16 == 2024-06-16T02:00Z.
    expect(istSlotEpoch('2024-06-16', '07:30')).toBe(Date.UTC(2024, 5, 16, 2, 0, 0));
    // 21:00 IST == 15:30Z same UTC day.
    expect(istSlotEpoch('2024-06-16', '21:00')).toBe(Date.UTC(2024, 5, 16, 15, 30, 0));
  });

  it('istSlotEpoch lands inside the istDayBounds window of the same day', () => {
    const day = istDayBounds(Date.UTC(2024, 5, 16, 5, 0, 0)); // 10:30 IST on the 16th
    const slot = istSlotEpoch(day.dateStr, '21:00');
    expect(slot).toBeGreaterThanOrEqual(day.start);
    expect(slot).toBeLessThan(day.end);
  });
});
