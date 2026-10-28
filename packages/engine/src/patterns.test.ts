// Unit tests for patterns.ts — the "your usual pattern" math behind the
// six metric cards (dashboard revamp item 2), the chart forecast (item 3)
// and the attribution card (item 4). All timestamps are deterministic.
import { describe, expect, it } from 'vitest';
import {
  DEVIATION_ALERT_MGDL,
  MIN_PATTERN_N,
  deviationFromUsual,
  mealSlotForHour,
  medsToday,
  sleepContext,
  stepsContext,
  stepsFromActivity,
  timeInRange,
  usualPatternAt,
  weightContext,
  type ReadingPoint,
} from './patterns';

const DAY = 86_400_000;
const HOUR = 3_600_000;
// 2024-06-15T14:00:00Z (a Saturday) — arbitrary fixed "now" for every test.
const NOW = Date.UTC(2024, 5, 15, 14, 0, 0);

function reading(value: number, at: number): ReadingPoint {
  return { value, takenAt: at };
}

describe('usualPatternAt', () => {
  it('medians same-hour readings from previous days and excludes today', () => {
    const at = NOW; // 14:00 UTC today
    const readings = [
      reading(150, NOW - 1 * DAY), // yesterday 14:00
      reading(140, NOW - 2 * DAY),
      reading(160, NOW - 3 * DAY),
      reading(999, NOW - HOUR), // today 13:00 — must be excluded
    ];
    const usual = usualPatternAt(readings, at, { now: NOW });
    expect(usual.median).toBe(150);
    expect(usual.n).toBe(3);
  });

  it('uses the ±windowHours circular hour window across midnight', () => {
    const at = Date.UTC(2024, 5, 15, 0, 30); // 00:30 today
    const readings = [
      reading(110, Date.UTC(2024, 5, 14, 23, 45)), // yesterday 23:45 — within 1h (circular)
      reading(120, Date.UTC(2024, 5, 13, 1, 15)), // 1h after target hour, 2 days ago
      reading(130, Date.UTC(2024, 5, 12, 0, 0)),
    ];
    const usual = usualPatternAt(readings, at, { now: at });
    expect(usual.n).toBe(3);
    expect(usual.median).toBe(120);
  });

  it('respects the trailing-days cutoff', () => {
    const at = NOW;
    const readings = [
      reading(100, NOW - 3 * DAY),
      reading(120, NOW - 20 * DAY), // outside 14-day window
    ];
    const usual = usualPatternAt(readings, at, { now: NOW, days: 14 });
    expect(usual.n).toBe(1);
    expect(usual.median).toBe(100);
  });

  it('returns null median and n=0 with no comparable readings', () => {
    const usual = usualPatternAt([reading(100, NOW - 30 * DAY)], NOW, { now: NOW });
    expect(usual.median).toBeNull();
    expect(usual.n).toBe(0);
    expect(usual.spread).toBeNull();
  });

  it('computes an IQR spread once at least 4 readings exist', () => {
    // 1,2,3,100 → Q1=1.75, Q3=3+97*0.25=27.25 → spread 25.5
    const readings = [1, 2, 3, 100].map((v, i) => reading(v, NOW - (i + 1) * DAY));
    const usual = usualPatternAt(readings, NOW, { now: NOW });
    expect(usual.n).toBe(4);
    expect(usual.spread).toBeCloseTo(25.5, 1);
  });

  it('exports the thresholds the UI flags on', () => {
    expect(MIN_PATTERN_N).toBeGreaterThanOrEqual(3);
    expect(DEVIATION_ALERT_MGDL).toBeGreaterThanOrEqual(10);
  });
});

describe('deviationFromUsual', () => {
  it('is reading minus usual median', () => {
    const usual = usualPatternAt(
      [reading(142, NOW - DAY), reading(142, NOW - 2 * DAY), reading(143, NOW - 3 * DAY)],
      NOW,
      { now: NOW },
    );
    expect(deviationFromUsual(168, usual)).toBe(26);
    expect(deviationFromUsual(120, usual)).toBe(-22);
  });

  it('is null when there is no usual pattern yet', () => {
    expect(deviationFromUsual(168, { median: null, n: 0, spread: null, windowHours: 1, days: 14 })).toBeNull();
  });
});

