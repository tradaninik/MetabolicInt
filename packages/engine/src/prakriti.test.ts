import { describe, it, expect } from 'vitest';
import { PRAKRITI_QUESTIONS, scorePrakriti } from './prakriti';

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
    });
  });

  it('breaks a three-way tie vata > pitta > kapha', () => {
    const r = scorePrakriti(mix(4, 4, 4));
    expect(r.primary).toBe('vata');
    expect(r.secondary).toBe('pitta');
    expect(r.vataPct + r.pittaPct + r.kaphaPct).toBe(100);
  });

  it('breaks a two-way vata/pitta tie toward vata (42/42/16)', () => {
    const r = scorePrakriti(mix(5, 5, 2));
    expect(r.primary).toBe('vata');
    expect(r.secondary).toBe('pitta');
    expect(r.vataPct).toBe(42);
    expect(r.pittaPct).toBe(42);
    expect(r.kaphaPct).toBe(16);
  });

  it('breaks a two-way pitta/kapha tie toward pitta', () => {
    const r = scorePrakriti(mix(2, 5, 5));
    expect(r.primary).toBe('pitta');
    expect(r.secondary).toBe('kapha');
  });

  it('scores a mixed profile with a clear winner', () => {
    const r = scorePrakriti(mix(2, 6, 4));
    expect(r.primary).toBe('pitta');
    expect(r.secondary).toBe('kapha');
    expect(r.vataPct + r.pittaPct + r.kaphaPct).toBe(100);
  });

  it('rejects unknown question ids and invalid dosha tags', () => {
    expect(() => scorePrakriti({ nope: 'vata' })).toThrow();
    const bad: Record<string, string> = {};
    bad[ids[0]] = 'dosha';
    expect(() => scorePrakriti(bad)).toThrow();
  });
});