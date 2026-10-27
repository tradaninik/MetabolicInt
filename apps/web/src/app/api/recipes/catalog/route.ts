// P8 Day 3 — /api/recipes/catalog: browse + search the seeded 300-recipe
// diabetic-friendly catalog. Filters (mealType / cuisine / carbTier / tag /
// q) are validated by the pure catalog-filters module and AND-combined;
// take/skip paginate with a separate count() so the UI gets the TOTAL
// matching rows, not just this page. Rows are read-only: per-serving macros
// were pipeline-computed at seed time (the iron law), never recomputed here.
// items.foodName resolves from the food-db index so the UI can show an
// ingredient list without a second request.
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getSessionUserId } from '@/lib/session-user';
import { prisma } from '@/lib/prisma';
import { parseCatalogQuery } from '@/lib/catalog-filters';
import { FOOD_INDEX } from '@mi/food-db';

interface CatalogRecipeRow {
  id: string;
  name: string;
  nameTe: string | null;
  mealType: string;
  cuisine: string;
  servings: number;
  prepMinutes: number;
  items: string; // JSON [{foodId, portionType:'grams', portionValue}]
  steps: string; // JSON string[]
  tags: string; // JSON string[] (controlled vocabulary)
  notes: string | null;
  kcal: number;
  carbsG: number;
  netCarbsG: number;
  proteinG: number;
  fatG: number;
  fiberG: number;
  gi: number;
  carbTier: string;
}

/** What a catalog item looks like on the wire: id + display name + grams. */
export interface CatalogItemClient {
  foodId: string;
  foodName: string;
  grams: number;
}

export interface CatalogRecipeClient {
  id: string;
  name: string;
  nameTe: string | null;
  mealType: string;
  cuisine: string;
  servings: number;
  prepMinutes: number;
  steps: string[];
  tags: string[];
  notes: string | null;
  kcal: number;
  carbsG: number;
  netCarbsG: number;
  proteinG: number;
  fatG: number;
  fiberG: number;
  gi: number;
  carbTier: 'LOW' | 'MODERATE' | 'HIGHER';
  items: CatalogItemClient[];
}

interface CatalogItemRow {
  foodId: string;
  portionType: 'grams';
  portionValue: number;
}

// Defensive parse, same posture as /api/recipes: the seed pipeline guarantees
// valid JSON columns, so a corrupt row degrades to an empty list, never a 500.
function parseItems(raw: string): CatalogItemRow[] {
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter(
      (it): it is CatalogItemRow =>
        !!it &&
        typeof it === 'object' &&
        typeof (it as { foodId?: unknown }).foodId === 'string' &&
        (it as { foodId: string }).foodId !== '' &&
        typeof (it as { portionValue?: unknown }).portionValue === 'number',
    );
  } catch {
    return [];
  }
}

function parseStrings(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter((s): s is string => typeof s === 'string');
  } catch {
    return [];
  }
}

/** DB row -> wire shape. foodName falls back to the id if the ingredient
 * ever left the index (Day-2 tests guarantee it never does). */
function toClient(row: CatalogRecipeRow): CatalogRecipeClient {
  return {
    id: row.id,
    name: row.name,
    nameTe: row.nameTe,
    mealType: row.mealType,
    cuisine: row.cuisine,
    servings: row.servings,
    prepMinutes: row.prepMinutes,
    steps: parseStrings(row.steps),
    tags: parseStrings(row.tags),
    notes: row.notes,
    kcal: row.kcal,
    carbsG: row.carbsG,
    netCarbsG: row.netCarbsG,
    proteinG: row.proteinG,
    fatG: row.fatG,
    fiberG: row.fiberG,
    gi: row.gi,
    carbTier: row.carbTier as CatalogRecipeClient['carbTier'],
    // Catalog items are grams-pinned (seed contract), so portionValue IS grams.
    items: parseItems(row.items).map((it) => ({
      foodId: it.foodId,
      foodName: FOOD_INDEX[it.foodId]?.name ?? it.foodId,
      grams: it.portionValue,
    })),
  };
}

export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = parseCatalogQuery(new URL(req.url).searchParams);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // Map the plain filter object onto the Prisma where clause. The tag filter
  // exact-matches a QUOTED tag inside the stored JSON array string
  // ('["quick","high-fiber"]' contains '"high-fiber"' but never '"high-fiber-x"').
  const where: Prisma.CatalogRecipeWhereInput = {};
  if (parsed.where.mealType) where.mealType = parsed.where.mealType;
  if (parsed.where.cuisine) where.cuisine = parsed.where.cuisine;
  if (parsed.where.carbTier) where.carbTier = parsed.where.carbTier;
  if (parsed.where.tag) where.tags = { contains: `"${parsed.where.tag}"` };
  if (parsed.where.q) {
    // SQLite LIKE is ASCII case-insensitive by default, so a plain contains
    // matches q case-insensitively (mode: 'insensitive' is not a SQLite thing).
    where.OR = [
      { name: { contains: parsed.where.q } },
      { nameTe: { contains: parsed.where.q } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.catalogRecipe.findMany({
      where,
      orderBy: { name: 'asc' }, // deterministic order for stable pagination
      take: parsed.take,
      skip: parsed.skip,
    }),
    prisma.catalogRecipe.count({ where }),
  ]);

  return NextResponse.json({ recipes: rows.map(toClient), total });
}
