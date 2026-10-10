import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { answerQuestion, priorSensitivity, type CoachContext, type UserProfile } from '@mi/engine';
import { mergedFoodIndex } from '@/lib/food-index';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { question } = await req.json();
  if (!question?.trim()) return NextResponse.json({ error: 'Empty question' }, { status: 400 });

  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      learnedModel: true,
      foodEntries: { orderBy: { loggedAt: 'desc' }, take: 30 },
      glucoseReadings: { orderBy: { takenAt: 'desc' }, take: 30 },
      sleepEntries: { orderBy: { wokeAt: 'desc' }, take: 7 },
      activityEntries: { orderBy: { at: 'desc' }, take: 7 },
    },
  });
  if (!u) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // F8: the merged index - catalog plus this user's custom foods - is still
  // an engine-shaped parameter, so the engine stays frozen.
  const foodIndex = await mergedFoodIndex(u.id);

  const conditions: string[] = u.conditions ? safeParse(u.conditions) : [];
  const diabetic = conditions.some((c) => c.includes('diabetes'));
  const profile: UserProfile = {
    age: u.age ?? 40,
    gender: (u.gender as UserProfile['gender']) || 'other',
    heightCm: u.heightCm ?? 170,
    weightKg: u.weightKg ?? 70,
    activityLevel: (u.activityLevel as UserProfile['activityLevel']) || 'light',
    region: (u.region as UserProfile['region']) || 'global',
    diabetic: diabetic || undefined,
  };
  if (u.hba1c) profile.hba1c = u.hba1c;

  const learned = u.learnedModel ?? {
    sensitivityMgDlPerGCarb: priorSensitivity(profile),
    sampleSize: 0,
    updatedAt: Date.now(),
    isPrior: true,
  };
  const stepsToday = u.activityEntries
    .filter((a) => a.at.toDateString() === new Date().toDateString() && a.type === 'walk')
    .reduce((s, a) => s + a.durationMin * 110, 0);

  const ctx: CoachContext = {
    profile,
    sensitivity: learned.sensitivityMgDlPerGCarb,
    learned: learned as never,
    foodIndex: foodIndex as never,
    recentMeals: u.foodEntries.map((m) => ({
      foodId: m.foodId, portionType: m.portionType as never, portionValue: m.portionValue,
      grams: m.grams, loggedAt: m.loggedAt.getTime(),
    })),
    recentGlucose: u.glucoseReadings.map((g) => ({ value: g.value, takenAt: g.takenAt.getTime() })),
    recentSleep: u.sleepEntries.map((s) => ({ hours: s.hours, wokeAt: s.wokeAt.getTime() })),
    stepsToday,
  };

  const answer = answerQuestion(question, ctx);

  // Persist the conversation.
  let thread = await prisma.coachThread.findFirst({
    where: { userId: u.id },
    orderBy: { updatedAt: 'desc' },
  });
  if (!thread) {
    thread = await prisma.coachThread.create({ data: { userId: u.id, title: question.slice(0, 60) } });
  }
  await prisma.coachMessage.create({ data: { threadId: thread.id, role: 'user', content: question } });
  await prisma.coachMessage.create({
    data: {
      threadId: thread.id, role: 'coach', content: answer.text,
      citations: JSON.stringify(answer.citations), grounded: answer.grounded,
    },
  });

  return NextResponse.json(answer);
}

function safeParse(s: string | null): any[] {
  if (!s) return [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
}