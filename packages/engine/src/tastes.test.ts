// P4c / U16 - tests for the taste (rasa) engine: matrix, badge derivation, meal aggregation.

import { describe, it, expect } from 'vitest';
import {
  RASA_ORDER,
  RASA_META,
  RASA_DOSHA_MATRIX,
  doshaFoodAdvice,
  mealTasteBalance,
  TASTE_DISCLAIMER,
  type Rasa,
} from './tastes';

describe('rasa meta integrity', () => {
  it('has the six classical tastes in canonical order', () => {
    expect(RASA_ORDER).toEqual(['sweet', 'sour', 'salty', 'bitter', 'pungent', 'astringent']);
  });

  it('carries a meta entry with a non-empty label and hint for every taste', () => {
    for (const r of RASA_ORDER) {
      const m = RASA_META[r as Rasa];
      expect(m.id).toBe(r);
      expect(m.label.length).toBeGreaterThan(2);
      expect(m.hint.length).toBeGreaterThan(20);
    }
  });

  it('carries the classical saptarasa-dosha matrix values', () => {
    expect(RASA_DOSHA_MATRIX.sweet).toEqual({ pacifies: ['vata', 'pitta'], aggravates: ['kapha'] });
    expect(RASA_DOSHA_MATRIX.sour).toEqual({ pacifies: ['vata'], aggravates: ['pitta', 'kapha'] });
    expect(RASA_DOSHA_MATRIX.salty).toEqual({ pacifies: ['vata'], aggravates: ['pitta', 'kapha'] });
    expect(RASA_DOSHA_MATRIX.bitter).toEqual({ pacifies: ['pitta', 'kapha'], aggravates: ['vata'] });
    expect(RASA_DOSHA_MATRIX.pungent).toEqual({ pacifies: ['kapha'], aggravates: ['vata', 'pitta'] });
    expect(RASA_DOSHA_MATRIX.astringent).toEqual({ pacifies: ['pitta', 'kapha'], aggravates: ['vata'] });
  });
});

describe('doshaFoodAdvice', () => {
  it('derives the sweet-food badge: pacifies V and P, aggravates K', () => {
    const a = doshaFoodAdvice({ rasa: ['sweet'], virya: 'cooling' });
    expect(a.pacifies).toEqual(['vata', 'pitta']);
    expect(a.aggravates).toEqual(['kapha']);
    expect(a.mixed).toEqual([]);
    expect(a.badge).toBe('V- P- K+');
    expect(a.label).toContain('pacifies vata and pitta');
    expect(a.label).toContain('aggravates kapha');
  });

  it('marks a dosha touched both ways by a mixed taste profile (sour + pungent)', () => {
    // sour: pacifies V, aggravates P+K; pungent: pacifies K, aggravates V+P.
    const a = doshaFoodAdvice({ rasa: ['sour', 'pungent'], virya: 'heating' });
    expect(a.mixed).toEqual(['vata', 'kapha']);
    expect(a.aggravates).toEqual(['pitta']);
    expect(a.pacifies).toEqual([]);
    expect(a.badge).toBe('V+/- P+ K+/-');
  });

  it('badge parts always render in V, P, K order and skip neutral doshas', () => {
    // bitter + astringent: both pacify P+K, aggravate V -> "V+ P- K-".
    const a = doshaFoodAdvice({ rasa: ['bitter', 'astringent'] });
    expect(a.badge).toBe('V+ P- K-');
  });

  it('throws on an invalid taste payload instead of guessing', () => {
    expect(() => doshaFoodAdvice({ rasa: [] as Rasa[] })).toThrow();
    expect(() => doshaFoodAdvice({ rasa: ['umami'] as unknown as Rasa[] })).toThrow();
    expect(() => doshaFoodAdvice(undefined as unknown as { rasa: Rasa[] })).toThrow();
  });

  it('never mutates the input taste list', () => {
    const rasa: Rasa[] = ['sweet', 'sour'];
    doshaFoodAdvice({ rasa });
    expect(rasa).toEqual(['sweet', 'sour']);
  });
});

describe('mealTasteBalance', () => {
  it('counts tastes across items and reports honest coverage', () => {
    const b = mealTasteBalance([
      { rasa: ['sweet', 'astringent'], virya: 'cooling' }, // e.g. moong dal
      { rasa: ['sweet'], virya: 'cooling' }, // e.g. rice
      { rasa: ['sour', 'pungent'], virya: 'heating' }, // e.g. sambar
      {}, // a custom food with no classical data
    ]);
    expect(b.coverage).toEqual({ known: 3, total: 4 });
    expect(b.counts.sweet).toBe(2);
    expect(b.counts.sour).toBe(1);
    expect(b.counts.pungent).toBe(1);
    expect(b.counts.astringent).toBe(1);
    expect(b.counts.salty).toBe(0);
    expect(b.dominant).toEqual(['sweet']);
    expect(b.virya).toEqual({ heating: 1, cooling: 2 });
  });

  it('breaks dominance ties in canonical RASA_ORDER, never input order', () => {
    const b = mealTasteBalance([
      { rasa: ['pungent'] },
      { rasa: ['sweet'] },
    ]);
    // sweet comes first in RASA_ORDER even though pungent was seen first.
    expect(b.dominant).toEqual(['sweet', 'pungent']);
    expect(b.summary).toContain('sweet and pungent');
  });

  it('combines dosha effects across the whole meal, including mixed verdicts', () => {
    const b = mealTasteBalance([
      { rasa: ['sweet'] },
      { rasa: ['bitter'] },
    ]);
    // sweet pacifies V+P / aggravates K; bitter pacifies P+K / aggravates V.
    // Pitta pacified by both; Vata and Kapha touched both ways -> mixed.
    expect(b.dosha.pacifies).toEqual(['pitta']);
    expect(b.dosha.aggravates).toEqual([]);
    expect(b.dosha.mixed).toEqual(['vata', 'kapha']);
    expect(b.dosha.badge).toBe('V+/- P- K+/-');
  });

  it('returns a clean unknown state when no item has taste data', () => {
    const b = mealTasteBalance([{ grams: 100 }, {}, {}]);
    expect(b.coverage).toEqual({ known: 0, total: 3 });
    expect(b.dominant).toEqual([]);
    expect(b.dosha.badge).toBe('');
    expect(b.summary).toContain('No classical taste data');
  });

  it('handles an empty tray without throwing', () => {
    const b = mealTasteBalance([]);
    expect(b.coverage).toEqual({ known: 0, total: 0 });
    expect(b.summary).toContain('No classical taste data');
  });

  it('flags unknown items in the summary so the UI never overstates coverage', () => {
    const b = mealTasteBalance([{ rasa: ['sweet'] }, {}]);
    expect(b.summary).toContain('1 of 2');
    expect(b.summary).toContain('1 without classical data');
  });
});

describe('disclaimer', () => {
  it('ships a non-empty educational disclaimer', () => {
    expect(TASTE_DISCLAIMER.length).toBeGreaterThan(80);
    expect(TASTE_DISCLAIMER.toLowerCase()).toContain('not medical advice');
  });
});
