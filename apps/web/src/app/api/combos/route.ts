import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface ComboItemInput {
  food: { id: string; [k: string]: unknown };
  portionType: string;
  portionValue: number;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { name, items } = await req.json();

  const cleanName = typeof name === 'string' ? name.trim().slice(0, 40) : '';
  if (!cleanName) return NextResponse.json({ error: 'Name your combo (up to 40 characters)' }, { status: 400 });
  if (!Array.isArray(items) || items.length === 0 || items.length > 10) {
    return NextResponse.json({ error: 'A combo needs 1-10 items' }, { status: 400 });
  }
  const clean: ComboItemInput[] = [];
  for (const it of items) {
    if (!it || typeof it.food?.id !== 'string') continue;
    const pt = ['serving', 'katori', 'grams'].includes(it.portionType) ? it.portionType : 'serving';
    const pv = Number(it.portionValue);
    clean.push({
      food: it.food,
      portionType: pt,
      portionValue: Number.isFinite(pv) && pv > 0 && pv <= 50 ? pv : 1,
    });
  }
  if (clean.length === 0) return NextResponse.json({ error: 'No valid items' }, { status: 400 });

  const combo = await prisma.savedCombo.create({
    data: { userId: session.user.id, name: cleanName, items: JSON.stringify(clean) },
  });
  return NextResponse.json({ combo: { ...combo, items: clean } });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rows = await prisma.savedCombo.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    take: 30,
  });
  const combos = rows.map((r) => {
    let items: ComboItemInput[] = [];
    try {
      const v = JSON.parse(r.items);
      if (Array.isArray(v)) items = v;
    } catch {
      // malformed row - return empty items rather than failing the list
    }
    return { id: r.id, name: r.name, items };
  });
  return NextResponse.json({ combos });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const combo = await prisma.savedCombo.findUnique({ where: { id } });
  if (!combo || combo.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  await prisma.savedCombo.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}