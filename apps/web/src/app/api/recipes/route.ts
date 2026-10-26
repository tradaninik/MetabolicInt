// P6-a — /api/recipes: user recipes (named multi-ingredient meals).
// Mirrors the SavedCombo precedent (items JSON), but stores only the lean
// {foodId, portionType, portionValue} triples: nutrition is recomputed at
// read time against the merged index, so edits to a custom ingredient flow
// through and nothing is frozen until logging (where FoodEntries take over).
import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/session-user';
import { prisma } from '@/lib/prisma';
import { mergedFoodIndex } from '@/lib/food-index';
import { validateRecipeInput, recipeNutrition, type RecipeItemInput, type Food } from '@mi/engine';

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

/** Attach resolved foods + per-serving nutrition to a stored recipe row.
 * Items carry the full engine Food object (same client shape as SavedCombo
 * items) so /log can fill its tray exactly like a saved combo. */
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

// Owner guard mirrors /api/meals: catalog foods are public; a custom food is
// visible only to its creator. Anything else is a 400 naming the offender.
async function assertFoodsAccessible(userId: string, items: RecipeItemInput[]): Promise<string | null> {
  const ids = [...new Set(items.map((i) => i.foodId))];
  const rows = await prisma.food.findMany({ where: { id: { in: ids } } });
  const ok = new Set(rows.filter((r) => r.createdByUserId === null || r.createdByUserId === userId).map((r) => r.id));
  const bad = ids.filter((id) => !ok.has(id));
  return bad.length > 0 ? `Some ingredients are unavailable (id ${bad[0]}). Add them as your own food first.` : null;
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [rows, foodIndex] = await Promise.all([
    prisma.recipe.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: 50 }),
    mergedFoodIndex(userId),
  ]);
  return NextResponse.json({ recipes: rows.map((r) => decorate(r, foodIndex)) });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const result = validateRecipeInput((body ?? {}) as Record<string, unknown>);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const guard = await assertFoodsAccessible(userId, result.items);
  if (guard) return NextResponse.json({ error: guard }, { status: 400 });

  const dup = await prisma.recipe.findFirst({
    where: { userId, name: result.name },
    select: { id: true },
  });
  if (dup) return NextResponse.json({ error: `You already have a recipe called "${result.name}".` }, { status: 409 });

  const recipe = await prisma.recipe.create({
    data: { userId, name: result.name, servings: result.servings, items: JSON.stringify(result.items) },
  });
  const foodIndex = await mergedFoodIndex(userId);
  return NextResponse.json({ recipe: decorate(recipe, foodIndex) });
}

export async function PATCH(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const existing = await prisma.recipe.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });

  // Partial edit: unspecified fields keep stored values (pattern: foods/custom PATCH).
  const merged = {
    name: body?.name !== undefined ? body.name : existing.name,
    servings: body?.servings !== undefined ? body.servings : existing.servings,
    items: body?.items !== undefined ? body.items : parseItems(existing.items),
  };
  const result = validateRecipeInput(merged);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const guard = await assertFoodsAccessible(userId, result.items);
  if (guard) return NextResponse.json({ error: guard }, { status: 400 });

  const dup = await prisma.recipe.findFirst({
    where: { userId, name: result.name, NOT: { id } },
    select: { id: true },
  });
  if (dup) return NextResponse.json({ error: `You already have a recipe called "${result.name}".` }, { status: 409 });

  const recipe = await prisma.recipe.update({
    where: { id },
    data: { name: result.name, servings: result.servings, items: JSON.stringify(result.items) },
  });
  const foodIndex = await mergedFoodIndex(userId);
  return NextResponse.json({ recipe: decorate(recipe, foodIndex) });
}

export async function DELETE(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const existing = await prisma.recipe.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });

  // Deleting is always allowed: logged meals keep their frozen FoodEntry
  // numbers, so history never references the recipe row.
  await prisma.recipe.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
