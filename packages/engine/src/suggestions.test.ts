// Unit tests for suggestions.ts - "Today's suggestions" (dashboard revamp
// item 6). Every claim must be evidence-gated and association-worded; the
// causal-language regex is shared with the attribution tests.
import { describe, expect, it } from 'vitest';
import {
  deriveSuggestions,
  type DinnerRecord,
  type EveningRecord,
} from './suggestions';

const CAUSAL_RE = /\b(caused|because|lowers|raises|reduces|will lower|will raise|improves)\b/i;

function evening(date: string, walk: boolean, reading: number | null): EveningRecord {
  return { date, hasPostDinnerWalk: walk, bedtimeReading: reading };
}
function dinner(date: string, hour: number, fasting: number | null): DinnerRecord {
  return { date, dinnerHour: hour, nextMorningFasting: fasting };
}

describe('deriveSuggestions - walk pattern', () => {
  it('suggests the post-dinner walk with the evening counts as evidence', () => {
    const evenings = [
      evening('d1', true, 140),
      evening('d2', true, 138),
      evening('d3', true, 142),
      evening('d4', false, 155),
      evening('d5', false, 152),
    ];
    const s = deriveSuggestions({ evenings, dinners: [], medAdherence: null });
    const walk = s.find((x) => x.id === 'walk-after-dinner');
    expect(walk).toBeDefined();
    expect(walk!.source).toBe('from pattern');
    expect(walk!.body).toContain('3 of 5 evenings');
    expect(walk!.evidence.text).toBe('3 of 5 evenings');
    expect(walk!.action).toEqual({ label: 'Add to plan', kind: 'plan' });
    expect(CAUSAL_RE.test(walk!.body)).toBe(false);
  });

  it('no suggestion when the difference is under the threshold', () => {
    const evenings = [
      evening('d1', true, 150),
      evening('d2', true, 148),
      evening('d3', true, 152),
      evening('d4', false, 153),
      evening('d5', false, 151),
    ];
    const s = deriveSuggestions({ evenings, dinners: [], medAdherence: null });
    expect(s.find((x) => x.id === 'walk-after-dinner')).toBeUndefined();
  });

  it('no suggestion with too few walk evenings (evidence-gated)', () => {
    const evenings = [
      evening('d1', true, 140),
      evening('d2', true, 139),
      evening('d3', false, 160),
      evening('d4', false, 158),
    ];
    const s = deriveSuggestions({ evenings, dinners: [], medAdherence: null });
    expect(s.find((x) => x.id === 'walk-after-dinner')).toBeUndefined();
  });
});

describe('deriveSuggestions - dinner timing model', () => {
  it('suggests earlier dinners when late dinners associate with higher fasting', () => {
    const dinners = [
      dinner('d1', 21, 132),
      dinner('d2', 21.5, 136),
      dinner('d3', 18, 120),
      dinner('d4', 19, 122),
      dinner('d5', 20.5, 134),
      dinner('d6', 18.5, 121),
    ];
    const s = deriveSuggestions({ evenings: [], dinners, medAdherence: null });
    const d = s.find((x) => x.id === 'dinner-before-8');
    expect(d).toBeDefined();
    expect(d!.source).toBe('from model');
    expect(d!.body).toContain('3 later-dinner days');
    expect(d!.body).toContain('3 earlier-dinner days');
    expect(CAUSAL_RE.test(d!.body)).toBe(false);
  });

  it('no suggestion with fewer than 5 dinner+fasting days', () => {
    const dinners = [
      dinner('d1', 21, 140),
      dinner('d2', 18, 120),
      dinner('d3', 21, 138),
      dinner('d4', 18, 122),
    ];
    const s = deriveSuggestions({ evenings: [], dinners, medAdherence: null });
    expect(s.find((x) => x.id === 'dinner-before-8')).toBeUndefined();
  });

  it('no suggestion when late dinners do NOT associate with higher fasting', () => {
    const dinners = [
      dinner('d1', 21, 120),
      dinner('d2', 21, 122),
      dinner('d3', 18, 126),
      dinner('d4', 19, 128),
      dinner('d5', 20.5, 121),
      dinner('d6', 18.5, 127),
    ];
    const s = deriveSuggestions({ evenings: [], dinners, medAdherence: null });
    expect(s.find((x) => x.id === 'dinner-before-8')).toBeUndefined();
  });
});

describe('deriveSuggestions - evening dose reminder', () => {
  it('reminds about a missed evening dose with the week counts', () => {
    const s = deriveSuggestions({
      evenings: [],
      dinners: [],
      medAdherence: { name: 'Metformin 500 mg', slotTime: '21:00', missedThisWeek: 2, scheduledThisWeek: 7 },
    });
    const r = s.find((x) => x.source === 'reminder');
    expect(r).toBeDefined();
    expect(r!.body).toContain('2 of 7');
    expect(r!.body).toContain('21:00');
    expect(r!.action).toEqual({ label: 'Set reminder', kind: 'remind' });
  });

  it('no reminder when the week is perfect', () => {
    const s = deriveSuggestions({
      evenings: [],
      dinners: [],
      medAdherence: { name: 'Metformin 500 mg', slotTime: '21:00', missedThisWeek: 0, scheduledThisWeek: 7 },
    });
    expect(s.find((x) => x.source === 'reminder')).toBeUndefined();
  });
});

describe('deriveSuggestions - shape', () => {
  it('empty input yields an empty list (no filler suggestions)', () => {
    expect(deriveSuggestions({ evenings: [], dinners: [], medAdherence: null })).toEqual([]);
  });

  it('orders pattern before model before reminder', () => {
    const s = deriveSuggestions({
      evenings: [
        evening('d1', true, 140), evening('d2', true, 138), evening('d3', true, 142),
        evening('d4', false, 155), evening('d5', false, 152),
      ],
      dinners: [
        dinner('d1', 21, 132), dinner('d2', 21, 136), dinner('d3', 18, 120),
        dinner('d4', 19, 122), dinner('d5', 20.5, 134), dinner('d6', 18.5, 121),
      ],
      medAdherence: { name: 'M', slotTime: '21:00', missedThisWeek: 1, scheduledThisWeek: 7 },
    });
    expect(s.map((x) => x.source)).toEqual(['from pattern', 'from model', 'reminder']);
    expect(s).toHaveLength(3);
  });

  it('every suggestion carries inline numbers and a plan/remind action', () => {
    const s = deriveSuggestions({
      evenings: [
        evening('d1', true, 140), evening('d2', true, 138), evening('d3', true, 142),
        evening('d4', false, 155), evening('d5', false, 152),
      ],
      dinners: [],
      medAdherence: null,
    });
    for (const sug of s) {
      expect(sug.body).toMatch(/\d/);
      expect(['plan', 'remind']).toContain(sug.action.kind);
      expect(sug.evidence.count).toBeGreaterThan(0);
    }
  });
});
