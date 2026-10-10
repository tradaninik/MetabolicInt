import { describe, it, expect, vi, beforeEach } from 'vitest';

// Factory-mock the prisma module entirely - the real one never loads, so
// PrismaClient is never instantiated inside the test run.
vi.mock('../prisma', () => ({
  prisma: { food: { findMany: vi.fn() } },
}));

import { prisma } from '../prisma';
import { FOOD_INDEX } from '@mi/food-db';
import { parseAliases, toEngineFood, mergedFoodIndex } from '../food-index';
import type { FoodRow } from '../food-index';

const findMany = prisma.food.findMany as unknown as ReturnType<typeof vi.fn>;

function row(overrides: Partial<FoodRow> = {}): FoodRow {
  return {
    id: 'custom-test', name: 'Test food', aliases: null,
    region: 'south_indian', category: 'cereal',
    servingGrams: 100, katoriGrams: null,
    kcalPer100g: 250, carbsPer100g: 50, proteinPer100g: 8,
    fatPer100g: 3, fiberPer100g: 4, gi: 55,
    ...overrides,
  };
}

describe('parseAliases', () => {
  it('returns undefined for null, bad JSON, and non-array JSON', () => {
    expect(parseAliases(null)).toBeUndefined();
    expect(parseAliases('not json')).toBeUndefined();
    expect(parseAliases('{"a":1}')).toBeUndefined();
    expect(parseAliases('null')).toBeUndefined();
    expect(parseAliases('"just a string"')).toBeUndefined();
  });

  it('parses arrays and filters non-string members', () => {
    expect(parseAliases('["chawal","anna"]')).toEqual(['chawal', 'anna']);
    expect(parseAliases('["a", 1, null, "b"]')).toEqual(['a', 'b']);
    expect(parseAliases('[]')).toEqual([]);
  });
});

describe('toEngineFood', () => {
  it('maps a full row onto the engine Food shape', () => {
    const f = toEngineFood(row({ aliases: '["chawal"]', katoriGrams: 150 }));
    expect(f).toMatchObject({
      id: 'custom-test', name: 'Test food', aliases: ['chawal'],
      katoriGrams: 150, kcalPer100g: 250, gi: 55,
    });
  });

  it('omits aliases and katoriGrams keys entirely when null (engine optionals)', () => {
    const f = toEngineFood(row());
    expect('aliases' in f).toBe(false);
    expect('katoriGrams' in f).toBe(false);
  });

  it('keeps katoriGrams: 0 - the guard is != null, not truthiness', () => {
    expect(toEngineFood(row({ katoriGrams: 0 })).katoriGrams).toBe(0);
  });
});

describe('mergedFoodIndex', () => {
  beforeEach(() => findMany.mockReset());

  it('merges customs over the catalog, scoped to the requesting user', async () => {
    findMany.mockResolvedValue([row({ id: 'custom-mine', name: 'Mine' })]);
    const merged = await mergedFoodIndex('user-1');
    expect(findMany).toHaveBeenCalledWith({ where: { createdByUserId: 'user-1' } });
    expect(Object.keys(merged).length).toBe(Object.keys(FOOD_INDEX).length + 1);
    for (const id of Object.keys(FOOD_INDEX)) expect(merged[id]).toBeDefined();
    expect(merged['custom-mine']).toMatchObject({ name: 'Mine' });
  });

  it('custom wins on id collision by assignment order (documented precedence)', async () => {
    const catalogId = Object.keys(FOOD_INDEX)[0];
    findMany.mockResolvedValue([row({ id: catalogId, name: 'Overridden' })]);
    const merged = await mergedFoodIndex('user-1');
    expect(merged[catalogId].name).toBe('Overridden');
  });
});