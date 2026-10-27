// P8 Day 3 — catalog query validation unit tests (the pure core behind
// /api/recipes/catalog). Defaults, every single filter, AND-combination,
// every invalid value (plain-language 400-style errors), and q trimming.
// Expected error strings are built from the same vocabularies the module
// uses, so the assertions never rot when a vocabulary grows.

import { describe, it, expect } from 'vitest';
import {
  parseCatalogQuery,
  CATALOG_PAGE_DEFAULTS,
  CARB_TIERS,
} from '../catalog-filters';
import {
  CATALOG_MEAL_TYPES,
  CATALOG_CUISINES,
  CATALOG_TAGS,
} from '@mi/food-db';

function parse(params: Record<string, string> = {}) {
  return parseCatalogQuery(new URLSearchParams(params));
}

describe('parseCatalogQuery — defaults', () => {
  it('no params -> empty where, take 24, skip 0', () => {
    expect(parse()).toEqual({
      ok: true,
      where: {},
      take: CATALOG_PAGE_DEFAULTS.take,
      skip: 0,
    });
  });

  it('shares the page defaults with the route (take 24, max 60)', () => {
    expect(CATALOG_PAGE_DEFAULTS).toEqual({ take: 24, maxTake: 60 });
  });

  it('treats empty-string params as absent (a cleared filter sends "")', () => {
    const r = parse({ mealType: '', cuisine: '', carbTier: '', tag: '', q: '', take: '', skip: '' });
    expect(r).toEqual({ ok: true, where: {}, take: 24, skip: 0 });
  });
});

describe('parseCatalogQuery — valid single filters', () => {
  it('accepts every mealType in the vocabulary', () => {
    for (const mealType of CATALOG_MEAL_TYPES) {
      expect(parse({ mealType })).toEqual({
        ok: true,
        where: { mealType },
        take: 24,
        skip: 0,
      });
    }
  });

  it('accepts every cuisine in the vocabulary', () => {
    for (const cuisine of CATALOG_CUISINES) {
      expect(parse({ cuisine })).toEqual({
        ok: true,
        where: { cuisine },
        take: 24,
        skip: 0,
      });
    }
  });

  it('accepts every carbTier (LOW / MODERATE / HIGHER)', () => {
    for (const carbTier of CARB_TIERS) {
      expect(parse({ carbTier })).toEqual({
        ok: true,
        where: { carbTier },
        take: 24,
        skip: 0,
      });
    }
  });

  it('accepts every tag in the controlled vocabulary', () => {
    for (const tag of CATALOG_TAGS) {
      expect(parse({ tag })).toEqual({
        ok: true,
        where: { tag },
        take: 24,
        skip: 0,
      });
    }
  });

  it('passes q through as a name substring', () => {
    expect(parse({ q: 'paneer' })).toEqual({
      ok: true,
      where: { q: 'paneer' },
      take: 24,
      skip: 0,
    });
  });

  it('accepts take anywhere in 1..60 and skip 0 and up', () => {
    const one = parse({ take: '1' });
    expect(one.ok && one.take).toBe(1);
    const sixty = parse({ take: '60' });
    expect(sixty.ok && sixty.take).toBe(60);
    const zero = parse({ skip: '0' });
    expect(zero.ok && zero.skip).toBe(0);
    const fortyEight = parse({ skip: '48' });
    expect(fortyEight.ok && fortyEight.skip).toBe(48);
  });
});

describe('parseCatalogQuery — combined filters AND together', () => {
  it('every filter at once', () => {
    const r = parse({
      mealType: 'dinner',
      cuisine: 'telugu',
      carbTier: 'LOW',
      tag: 'high-fiber',
      q: 'paneer',
      take: '12',
      skip: '36',
    });
    expect(r).toEqual({
      ok: true,
      where: {
        mealType: 'dinner',
        cuisine: 'telugu',
        carbTier: 'LOW',
        tag: 'high-fiber',
        q: 'paneer',
      },
      take: 12,
      skip: 36,
    });
  });

  it('two filters alongside non-default pagination', () => {
    const r = parse({ mealType: 'snack', carbTier: 'HIGHER', take: '60', skip: '24' });
    expect(r).toEqual({
      ok: true,
      where: { mealType: 'snack', carbTier: 'HIGHER' },
      take: 60,
      skip: 24,
    });
  });
});

describe('parseCatalogQuery — invalid values get plain-language errors', () => {
  it('bad mealType names the vocabulary', () => {
    expect(parse({ mealType: 'brunch' })).toEqual({
      ok: false,
      error: `Unknown mealType. Use one of: ${CATALOG_MEAL_TYPES.join(', ')}.`,
    });
  });

  it('bad cuisine names the vocabulary', () => {
    expect(parse({ cuisine: 'indian' })).toEqual({
      ok: false,
      error: `Unknown cuisine. Use one of: ${CATALOG_CUISINES.join(', ')}.`,
    });
  });

  it('bad carbTier names the tiers', () => {
    expect(parse({ carbTier: 'medium' })).toEqual({
      ok: false,
      error: `Unknown carbTier. Use one of: ${CARB_TIERS.join(', ')}.`,
    });
  });

  it('bad tag names the controlled vocabulary', () => {
    expect(parse({ tag: 'keto' })).toEqual({
      ok: false,
      error: `Unknown tag. Use one of: ${CATALOG_TAGS.join(', ')}.`,
    });
  });

  it('take=0, take=61, take="abc" and non-integer take all fail the same way', () => {
    const error = `take must be a whole number between 1 and ${CATALOG_PAGE_DEFAULTS.maxTake}.`;
    expect(parse({ take: '0' })).toEqual({ ok: false, error });
    expect(parse({ take: '61' })).toEqual({ ok: false, error });
    expect(parse({ take: 'abc' })).toEqual({ ok: false, error });
    expect(parse({ take: '24.5' })).toEqual({ ok: false, error });
  });

  it('skip=-1 and skip="abc" fail with the skip message', () => {
    expect(parse({ skip: '-1' })).toEqual({
      ok: false,
      error: 'skip must be a whole number of 0 or more.',
    });
    expect(parse({ skip: 'abc' })).toEqual({
      ok: false,
      error: 'skip must be a whole number of 0 or more.',
    });
  });

  it('reports the first invalid param when several are bad', () => {
    expect(parse({ mealType: 'lunch', cuisine: 'bad', take: '99' })).toEqual({
      ok: false,
      error: `Unknown cuisine. Use one of: ${CATALOG_CUISINES.join(', ')}.`,
    });
  });
});

describe('parseCatalogQuery — q trimming', () => {
  it('trims surrounding whitespace from q', () => {
    expect(parse({ q: '  paneer  ' })).toEqual({
      ok: true,
      where: { q: 'paneer' },
      take: 24,
      skip: 0,
    });
  });

  it('treats an all-whitespace q as absent', () => {
    expect(parse({ q: '   ' })).toEqual({ ok: true, where: {}, take: 24, skip: 0 });
  });

  it('does not lowercase q — SQLite LIKE owns case-insensitivity', () => {
    expect(parse({ q: 'Paneer' })).toEqual({
      ok: true,
      where: { q: 'Paneer' },
      take: 24,
      skip: 0,
    });
  });
});
