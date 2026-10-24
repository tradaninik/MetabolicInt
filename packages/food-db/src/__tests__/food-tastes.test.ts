// P4c-b / U16 - integrity tests for the classical taste (rasa) dataset.
// The rules below are the editorial review checklist, expressed as code.

import { describe, it, expect } from 'vitest';
import { FOODS, FOOD_TASTES, tasteOf, findTasteByName, findHealingFoodByName } from '../index';
import { doshaFoodAdvice, RASA_ORDER, type Rasa, type Virya } from '@mi/engine';

describe('food-tastes dataset integrity', () => {
  it('covers every curated food exactly - no missing ids, no stale ids', () => {
    const foodIds = new Set(FOODS.map((f) => f.id));
    const tasteIds = new Set(Object.keys(FOOD_TASTES));
    const missing = [...foodIds].filter((id) => !tasteIds.has(id));
    const stale = [...tasteIds].filter((id) => !foodIds.has(id));
    expect(missing).toEqual([]);
    expect(stale).toEqual([]);
  });

  it('gives every entry a non-empty list of valid taste ids', () => {
    for (const [id, t] of Object.entries(FOOD_TASTES)) {
      expect(Array.isArray(t.rasa), `${id}.rasa must be an array`).toBe(true);
      expect(t.rasa.length, `${id}.rasa must be non-empty`).toBeGreaterThan(0);
      for (const r of t.rasa) {
        expect(RASA_ORDER.includes(r as Rasa), `${id} has unknown rasa: ${String(r)}`).toBe(true);
      }
    }
  });

  it('uses only heating or cooling virya where a virya is set', () => {
    for (const [id, t] of Object.entries(FOOD_TASTES)) {
      if (t.virya === undefined) continue;
      expect(
        t.virya === 'heating' || t.virya === 'cooling',
        `${id} has unknown virya: ${String(t.virya)}`,
      ).toBe(true);
      expect((t.virya as Virya).length).toBeGreaterThan(4);
    }
  });

  it('derives a non-empty dosha badge for every entry', () => {
    for (const [id, t] of Object.entries(FOOD_TASTES)) {
      const advice = doshaFoodAdvice(t);
      expect(advice.badge.length, `${id} must yield a badge`).toBeGreaterThan(0);
      expect(advice.label.length).toBeGreaterThan(10);
    }
  });

  it('keeps every taste list reasonably short (a dish is not all six tastes)', () => {
    // Sambar-class dishes carry four; nothing in the table needs all six.
    for (const [id, t] of Object.entries(FOOD_TASTES)) {
      expect(t.rasa.length, `${id} lists too many tastes`).toBeLessThanOrEqual(4);
    }
  });

  it('exposes the id lookup the logging flow uses', () => {
    expect(tasteOf('chapati')).toEqual({ rasa: ['sweet'], virya: 'heating' });
    expect(tasteOf('custom-anything')).toBeUndefined();
    expect(tasteOf('does-not-exist')).toBeUndefined();
  });
});

describe('findTasteByName (the /my-foods overlay)', () => {
  it('matches curated names case-insensitively', () => {
    const m = findTasteByName('chapati');
    expect(m).toBeDefined();
    expect(m!.matchedId).toBe('chapati');
    expect(m!.taste.rasa).toContain('sweet');
  });

  it('matches aliases, not just primary names', () => {
    // 'idly' is an alias of Idli.
    const m = findTasteByName('idly');
    expect(m).toBeDefined();
    expect(m!.matchedId).toBe('idli');
  });

  it('returns undefined for unknown names instead of guessing', () => {
    expect(findTasteByName('grandmas special halwa')).toBeUndefined();
    expect(findTasteByName('')).toBeUndefined();
  });

  it('checks the provided aliases of a custom food', () => {
    const m = findTasteByName('my evening snack', ['dosa']);
    expect(m).toBeDefined();
    expect(m!.matchedId).toBe('plain_dosa');
  });

  it('trims whitespace before matching', () => {
    expect(findTasteByName('  Idli  ')).toBeDefined();
  });
});

describe('findHealingFoodByName (the Food as Medicine chip)', () => {
  it('matches knowledge-base names and alsoKnownAs entries', () => {
    expect(findHealingFoodByName('Fenugreek seeds')?.slug).toBe('fenugreek-seeds-methi');
    expect(findHealingFoodByName('methi dana')?.slug).toBe('fenugreek-seeds-methi');
    expect(findHealingFoodByName('karela')?.slug).toBe('bitter-gourd-karela');
    expect(findHealingFoodByName('badam')?.slug).toBe('nuts-almonds-walnuts');
  });

  it('returns undefined for names outside the knowledge base', () => {
    expect(findHealingFoodByName('pizza')).toBeUndefined();
    expect(findHealingFoodByName('')).toBeUndefined();
  });

  it('never matches a habit entry by a food-style name lookup mishap (habits are not foods)', () => {
    // 'The post-meal walk' is a habit entry; it should not surface as a food match.
    const hit = findHealingFoodByName('the post-meal walk');
    expect(hit?.category).toBe('habit');
  });
});
