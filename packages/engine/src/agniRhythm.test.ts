// P4c / U17 - tests for the agni rhythm engine: IST windows, boundaries, scoring, banner.

import { describe, it, expect } from 'vitest';
import {
  agniWindowAt,
  AGNI_WINDOW_META,
  AGNI_WINDOW_BOUNDS,
  AGNI_TARGETS,
  AGNI_WEIGHTS,
  AGNI_HABIT_SLUGS,
  AGNI_DISCLAIMER,
  istMinuteOfDay,
  istTodayStartEpoch,
  agniScore,
  lateMealBanner,
  type AgniMeal,
} from './agniRhythm';

describe('IST helpers', () => {
  it('maps epoch 0 (UTC midnight) to 05:30 IST = minute 330', () => {
    expect(istMinuteOfDay(0)).toBe(330);
  });

  it('maps UTC noon to 17:30 IST = minute 1050 (vata afternoon)', () => {
    expect(istMinuteOfDay(12 * 60 * 60 * 1000)).toBe(1050);
  });

  it('is stable across midnight UTC and midnight IST', () => {
    // 23:59 UTC -> 05:29 IST next day.
    expect(istMinuteOfDay((23 * 60 + 59) * 60 * 1000)).toBe(329);
    // 18:30 UTC -> 00:00 IST.
    expect(istMinuteOfDay((18 * 60 + 30) * 60 * 1000)).toBe(0);
  });

  it('throws on non-finite input', () => {
    expect(() => istMinuteOfDay(NaN)).toThrow();
    expect(() => istMinuteOfDay(Number.POSITIVE_INFINITY)).toThrow();
  });

  it('istTodayStartEpoch lands exactly on IST midnight and is idempotent', () => {
    const t = new Date('2026-10-24T15:07:33Z').getTime(); // 20:37:33 IST
    const start = istTodayStartEpoch(t);
    expect(istMinuteOfDay(start)).toBe(0);
    // IST midnight for the IST day of Oct 24 is 18:30 UTC on the PREVIOUS UTC day.
    expect(new Date(start).toISOString()).toBe('2026-10-23T18:30:00.000Z');
    expect(istTodayStartEpoch(start)).toBe(start);
    expect(istTodayStartEpoch(start + 59_999)).toBe(start);
  });
});

describe('agniWindowAt boundaries', () => {
  it('classifies the exact window edges with [start, end) semantics', () => {
    expect(agniWindowAt(0)).toBe('night');
    expect(agniWindowAt(359)).toBe('night');
    expect(agniWindowAt(360)).toBe('kapha_morning');
    expect(agniWindowAt(599)).toBe('kapha_morning');
    expect(agniWindowAt(600)).toBe('pitta_midday');
    expect(agniWindowAt(839)).toBe('pitta_midday');
    expect(agniWindowAt(840)).toBe('vata_afternoon');
    expect(agniWindowAt(1079)).toBe('vata_afternoon');
    expect(agniWindowAt(1080)).toBe('kapha_evening');
    expect(agniWindowAt(1319)).toBe('kapha_evening');
    expect(agniWindowAt(1320)).toBe('night');
    expect(agniWindowAt(1439)).toBe('night');
  });

  it('has consistent metadata and bounds for every window', () => {
    for (const id of Object.keys(AGNI_WINDOW_META) as (keyof typeof AGNI_WINDOW_META)[]) {
      const meta = AGNI_WINDOW_META[id];
      expect(meta.id).toBe(id);
      expect(meta.label.length).toBeGreaterThan(4);
      expect(meta.note.length).toBeGreaterThan(40);
      const b = AGNI_WINDOW_BOUNDS[id];
      expect(b.startMin).toBeLessThan(b.endMin);
    }
    // the night window wraps; its start is late evening and end is end-of-day.
    expect(AGNI_WINDOW_BOUNDS.night).toEqual({ startMin: 1320, endMin: 1440 });
  });

  it('throws on non-integer or out-of-range minutes', () => {
    expect(() => agniWindowAt(-1)).toThrow();
    expect(() => agniWindowAt(1440)).toThrow();
    expect(() => agniWindowAt(600.5)).toThrow();
    expect(() => agniWindowAt(NaN)).toThrow();
  });
});

