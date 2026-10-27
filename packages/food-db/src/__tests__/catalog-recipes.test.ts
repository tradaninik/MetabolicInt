// P8 — catalog recipe invariants: the test that keeps the 300-recipe
// catalog honest. The registry (data/recipes/index.ts) already fails import
// on slug/name collisions or a short band; this test goes further and pins
// the iron law + authoring contract:
//   - every ingredient id resolves in the food-db (no invented ids, ever)
//   - computed nutrition is finite, non-negative, and macro-consistent
//   - carbTier distribution matches the diabetic-friendly brief (band rules)
//   - deterministic tag honesty: high-fiber >= 5g, high-protein >= 15g,
//     quick <= 20 min, vegan = zero dairy/egg/meat ingredients
// Macros here are COMPUTED via @mi/engine recipeNutrition — the same math
// the seed pipeline uses — so a passing test proves the seeded numbers.
import { describe, it, expect } from 'vitest';
import { catalogRecipes, CATALOG_RECIPE_TARGET, ingredientFoods, FOOD_INDEX } from '../index';
import { CATALOG_MEAL_TYPES, CATALOG_CUISINES, CATALOG_TAGS } from '../data/recipes/types';
import type { CatalogRecipeSeed } from '../data/recipes/types';
import { recipeNutrition, carbTier } from '@mi/engine';

const INGREDIENT_IDS = new Set(ingredientFoods.map((f) => f.id));
const MEAL_TYPES = new Set<string>(CATALOG_MEAL_TYPES);
const CUISINES = new Set<string>(CATALOG_CUISINES);
const TAGS = new Set<string>(CATALOG_TAGS);

// Ingredient classes for the vegan check (dairy + egg + meat ids).
const NON_VEGAN_IDS = new Set([
  'milk_toned', 'curd', 'buttermilk', 'paneer', 'ghee', 'butter', 'fresh_cream',
  'egg_raw', 'chicken_raw', 'mutton_raw', 'fish_raw', 'prawns_raw',
]);

function nutritionOf(r: CatalogRecipeSeed) {
  return recipeNutrition(r.items, FOOD_INDEX, r.servings);
}

describe('P8 catalog recipes — registry invariants', () => {
  it('ships exactly the 300-recipe sprint deliverable', () => {
    expect(catalogRecipes.length).toBe(CATALOG_RECIPE_TARGET);
    expect(CATALOG_RECIPE_TARGET).toBe(300);
  });

  it('has unique slugs and unique names across all bands', () => {
    const slugs = new Set(catalogRecipes.map((r) => r.slug));
    const names = new Set(catalogRecipes.map((r) => r.name));
    expect(slugs.size).toBe(catalogRecipes.length);
    expect(names.size).toBe(catalogRecipes.length);
  });

  it('covers all six meal bands (breakfast/lunch/dinner/snack/drink/side)', () => {
    const byMeal = new Map<string, number>();
    for (const r of catalogRecipes) byMeal.set(r.mealType, (byMeal.get(r.mealType) ?? 0) + 1);
    // Six authored bands of 50: breakfast/lunch/dinner/snack/drink+side
    // (25+25)/hyderabadi-mains. The mains band spans lunch+dinner, so the
    // totals overlap: lunch 50+26, dinner 50+24.
    expect(byMeal.get('breakfast')).toBe(50);
    expect(byMeal.get('lunch')).toBeGreaterThanOrEqual(70);
    expect(byMeal.get('dinner')).toBeGreaterThanOrEqual(70);
    expect(byMeal.get('snack')).toBe(50);
    expect(byMeal.get('drink')).toBe(25);
    expect(byMeal.get('side')).toBe(25);
  });

  it('includes the Hyderabadi non-veg heritage band', () => {
    const hyd = catalogRecipes.filter((r) => r.cuisine === 'hyderabadi');
    expect(hyd.length).toBeGreaterThanOrEqual(30);
  });
});

