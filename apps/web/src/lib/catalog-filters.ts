// P8 Day 3 — catalog query validation (the pure core behind
// /api/recipes/catalog). parseCatalogQuery turns the route's search params
// into a plain filter object + pagination, with plain-language 400-style
// errors in the repo's voice. No Prisma, no DB, no fetch: the vocabularies
// are plain string arrays from @mi/food-db (types are erased at runtime), so
// this module stays fully unit-testable and the route just maps the filter
// object onto a Prisma where clause.
//
// All filters are optional and AND-combined. An empty-string param counts
// as "no filter" (a cleared UI select serializes to ''), same as q. q is a
// name substring — case-insensitivity comes from SQLite LIKE on the DB side,
// so the parser only trims, never rewrites the query.

import {
  CATALOG_MEAL_TYPES,
  CATALOG_CUISINES,
  CATALOG_TAGS,
} from '@mi/food-db';
import type { CatalogMealType, CatalogCuisine, CatalogTag } from '@mi/food-db';
import type { CarbTier } from '@mi/engine';

/** Shared pagination: default page size 24, hard max 60 (UI grid pages). */
export const CATALOG_PAGE_DEFAULTS = {
  take: 24,
  maxTake: 60,
} as const;

/** The engine carb tiers the catalog filters on (LOW / MODERATE / HIGHER). */
export const CARB_TIERS = ['LOW', 'MODERATE', 'HIGHER'] as const satisfies readonly CarbTier[];

/** The plain filter object the route maps onto a Prisma where clause. */
export interface CatalogQueryWhere {
  mealType?: CatalogMealType;
  cuisine?: CatalogCuisine;
  carbTier?: CarbTier;
  tag?: CatalogTag;
  q?: string;
}

export type CatalogQueryResult =
  | { ok: true; where: CatalogQueryWhere; take: number; skip: number }
  | { ok: false; error: string };

const MEAL_TYPE_LIST = CATALOG_MEAL_TYPES.join(', ');
const CUISINE_LIST = CATALOG_CUISINES.join(', ');
const TAG_LIST = CATALOG_TAGS.join(', ');
const TIER_LIST = CARB_TIERS.join(', ');

/** Validate /api/recipes/catalog search params. First invalid param wins;
 * the error strings name the vocabulary so the UI can hint valid values. */
export function parseCatalogQuery(searchParams: URLSearchParams): CatalogQueryResult {
  const where: CatalogQueryWhere = {};

  const mealType = searchParams.get('mealType');
  if (mealType != null && mealType !== '') {
    if (!(CATALOG_MEAL_TYPES as readonly string[]).includes(mealType)) {
      return { ok: false, error: `Unknown mealType. Use one of: ${MEAL_TYPE_LIST}.` };
    }
    // includes() above proved membership; the cast only re-narrows to the union.
    where.mealType = mealType as CatalogMealType;
  }

  const cuisine = searchParams.get('cuisine');
  if (cuisine != null && cuisine !== '') {
    if (!(CATALOG_CUISINES as readonly string[]).includes(cuisine)) {
      return { ok: false, error: `Unknown cuisine. Use one of: ${CUISINE_LIST}.` };
    }
    where.cuisine = cuisine as CatalogCuisine;
  }

  const carbTierParam = searchParams.get('carbTier');
  if (carbTierParam != null && carbTierParam !== '') {
    if (!(CARB_TIERS as readonly string[]).includes(carbTierParam)) {
      return { ok: false, error: `Unknown carbTier. Use one of: ${TIER_LIST}.` };
    }
    where.carbTier = carbTierParam as CarbTier;
  }

  const tag = searchParams.get('tag');
  if (tag != null && tag !== '') {
    if (!(CATALOG_TAGS as readonly string[]).includes(tag)) {
      return { ok: false, error: `Unknown tag. Use one of: ${TAG_LIST}.` };
    }
    where.tag = tag as CatalogTag;
  }

  // Empty q is absent; otherwise pass through trimmed (LIKE handles case).
  const q = (searchParams.get('q') ?? '').trim();
  if (q) where.q = q;

  let take: number = CATALOG_PAGE_DEFAULTS.take;
  const takeParam = searchParams.get('take');
  if (takeParam != null && takeParam !== '') {
    const n = Number(takeParam);
    if (!Number.isInteger(n) || n < 1 || n > CATALOG_PAGE_DEFAULTS.maxTake) {
      return {
        ok: false,
        error: `take must be a whole number between 1 and ${CATALOG_PAGE_DEFAULTS.maxTake}.`,
      };
    }
    take = n;
  }

  let skip = 0;
  const skipParam = searchParams.get('skip');
  if (skipParam != null && skipParam !== '') {
    const n = Number(skipParam);
    if (!Number.isInteger(n) || n < 0) {
      return { ok: false, error: 'skip must be a whole number of 0 or more.' };
    }
    skip = n;
  }

  return { ok: true, where, take, skip };
}
