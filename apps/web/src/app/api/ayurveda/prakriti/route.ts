import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PRAKRITI_QUESTIONS, scorePrakriti } from '@mi/engine';

export const dynamic = 'force-dynamic';

// U11 Prakriti: owner-guarded self-assessment API. Educational only - not a medical classification.
// GET returns the quiz questions plus your latest stored profile (history is kept; latest wins).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const latest = await prisma.prakritiProfile.findFirst({
    where: { userId: session.user.id },
    orderBy: { takenAt: 'desc' },
  });
  if (!latest) return NextResponse.json({ questions: PRAKRITI_QUESTIONS, profile: null });

  let stored: Record<string, string> = {};
  try {
    const parsed = JSON.parse(latest.answersJson);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) stored = parsed as Record<string, string>;
  } catch { stored = {}; }

  let pct: { vataPct: number; pittaPct: number; kaphaPct: number } | null = null;
  try {
    const rescored = scorePrakriti(stored);
    pct = { vataPct: rescored.vataPct, pittaPct: rescored.pittaPct, kaphaPct: rescored.kaphaPct };
  } catch { pct = null; }

  return NextResponse.json({
    questions: PRAKRITI_QUESTIONS,
    profile: {
      answers: stored,
      vata: latest.vataScore,
      pitta: latest.pittaScore,
      kapha: latest.kaphaScore,
      ...(pct ?? {}),
      primary: latest.primaryDosha,
      secondary: latest.secondaryDosha,
      takenAt: latest.takenAt,
    },
  });
}

// POST stores a NEW profile row on every retake (history preserved) and returns the scored result.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const raw = (body as { answers?: unknown } | null)?.answers;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return NextResponse.json({ error: 'Please answer all 12 questions.' }, { status: 400 });
  }
  const map = raw as Record<string, unknown>;

  const clean: Record<string, string> = {};
  for (const q of PRAKRITI_QUESTIONS) {
    const v = map[q.id];
    if (typeof v !== 'string') {
      return NextResponse.json({ error: 'Please answer all 12 questions.' }, { status: 400 });
    }
    clean[q.id] = v;
  }

  let result;
  try {
    result = scorePrakriti(clean);
  } catch {
    return NextResponse.json({ error: 'Some answers were not recognized - please retake the quiz.' }, { status: 400 });
  }

  const row = await prisma.prakritiProfile.create({
    data: {
      userId: session.user.id,
      answersJson: JSON.stringify(clean),
      vataScore: result.vata,
      pittaScore: result.pitta,
      kaphaScore: result.kapha,
      primaryDosha: result.primary,
      secondaryDosha: result.secondary,
    },
  });

  return NextResponse.json({
    profile: {
      answers: clean,
      vata: result.vata,
      pitta: result.pitta,
      kapha: result.kapha,
      vataPct: result.vataPct,
      pittaPct: result.pittaPct,
      kaphaPct: result.kaphaPct,
      primary: result.primary,
      secondary: result.secondary,
      takenAt: row.takenAt,
    },
  });
}