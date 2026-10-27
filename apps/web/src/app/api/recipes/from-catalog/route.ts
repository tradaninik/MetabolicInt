// P8 Day 3 — /api/recipes/from-catalog: "save to my recipes". Copies a
// catalog recipe (id = the seed slug) into the user's own Recipe table with
// the items JSON VERBATIM — the same {foodId, portionType:'grams',
// portionValue} triples the seeds pin — so the copy flows through
// /api/recipes and the /log tray exactly like a hand-built recipe, and
// edits to an ingredient's per-100g values keep flowing through (nutrition
// is recomputed at read time, never frozen).
//
// IDEMPOTENT by design: if the user already has a Recipe with the same name
// AND the same items, the save returns that row with existing: true instead
// of duplicating it (repeat clicks on the same catalog card are a no-op).
import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/session-user';
import { prisma } from '@/lib/prisma';
import { mergedFoodIndex } from '@/lib/food-index';
import { recipeNutrition, type RecipeItemInput, type Food } from '@mi/engine';

interface RecipeRow {
  id: string;
  name: string;
  servings: number;
  items: string; // JSON
  updatedAt: Date;
}

export interface RecipeClientItem {
  food: Food;
  portionType: RecipeItemInput['portionType'];
  portionValue: number;
}

function parseItems(raw: string): RecipeItemInput[] {
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter(
      (it): it is RecipeItemInput =>
        it && typeof it === 'object' && typeof it.foodId === 'string' && it.foodId !== '',
    );
  } catch {
    return [];
  }
}

/** Same decorate as /api/recipes (reimplemented locally — that route is a
 * read-only reference): resolved engine foods + per-serving nutrition, so
 * the saved copy is indistinguishable from a hand-built recipe on the wire. */
function decorate(row: RecipeRow, foodIndex: Record<string, Food>) {
  const items = parseItems(row.items);
  const nutrition = recipeNutrition(items, foodIndex, row.servings);
  return {
    id: row.id,
    name: row.name,
    servings: row.servings,
    items: items
      .filter((it) => foodIndex[it.foodId] != null)
      .map((it): RecipeClientItem => ({
        food: foodIndex[it.foodId],
        portionType: it.portionType,
        portionValue: it.portionValue,
      })),
    missingFoodIds: nutrition.missingFoodIds,
    nutrition: nutrition.perServing,
    totals: nutrition.totals,
    updatedAt: row.updatedAt,
  };
}

/** Structural, order-sensitive items equality — a save after a hand-built
 * identical recipe (or a re-save of this route's own copy) dedupes even if
 * the two JSON strings differ in spacing. */
function sameItems(a: RecipeItemInput[], b: RecipeItemInput[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (it, i) =>
      it.foodId === b[i].foodId &&
      it.portionType === b[i].portionType &&
      it.portionValue === b[i].portionValue,
  );
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const catalogId =
    body && typeof body === 'object' && typeof (body as { catalogId?: unknown }).catalogId === 'string'
      ? (body as { catalogId: string }).catalogId
      : '';
  if (!catalogId) return NextResponse.json({ error: 'Missing catalogId.' }, { status: 400 });

  const catalog = await prisma.catalogRecipe.findUnique({ where: { id: catalogId } });
  if (!catalog) {
    return NextResponse.json({ error: 'Catalog recipe not found.' }, { status: 404 });
  }

  // Idempotency: same name + same items (parsed and compared structurally)
  // means the user already has this exact recipe — return it, never duplicate.
  const catalogItems = parseItems(catalog.items);
  const mine = await prisma.recipe.findMany({ where: { userId, name: catalog.name } });
  const existing = mine.find((r) => sameItems(parseItems(r.items), catalogItems));
  if (existing) {
    const foodIndex = await mergedFoodIndex(userId);
    return NextResponse.json({ recipe: decorate(existing, foodIndex), existing: true });
  }

  // Copy verbatim: name + servings + the stored items JSON string as-is.
  const recipe = await prisma.recipe.create({
    data: {
      userId,
      name: catalog.name,
      servings: catalog.servings,
      items: catalog.items,
    },
  });
  const foodIndex = await mergedFoodIndex(userId);
  return NextResponse.json({ recipe: decorate(recipe, foodIndex), existing: false }, { status: 201 });
}