describe('timeInRange', () => {
  const base = NOW - 10 * DAY;
  const readings = [
    reading(100, base),
    reading(120, base + HOUR),
    reading(150, base + 2 * HOUR), // above
    reading(60, base + 3 * HOUR), // below
    reading(135, base + 4 * HOUR),
  ];
  it('counts readings, not minutes, and reports all three bands', () => {
    const tir = timeInRange(readings, NOW);
    expect(tir.total).toBe(5);
    expect(tir.inRange).toBe(3);
    expect(tir.above).toBe(1);
    expect(tir.below).toBe(1);
    expect(tir.pct).toBe(60);
    expect(tir.low).toBe(70);
    expect(tir.high).toBe(140);
    expect(tir.days).toBe(14);
  });

  it('excludes readings older than the window', () => {
    const tir = timeInRange([...readings, reading(100, NOW - 40 * DAY)], NOW);
    expect(tir.total).toBe(5);
  });

  it('returns pct null on an empty window (UI shows "no data" honestly)', () => {
    const tir = timeInRange([], NOW);
    expect(tir.pct).toBeNull();
    expect(tir.total).toBe(0);
  });

  it('boundary values count as in-range (70 and 140 are inside)', () => {
    const tir = timeInRange([reading(70, NOW - HOUR), reading(140, NOW - 2 * HOUR)], NOW);
    expect(tir.inRange).toBe(2);
    expect(tir.pct).toBe(100);
  });
});

describe('stepsFromActivity', () => {
  it('converts walk minutes at the 110/min cadence', () => {
    expect(stepsFromActivity('walk', 30)).toBe(3300);
  });

  it('ignores non-walk activity and bad input', () => {
    expect(stepsFromActivity('yoga', 60)).toBe(0);
    expect(stepsFromActivity('walk', -5)).toBe(0);
    expect(stepsFromActivity('walk', NaN)).toBe(0);
  });
});

describe('stepsContext', () => {
  const todayStart = NOW - (NOW % DAY);
  const day = (n: number) => todayStart - n * DAY;

  it('compares today against the mean of the previous 7 days', () => {
    const series = [
      { dayStart: day(3), steps: 5000 },
      { dayStart: day(2), steps: 6000 },
      { dayStart: day(1), steps: 5200 },
    ];
    const ctx = stepsContext(2148, series, todayStart);
    expect(ctx.today).toBe(2148);
    expect(ctx.usualAvg).toBe(5400);
    expect(ctx.pctVsUsual).toBe(-60); // round((2148-5400)/5400*100)
    expect(ctx.last7.at(-1)).toEqual({ dayStart: todayStart, steps: 2148 });
  });

  it('usualAvg is null with no prior days — no fake baseline', () => {
    const ctx = stepsContext(1000, [], todayStart);
    expect(ctx.usualAvg).toBeNull();
    expect(ctx.pctVsUsual).toBeNull();
  });

  it('caps the sparkline at 7 days', () => {
    const series = Array.from({ length: 12 }, (_, i) => ({ dayStart: day(i + 1), steps: 1000 }));
    expect(stepsContext(500, series, todayStart).last7).toHaveLength(7);
  });
});

describe('sleepContext', () => {
  it('compares the last night with the usual of the previous 7', () => {
    const sleeps = [
      { hours: 7.2, wokeAt: NOW - 3 * DAY },
      { hours: 7.3, wokeAt: NOW - 2 * DAY },
      { hours: 7.1, wokeAt: NOW - 1 * DAY },
      { hours: 6.4, wokeAt: NOW }, // last night
    ];
    const ctx = sleepContext(sleeps);
    expect(ctx.lastHours).toBe(6.4);
    expect(ctx.usualAvg).toBe(7.2);
    expect(ctx.deltaHours).toBeCloseTo(-0.8, 1);
    expect(ctx.n).toBe(3);
  });

  it('handles the empty case', () => {
    const ctx = sleepContext([]);
    expect(ctx.lastHours).toBeNull();
    expect(ctx.usualAvg).toBeNull();
  });

  it('sorts unsorted input by wokeAt (last entry wins)', () => {
    const sleeps = [
      { hours: 6.4, wokeAt: NOW },
      { hours: 8, wokeAt: NOW - DAY },
    ];
    expect(sleepContext(sleeps).lastHours).toBe(6.4);
  });
});

