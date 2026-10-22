import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/session-user';
import { prisma } from '@/lib/prisma';
import { validateDayTag, DAY_CONTEXT_TAGS, DAY_TAG_LABELS, istNow } from '@/lib/clinical-db';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET: ?date=YYYY-MM-DD for one day; otherwise the last 30 days.
// The tag vocabulary rides along so forms never hardcode it.
export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const date = url.searchParams.get('date');
  if (date) {
    if (!DATE_RE.test(date)) return NextResponse.json({ error: 'date must be YYYY-MM-DD.' }, { status: 400 });
    const rows = await prisma.dayContextTag.findMany({ where: { userId, tagDate: date }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ rows });
  }

  const to = istNow().slice(0, 10);
  const from = new Date(Date.parse(`${to}T00:00:00Z`) - 29 * 86400000).toISOString().slice(0, 10);
  const rows = await prisma.dayContextTag.findMany({
    where: { userId, tagDate: { gte: from } },
    orderBy: [{ tagDate: 'desc' }, { createdAt: 'desc' }],
  });
  return NextResponse.json({
    rows,
    tags: DAY_CONTEXT_TAGS.map((t) => ({ value: t, label: DAY_TAG_LABELS[t] })),
  });
}

// POST: tag a day. Tags are associations from the user's notes - never causes.
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const b = body as Record<string, unknown>;

  const tag = typeof b.tag === 'string' ? b.tag : '';
  const tagDate = typeof b.tagDate === 'string' ? b.tagDate : '';
  const note = typeof b.note === 'string' ? b.note.trim().slice(0, 200) : null;

  const err = validateDayTag({ tag, tagDate, note });
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  try {
    const row = await prisma.dayContextTag.create({ data: { userId, tag, tagDate, note: note || null } });
    return NextResponse.json({ row });
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'This day already carries that tag.' }, { status: 409 });
    }
    throw e;
  }
}

// DELETE: ?id= - undo a tag. Idempotent: a repeat undo reports deleted: 0.
export async function DELETE(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const res = await prisma.dayContextTag.deleteMany({ where: { id, userId } });
  return NextResponse.json({ deleted: res.count });
}