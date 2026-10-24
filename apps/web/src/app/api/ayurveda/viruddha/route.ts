import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkViruddha, VIRUDDHA_DISCLAIMER, type ViruddhaCheckItem } from '@mi/engine';
import { parseAliases, viruddhaTagsForFood } from '@/lib/viruddha';

export const dynamic = 'force-dynamic';

// P4c-c / U19 - Viruddha Ahara checker API (educational, non-medical).
// POST accepts 1-10 items ({ foodId? , name?, aliases? }) - the shape of a /log tray,
// a SavedCombo payload, or a programmatic/mobile client - and returns the pairing
// findings with BOTH the classical rationale and the modern note, plus the disclaimer.
// 401 unauthenticated; a clean combination returns an empty findings array.

interface ItemInput {
  foodId?: string;
  name?: string;
  aliases?: string[];
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { items?: ItemInput[] };
  try {
    body = (await req.json()) as { items?: ItemInput[] };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const raw = body?.items;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 10) {
    return NextResponse.json({ error: 'Send 1-10 items ({ foodId?, name?, aliases? })' }, { status: 400 });
  }

  const items: ViruddhaCheckItem[] = [];
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue;
    const foodId = typeof it.foodId === 'string' ? it.foodId.trim() : '';
    const name = typeof it.name === 'string' ? it.name.trim().slice(0, 80) : '';
    const aliases = Array.isArray(it.aliases)
      ? it.aliases.filter((a) => typeof a === 'string').map((a) => a.trim().slice(0, 40)).filter(Boolean).slice(0, 5)
      : [];

    let resolvedName = name;
    let resolvedAliases = aliases;
    if (foodId) {
      // Owner guard (spec 3.4): catalog foods are public; someone else's custom food
      // is indistinguishable from a missing one - it resolves by name only, never 403.
      const food = await prisma.food.findFirst({
        where: { id: foodId, OR: [{ createdByUserId: null }, { createdByUserId: session.user.id }] },
      });
      if (food) {
        resolvedName = name || food.name;
        resolvedAliases = aliases.length > 0 ? aliases : parseAliases(food.aliases);
      }
    }
    if (!resolvedName && !foodId) continue; // nothing to resolve
    items.push({
      key: foodId || resolvedName,
      label: resolvedName || foodId,
      tags: viruddhaTagsForFood({ id: foodId, name: resolvedName, aliases: resolvedAliases }),
    });
  }

  const findings = checkViruddha(items);
  return NextResponse.json({ findings, disclaimer: VIRUDDHA_DISCLAIMER });
}
