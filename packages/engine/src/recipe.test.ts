// P6-a — recipe math tests. Per-serving nutrition must be exact: sum the
// ingredients (same portion -> grams -> per-100g math as the /log tray),
// divide by servings. GI is net-carb weighted, matching the tray preview.
import { describe, expect, it } from 'vitest';
import {
  validateRecipeInput,
  resolveRecipeItems,
  recipeNutrition,
  type RecipeItemInput,
} from './recipe';
import type { Food } from './types';

const food = (over: Partial<Food>): Food => ({
  id: 'f',
  name: 'Food',
  region: 'global',
  category: 'vegetable',
  servingGrams: 100,
  kcalPer100g: 100,
  carbsPer100g: 20,
  proteinPer100g: 5,
  fatPer100g: 2,
  fiberPer100g: 4,
  gi: 50,
  ...over,
});

const chapati = food({ id: 'chapati', name: 'Chapati', servingGrams: 40, kcalPer100g: 260, carbsPer100g: 50, proteinPer100g: 9, fatPer100g: 4, fiberPer100g: 5, gi: 62 });
const dal = food({ id: 'dal', name: 'Dal', servingGrams: 150, katoriGrams: 150, kcalPer100g: 116, carbsPer100g: 16, proteinPer100g: 8, fatPer100g: 3, fiberPer100g: 5, gi: 32 });
const ghee = food({ id: 'ghee', name: 'Ghee', servingGrams: 5, kcalPer100g: 900, carbsPer100g: 0, proteinPer100g: 0, fatPer100g: 100, fiberPer100g: 0, gi: 0 });

const index = { chapati, dal, ghee };

describe('validateRecipeInput', () => {
  it('accepts a well-formed recipe and trims the name', () => {
    const r = validateRecipeInput({
      name: '  Dal-chawal plate  ',
      servings: 2,
      items: [{ foodId: 'chapati', portionType: 'serving', portionValue: 2 }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.name).toBe('Dal-chawal plate');
      expect(r.servings).toBe(2);
      expect(r.items).toHaveLength(1);
    }
  });

  it('rejects an empty name, non-positive servings, and empty items with plain language', () => {
    expect(validateRecipeInput({ name: '   ', servings: 2, items: [] }).ok).toBe(false);
    expect(validateRecipeInput({ name: 'x', servings: 0, items: [] }).ok).toBe(false);
    expect(validateRecipeInput({ name: 'x', servings: 2, items: 'nope' }).ok).toBe(false);
    expect(validateRecipeInput({ name: 'x', servings: 2, items: [] }).ok).toBe(false);
  });

  it('rejects more than the item cap and clamps bad portion rows out', () => {
    const tooMany = Array.from({ length: 16 }, (_, i) => ({ foodId: `f${i}`, portionType: 'serving', portionValue: 1 }));
    expect(validateRecipeInput({ name: 'x', servings: 2, items: tooMany }).ok).toBe(false);

    const r = validateRecipeInput({
      name: 'x',
      servings: 2,
      items: [
        { foodId: 'chapati', portionType: 'serving', portionValue: -1 }, // dropped
        { foodId: 'chapati', portionType: 'bogus', portionValue: 2 }, // portionType falls back to serving
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.items).toHaveLength(1);
      expect(r.items[0].portionType).toBe('serving');
    }
  });
});

describe('resolveRecipeItems', () => {
  it('resolves katori portions through katoriGrams and reports unknown ids once', () => {
    const { resolved, missingFoodIds } = resolveRecipeItems(
      [
        { foodId: 'dal', portionType: 'katori', portionValue: 1 },
        { foodId: 'ghost', portionType: 'serving', portionValue: 1 },
        { foodId: 'ghost', portionType: 'serving', portionValue: 2 },
      ],
      index,
    );
    expect(resolved).toHaveLength(1);
    expect(resolved[0].grams).toBe(150);
    expect(missingFoodIds).toEqual(['ghost']);
  });
});

describe('recipeNutrition', () => {
  it('per-serving values are the totals divided exactly (2 servings)', () => {
    const items: RecipeItemInput[] = [
      { foodId: 'chapati', portionType: 'serving', portionValue: 2 }, // 80 g
      { foodId: 'dal', portionType: 'katori', portionValue: 1 }, // 150 g
    ];
    const n = recipeNutrition(items, index, 2);

    // totals: chapati 80g -> 208 kcal; dal 150g -> 174 kcal
    expect(n.totals.kcal).toBe(382);
    expect(n.perServing.kcal).toBe(191);

    // carbs: chapati 40.0 + dal 24.0
    expect(n.totals.carbsG).toBe(64);
    expect(n.perServing.carbsG).toBe(32);

    // fiber: chapati 4.0 + dal 7.5
    expect(n.totals.fiberG).toBe(11.5);
    expect(n.perServing.fiberG).toBe(5.8); // 5.75 rounded to 1 dp

    // net carbs: 64 - 0.5*11.5 = 58.25 -> 58.3; per serving 29.1
    expect(n.totals.netCarbsG).toBe(58.3);
    expect(n.perServing.netCarbsG).toBe(29.1);

    expect(n.resolvedCount).toBe(2);
    expect(n.missingFoodIds).toEqual([]);
  });

  it('gi is net-carb weighted like the tray preview', () => {
    const n = recipeNutrition(
      [
        { foodId: 'chapati', portionType: 'serving', portionValue: 2 },
        { foodId: 'dal', portionType: 'katori', portionValue: 1 },
      ],
      index,
      2,
    );
    // carbs chapati: 50*0.8 = 40, fiber 5*0.8 = 4 -> nc 38
    // carbs dal: 16*1.5 = 24, fiber 5*1.5 = 7.5 -> nc 20.25
    const nc1 = 40 - 0.5 * 4;
    const nc2 = 24 - 0.5 * 7.5;
    const expected = (62 * nc1 + 32 * nc2) / (nc1 + nc2);
    expect(n.totals.gi).toBeCloseTo(Math.round(expected * 10) / 10, 1);
    expect(n.perServing.gi).toBe(n.totals.gi); // GI does not scale with servings
  });

  it('zero-carb ingredients still count for macros and do not distort GI weights (floored at 1)', () => {
    const n = recipeNutrition(
      [
        { foodId: 'ghee', portionType: 'serving', portionValue: 1 }, // 5 g, 45 kcal, nc 0
        { foodId: 'chapati', portionType: 'serving', portionValue: 1 }, // nc 18, gi 62
      ],
      index,
      1,
    );
    expect(n.totals.kcal).toBe(45 + 104);
    // weights: ghee max(0,1)=1, chapati nc 19 (carbs 20 - fiber 2/2) -> gi = (0*1 + 62*19)/20
    expect(n.totals.gi).toBeCloseTo((62 * 19) / 20, 1);
  });

  it('survives an unknown ingredient by reporting it and summing the rest', () => {
    const n = recipeNutrition(
      [
        { foodId: 'chapati', portionType: 'serving', portionValue: 1 },
        { foodId: 'ghost', portionType: 'serving', portionValue: 1 },
      ],
      index,
      1,
    );
    expect(n.resolvedCount).toBe(1);
    expect(n.missingFoodIds).toEqual(['ghost']);
    expect(n.totals.kcal).toBe(104);
  });
});
