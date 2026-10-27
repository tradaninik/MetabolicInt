// P8 — catalog recipe seeds: the authoring contract for the 300-recipe
// diabetic-friendly catalog. Content agents write ONE file per meal band
// (breakfast / lunch / dinner / snack / drink-side / hyderabadi-mains),
// each exporting a `CatalogRecipeSeed[]`.
//
// THE IRON LAW: seeds carry NO nutrition numbers. Macros are computed by
// the seed pipeline (apps/web/prisma/seed.ts) via @mi/engine recipeNutrition
// from ingredient grams x per-100g values — never hand-entered, never stored
// from a human's arithmetic. That keeps the catalog honest by construction.
//
// `items` uses the exact same {foodId, portionType, portionValue} triple as
// user recipes (P6) so a catalog row can flow into "add to my recipes" and
// the /log tray unchanged. Seeds pin portionType to 'grams' — deterministic
// regardless of the ingredient's serving/katori metadata.
//
// foodId universe = ingredientFoods ids in ../ingredients.ts (117 raw
// building blocks). The catalog-recipes test rejects any id outside it.

export type CatalogMealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'drink' | 'side';
export type CatalogCuisine = 'telugu' | 'hyderabadi' | 'south-indian' | 'north-indian' | 'pan-indian';

export const CATALOG_MEAL_TYPES = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'drink',
  'side',
] as const satisfies readonly CatalogMealType[];

export const CATALOG_CUISINES = [
  'telugu',
  'hyderabadi',
  'south-indian',
  'north-indian',
  'pan-indian',
] as const satisfies readonly CatalogCuisine[];

/** Controlled vocabulary — the Day-5 search filters are generated from it. */
export const CATALOG_TAGS = [
  'high-fiber', // >= 5 g fiber per serving (pipeline-verified at review)
  'high-protein', // >= 15 g protein per serving (pipeline-verified at review)
  'low-gi', // weighted GI <= 55 (pipeline-verified at review)
  'quick', // prepMinutes <= 20
  'one-pot',
  'no-cook',
  'leftover-friendly', // core ingredient is a common leftover (cooked rice, day-old dal...)
  'budget',
  'festive',
  'iron-rich',
  'calcium-rich',
  'vegan',
] as const;

export type CatalogTag = (typeof CATALOG_TAGS)[number];

export interface CatalogRecipeSeedItem {
  /** exact id from ingredientFoods (../ingredients.ts) — no other ids pass validation */
  foodId: string;
  /** seeds always use grams — exact, deterministic */
  portionType: 'grams';
  /** 1..500 g per ingredient */
  portionValue: number;
}

export interface CatalogRecipeSeed {
  /** stable kebab-case id, unique across ALL catalog files; doubles as the DB row id */
  slug: string;
  /** English display name, unique across the catalog, <= 60 chars */
  name: string;
  /** Telugu name (Hyderabad users) — encouraged, not required */
  nameTe?: string;
  mealType: CatalogMealType;
  cuisine: CatalogCuisine;
  /** 1..6 — home-scale batches so per-serving math stays honest */
  servings: number;
  /** 5..90 total minutes */
  prepMinutes: number;
  /** 2..12 ingredient rows; omit water; salt only if meaningful (<= 5 g) */
  items: CatalogRecipeSeedItem[];
  /** 3..8 steps, each <= 160 chars, plain English, diabetic-friendly method (roast/tawa/steam > deep-fry) */
  steps: string[];
  /** subset of CATALOG_TAGS; every catalog recipe is diabetic-friendly by design (no tag needed for that) */
  tags: CatalogTag[];
  /** one line on the diabetic angle: the swap, the portion logic, or the leftover use; <= 160 chars */
  notes?: string;
}
