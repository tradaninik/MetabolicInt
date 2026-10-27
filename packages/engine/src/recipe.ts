// P6-a — recipes: named multi-ingredient meals with exact per-serving nutrition.
//
// A recipe is "ingredients + a serving count", exactly like a saved combo plus
// division. Nutrition is computed, never stored: sum every ingredient's macros
// (portion -> grams -> per-100g math, identical to the /log tray), then divide
// by the serving count. Logging a recipe expands back into one FoodEntry per
// ingredient, so entries keep their frozen numbers and the offline queue sees
// nothing new (same /api/meals bodies as always).
//
// Pure functions only; the caller supplies the food index (catalog + the
// user's customs merged, engine Food shape). Unknown foodIds are reported,
// never guessed.

import type { Food, PortionType } from './types';
import { macrosForGrams, netCarbsG, portionToGrams } from './nutrition';

export type RecipePortionType = PortionType; // katori | serving | grams

export interface RecipeItemInput {
  foodId: string;
  portionType: RecipePortionType;
  portionValue: number;
}

export interface RecipeMacros {
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  fiberG: number;
  netCarbsG: number;
}

export interface RecipeItemResolved extends RecipeItemInput {
  name: string;
  grams: number;
  gi: number;
  macros: RecipeMacros;
}

export interface RecipeNutrition {
  /** ingredient count used in the sums (unknown foodIds skipped + reported) */
  resolvedCount: number;
  /** foodIds that could not be resolved in the supplied index */
  missingFoodIds: string[];
  totals: RecipeMacros & { grams: number; gi: number };
  perServing: RecipeMacros & { grams: number; gi: number };
}

export const RECIPE_MAX_ITEMS = 15;
export const RECIPE_MAX_SERVINGS = 50;

const round1 = (n: number) => +(Math.round(n * 10) / 10);

/** Validate a recipe create/edit payload. Returns a plain-language error or null. */
export function validateRecipeInput(input: {
  name?: unknown;
  servings?: unknown;
  items?: unknown;
}): { ok: true; name: string; servings: number; items: RecipeItemInput[] } | { ok: false; error: string } {
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 60) : '';
  if (!name) return { ok: false, error: 'Give your recipe a name (up to 60 characters).' };

  const servings = Number(input.servings);
  if (!Number.isFinite(servings) || servings <= 0 || servings > RECIPE_MAX_SERVINGS) {
    return { ok: false, error: `Servings must be between 1 and ${RECIPE_MAX_SERVINGS}.` };
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, error: 'A recipe needs at least one ingredient.' };
  }
  if (input.items.length > RECIPE_MAX_ITEMS) {
    return { ok: false, error: `A recipe can have at most ${RECIPE_MAX_ITEMS} ingredients.` };
  }

  const items: RecipeItemInput[] = [];
  for (const it of input.items) {
    if (!it || typeof it !== 'object') continue;
    const rec = it as Record<string, unknown>;
    if (typeof rec.foodId !== 'string' || !rec.foodId) continue;
    const pt = (['serving', 'katori', 'grams'] as const).includes(rec.portionType as never)
      ? (rec.portionType as RecipePortionType)
      : 'serving';
    const pv = Number(rec.portionValue);
    if (!Number.isFinite(pv) || pv <= 0 || pv > 500) continue;
    items.push({ foodId: rec.foodId, portionType: pt, portionValue: pv });
  }
  if (items.length === 0) return { ok: false, error: 'No usable ingredients - check portions are positive numbers.' };

  return { ok: true, name, servings: round1(servings), items };
}

/** Resolve recipe items against a food index. Unknown ids are skipped and reported. */
export function resolveRecipeItems(
  items: RecipeItemInput[],
  foodIndex: Record<string, Food>,
): { resolved: RecipeItemResolved[]; missingFoodIds: string[] } {
  const resolved: RecipeItemResolved[] = [];
  const missingFoodIds: string[] = [];
  for (const it of items) {
    const food = foodIndex[it.foodId];
    if (!food) {
      if (!missingFoodIds.includes(it.foodId)) missingFoodIds.push(it.foodId);
      continue;
    }
    const grams = portionToGrams(food, it.portionType, it.portionValue);
    const m = macrosForGrams(food, grams);
    resolved.push({
      ...it,
      name: food.name,
      grams,
      gi: food.gi,
      macros: {
        kcal: m.kcal,
        carbsG: m.carbsG,
        proteinG: m.proteinG,
        fatG: m.fatG,
        fiberG: m.fiberG,
        netCarbsG: netCarbsG(m.carbsG, m.fiberG),
      },
    });
  }
  return { resolved, missingFoodIds };
}

/**
 * Exact per-serving nutrition: sum the ingredients, divide by the serving
 * count. GI is net-carb weighted across ingredients (same convention as the
 * /log tray preview and blendRecipe) so all three views agree.
 */
export function recipeNutrition(
  items: RecipeItemInput[],
  foodIndex: Record<string, Food>,
  servings: number,
): RecipeNutrition {
  const { resolved, missingFoodIds } = resolveRecipeItems(items, foodIndex);
  const n = Math.max(1, servings);

  let kcal = 0;
  let carbs = 0;
  let protein = 0;
  let fat = 0;
  let fiber = 0;
  let nc = 0;
  let grams = 0;
  let giW = 0;
  let giWt = 0;
  for (const r of resolved) {
    kcal += r.macros.kcal;
    carbs += r.macros.carbsG;
    protein += r.macros.proteinG;
    fat += r.macros.fatG;
    fiber += r.macros.fiberG;
    nc += r.macros.netCarbsG;
    grams += r.grams;
    const w = Math.max(r.macros.netCarbsG, 1);
    giW += r.gi * w;
    giWt += w;
  }

  return {
    resolvedCount: resolved.length,
    missingFoodIds,
    totals: {
      kcal: Math.round(kcal),
      carbsG: round1(carbs),
      proteinG: round1(protein),
      fatG: round1(fat),
      fiberG: round1(fiber),
      netCarbsG: round1(nc),
      grams: round1(grams),
      gi: giWt > 0 ? Math.round((giW / giWt) * 10) / 10 : 0,
    },
    perServing: {
      kcal: Math.round(kcal / n),
      carbsG: round1(carbs / n),
      proteinG: round1(protein / n),
      fatG: round1(fat / n),
      fiberG: round1(fiber / n),
      netCarbsG: round1(nc / n),
      grams: round1(grams / n),
      gi: giWt > 0 ? Math.round((giW / giWt) * 10) / 10 : 0,
    },
  };
}

// P8 — carb tier: the coarse per-serving carb band the catalog recipe
// search filters and the UI badge display on. Net carbs per serving (the
// same number recipeNutrition computes), so the tier can never disagree
// with the macros a recipe actually logs. Thresholds: LOW < 20 g,
// MODERATE 20-40 g, HIGHER >= 40 g.
export type CarbTier = 'LOW' | 'MODERATE' | 'HIGHER';

export const CARB_TIER_LOW_MAX = 20; // net carbs strictly below this = LOW
export const CARB_TIER_MODERATE_MAX = 40; // net carbs up to this = MODERATE

export function carbTier(netCarbsPerServing: number): CarbTier {
  if (!Number.isFinite(netCarbsPerServing)) return 'HIGHER';
  if (netCarbsPerServing < CARB_TIER_LOW_MAX) return 'LOW';
  if (netCarbsPerServing <= CARB_TIER_MODERATE_MAX) return 'MODERATE';
  return 'HIGHER';
}
