import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/session-user';
import { INGREDIENT_IDS } from '@mi/food-db';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.toLowerCase().trim() ?? '';
  const region = url.searchParams.get('region'); // optional filter
  const category = url.searchParams.get('category'); // optional filter
  const mine = url.searchParams.get('mine') === '1';
  // P7.1: ingredient mode for the recipe editor - catalog hits are restricted
  // to raw building blocks (the user's own foods stay, they are single foods
  // the user authored themselves, not catalog dishes).
  const ingredients = url.searchParams.get('ingredients') === '1';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '30', 10), 100);

  // Optional session: logged-out visitors see catalog only (spec 3.4).
  const userId = await getSessionUserId().catch(() => null);

  const where: Prisma.FoodWhereInput = {
    ...(region && region !== 'all' ? { region } : {}),
    ...(category && category !== 'all' ? { category } : {}),
  };

  // The catalog-side clause: ingredient mode whitelists raw-staple ids only.
  const catalogSide = ingredients
    ? { createdByUserId: null, id: { in: INGREDIENT_IDS } }
    : { createdByUserId: null };

  if (mine) {
    // Only my customs. Signed-out mine=1 matches nothing.
    where.createdByUserId = userId ?? '__none__';
    if (q) where.OR = [{ name: { contains: q } }, { aliases: { contains: q } }];
  } else if (userId) {
    // Catalog + my customs, AND-ed with the search clause.
    const visible = { OR: [catalogSide, { createdByUserId: userId }] };
    if (q) where.AND = [visible, { OR: [{ name: { contains: q } }, { aliases: { contains: q } }] }];
    else Object.assign(where, visible);
  } else {
    Object.assign(where, catalogSide);
    if (q) where.OR = [{ name: { contains: q } }, { aliases: { contains: q } }];
  }

  const foods = await prisma.food.findMany({ where, take: limit, orderBy: { name: 'asc' } });

  // Rank: my customs first (F6 "yours badge, mine ranked first"), then
  // exact prefix matches. The client badges ids starting with 'custom-'.
  const isMine = (f: { createdByUserId: string | null }) => f.createdByUserId != null;
  const ranked = foods.sort((a, b) => {
    const am = isMine(a) ? 0 : 1;
    const bm = isMine(b) ? 0 : 1;
    if (am !== bm) return am - bm;
    const ap = a.name.toLowerCase().startsWith(q) ? 0 : 1;
    const bp = b.name.toLowerCase().startsWith(q) ? 0 : 1;
    return ap - bp;
  });

  return NextResponse.json({ foods: ranked });
}