import { describe, it, expect } from 'vitest';
import { HEALING_FOODS, HEALING_FOOD_INDEX } from '../index';
import { validateHealingFood, lensesOf, type HealingFood } from '@mi/engine';

const FORBIDDEN = /\b(cure|curative|treat(?:s|ed|ment)?|revers(?:e|es|ed|ing|al)?)\b/i;
const SEASON_IDS = ['shishira', 'vasant', 'grishma', 'varsha', 'sharad', 'hemant'];
const MED_CAUTION_SLUGS = [
  'fenugreek-seeds-methi',
  'bitter-gourd-karela',
  'vinegar-before-meals',
  'early-dinner',
];

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectStrings);
  return [];
}

describe('healing foods knowledge base (P4c §5 starter set)', () => {
  it('ships the approved 16-entry starter set', () => {
    expect(HEALING_FOODS.length).toBe(16);
  });

  it('has unique kebab-case slugs', () => {
    const slugs = HEALING_FOODS.map((f) => f.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('every entry passes the editorial validator', () => {
    for (const f of HEALING_FOODS) {
      expect(validateHealingFood(f), `problems on ${f.slug}`).toEqual([]);
    }
  });

  it('every entry has at least one lens payload', () => {
    for (const f of HEALING_FOODS) {
      expect(lensesOf(f).length, f.slug).toBeGreaterThan(0);
    }
  });

  it('grade mix matches the approved table: A x1, B x7, C x7, D x1', () => {
    const grades = HEALING_FOODS.map((f) => f.science?.grade).filter(Boolean) as string[];
    expect(grades.length).toBe(16);
    expect(grades.filter((g) => g === 'A').length).toBe(1);
    expect(grades.filter((g) => g === 'B').length).toBe(7);
    expect(grades.filter((g) => g === 'C').length).toBe(7);
    expect(grades.filter((g) => g === 'D').length).toBe(1);
  });

  it('every D-grade entry carries a debunk pair (claim + verdict)', () => {
    for (const f of HEALING_FOODS) {
      if (f.science?.grade === 'D') {
        expect(f.science.debunk?.claim.length ?? 0, f.slug).toBeGreaterThan(8);
        expect(f.science.debunk?.verdict.length ?? 0, f.slug).toBeGreaterThan(8);
      }
    }
  });

  it('flagship facts hold: walk is A, okra is D with debunk, vinegar and plate-order carry no ayurveda lens', () => {
    const bySlug: Record<string, HealingFood> = Object.fromEntries(
      HEALING_FOODS.map((f) => [f.slug, f]),
    );
    expect(bySlug['post-meal-10min-walk'].science?.grade).toBe('A');
    expect(bySlug['okra-bhindi'].science?.grade).toBe('D');
    expect(bySlug['okra-bhindi'].science?.debunk).toBeDefined();
    expect(bySlug['vinegar-before-meals'].ayurveda).toBeUndefined();
    expect(bySlug['plate-order-veg-first'].ayurveda).toBeUndefined();
  });

  it('med-interaction cautions render where the spec requires them', () => {
    const bySlug: Record<string, HealingFood> = Object.fromEntries(
      HEALING_FOODS.map((f) => [f.slug, f]),
    );
    for (const slug of MED_CAUTION_SLUGS) {
      expect(bySlug[slug]?.cautions?.length ?? 0, slug).toBeGreaterThan(0);
    }
  });

  it('season references are valid Ritucharya ids', () => {
    for (const f of HEALING_FOODS) {
      for (const s of f.ayurveda?.seasons ?? []) {
        expect(SEASON_IDS, f.slug).toContain(s);
      }
    }
  });

  it('uses no cure/treatment/reverse language anywhere in the dataset', () => {
    for (const f of HEALING_FOODS) {
      for (const s of collectStrings(f)) {
        expect(s.match(FORBIDDEN), `${f.slug}: "${s}"`).toBeNull();
      }
    }
  });

  it('HEALING_FOOD_INDEX mirrors the dataset by slug', () => {
    for (const f of HEALING_FOODS) {
      expect(HEALING_FOOD_INDEX[f.slug]).toBe(f);
    }
    expect(Object.keys(HEALING_FOOD_INDEX).length).toBe(HEALING_FOODS.length);
  });
});
