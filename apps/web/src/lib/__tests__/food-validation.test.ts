import { describe, it, expect } from 'vitest';
import { FOOD_INDEX } from '@mi/food-db';
import {
  validateCustomFood, atwaterKcal,
  CATEGORY_VALUES, REGION_VALUES, GI_BANDS, MAX_CUSTOM_FOODS_PER_USER,
} from '../food-validation';
import type { CuisineRegion } from '@mi/engine';

const FALLBACK_REGION = [...REGION_VALUES][0] as CuisineRegion;
const base = { fallbackRegion: FALLBACK_REGION };

describe('spec pin - docs/CUSTOM-FOODS-V2.md sections 5 and 11', () => {
  it('engine unions pinned: 13 categories (incl nut, unused by catalog), 11 regions', () => {
    expect(CATEGORY_VALUES.size).toBe(13);
    expect(CATEGORY_VALUES.has('nut')).toBe(true); // the 13th: catalog has no nut foods
    expect(REGION_VALUES.size).toBe(11);
    expect(CATEGORY_VALUES.has('snack')).toBe(true); // the default category
  });

  it('catalog categories and regions are subsets of the unions', () => {
    for (const f of Object.values(FOOD_INDEX)) {
      expect(CATEGORY_VALUES.has(f.category), `category ${f.category}`).toBe(true);
      expect(REGION_VALUES.has(f.region), `region ${f.region}`).toBe(true);
    }
  });

  it('GI bands are 40/55/70/85', () => {
    expect(GI_BANDS.map((b) => b.value)).toEqual([40, 55, 70, 85]);
  });

  it('cap is 100 custom foods per user', () => {
    expect(MAX_CUSTOM_FOODS_PER_USER).toBe(100);
  });
});

describe('validateCustomFood', () => {
  it('accepts a name-only food and defaults everything (promptless law)', () => {
    const r = validateCustomFood({ name: 'My idli batter' }, base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toMatchObject({
      name: 'My idli batter', category: 'snack', region: FALLBACK_REGION,
      servingGrams: 100, katoriGrams: null,
      carbsPer100g: 0, proteinPer100g: 0, fatPer100g: 0, fiberPer100g: 0,
      gi: 55, aliases: null,
    });
    expect(r.data.kcalPer100g).toBe(0);
  });

  it('cleans the name: strips control chars, collapses whitespace, trims', () => {
    const r = validateCustomFood({ name: '  Cha\u0000wal   dosa \n' }, base);
    expect(r.ok && r.data.name).toBe('Chawal dosa');
  });

  it('rejects bad names and non-object bodies', () => {
    expect(validateCustomFood({ name: 'a' }, base).ok).toBe(false);
    expect(validateCustomFood({ name: 'x'.repeat(61) }, base).ok).toBe(false);
    expect(validateCustomFood({ name: 'x'.repeat(60) }, base).ok).toBe(true);
    expect(validateCustomFood({}, base).ok).toBe(false);
    expect(validateCustomFood(null, base).ok).toBe(false);
  });

  it('validates category and region against the union sets', () => {
    const r = validateCustomFood({ name: 'Test', category: 'nope', region: 'mars' }, base);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.category).toBeDefined();
    expect(r.errors.region).toBeDefined();
  });

  it('accepts a nut-category food (catalog never uses it, customs may)', () => {
    const r = validateCustomFood({ name: 'My walnut mix', category: 'nut' }, base);
    expect(r.ok && r.data.category).toBe('nut');
  });

  it('rejects an invalid fallback region too', () => {
    expect(validateCustomFood({ name: 'Test' }, { fallbackRegion: 'atlantis' as CuisineRegion }).ok).toBe(false);
  });

  it('accepts numeric strings from forms and enforces ranges', () => {
    const r = validateCustomFood({ name: 'Test', servingGrams: '150', katoriGrams: '200' }, base);
    expect(r.ok && r.data.servingGrams).toBe(150);
    expect(r.ok && r.data.katoriGrams).toBe(200);
    expect(validateCustomFood({ name: 'Test', servingGrams: 0 }, base).ok).toBe(false);
    expect(validateCustomFood({ name: 'Test', servingGrams: 2001 }, base).ok).toBe(false);
    expect(validateCustomFood({ name: 'Test', katoriGrams: 0 }, base).ok).toBe(false);
    expect(validateCustomFood({ name: 'Test', carbsPer100g: 100.5 }, base).ok).toBe(false);
    expect(validateCustomFood({ name: 'Test', carbsPer100g: -1 }, base).ok).toBe(false);
    expect(validateCustomFood({ name: 'Test', carbsPer100g: 100 }, base).ok).toBe(true);
  });

  it('computes Atwater kcal when blank: 4c + 4p + 9f', () => {
    expect(atwaterKcal(50, 10, 5)).toBe(285);
    const r = validateCustomFood({ name: 'Test', carbsPer100g: 50, proteinPer100g: 10, fatPer100g: 5 }, base);
    expect(r.ok && r.data.kcalPer100g).toBe(285);
  });

  it('keeps a supplied kcal instead of Atwater, within 0-900', () => {
    const r = validateCustomFood({ name: 'Test', carbsPer100g: 50, kcalPer100g: 450 }, base);
    expect(r.ok && r.data.kcalPer100g).toBe(450);
    expect(validateCustomFood({ name: 'Test', kcalPer100g: 901 }, base).ok).toBe(false);
    expect(validateCustomFood({ name: 'Test', kcalPer100g: -1 }, base).ok).toBe(false);
  });

  it('rejects macros implying more than 900 kcal/100g via Atwater', () => {
    const r = validateCustomFood({ name: 'Test', carbsPer100g: 100, proteinPer100g: 100, fatPer100g: 100 }, base);
    expect(r.ok).toBe(false);
    if (r.ok) return; // unexpected success - bail before the error shape
    expect(r.errors.kcalPer100g).toBeDefined();
  });

  it('GI: defaults 55, rejects 0 and out-of-range, accepts strings', () => {
    const d = validateCustomFood({ name: 'Test' }, base);
    expect(d.ok && d.data.gi).toBe(55);
    expect(validateCustomFood({ name: 'Test', gi: 0 }, base).ok).toBe(false);
    expect(validateCustomFood({ name: 'Test', gi: 101 }, base).ok).toBe(false);
    const s = validateCustomFood({ name: 'Test', gi: '70' }, base);
    expect(s.ok && s.data.gi).toBe(70);
  });

  it('aliases: comma-split, trimmed, JSON-encoded, max 5, 40 chars', () => {
    const r = validateCustomFood({ name: 'Test', aliases: ' chawal , anna ,, atta ' }, base);
    expect(r.ok && r.data.aliases).toBe(JSON.stringify(['chawal', 'anna', 'atta']));
    const blank = validateCustomFood({ name: 'Test', aliases: '' }, base);
    expect(blank.ok && blank.data.aliases).toBeNull();
    expect(validateCustomFood({ name: 'Test', aliases: 'a,b,c,d,e,f' }, base).ok).toBe(false);
    expect(validateCustomFood({ name: 'Test', aliases: 'x'.repeat(41) }, base).ok).toBe(false);
    expect(validateCustomFood({ name: 'Test', aliases: ['a'] }, base).ok).toBe(false);
  });
});