import { describe, it, expect } from 'vitest';
import { HEALING_FOODS } from '../index';
import { validateHealingFood } from '@mi/engine';

// P5 - Ancient practice (tradition) coverage over the shipped dataset.
// Complements healing-foods.test.ts: every tradition block validates, the
// coverage set is explicit (the two deliberately tradition-free entries stay
// honest), and the vocabulary stays educational.

const FORBIDDEN = /\b(cure|curative|treat(?:s|ed|ment)?|revers(?:e|es|ed|ing|al)?)\b/i;

/** Entries that deliberately carry no tradition content: vinegar and plate
 *  order are modern/medical habits with no classical Ayurvedic practice
 *  behind them - honest coverage beats padding (dataset policy). */
const TRADITION_FREE = new Set(['vinegar-before-meals', 'plate-order-veg-first']);

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectStrings);
  return [];
}

describe('healing foods tradition layer (P5)', () => {
  it('every tradition block passes the editorial validator', () => {
    for (const f of HEALING_FOODS) {
      expect(validateHealingFood(f), f.slug).toEqual([]);
    }
  });

  it('14 of 16 entries carry tradition content; the 2 skips are deliberate', () => {
    const withTradition = HEALING_FOODS.filter((f) => f.tradition);
    expect(withTradition.length).toBe(14);
    const skipped = HEALING_FOODS.filter((f) => !f.tradition).map((f) => f.slug);
    expect(skipped.sort()).toEqual([...TRADITION_FREE].sort());
  });

  it('every tradition block has classical sources and at least one practice', () => {
    for (const f of HEALING_FOODS) {
      const tr = f.tradition;
      if (!tr) continue;
      expect(tr.headline.length, f.slug).toBeGreaterThanOrEqual(8);
      expect(tr.classicalTexts?.length ?? 0, f.slug).toBeGreaterThanOrEqual(1);
      expect(tr.practices.length, f.slug).toBeGreaterThanOrEqual(1);
      for (const pr of tr.practices) {
        expect(pr.detail.length, `${f.slug}/${pr.name}`).toBeGreaterThanOrEqual(80);
      }
    }
  });

  it('tradition language stays educational (no cure/treatment/reverse)', () => {
    for (const f of HEALING_FOODS) {
      if (!f.tradition) continue;
      for (const s of collectStrings(f.tradition)) {
        expect(s.match(FORBIDDEN), `${f.slug}: "${s}"`).toBeNull();
      }
    }
  });

  it('classical sources are phrased as "as commonly taught" (honest attribution)', () => {
    for (const f of HEALING_FOODS) {
      for (const t of f.tradition?.classicalTexts ?? []) {
        // Either an honest hedged source or a clearly-labeled non-textual source
        // (household sayings, kitchen traditions, or the cultural Jambudvipa note).
        const hedged = t.includes('as commonly taught');
        const nonTextual = /household|kitchen tradition|oral tradition|Jambudvipa/.test(t);
        expect(hedged || nonTextual, `${f.slug}: "${t}"`).toBe(true);
      }
    }
  });
});
