// Per-user merged food index: the catalog plus this user's custom foods,
// shaped exactly like the engine's Food interface. The engine package stays
// frozen - custom rows are converted app-side, because the DB stores aliases
// as a JSON string while the engine expects string[].
//
// Consumers: engine-service (dashboard timeline labels + insights) and
// api/coach (coach context). pairing.ts deliberately does NOT use this -
// it reads the food relation straight from FoodEntry rows.

import { FOOD_INDEX } from '@mi/food-db';
import type { Food as EngineFood, FoodCategory, CuisineRegion } from '@mi/engine';
import { prisma } from './prisma';

/** The Prisma Food columns this module converts from. */
export interface FoodRow {
  id: string;
  name: string;
  aliases: string | null; // JSON-encoded string[] in the DB
  region: string;
  category: string;
  servingGrams: number;
  katoriGrams: number | null;
  kcalPer100g: number;
  carbsPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  gi: number;
}

/** DB aliases are JSON strings; the engine expects string[]. Safe parse. */
export function parseAliases(s: string | null): string[] | undefined {
  if (!s) return undefined;
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : undefined;
  } catch {
    return undefined;
  }
}

/** Convert a Prisma Food row into the engine's Food shape. */
export function toEngineFood(row: FoodRow): EngineFood {
  const aliases = parseAliases(row.aliases);
  return {
    id: row.id,
    name: row.name,
    ...(aliases ? { aliases } : {}),
    region: row.region as CuisineRegion,
    category: row.category as FoodCategory,
    servingGrams: row.servingGrams,
    ...(row.katoriGrams != null ? { katoriGrams: row.katoriGrams } : {}),
    kcalPer100g: row.kcalPer100g,
    carbsPer100g: row.carbsPer100g,
    proteinPer100g: row.proteinPer100g,
    fatPer100g: row.fatPer100g,
    fiberPer100g: row.fiberPer100g,
    gi: row.gi,
  };
}

/**
 * Catalog index merged with this user's custom foods. Custom ids start with
 * 'custom-' so they can never collide with catalog ids; the assignment order
 * makes custom-wins explicit regardless.
 */
export async function mergedFoodIndex(userId: string): Promise<Record<string, EngineFood>> {
  const customs = await prisma.food.findMany({ where: { createdByUserId: userId } });
  const merged: Record<string, EngineFood> = { ...FOOD_INDEX };
  for (const row of customs) {
    merged[row.id] = toEngineFood(row);
  }
  return merged;
}