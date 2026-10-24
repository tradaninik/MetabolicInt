// P4c / U19 - web-side resolution for the Viruddha Ahara checker (educational, non-medical).
// Converts prisma Food rows (or engine Food objects) into engine check items: curated
// ids resolve via the food-db tag map; everything else falls back to exact name/alias
// matching, the same honest-coverage pattern as the taste overlay. No match, no finding.

import { checkViruddha, type ViruddhaCheckItem, type ViruddhaFinding, type ViruddhaTag } from '@mi/engine';
import { viruddhaTagsOf, findViruddhaTagsByName } from '@mi/food-db';

/** Minimal food shape shared by prisma rows and engine Food objects. */
export interface ViruddhaFoodLike {
  id: string;
  name: string;
  /** Engine Food: string[]; prisma Food: JSON-encoded string[] (or CSV fallback). */
  aliases?: string[] | string | null;
}

/** Parse the alias field in any stored shape into a plain string[]. */
export function parseAliases(aliases: string[] | string | null | undefined): string[] {
  if (Array.isArray(aliases)) {
    return aliases.filter((a): a is string => typeof a === 'string' && a.trim().length > 0);
  }
  if (typeof aliases === 'string' && aliases.trim()) {
    try {
      const v: unknown = JSON.parse(aliases);
      if (Array.isArray(v)) {
        return v.filter((a): a is string => typeof a === 'string' && a.trim().length > 0);
      }
    } catch {
      // Legacy CSV fallback - prisma has always stored JSON here, but a stray
      // hand-edited row should degrade gracefully, never throw.
      return aliases.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

/** Resolve one food to its viruddha food classes: curated id first, then name/alias match. */
export function viruddhaTagsForFood(food: ViruddhaFoodLike): ViruddhaTag[] {
  const byId = typeof food?.id === 'string' ? viruddhaTagsOf(food.id) : undefined;
  if (byId) return [...byId];
  if (typeof food?.name === 'string' && food.name.trim()) {
    const byName = findViruddhaTagsByName(food.name, parseAliases(food.aliases));
    if (byName) return [...byName];
  }
  return [];
}

/** Build the engine check item for one food row. */
export function viruddhaItemFor(food: ViruddhaFoodLike): ViruddhaCheckItem {
  return {
    key: typeof food?.id === 'string' && food.id ? food.id : (food?.name ?? ''),
    label: typeof food?.name === 'string' && food.name.trim() ? food.name : (food?.id ?? ''),
    tags: viruddhaTagsForFood(food),
  };
}

/** Run the checker over a set of food rows (tray, combo items, same-meal window). */
export function viruddhaFindingsForFoods(foods: ViruddhaFoodLike[]): ViruddhaFinding[] {
  if (!Array.isArray(foods)) return [];
  return checkViruddha(foods.map(viruddhaItemFor));
}
