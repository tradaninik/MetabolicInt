import { describe, it, expect } from 'vitest';
import { PRAKRITI_QUESTIONS, QUIZ_VERSION, scorePrakriti } from './prakriti';

const ids = PRAKRITI_QUESTIONS.map((q) => q.id);

function all(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of ids) out[id] = tag;
  return out;
}

function mix(nV: number, nP: number, nK: number): Record<string, string> {
  const out: Record<string, string> = {};
  ids.forEach((id, i) => {
    out[id] = i < nV ? 'vata' : i < nV + nP ? 'pitta' : 'kapha';
  });
  return out;
}

describe('scorePrakriti', () => {
  it('scores a unanimous vata profile with 100% vata', () => {
    expect(scorePrakriti(all('vata'))).toEqual({
      vata: 12, pitta: 0, kapha: 0,
      vataPct: 100, pittaPct: 0, kaphaPct: 0,
      primary: 'vata', secondary: 'pitta',
      profileLabel: 'Vata primary · Pitta secondary',
      isTie: false,
      quizVersion: QUIZ_VERSION,
    });
  });

  it('three-way tie: legacy fields keep canonical order, but the label names all three (no dominance)', () => {
    const r = scorePrakriti(mix(4, 4, 4));
    // Legacy order preserved for stored rows / API compat:
    expect(r.primary).toBe('vata');
    expect(r.secondary).toBe('pitta');
    // S2-B1: the label every UI must lead with:
    expect(r.profileLabel).toBe('Vata–Pitta–Kapha profile');
    expect(r.isTie).toBe(true);
    expect(r.vataPct + r.pittaPct + r.kaphaPct).toBe(100);
  });

  it('two-way vata/pitta tie (42/42/16): label is "Vata–Pitta profile", never "Vata primary"', () => {
    const r = scorePrakriti(mix(5, 5, 2));
    expect(r.primary).toBe('vata');
    expect(r.secondary).toBe('pitta');
    expect(r.profileLabel).toBe('Vata–Pitta profile');
    expect(r.isTie).toBe(true);
    expect(r.vataPct).toBe(42);
    expect(r.pittaPct).toBe(42);
    expect(r.kaphaPct).toBe(16);
  });

  it('two-way pitta/kapha tie: label names both, ordered by count then canonical order', () => {
    const r = scorePrakriti(mix(2, 5, 5));
    expect(r.primary).toBe('pitta');
    expect(r.secondary).toBe('kapha');
    expect(r.profileLabel).toBe('Pitta–Kapha profile');
    expect(r.isTie).toBe(true);
  });

  it('two-way vata/kapha tie: canonical order puts Vata first in the label', () => {
    const r = scorePrakriti(mix(5, 2, 5));
    expect(r.profileLabel).toBe('Vata–Kapha profile');
    expect(r.isTie).toBe(true);
  });

  it('clear winner keeps the primary/secondary label; a 1-answer gap is NOT a tie', () => {
    const r = scorePrakriti(mix(5, 4, 3));
    expect(r.profileLabel).toBe('Vata primary · Pitta secondary');
    expect(r.isTie).toBe(false);
  });

  it('scores a mixed profile with a clear winner', () => {
    const r = scorePrakriti(mix(2, 6, 4));
    expect(r.primary).toBe('pitta');
    expect(r.secondary).toBe('kapha');
    expect(r.profileLabel).toBe('Pitta primary · Kapha secondary');
    expect(r.isTie).toBe(false);
    expect(r.vataPct + r.pittaPct + r.kaphaPct).toBe(100);
  });

  it('stamps every result with the questionnaire version', () => {
    expect(QUIZ_VERSION).toBe(1);
    expect(scorePrakriti(all('vata')).quizVersion).toBe(QUIZ_VERSION);
  });

  it('rejects unknown question ids and invalid dosha tags', () => {
    expect(() => scorePrakriti({ nope: 'vata' })).toThrow();
    const bad: Record<string, string> = {};
    bad[ids[0]] = 'dosha';
    expect(() => scorePrakriti(bad)).toThrow();
  });
});