describe('P8 catalog recipes — authoring contract', () => {
  it('references only real ingredient ids (never invented ones)', () => {
    const bad: string[] = [];
    for (const r of catalogRecipes) {
      for (const it of r.items) {
        if (!INGREDIENT_IDS.has(it.foodId)) bad.push(`${r.slug}: ${it.foodId}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('uses grams portions exclusively (the seed contract)', () => {
    const bad = catalogRecipes.flatMap((r) =>
      r.items.filter((it) => it.portionType !== 'grams').map(() => r.slug),
    );
    expect(bad).toEqual([]);
  });

  it('resolves every recipe fully — no missing foodIds anywhere', () => {
    const bad = catalogRecipes.filter((r) => nutritionOf(r).missingFoodIds.length > 0);
    expect(bad.map((r) => r.slug)).toEqual([]);
  });

  it('respects field limits (servings, minutes, items, steps, name, notes)', () => {
    const bad: string[] = [];
    for (const r of catalogRecipes) {
      if (r.servings < 1 || r.servings > 6) bad.push(`${r.slug}: servings ${r.servings}`);
      if (r.prepMinutes < 5 || r.prepMinutes > 90) bad.push(`${r.slug}: prepMinutes ${r.prepMinutes}`);
      if (r.items.length < 2 || r.items.length > 12) bad.push(`${r.slug}: ${r.items.length} items`);
      if (r.steps.length < 3 || r.steps.length > 8) bad.push(`${r.slug}: ${r.steps.length} steps`);
      if (r.name.length > 60) bad.push(`${r.slug}: name ${r.name.length}`);
      for (const it of r.items) {
        if (it.portionValue < 1 || it.portionValue > 500) {
          bad.push(`${r.slug}: ${it.foodId} ${it.portionValue}g`);
        }
      }
      for (const s of r.steps) {
        if (s.length > 160) bad.push(`${r.slug}: step ${s.length} chars`);
      }
      if (r.notes && r.notes.length > 160) bad.push(`${r.slug}: notes ${r.notes.length}`);
    }
    expect(bad.slice(0, 10)).toEqual([]);
    expect(bad.length).toBe(0);
  });

  it('uses only the controlled vocabularies (mealType, cuisine, tags)', () => {
    const bad: string[] = [];
    for (const r of catalogRecipes) {
      if (!MEAL_TYPES.has(r.mealType)) bad.push(`${r.slug}: mealType ${r.mealType}`);
      if (!CUISINES.has(r.cuisine)) bad.push(`${r.slug}: cuisine ${r.cuisine}`);
      for (const t of r.tags) if (!TAGS.has(t)) bad.push(`${r.slug}: tag ${t}`);
    }
    expect(bad).toEqual([]);
  });

  it('never references the refined-sugar ingredient', () => {
    const bad = catalogRecipes.filter((r) => r.items.some((it) => it.foodId === 'sugar'));
    expect(bad.map((r) => r.slug)).toEqual([]);
  });
});

describe('P8 catalog recipes — computed nutrition (the iron law)', () => {
  it('produces finite, non-negative macros for every recipe', () => {
    const bad: string[] = [];
    for (const r of catalogRecipes) {
      const n = nutritionOf(r).perServing;
      const nums = [n.kcal, n.carbsG, n.netCarbsG, n.proteinG, n.fatG, n.fiberG, n.grams, n.gi];
      if (nums.some((v) => !Number.isFinite(v) || v < 0)) bad.push(r.slug);
      if (n.netCarbsG > n.carbsG + 0.05) bad.push(`${r.slug}: netCarbs ${n.netCarbsG} > carbs ${n.carbsG}`);
    }
    expect(bad).toEqual([]);
  });

  it('keeps the carb-tier distribution diabetic-friendly', () => {
    let low = 0;
    let moderate = 0;
    let higher = 0;
    const higherSlugs: string[] = [];
    for (const r of catalogRecipes) {
      const t = carbTier(nutritionOf(r).perServing.netCarbsG);
      if (t === 'LOW') low++;
      else if (t === 'MODERATE') moderate++;
      else {
        higher++;
        higherSlugs.push(r.slug);
      }
    }
    // 300 recipes: at most 7% in the HIGHER tier (the brief allows small,
    // portion-noted exceptions — authenticity beats bland uniformity).
    expect(higher).toBeLessThanOrEqual(Math.floor(catalogRecipes.length * 0.07));
    expect(low + moderate + higher).toBe(catalogRecipes.length);
    // Snacks + drinks + sides are the between-meal bands: essentially all LOW.
    const snackTier = catalogRecipes
      .filter((r) => ['snack', 'drink', 'side'].includes(r.mealType))
      .map((r) => carbTier(nutritionOf(r).perServing.netCarbsG));
    const snackModerate = snackTier.filter((t) => t !== 'LOW').length;
    expect(snackModerate).toBeLessThanOrEqual(6);
  });
});

describe('P8 catalog recipes — deterministic tag honesty', () => {
  it('high-fiber means >= 5g fiber per serving', () => {
    const bad: string[] = [];
    for (const r of catalogRecipes) {
      if (!r.tags.includes('high-fiber')) continue;
      if (nutritionOf(r).perServing.fiberG < 5) bad.push(`${r.slug}: ${nutritionOf(r).perServing.fiberG}g`);
    }
    expect(bad).toEqual([]);
  });

  it('high-protein means >= 15g protein per serving', () => {
    const bad: string[] = [];
    for (const r of catalogRecipes) {
      if (!r.tags.includes('high-protein')) continue;
      if (nutritionOf(r).perServing.proteinG < 15) bad.push(`${r.slug}: ${nutritionOf(r).perServing.proteinG}g`);
    }
    expect(bad).toEqual([]);
  });

  it('quick means <= 20 minutes', () => {
    const bad = catalogRecipes.filter((r) => r.tags.includes('quick') && r.prepMinutes > 20);
    expect(bad.map((r) => r.slug)).toEqual([]);
  });

  it('vegan means zero dairy/egg/meat ingredients', () => {
    const bad = catalogRecipes.filter(
      (r) => r.tags.includes('vegan') && r.items.some((it) => NON_VEGAN_IDS.has(it.foodId)),
    );
    expect(bad.map((r) => r.slug)).toEqual([]);
  });
});
