// Server-side validation for custom foods - the source of truth per
// docs/CUSTOM-FOODS-V2.md section 5. Hand-rolled and dependency-free on
// purpose: the spec names no validator library, and "smallest diffs" wins.
//
// The 13 FoodCategory / 11 CuisineRegion literals below are copied verbatim
// from packages/engine/src/types.ts (which is frozen). The catalog uses 12
// of the 13 categories - it has no 'nut' foods yet - so deriving these sets
// from FOOD_INDEX was wrong; a custom food filed under 'nut' would have
// been rejected. Typed Sets keep tsc as the guard: a typo'd literal fails
// compilation.

import type { FoodCategory, CuisineRegion } from '@mi/engine';

export const CATEGORY_VALUES: ReadonlySet<FoodCategory> = new Set<FoodCategory>([
  'cereal', 'legume', 'vegetable', 'fruit', 'dairy', 'meat', 'fish', 'egg',
  'nut', 'snack', 'sweet', 'beverage', 'fat', 'spice',
]);

export const REGION_VALUES: ReadonlySet<CuisineRegion> = new Set<CuisineRegion>([
  'south_indian', 'north_indian', 'bengali', 'gujarati', 'punjabi', 'telugu',
  'tamil', 'kerala', 'maharashtrian', 'rajasthani', 'global',
]);

/** Spec: cap of 100 custom foods per user (count enforced route-side). */
export const MAX_CUSTOM_FOODS_PER_USER = 100;

/** Spec section 11: GI band chips, Medium (55) preselected. Shared with the C2 form. */
export const GI_BANDS = [
  { label: 'Low', value: 40 },
  { label: 'Medium', value: 55 },
  { label: 'High', value: 70 },
  { label: 'Very high', value: 85 },
] as const;
export const GI_DEFAULT = 55;

/** Atwater approximation the spec pins for blank kcal: 4c + 4p + 9f. */
export function atwaterKcal(carbs: number, protein: number, fat: number): number {
  return 4 * carbs + 4 * protein + 9 * fat;
}

/** A custom-food row exactly as it will be handed to prisma.food.create. */
export interface ValidatedFood {
  name: string;
  category: FoodCategory;
  region: CuisineRegion;
  servingGrams: number;
  katoriGrams: number | null; // null = no katori portion option
  carbsPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  kcalPer100g: number;
  gi: number; // 1-100; zero is unrepresentable by design (spec section 5)
  aliases: string | null; // JSON-encoded string[] - the DB column shape
}

export type FoodValidationResult =
  | { ok: true; data: ValidatedFood }
  | { ok: false; errors: Record<string, string> };

/** Absent/blank -> undefined; numbers pass; numeric strings parse; garbage -> NaN. */
function toNum(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '') return Number(v);
  return NaN;
}

function range(
  body: Record<string, unknown>,
  key: string,
  errors: Record<string, string>,
  label: string,
  min: number,
  max: number,
): number | undefined {
  const n = toNum(body[key]);
  if (n === undefined) return undefined;
  if (!Number.isFinite(n) || n < min || n > max) {
    errors[key] = `${label} must be a number between ${min} and ${max}.`;
    return undefined;
  }
  return n;
}

export function validateCustomFood(
  raw: unknown,
  opts: { fallbackRegion: CuisineRegion },
): FoodValidationResult {
  const errors: Record<string, string> = {};
  const body = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;

  // name: strip control characters, collapse whitespace, trim, 2-60 chars.
  let name = '';
  if (typeof body.name === 'string') {
    name = body.name.replace(/\p{C}/gu, '').replace(/\s+/g, ' ').trim();
  }
  if (name.length < 2 || name.length > 60) {
    errors.name = 'Name is required, 2-60 characters.';
  }

  // category: one of the 13 union values; default snack.
  let category: FoodCategory = 'snack';
  if (body.category != null && body.category !== '') {
    category = body.category as FoodCategory;
    if (!CATEGORY_VALUES.has(category)) errors.category = 'Unknown category.';
  }

  // region: one of the 11 union values; default the profile region.
  // The fallback is checked too - no silent trust of stale profile data.
  const region = (body.region != null && body.region !== ''
    ? body.region
    : opts.fallbackRegion) as CuisineRegion;
  if (!REGION_VALUES.has(region)) errors.region = 'Unknown region.';

  const servingGrams = range(body, 'servingGrams', errors, 'Serving grams', 1, 2000) ?? 100;
  const katori = range(body, 'katoriGrams', errors, 'Katori grams', 1, 2000);
  const katoriGrams = katori === undefined ? null : katori;

  const carbs = range(body, 'carbsPer100g', errors, 'Carbs per 100g', 0, 100) ?? 0;
  const protein = range(body, 'proteinPer100g', errors, 'Protein per 100g', 0, 100) ?? 0;
  const fat = range(body, 'fatPer100g', errors, 'Fat per 100g', 0, 100) ?? 0;
  const fiber = range(body, 'fiberPer100g', errors, 'Fiber per 100g', 0, 100) ?? 0;

  // kcalPer100g: optional 0-900 when supplied; Atwater when blank. The stored
  // value honors the bound either way: macros implying >900 (only possible
  // near the macro caps) are rejected with an explanation, not stored.
  let kcal = range(body, 'kcalPer100g', errors, 'kcal per 100g', 0, 900);
  if (
    kcal === undefined && !errors.kcalPer100g &&
    !errors.carbsPer100g && !errors.proteinPer100g && !errors.fatPer100g
  ) {
    const implied = atwaterKcal(carbs, protein, fat);
    if (implied > 900) {
      errors.kcalPer100g = `These macros imply ${Math.round(implied)} kcal/100g (Atwater), above the 900 limit - please check carbs, protein and fat.`;
    } else {
      kcal = implied;
    }
  }

  const gi = range(body, 'gi', errors, 'GI', 1, 100) ?? GI_DEFAULT;

  // aliases: comma-separated, max 5, each trimmed to 40 chars; stored as
  // JSON-encoded string[] to match the DB column (parseAliases reads back).
  let aliases: string | null = null;
  if (body.aliases != null && body.aliases !== '') {
    if (typeof body.aliases !== 'string') {
      errors.aliases = 'Aliases must be a comma-separated string.';
    } else {
      const list = body.aliases.split(',').map((a) => a.trim()).filter((a) => a !== '');
      if (list.length > 5) errors.aliases = 'At most 5 aliases.';
      else if (list.some((a) => a.length > 40)) errors.aliases = 'Each alias is limited to 40 characters.';
      else aliases = list.length > 0 ? JSON.stringify(list) : null;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      name, category, region, servingGrams, katoriGrams,
      carbsPer100g: carbs, proteinPer100g: protein, fatPer100g: fat, fiberPer100g: fiber,
      kcalPer100g: kcal as number, gi, aliases,
    },
  };
}