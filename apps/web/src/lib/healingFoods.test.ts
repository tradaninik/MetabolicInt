import { describe, expect, it } from 'vitest';
import { groupFoodsByCategory, lensPool, pickForYou } from './healingFoods';
import type { RankedFood } from './healingFoods';

const entry = (slug: string, category: string, lenses: string[] = ['ayurveda', 'science', 'stories']): RankedFood => ({
  food: { slug, name: slug, category, headline: `${slug} headline` },
  score: 0,
  reasons: [],
  lenses,
});

describe('lensPool', () => {
  it('returns every entry for the all lens', () => {
    const foods = [entry('a', 'spices'), entry('b', 'grains')];
    expect(lensPool(foods, 'all')).toHaveLength(2);
  });

  it('keeps only entries carrying the selected lens', () => {
    const foods = [entry('a', 'spices', ['ayurveda']), entry('b', 'grains', ['science', 'stories'])];
    expect(lensPool(foods, 'science').map((r) => r.food.slug)).toEqual(['b']);
  });
});

describe('pickForYou', () => {
  it('splits a ranked list into top 3 and the rest, preserving order', () => {
    const foods = [1, 2, 3, 4, 5].map((n) => entry(`f${n}`, 'spices'));
    const { shortlist, library } = pickForYou(foods);
    expect(shortlist.map((r) => r.food.slug)).toEqual(['f1', 'f2', 'f3']);
    expect(library.map((r) => r.food.slug)).toEqual(['f4', 'f5']);
  });

  it('handles short lists without throwing', () => {
    const foods = [entry('only', 'grains')];
    const { shortlist, library } = pickForYou(foods);
    expect(shortlist).toHaveLength(1);
    expect(library).toHaveLength(0);
  });
});

describe('groupFoodsByCategory', () => {
  it('groups by category and preserves ranked order within groups', () => {
    const foods = [
      entry('fenugreek', 'spices'),
      entry('barley', 'grains'),
      entry('turmeric', 'spices'),
    ];
    const groups = groupFoodsByCategory(foods);
    expect(groups.map((g) => g.categoryId)).toEqual(['spices', 'grains']);
    expect(groups[0].entries.map((r) => r.food.slug)).toEqual(['fenugreek', 'turmeric']);
    expect(groups[1].entries.map((r) => r.food.slug)).toEqual(['barley']);
  });

  it('returns an empty array for empty input', () => {
    expect(groupFoodsByCategory([])).toEqual([]);
  });
});