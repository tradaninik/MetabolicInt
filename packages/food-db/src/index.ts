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

import type { Food, HealingFood, FoodTaste, ViruddhaTag } from '@mi/engine';

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
import { foodTastes } from './data/food-tastes';
import { viruddhaTags, viruddhaTagNames } from './data/viruddha-tags';

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

/** Classical taste (rasa) + potency (virya) per curated food (P4c-b / U16 logging overlay). */
export const FOOD_TASTES: Record<string, FoodTaste> = foodTastes;

/** Viruddha food classes per curated food (P4c-c / U19 pairing checker). */
export const VIRUDDHA_TAGS: Record<string, ViruddhaTag[]> = viruddhaTags;

/** Name-matched viruddha food classes for custom foods (P4c-c / U19). */
export const VIRUDDHA_TAG_NAMES: Record<string, ViruddhaTag[]> = viruddhaTagNames;

/** Viruddha food classes for a curated food by id (P4c-c / U19 pairing checker). */
export function viruddhaTagsOf(foodId: string): ViruddhaTag[] | undefined {
  return VIRUDDHA_TAGS[foodId];
}

/** Match a custom food's name (or one of its aliases) to viruddha food classes. */
export function findViruddhaTagsByName(name: string, aliases: string[] = []): ViruddhaTag[] | undefined {
  for (const n of [name, ...aliases]) {
    if (typeof n !== 'string') continue;
    const hit = VIRUDDHA_TAG_NAMES[n.toLowerCase().trim()];
    if (hit) return hit;
  }
  return undefined;
}

/** A taste match found by name - powers the /my-foods overlay for custom foods. */
export interface TasteMatch {
  matchedId: string;
  matchedName: string;
  taste: FoodTaste;
}

// Name + alias index over curated foods that have classical taste data. Keys are
// lowercased and trimmed. Custom foods whose name (or an alias) matches a curated
// classic get the overlay; everything else shows nothing - honest coverage, no guessing.
const TASTE_BY_NAME: Map<string, TasteMatch> = (() => {
  const m = new Map<string, TasteMatch>();
  for (const f of FOODS) {
    const taste = FOOD_TASTES[f.id];
    if (!taste) continue;
    const names = [f.name, ...(f.aliases ?? [])].map((n) => n.toLowerCase().trim());
    for (const n of names) {
      if (!m.has(n)) m.set(n, { matchedId: f.id, matchedName: f.name, taste });
    }
  }
  return m;
})();

/** Taste data for a food by id (curated foods only). */
export function tasteOf(foodId: string): FoodTaste | undefined {
  return FOOD_TASTES[foodId];
}

/** Match a custom food's name (or one of its aliases) to a curated classic's taste data. */
export function findTasteByName(name: string, aliases: string[] = []): TasteMatch | undefined {
  for (const n of [name, ...aliases]) {
    if (typeof n !== 'string') continue;
    const hit = TASTE_BY_NAME.get(n.toLowerCase().trim());
    if (hit) return hit;
  }
  return undefined;
}

// Name + alias index over the healing-foods knowledge base, for the Food as Medicine
// chip on /my-foods (e.g. a custom "methi dana" food links to the fenugreek entry).
const HEALING_BY_NAME: Map<string, HealingFood> = (() => {
  const m = new Map<string, HealingFood>();
  for (const f of HEALING_FOODS) {
    const names = [f.name, ...(f.alsoKnownAs ?? [])].map((n) => n.toLowerCase().trim());
    for (const n of names) {
      if (!m.has(n)) m.set(n, f);
    }
  }
  return m;
})();

/** Match a food name (or alias) to a Food as Medicine knowledge-base entry. */
export function findHealingFoodByName(name: string, aliases: string[] = []): HealingFood | undefined {
  for (const n of [name, ...aliases]) {
    if (typeof n !== 'string') continue;
    const hit = HEALING_BY_NAME.get(n.toLowerCase().trim());
    if (hit) return hit;
  }
  return undefined;
}

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
