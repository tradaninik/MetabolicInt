import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  estimateGlucoseSpike,
  netCarbsG,
  priorSensitivity,
  type UserProfile,
} from '@mi/engine';
import { macrosForGrams } from '@/lib/engine-service';
import { afterMealLogged, updateLearnedModel, type PendingCheckIn, type LearnedModelInfo } from '@/lib/pairing';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { foodId, portionType, portionValue, photoPath, notes, loggedAt } = await req.json();

  const food = await prisma.food.findUnique({ where: { id: foodId } });
  if (!food) return NextResponse.json({ error: 'Food not found' }, { status: 404 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { learnedModel: true },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Optional actual meal time - log a meal whenever you get to it. Defaults to now.
  let loggedAtDate: Date | undefined;
  if (loggedAt != null) {
    const t = new Date(loggedAt).getTime();
    if (!Number.isFinite(t)) return NextResponse.json({ error: 'Invalid loggedAt' }, { status: 400 });
    if (t > Date.now() + 5 * 60_000) {
      return NextResponse.json({ error: 'loggedAt cannot be in the future' }, { status: 400 });
    }
    loggedAtDate = new Date(t);
  }

  // Resolve grams.
  let grams: number;
  const pv = Number(portionValue) || 1;
  if (portionType === 'grams') grams = pv;
  else if (portionType === 'katori') grams = pv * (food.katoriGrams ?? food.servingGrams);
  else grams = pv * food.servingGrams; // serving

  const macros = macrosForGrams(
    {
      kcalPer100g: food.kcalPer100g, carbsPer100g: food.carbsPer100g,
      proteinPer100g: food.proteinPer100g, fatPer100g: food.fatPer100g, fiberPer100g: food.fiberPer100g,
    } as never,
    grams,
  );

  const entry = await prisma.foodEntry.create({
    data: {
      userId: session.user.id,
      foodId,
      portionType,
      portionValue: pv,
      grams,
      kcal: macros.kcal,
      carbsG: macros.carbsG,
      proteinG: macros.proteinG,
      fatG: macros.fatG,
      photoPath: photoPath ?? null,
      notes: notes ?? null,
      ...(loggedAtDate ? { loggedAt: loggedAtDate } : {}),
    },
  });

  // Predict the spike for immediate feedback in the UI.
  const profile: UserProfile = {
    age: user.age ?? 40,
    gender: (user.gender as UserProfile['gender']) || 'other',
    heightCm: user.heightCm ?? 170,
    weightKg: user.weightKg ?? 70,
    activityLevel: (user.activityLevel as UserProfile['activityLevel']) || 'light',
    region: (user.region as UserProfile['region']) || 'global',
  };
  if (user.hba1c) profile.hba1c = user.hba1c;
  const sensitivity = user.learnedModel?.sensitivityMgDlPerGCarb ?? priorSensitivity(profile);
  const nc = netCarbsG(macros.carbsG, macros.fiberG);
  const spike = estimateGlucoseSpike({
    carbsG: nc,
    gi: food.gi,
    sensitivity,
    mealAt: loggedAtDate ? loggedAtDate.getTime() : Date.now(),
  });

  // Pairing: derive the 2-hour check-in schedule, refit if a pair just completed.
  // Best-effort - the meal itself is already saved.
  let checkIn: PendingCheckIn | null = null;
  let model: LearnedModelInfo | null = null;
  try {
    const result = await afterMealLogged(session.user.id);
    checkIn = result.checkIn;
    model = result.model;
  } catch (e) {
    console.error('pairing: meal post failed', e);
  }

  return NextResponse.json({
    entry,
    predictedSpike: spike,
    ...(checkIn ? { checkIn } : {}),
    ...(model ? { model } : {}),
  });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, portionType, portionValue } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const entry = await prisma.foodEntry.findUnique({ where: { id } });
  if (!entry || entry.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const food = await prisma.food.findUnique({ where: { id: entry.foodId } });
  if (!food) return NextResponse.json({ error: 'Food not found' }, { status: 404 });

  const pt = portionType ?? entry.portionType;
  const pv = Number(portionValue ?? entry.portionValue) || entry.portionValue;
  let grams: number;
  if (pt === 'grams') grams = pv;
  else if (pt === 'katori') grams = pv * (food.katoriGrams ?? food.servingGrams);
  else grams = pv * food.servingGrams;

  const macros = macrosForGrams(
    {
      kcalPer100g: food.kcalPer100g, carbsPer100g: food.carbsPer100g,
      proteinPer100g: food.proteinPer100g, fatPer100g: food.fatPer100g, fiberPer100g: food.fiberPer100g,
    } as never,
    grams,
  );

  const updated = await prisma.foodEntry.update({
    where: { id },
    data: {
      portionType: pt, portionValue: pv, grams,
      kcal: macros.kcal, carbsG: macros.carbsG, proteinG: macros.proteinG, fatG: macros.fatG,
    },
  });

  // History changed - refit the learned model (best-effort).
  try {
    await updateLearnedModel(session.user.id);
  } catch (e) {
    console.error('pairing: refit after edit failed', e);
  }
  return NextResponse.json({ entry: updated });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const entry = await prisma.foodEntry.findUnique({ where: { id } });
  if (!entry || entry.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  await prisma.foodEntry.delete({ where: { id } });

  // History changed - refit the learned model (best-effort).
  try {
    await updateLearnedModel(session.user.id);
  } catch (e) {
    console.error('pairing: refit after delete failed', e);
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const entries = await prisma.foodEntry.findMany({
    where: { userId: session.user.id },
    orderBy: { loggedAt: 'desc' },
    take: 50,
    include: { food: true },
  });
  return NextResponse.json({ entries });
}