describe('agniScore', () => {
  it('returns null when nothing is logged yet', () => {
    expect(agniScore([])).toBeNull();
  });

  it('gives the ideal day a perfect 100 (largest meal at midday, light early dinner, clean night)', () => {
    const r = agniScore([
      { minuteOfDay: 390, carbsG: 30 }, // 06:30 breakfast
      { minuteOfDay: 780, carbsG: 75 }, // 13:00 lunch - largest, in Pitta
      { minuteOfDay: 1200, carbsG: 40 }, // 20:00 dinner - light, exactly 2.5 h before 22:30
    ]);
    expect(r).not.toBeNull();
    expect(r!.score).toBe(100);
    expect(r!.components).toEqual({
      largestMealTiming: 40,
      dinnerLightness: 20,
      dinnerLead: 20,
      nightDiscipline: 20,
    });
    expect(r!.nudges).toEqual([]);
    expect(r!.nightMeals).toBe(0);
  });

  it('grades a heavy late dinner with partial credit and a nudge, never below zero', () => {
    const r = agniScore([
      { minuteOfDay: 780, carbsG: 100 }, // midday lunch - largest, in Pitta
      { minuteOfDay: 1300, carbsG: 90 }, // 21:40 dinner - heavy and late
    ]);
    expect(r!.components.largestMealTiming).toBe(40);
    expect(r!.components.dinnerLightness).toBe(0);
    expect(r!.components.dinnerLead).toBe(0);
    expect(r!.score).toBe(60);
    expect(r!.nudges.some((n) => n.includes('9:40 PM'))).toBe(true);
    expect(r!.nudges.some((n) => n.includes('90 g carbs'))).toBe(true);
  });

  it('penalizes night-window meals and puts that nudge first', () => {
    const r = agniScore([
      { minuteOfDay: 700, carbsG: 70 }, // Pitta lunch
      { minuteOfDay: 1380, carbsG: 45 }, // 23:00 - night window
    ]);
    expect(r!.components.nightDiscipline).toBe(0);
    expect(r!.nightMeals).toBe(1);
    expect(r!.nudges[0]).toContain('night window');
  });

  it('also treats pre-dawn meals (00:00-06:00) as night meals', () => {
    const r = agniScore([{ minuteOfDay: 300, carbsG: 50 }]); // 05:00
    expect(r!.nightMeals).toBe(1);
    expect(r!.components.nightDiscipline).toBe(0);
    expect(r!.components.largestMealTiming).toBe(0); // largest landed at night
  });

  it('awards full dinner credit with a gentle note when no evening meal is logged yet', () => {
    const r = agniScore([{ minuteOfDay: 780, carbsG: 70 }]);
    expect(r!.components.dinnerLightness).toBe(20);
    expect(r!.components.dinnerLead).toBe(20);
    expect(r!.score).toBe(100);
    expect(r!.nudges.some((n) => n.includes('No evening meal logged yet'))).toBe(true);
  });

  it('scores an early-morning largest meal at the kapha weight, with a midday nudge', () => {
    const r = agniScore([{ minuteOfDay: 420, carbsG: 80 }]); // 07:00 breakfast, largest
    expect(r!.components.largestMealTiming).toBe(AGNI_WEIGHTS.largestMealTiming.kapha_morning);
    expect(r!.nudges.some((n) => n.includes('Pitta window'))).toBe(true);
  });

  it('uses the largest evening meal as the graded dinner, and the latest evening meal for lead time', () => {
    const r = agniScore([
      { minuteOfDay: 780, carbsG: 90 }, // midday, largest overall
      { minuteOfDay: 1150, carbsG: 55 }, // 19:10 - bigger evening meal (dinner)
      { minuteOfDay: 1200, carbsG: 15 }, // 20:00 snack - later but lighter
    ]);
    expect(r!.dinner!.carbsG).toBe(55);
    expect(r!.lastEveningMeal!.minuteOfDay).toBe(1200);
    // lead from 20:00 to 22:30 = 150 min >= 150 target.
    expect(r!.components.dinnerLead).toBe(20);
    expect(r!.components.dinnerLightness).toBe(AGNI_WEIGHTS.dinnerLightness.moderate);
  });

  it('caps the score at 100 and keeps it an integer', () => {
    const r = agniScore([
      { minuteOfDay: 780, carbsG: 75 },
      { minuteOfDay: 1230, carbsG: 45 },
    ]);
    expect(Number.isInteger(r!.score)).toBe(true);
    expect(r!.score).toBeLessThanOrEqual(100);
    expect(r!.score).toBeGreaterThanOrEqual(0);
  });

  it('never returns more than three nudges', () => {
    const r = agniScore([
      { minuteOfDay: 300, carbsG: 90 }, // night + largest at night
      { minuteOfDay: 1290, carbsG: 80 }, // late, heavy dinner
      { minuteOfDay: 1150, carbsG: 50 },
    ]);
    expect(r!.nudges.length).toBeLessThanOrEqual(3);
  });

  it('ignores malformed rows instead of crashing', () => {
    const r = agniScore([{ minuteOfDay: NaN, carbsG: 40 }, { minuteOfDay: 700, carbsG: 50 }]);
    expect(r).not.toBeNull();
    expect(r!.largestMeal!.minuteOfDay).toBe(700);
  });
});

