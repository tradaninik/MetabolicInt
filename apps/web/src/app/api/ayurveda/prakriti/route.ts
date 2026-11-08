import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PRAKRITI_QUESTIONS, QUIZ_VERSION, scorePrakriti } from '@mi/engine';

export const dynamic = 'force-dynamic';

// U11 Prakriti: owner-guarded self-assessment API. Educational only - not a medical classification.
// S2-B: every payload carries quizVersion; the profile leads with the no-dominance
// profileLabel (a tie never implies a dominant dosha); GET also returns the recent
// retake history (rows already exist and are indexed - zero schema change).
const HISTORY_LIMIT = 10;

function parseAnswers(json: string): Record<string, string> {
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    /* fall through to empty */
  }
  return {};
}

/** Rescore stored answers with the CURRENT engine so old rows also get the
 *  tie-aware label. Returns null when the answers no longer validate. */
function rescore(stored: Record<string, string>) {
  try {
    return scorePrakriti(stored);
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await prisma.prakritiProfile.findMany({
    where: { userId: session.user.id },
    orderBy: { takenAt: 'desc' },
    take: HISTORY_LIMIT,
  });
  if (rows.length === 0) {
    return NextResponse.json({ questions: PRAKRITI_QUESTIONS, quizVersion: QUIZ_VERSION, profile: null, history: [] });
  }

  const latest = rows[0];
  const stored = parseAnswers(latest.answersJson);
  const rescored = rescore(stored);

  const history = rows.map((row) => {
    const r = rescore(parseAnswers(row.answersJson));
    return {
      takenAt: row.takenAt,
      vata: row.vataScore,
      pitta: row.pittaScore,
      kapha: row.kaphaScore,
      ...(r
        ? {
            vataPct: r.vataPct,
            pittaPct: r.pittaPct,
            kaphaPct: r.kaphaPct,
            profileLabel: r.profileLabel,
            isTie: r.isTie,
          }
        : {}),
    };
  });

  return NextResponse.json({
    questions: PRAKRITI_QUESTIONS,
    quizVersion: QUIZ_VERSION,
    profile: {
      answers: stored,
      vata: latest.vataScore,
      pitta: latest.pittaScore,
      kapha: latest.kaphaScore,
      ...(rescored
        ? {
            vataPct: rescored.vataPct,
            pittaPct: rescored.pittaPct,
            kaphaPct: rescored.kaphaPct,
            profileLabel: rescored.profileLabel,
            isTie: rescored.isTie,
          }
        : {}),
      primary: latest.primaryDosha,
      secondary: latest.secondaryDosha,
      takenAt: latest.takenAt,
    },
    history,
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
    quizVersion: QUIZ_VERSION,
    profile: {
      answers: clean,
      vata: result.vata,
      pitta: result.pitta,
      kapha: result.kapha,
      vataPct: result.vataPct,
      pittaPct: result.pittaPct,
      kaphaPct: result.kaphaPct,
      profileLabel: result.profileLabel,
      isTie: result.isTie,
      primary: result.primary,
      secondary: result.secondary,
      takenAt: row.takenAt,
    },
  });
}
