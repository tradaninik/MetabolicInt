// Indian regional + global food nutrition dataset.
//
// Nutrition values are per 100g and sourced/estimated from IFCT (Indian Food Composition
// Table, NIN), USDA FoodData Central, and published glycemic index research (Foster-Powell
// / Atkinson international GI tables). Values are educational approximations — not a
// clinical reference. Glycemic index is regional where data exists.
//
// Each food carries:
//   region       — cuisine region (the differentiator)
//   servingGrams — grams in one standard serving
//   katoriGrams  — grams in one standard Indian katori (~150 ml)
//   gi           — glycemic index (0-100)

export type { Food, CuisineRegion, FoodCategory } from '@mi/engine';

import type { Food, HealingFood } from '@mi/engine';

import { southIndian } from './data/south-indian';
import { northIndian } from './data/north-indian';
import { bengali } from './data/bengali';
import { gujarati } from './data/gujarati';
import { punjabi } from './data/punjabi';
import { telugu } from './data/telugu';
import { tamil } from './data/tamil';
import { kerala } from './data/kerala';
import { maharashtrian } from './data/maharashtrian';
import { rajasthani } from './data/rajasthani';
import { global } from './data/global';
import { healingFoods } from './data/healing-foods';

/** All foods, flat. */
export const FOODS: Food[] = [
  ...southIndian,
  ...northIndian,
  ...bengali,
  ...gujarati,
  ...punjabi,
  ...telugu,
  ...tamil,
  ...kerala,
  ...maharashtrian,
  ...rajasthani,
  ...global,
];

/** Fast lookup by id. */
export const FOOD_INDEX: Record<string, Food> = Object.fromEntries(
  FOODS.map((f) => [f.id, f]),
);

/** Curated Food as Medicine knowledge base (P4c / U16, multi-lens). */
export const HEALING_FOODS: HealingFood[] = healingFoods;

/** Fast lookup by slug for the Food as Medicine surfaces. */
export const HEALING_FOOD_INDEX: Record<string, HealingFood> = Object.fromEntries(
  HEALING_FOODS.map((f) => [f.slug, f]),
);

/** Foods belonging to a cuisine region. */
export function foodsByRegion(region: Food['region']): Food[] {
  return FOODS.filter((f) => f.region === region);
}

/** Simple substring search across name + aliases. */
export function searchFoods(query: string, limit = 20): Food[] {
  const q = query.toLowerCase().trim();
  if (!q) return FOODS.slice(0, limit);
  const starts = FOODS.filter((f) => f.name.toLowerCase().startsWith(q));
  const contains = FOODS.filter((f) => {
    if (f.name.toLowerCase().startsWith(q)) return false;
    const names = [f.name, ...(f.aliases ?? [])].map((n) => n.toLowerCase());
    return names.some((n) => n.includes(q));
  });
  return [...starts, ...contains].slice(0, limit);
}

export const FOOD_DB_VERSION = '0.1.0';

export const REGION_LABELS: Record<Food['region'], string> = {
  south_indian: 'South Indian',
  north_indian: 'North Indian',
  bengali: 'Bengali',
  gujarati: 'Gujarati',
  punjabi: 'Punjabi',
  telugu: 'Telugu (Andhra)',
  tamil: 'Tamil',
  kerala: 'Kerala',
  maharashtrian: 'Maharashtrian',
  rajasthani: 'Rajasthani',
  global: 'Global',
};
