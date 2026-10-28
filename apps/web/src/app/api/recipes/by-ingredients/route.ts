// P8 Day 4 — /api/recipes/by-ingredients: "cook with what I have".
// GET ?ing=curd&ing=onion[&mode=pantry|leftover][&limit=20]
//
// The user tells us their pantry (or last night's leftovers); we rank the
// seeded 300-recipe catalog by ingredient COVERAGE - what they can already
// make - via the pure recipe-match lib. Rows are read-only: per-serving
// macros were pipeline-computed at seed time (the iron law) and are never
// recomputed here.
//
// `ing` values may be ingredient foodIds (what the picker sends) OR
// ingredient names/aliases ("Curd", "poha") - resolved against the raw
// building-block catalog only, so a hand-typed dish name stays honestly
// "unknown" instead of pretending to match. Unrecognized values come back
// in `unknown` so the UI can say so; they are NOT a 400.
//
// No medical claims - coverage math and plain copy only.
import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/session-user';
import { prisma } from '@/lib/prisma';
import {
  parseByIngredientsQuery,
  rankRecipesByIngredients,
  type MatchCandidate,
  type MatchInfo,
} from '@/lib/recipe-match';
import { ingredientFoods, FOOD_INDEX } from '@mi/food-db';

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
  tags: string; // JSON string[]
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

export interface CatalogItemClient {
  foodId: string;
  foodName: string;
  grams: number;
}

export interface ByIngredientsMatchClient {
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
  match: MatchInfo;
}

interface CatalogItemRow {
  foodId: string;
  portionType: 'grams';
  portionValue: number;
}

// Defensive parse, same posture as /api/recipes/catalog: the seed pipeline
// guarantees valid JSON columns, so a corrupt row degrades to an empty list,
// never a 500.
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

// ---------- ingredient resolution: id, name, or alias -> foodId ----------

// ingredientFoods is the exact universe catalog recipes draw their items
// from, so resolving against it (not all FOODS) keeps "unknown" honest.
const ING_ID_SET = new Set(ingredientFoods.map((f) => f.id));
const ING_KEY_TO_ID = new Map<string, string>();
for (const f of ingredientFoods) {
  ING_KEY_TO_ID.set(f.name.toLowerCase(), f.id);
  for (const a of f.aliases ?? []) ING_KEY_TO_ID.set(a.toLowerCase(), f.id);
}

/** Resolve one user-supplied ing value to a catalog ingredient foodId.
 * Returns null for anything unrecognized (reported, never fatal). */
function resolveIngredient(input: string): string | null {
  if (ING_ID_SET.has(input)) return input;
  const key = input.toLowerCase();
  if (ING_ID_SET.has(key)) return key;
  return ING_KEY_TO_ID.get(key) ?? null;
}

export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = parseByIngredientsQuery(new URL(req.url).searchParams);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // Resolve names/aliases to ids; unrecognized values ride along in `unknown`.
  const have: string[] = [];
  const unknown: string[] = [];
  for (const value of parsed.have) {
    const id = resolveIngredient(value);
    if (id != null && !have.includes(id)) have.push(id);
    else if (id == null) unknown.push(value);
  }

  // Rank against the whole catalog (300 rows, in-memory coverage math is
  // trivial); deterministic name-asc order from the DB keeps ranking stable.
  const rows = await prisma.catalogRecipe.findMany({ orderBy: { name: 'asc' } });

  const candidates: Array<MatchCandidate & { row: CatalogRecipeRow }> = (
    rows as unknown as CatalogRecipeRow[]
  ).map((row) => ({
    id: row.id,
    name: row.name,
    tags: parseStrings(row.tags),
    items: parseItems(row.items),
    row,
  }));

  const ranked = rankRecipesByIngredients(have, candidates, parsed.mode).slice(0, parsed.limit);

  const matches: ByIngredientsMatchClient[] = ranked.map(({ candidate, match }) => {
    const row = (candidate as { row: CatalogRecipeRow }).row;
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
      carbTier: row.carbTier as ByIngredientsMatchClient['carbTier'],
      // Catalog items are grams-pinned (seed contract), so portionValue IS grams.
      items: parseItems(row.items).map((it) => ({
        foodId: it.foodId,
        foodName: FOOD_INDEX[it.foodId]?.name ?? it.foodId,
        grams: it.portionValue,
      })),
      match,
    };
  });

  return NextResponse.json({ have, unknown, mode: parsed.mode, matches });
}
