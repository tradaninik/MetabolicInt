// P4: personalization questionnaire - GET/PUT /api/intelligence/survey
// One row per user (IntelligenceSurvey). Answers are whitelisted hard: unknown
// keys or out-of-vocabulary values are dropped, never stored.
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SYMPTOM_OPTIONS, FAMILY_HISTORY_OPTIONS, type SurveyAnswers } from '@mi/engine';

export const dynamic = 'force-dynamic';

const DIET = ['veg', 'egg', 'nonveg'] as const;
const RICE = ['daily', 'most-days', 'occasional'] as const;
const SWEETS = ['daily', 'weekly', 'rarely'] as const;
const TEA = ['none', 'some', 'heavy'] as const;
const EATOUT = ['often', 'sometimes', 'rarely'] as const;
const OIL = ['groundnut', 'sunflower', 'coconut', 'ghee-heavy', 'mustard', 'olive-blend', 'mixed'] as const;
const SLEEPQ = ['good', 'disturbed', 'poor'] as const;
const MENOPAUSE = ['pre', 'peri', 'post', 'na'] as const;
const GOAL = ['sugar', 'weight', 'cholesterol', 'energy', 'fitness'] as const;

function inEnum<T extends readonly string[]>(v: unknown, list: T): v | undefined {
  return typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T[number]) : undefined;
}

function numIn(v: unknown, lo: number, hi: number): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n * 10) / 10 : undefined;
}

function strListIn(v: unknown, vocab: readonly string[]): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const kept = v.filter((x): x is string => typeof x === 'string' && (vocab as readonly string[]).includes(x));
  return kept.length > 0 ? kept : undefined;
}

/** Whitelist-validate an arbitrary payload down to a safe SurveyAnswers. */
export function sanitizeSurveyAnswers(payload: unknown): SurveyAnswers {
  const p = (payload ?? {}) as Record<string, unknown>;
  const out: SurveyAnswers = {};
  const diet = inEnum(p.dietPattern, DIET);
  if (diet) out.dietPattern = diet;
  const rice = inEnum(p.riceFrequency, RICE);
  if (rice) out.riceFrequency = rice;
  const sweets = inEnum(p.sweetsFrequency, SWEETS);
  if (sweets) out.sweetsFrequency = sweets;
  const tea = inEnum(p.teaCoffeeSugar, TEA);
  if (tea) out.teaCoffeeSugar = tea;
  const eat = inEnum(p.eatingOutFrequency, EATOUT);
  if (eat) out.eatingOutFrequency = eat;
  const oil = inEnum(p.cookingOil, OIL);
  if (oil) out.cookingOil = oil;
  const sleepQ = inEnum(p.sleepQuality, SLEEPQ);
  if (sleepQ) out.sleepQuality = sleepQ;
  const meno = inEnum(p.menopause, MENOPAUSE);
  if (meno) out.menopause = meno;
  const goal = inEnum(p.primaryGoal, GOAL);
  if (goal) out.primaryGoal = goal;
  const walk = numIn(p.walkMinutesPerDay, 0, 180);
  if (walk != null) out.walkMinutesPerDay = walk;
  const strength = numIn(p.strengthPerWeek, 0, 7);
  if (strength != null) out.strengthPerWeek = strength;
  const sitting = numIn(p.sittingHours, 0, 16);
  if (sitting != null) out.sittingHours = sitting;
  const stress = numIn(p.stressLevel, 1, 5);
  if (stress != null) out.stressLevel = stress;
  const symptoms = strListIn(p.symptoms, SYMPTOM_OPTIONS);
  if (symptoms) out.symptoms = symptoms;
  const family = strListIn(p.familyHistory, FAMILY_HISTORY_OPTIONS);
  if (family) out.familyHistory = family;
  return out;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  try {
    const row = await prisma.intelligenceSurvey.findUnique({ where: { userId } });
    let answers: SurveyAnswers | null = null;
    if (row?.answersJson) {
      try {
        answers = sanitizeSurveyAnswers(JSON.parse(row.answersJson));
      } catch {
        answers = null;
      }
    }
    return NextResponse.json({ answers });
  } catch (err) {
    console.error('survey GET failed', err);
    return NextResponse.json({ error: 'Could not load the questionnaire' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => null);
    const answers = sanitizeSurveyAnswers(body?.answers ?? body);
    const kept = Object.keys(answers).length;
    if (kept === 0) {
      return NextResponse.json({ error: 'Nothing recognizable to save' }, { status: 400 });
    }
    await prisma.intelligenceSurvey.upsert({
      where: { userId },
      create: { userId, answersJson: JSON.stringify(answers) },
      update: { answersJson: JSON.stringify(answers) },
    });
    return NextResponse.json({ ok: true, saved: kept });
  } catch (err) {
    console.error('survey PUT failed', err);
    return NextResponse.json({ error: 'Could not save the questionnaire' }, { status: 500 });
  }
}