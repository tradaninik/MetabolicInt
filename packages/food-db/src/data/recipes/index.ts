// P8 — the unified 300-recipe catalog: the single import the web app and the
// seed pipeline consume. Bands are authored in parallel (one file per meal
// band) and merged here with three hard invariants enforced at import time
// (fail fast, never silently ship a broken catalog):
//   1. every slug unique across ALL bands (doubles as the DB row id)
//   2. every name unique across ALL bands
//   3. exactly 300 recipes (the sprint's Day-2 deliverable; a dropped band
//      must fail the build, not quietly ship 250)
// Macro columns are never part of this module — the seed pipeline computes
// them via @mi/engine recipeNutrition (iron law: computed, never hand-set).

import type { CatalogRecipeSeed } from './types';
import { breakfastRecipes } from './breakfast';
import { lunchRecipes } from './lunch';
import { dinnerRecipes } from './dinner';
import { snackRecipes } from './snack';
import { drinkSideRecipes } from './drink-side';
import { hyderabadiMainRecipes } from './hyderabadi-mains';

export const CATALOG_RECIPE_TARGET = 300;

export const catalogRecipes: CatalogRecipeSeed[] = [
  ...breakfastRecipes,
  ...lunchRecipes,
  ...dinnerRecipes,
  ...snackRecipes,
  ...drinkSideRecipes,
  ...hyderabadiMainRecipes,
];

// --- invariant 1+2: unique slugs and names across the whole catalog ---
const slugCounts = new Map<string, number>();
const nameCounts = new Map<string, number>();
for (const r of catalogRecipes) {
  slugCounts.set(r.slug, (slugCounts.get(r.slug) ?? 0) + 1);
  nameCounts.set(r.name, (nameCounts.get(r.name) ?? 0) + 1);
}
const dupeSlugs = [...slugCounts.entries()].filter(([, n]) => n > 1).map(([s]) => s);
const dupeNames = [...nameCounts.entries()].filter(([, n]) => n > 1).map(([s]) => s);
if (dupeSlugs.length > 0 || dupeNames.length > 0) {
  throw new Error(
    `Catalog recipe collision: slugs [${dupeSlugs.join(', ')}] names [${dupeNames.join(', ')}]`,
  );
}

// --- invariant 3: the full 300 ---
if (catalogRecipes.length !== CATALOG_RECIPE_TARGET) {
  throw new Error(
    `Catalog recipes: expected ${CATALOG_RECIPE_TARGET}, got ${catalogRecipes.length} — a band file is short or double-loaded`,
  );
}
