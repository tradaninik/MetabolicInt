// Unit tests for attribution.ts - "Why was it high?" (dashboard revamp
// item 4). Written BEFORE the dashboard wiring, per the engine-first rule.
// The vocabulary is the contract: exactly three labels, association wording
// only - no test may pass if a row starts claiming causation.
import { describe, expect, it } from 'vitest';
import {
  ATTRIBUTION_LABELS,
  attributeDeviation,
  type AttributionInput,
} from './attribution';

const NOW = Date.UTC(2024, 5, 15, 8, 45, 0); // 14:15 IST, fixed

function baseInput(over: Partial<AttributionInput> = {}): AttributionInput {
  return {
    reading: { value: 168, takenAt: NOW },
    usual: { median: 142, n: 6 },
    deviation: 26,
    mealsBefore: [{ takenAt: NOW - 75 * 60_000, carbsG: 52, name: 'roti + dal' }],
    comparableMealCarbs: [48, 50, 51, 49],
    medSlotsBefore: [{ name: 'Metformin', slotTime: '07:30', status: 'taken' }],
    steps: { today: 2148, usualAvg: 5400 },
    sleep: { lastNight: 6.4, usualAvg: 7.2 },
    contextNotes: [{ tag: 'stress', note: 'work deadline' }],
    ...over,
  };
}

const CAUSAL_RE = /\b(caused|because|raised|spiked|drove|led to|made it)\b/i;

describe('attributeDeviation - trigger', () => {
  it('triggers only above the deviation threshold with enough pattern history', () => {
    expect(attributeDeviation(baseInput()).triggered).toBe(true);
    expect(attributeDeviation(baseInput({ deviation: 14 })).triggered).toBe(false);
    expect(attributeDeviation(baseInput({ deviation: null })).triggered).toBe(false);
    expect(attributeDeviation(baseInput({ usual: { median: 142, n: 2 } })).triggered).toBe(false);
  });

  it('a below-usual reading is not an investigation ("why was it high")', () => {
    expect(attributeDeviation(baseInput({ deviation: -20 })).triggered).toBe(false);
  });

  it('rows are computed even in the calm state (same table, different headline)', () => {
    const r = attributeDeviation(baseInput({ deviation: 5 }));
    expect(r.triggered).toBe(false);
    expect(r.rows).toHaveLength(5);
  });
});

describe('attributeDeviation - the three-label vocabulary', () => {
  it('exports exactly the three approved labels', () => {
    expect(ATTRIBUTION_LABELS).toEqual(['observed pattern', 'possible contributor', 'insufficient data']);
  });

  it('every row uses one of the three labels and association-only wording', () => {
    const r = attributeDeviation(baseInput());
    for (const row of r.rows) {
      expect(ATTRIBUTION_LABELS).toContain(row.label);
      expect(row.text.length).toBeGreaterThan(5);
      expect(CAUSAL_RE.test(row.text)).toBe(false);
    }
  });

  it('covers the five candidate factors in mockup order', () => {
    const r = attributeDeviation(baseInput());
    expect(r.rows.map((x) => x.factor)).toEqual(['meal', 'medication', 'activity', 'sleep', 'stress']);
  });
});

describe('attributeDeviation - meal row', () => {
  it('a clearly larger meal is a possible contributor with the comparison shown', () => {
    const r = attributeDeviation(baseInput({
      mealsBefore: [{ takenAt: NOW - 75 * 60_000, carbsG: 75, name: 'wedding thali' }],
    }));
    const meal = r.rows[0];
    expect(meal.label).toBe('possible contributor');
    expect(meal.text).toContain('75 g');
    expect(meal.text).toContain('50 g');
  });

  it('an on-par meal (the base case) is an observed pattern, not blamed', () => {
    const r = attributeDeviation(baseInput());
    expect(r.rows[0].label).toBe('observed pattern');
    expect(r.rows[0].text).toContain('usual 50 g');
  });

  it('no meal before the reading is insufficient data', () => {
    const r = attributeDeviation(baseInput({ mealsBefore: [] }));
    expect(r.rows[0].label).toBe('insufficient data');
  });

  it('a meal with almost no comparable days is insufficient data', () => {
    const r = attributeDeviation(baseInput({ comparableMealCarbs: [50] }));
    expect(r.rows[0].label).toBe('insufficient data');
  });

  it('meals older than 4 h do not count', () => {
    const r = attributeDeviation(baseInput({
      mealsBefore: [{ takenAt: NOW - 5 * 3_600_000, carbsG: 90, name: 'late breakfast' }],
    }));
    expect(r.rows[0].label).toBe('insufficient data');
  });
});