describe('weightContext', () => {
  it('deltas the latest against the reading nearest 30 days ago', () => {
    const weights = [
      { kg: 75.4, takenAt: NOW - 31 * DAY },
      { kg: 75.0, takenAt: NOW - 15 * DAY },
      { kg: 74.6, takenAt: NOW - DAY },
    ];
    const ctx = weightContext(weights, NOW);
    expect(ctx.latestKg).toBe(74.6);
    expect(ctx.delta30d).toBeCloseTo(-0.8, 1);
  });

  it('no trend claim from a single reading', () => {
    const ctx = weightContext([{ kg: 74.6, takenAt: NOW - DAY }], NOW);
    expect(ctx.latestKg).toBe(74.6);
    expect(ctx.delta30d).toBeNull();
  });

  it('empty case', () => {
    const ctx = weightContext([], NOW);
    expect(ctx.latestKg).toBeNull();
    expect(ctx.n).toBe(0);
  });
});

describe('medsToday', () => {
  const TODAY = '2024-06-15';
  const meds = [
    { name: 'Metformin', scheduleTimes: '["07:30","21:00"]', isActive: true },
    { name: 'Old med', scheduleTimes: '["08:00"]', isActive: false },
  ];

  it('marks unlogged slots planned, logged slots taken', () => {
    const logs = [{ slotTime: '07:30', logDate: TODAY, status: 'taken', createdAt: NOW - 5 * HOUR }];
    const ctx = medsToday(meds, logs, TODAY);
    expect(ctx.scheduled).toBe(2); // inactive med excluded
    expect(ctx.taken).toBe(1);
    expect(ctx.slots[0]).toMatchObject({ name: 'Metformin', slotTime: '07:30', status: 'taken' });
    expect(ctx.slots[1]).toMatchObject({ name: 'Metformin', slotTime: '21:00', status: 'planned' });
    expect(ctx.lastLoggedAt).toBe(NOW - 5 * HOUR);
  });

  it('separate logs for other days do not leak in', () => {
    const logs = [{ slotTime: '07:30', logDate: '2024-06-14', status: 'taken', createdAt: NOW }];
    const ctx = medsToday(meds, logs, TODAY);
    expect(ctx.taken).toBe(0);
    expect(ctx.slots.find((s) => s.slotTime === '07:30')!.status).toBe('planned');
  });

  it('skipped slots are neither taken nor planned', () => {
    const logs = [{ slotTime: '07:30', logDate: TODAY, status: 'skipped', createdAt: NOW }];
    const ctx = medsToday(meds, logs, TODAY);
    expect(ctx.taken).toBe(0);
    expect(ctx.slots.find((s) => s.slotTime === '07:30')!.status).toBe('skipped');
  });

  it('accepts scheduleTimes already parsed as an array (mobile callers)', () => {
    const ctx = medsToday([{ name: 'M', scheduleTimes: ['09:00'] }], [], TODAY);
    expect(ctx.scheduled).toBe(1);
  });

  it('ignores malformed schedule JSON gracefully', () => {
    const ctx = medsToday([{ name: 'M', scheduleTimes: 'not json' }], [], TODAY);
    expect(ctx.scheduled).toBe(0);
  });

  it('no medications means 0/0, not a fake full adherence', () => {
    const ctx = medsToday([], [], TODAY);
    expect(ctx.taken).toBe(0);
    expect(ctx.scheduled).toBe(0);
  });

  it('two meds sharing a slot time are matched by their own logs, not crossed', () => {
    const meds = [
      { id: 'med-a', name: 'Metformin', scheduleTimes: '["07:30"]', isActive: true },
      { id: 'med-b', name: 'Statin', scheduleTimes: '["07:30"]', isActive: true },
    ];
    const logs = [{ medicationId: 'med-b', slotTime: '07:30', logDate: TODAY, status: 'taken', createdAt: NOW }];
    const ctx = medsToday(meds, logs, TODAY);
    expect(ctx.taken).toBe(1);
    expect(ctx.slots.find((s) => s.name === 'Statin')!.status).toBe('taken');
    expect(ctx.slots.find((s) => s.name === 'Metformin')!.status).toBe('planned');
  });
});

describe('mealSlotForHour', () => {
  it('maps IST hours to coarse meal slots', () => {
    expect(mealSlotForHour(8)).toBe('breakfast');
    expect(mealSlotForHour(13)).toBe('lunch');
    expect(mealSlotForHour(17)).toBe('snack');
    expect(mealSlotForHour(20)).toBe('dinner');
    expect(mealSlotForHour(2)).toBe('dinner'); // late night counts as after-dinner
    expect(mealSlotForHour(5)).toBe('breakfast');
  });
});
