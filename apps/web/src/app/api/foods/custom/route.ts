// POST/GET/PATCH/DELETE /api/foods/custom - spec section 4.
// No-DDL by design: the cap is a count check, references are counted then
// 409. Schema-verified against apps/web/prisma/schema.prisma: profile
// fields (incl region) live on User; combo references live in
// SavedCombo.items as a JSON string - both handled below.
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/session-user';
import { validateCustomFood, MAX_CUSTOM_FOODS_PER_USER, REGION_VALUES } from '@/lib/food-validation';
import { parseAliases, type FoodRow } from '@/lib/food-index';
import type { CuisineRegion } from '@mi/engine';

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });
type Row = FoodRow & { createdByUserId?: string | null };
const toClientFood = (row: Row) => ({ ...row, aliases: parseAliases(row.aliases) ?? [], custom: true });

// Spec section 5: region defaults to the user's profile region (User.region).
// The fallback is validated - no silent trust of stale profile data.
async function profileFallbackRegion(userId: string): Promise<CuisineRegion> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { region: true } });
  const r = u?.region as CuisineRegion | undefined;
  if (r && REGION_VALUES.has(r)) return r;
  return 'global';
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return json({ error: 'Sign in to add foods.' }, 401);

  const raw = await req.json().catch(() => null);
  const result = validateCustomFood(raw, { fallbackRegion: await profileFallbackRegion(userId) });
  if (!result.ok) return json({ errors: result.errors }, 400);

  const count = await prisma.food.count({ where: { createdByUserId: userId } });
  if (count >= MAX_CUSTOM_FOODS_PER_USER)
    return json({ error: `You've reached the ${MAX_CUSTOM_FOODS_PER_USER}-food limit. Delete one to add another.` }, 409);

  // Exact own-name duplicate -> 409; duplicates vs catalog names stay allowed (J4).
  const dup = await prisma.food.findFirst({ where: { name: result.data.name, createdByUserId: userId }, select: { id: true } });
  if (dup) return json({ error: `You already have a food called "${result.data.name}".` }, 409);

  const food = await prisma.food.create({ data: { id: `custom-${randomUUID()}`, createdByUserId: userId, ...result.data } });
  return json({ food: toClientFood(food) });
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return json({ error: 'Sign in to see your foods.' }, 401);
  const rows = await prisma.food.findMany({ where: { createdByUserId: userId }, orderBy: { name: 'asc' } });
  // useCount: counted in JS - version-proof vs groupBy syntax drift (spec
  // says entry groupBy; same output, swap when convenient).
  const entries = await prisma.foodEntry.findMany({
    where: { foodId: { in: rows.map((r) => r.id) } }, select: { foodId: true },
  });
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.foodId, (counts.get(e.foodId) ?? 0) + 1);
  return json({ foods: rows.map((r) => ({ ...toClientFood(r), useCount: counts.get(r.id) ?? 0 })) });
}

export async function PATCH(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return json({ error: 'Sign in to edit foods.' }, 401);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const id = body?.id;
  if (typeof id !== 'string' || !id.startsWith('custom-')) return json({ error: 'Missing food id.' }, 400);

  const existing = await prisma.food.findFirst({ where: { id, createdByUserId: userId } });
  if (!existing) return json({ error: 'Food not found.' }, 404); // foreign ids: invisible, not 403

  // Partial edit: unspecified fields keep stored values; aliases unpack to
  // comma form so the SAME validation runs. Past FoodEntries keep their
  // frozen numbers - only the Food row changes (spec 3.5).
  const merged: Record<string, unknown> = {
    name: existing.name, category: existing.category, region: existing.region,
    servingGrams: existing.servingGrams, katoriGrams: existing.katoriGrams,
    carbsPer100g: existing.carbsPer100g, proteinPer100g: existing.proteinPer100g,
    fatPer100g: existing.fatPer100g, fiberPer100g: existing.fiberPer100g,
    kcalPer100g: existing.kcalPer100g, gi: existing.gi,
    aliases: (parseAliases(existing.aliases) ?? []).join(','),
    ...(body ?? {}),
  };
  delete merged.id; // immutable
  const result = validateCustomFood(merged, { fallbackRegion: existing.region as CuisineRegion });
  if (!result.ok) return json({ errors: result.errors }, 400);

  const dup = await prisma.food.findFirst({
    where: { name: result.data.name, createdByUserId: userId, NOT: { id } },
    select: { id: true },
  });
  if (dup) return json({ error: `You already have a food called "${result.data.name}".` }, 409);

  const food = await prisma.food.update({ where: { id }, data: result.data });
  return json({ food: toClientFood(food) });
}

export async function DELETE(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return json({ error: 'Sign in to delete foods.' }, 401);
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return json({ error: 'Missing ?id=.' }, 400);
  const existing = await prisma.food.findFirst({ where: { id, createdByUserId: userId } });
  if (!existing) return json({ error: 'Food not found.' }, 404);

  const entryCount = await prisma.foodEntry.count({ where: { foodId: id } });

  // Combo references: SavedCombo.items is a JSON array of {foodId,...}.
  // Only the owner can reference their custom food, so only their combos
  // need scanning.
  const combos = await prisma.savedCombo.findMany({ where: { userId }, select: { items: true } });
  let comboCount = 0;
  for (const c of combos) {
    try {
      const items = JSON.parse(c.items);
      if (Array.isArray(items) && items.some((it) => it && it.foodId === id)) comboCount++;
    } catch { /* malformed rows never count */ }
  }

  if (entryCount > 0 || comboCount > 0) {
    const bits = [
      entryCount > 0 ? `logged ${entryCount} time${entryCount === 1 ? '' : 's'}` : null,
      comboCount > 0 ? `used in ${comboCount} combo${comboCount === 1 ? '' : 's'}` : null,
    ].filter(Boolean).join(', ');
    return json({ error: `"${existing.name}" is still in use - ${bits}. Remove those uses first, then delete.`, entryCount, comboCount }, 409);
  }
  await prisma.food.delete({ where: { id } });
  return json({ ok: true });
}