describe('attributeDeviation - medication row', () => {
  it('all scheduled doses taken is an observed pattern', () => {
    const r = attributeDeviation(baseInput());
    expect(r.rows[1].label).toBe('observed pattern');
    expect(r.rows[1].text).toContain('Metformin');
  });

  it('a skipped dose before the reading is a possible contributor', () => {
    const r = attributeDeviation(baseInput({
      medSlotsBefore: [{ name: 'Metformin', slotTime: '07:30', status: 'skipped' }],
    }));
    expect(r.rows[1].label).toBe('possible contributor');
    expect(r.rows[1].text).toContain('07:30');
  });

  it('no schedule at all is insufficient data', () => {
    const r = attributeDeviation(baseInput({ medSlotsBefore: [] }));
    expect(r.rows[1].label).toBe('insufficient data');
  });
});

describe('attributeDeviation - activity row', () => {
  it('steps far below usual is a possible contributor', () => {
    const r = attributeDeviation(baseInput());
    expect(r.rows[2].label).toBe('possible contributor');
    expect(r.rows[2].text).toContain('2,148');
    expect(r.rows[2].text).toContain('5,400');
  });

  it('steps on par with usual is an observed pattern', () => {
    const r = attributeDeviation(baseInput({ steps: { today: 5100, usualAvg: 5400 } }));
    expect(r.rows[2].label).toBe('observed pattern');
  });

  it('no baseline yet is insufficient data', () => {
    const r = attributeDeviation(baseInput({ steps: { today: 500, usualAvg: null } }));
    expect(r.rows[2].label).toBe('insufficient data');
  });
});

describe('attributeDeviation - sleep row', () => {
  it('a clearly short night is a possible contributor', () => {
    const r = attributeDeviation(baseInput());
    expect(r.rows[3].label).toBe('possible contributor');
    expect(r.rows[3].text).toContain('6.4 h');
    expect(r.rows[3].text).toContain('7.2 h');
  });

  it('a normal night is an observed pattern', () => {
    const r = attributeDeviation(baseInput({ sleep: { lastNight: 7.0, usualAvg: 7.2 } }));
    expect(r.rows[3].label).toBe('observed pattern');
  });

  it('missing history is insufficient data', () => {
    const r = attributeDeviation(baseInput({ sleep: { lastNight: null, usualAvg: null } }));
    expect(r.rows[3].label).toBe('insufficient data');
  });
});

describe('attributeDeviation - stress row', () => {
  it('a same-day stress note stays insufficient data - one note is not a pattern', () => {
    const r = attributeDeviation(baseInput());
    const stress = r.rows[4];
    expect(stress.label).toBe('insufficient data');
    expect(stress.text).toContain('work deadline');
  });

  it('no tags today is also insufficient data, stated plainly', () => {
    const r = attributeDeviation(baseInput({ contextNotes: [] }));
    expect(r.rows[4].text).toContain('no context tags');
  });
});

describe('attributeDeviation - evidence accounting', () => {
  it('totalEvidence is the sum of row evidence counts', () => {
    const r = attributeDeviation(baseInput());
    expect(r.totalEvidence).toBe(r.rows.reduce((a, x) => a + x.evidenceCount, 0));
    expect(r.totalEvidence).toBeGreaterThan(0);
  });
});