describe('lateMealBanner', () => {
  it('stays quiet through breakfast, midday and a normal dinner hour', () => {
    expect(lateMealBanner(480)).toBeNull(); // 08:00
    expect(lateMealBanner(780)).toBeNull(); // 13:00
    expect(lateMealBanner(1140)).toBeNull(); // 19:00
    expect(lateMealBanner(1229)).toBeNull(); // 20:29
    expect(lateMealBanner(360)).toBeNull(); // 06:00
  });

  it('triggers from 20:30 onward (inside the 2.5-h pre-sleep zone)', () => {
    const b = lateMealBanner(1230); // 20:30
    expect(b).not.toBeNull();
    expect(b!.window).toBe('kapha_evening');
    expect(b!.title).toBe('Logged in a low-agni window');
    expect(b!.body).toContain('winding down');
  });

  it('triggers through the night window with the resting wording', () => {
    const b = lateMealBanner(1410); // 23:30
    expect(b!.window).toBe('night');
    expect(b!.body).toContain('at rest');

    const dawn = lateMealBanner(120); // 02:00
    expect(dawn!.window).toBe('night');
  });

  it('stops at 06:00 sharp', () => {
    expect(lateMealBanner(359)).not.toBeNull();
    expect(lateMealBanner(360)).toBeNull();
  });

  it('throws on invalid minutes like the window function does', () => {
    expect(() => lateMealBanner(-5)).toThrow();
    expect(() => lateMealBanner(1500)).toThrow();
  });
});

describe('lens bridge and disclaimer', () => {
  it('pins the three rhythm habit slugs from the healing-foods knowledge base', () => {
    expect(AGNI_HABIT_SLUGS).toEqual(['post-meal-10min-walk', 'plate-order-veg-first', 'early-dinner']);
  });

  it('ships a medication-aware disclaimer', () => {
    expect(AGNI_DISCLAIMER.toLowerCase()).toContain('not medical advice');
    expect(AGNI_DISCLAIMER).toContain('insulin or sulfonylureas');
  });

  it('exposes readable targets the card can quote', () => {
    expect(AGNI_TARGETS.sleepMin).toBe(1350);
    expect(AGNI_TARGETS.dinnerLeadMin).toBe(150);
    expect(AGNI_TARGETS.dinnerLightCarbG).toBe(45);
  });
});
