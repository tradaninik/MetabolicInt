import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { priorSensitivity } from '@mi/engine';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { learnedModel: true },
  });
  if (!u) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const conditions: string[] = u.conditions ? safeParse(u.conditions) : [];
  const diabetic = conditions.some((c) => c.includes('diabetes'));
  const profile = {
    age: u.age, gender: u.gender, heightCm: u.heightCm, weightKg: u.weightKg,
    hba1c: u.hba1c, activityLevel: u.activityLevel, region: u.region, diabetic,
  };
  const sensitivity = u.learnedModel?.sensitivityMgDlPerGCarb ?? priorSensitivity(profile as never);
  return NextResponse.json({
    region: u.region,
    diabetic,
    sensitivity,
    onboardingComplete: u.onboardingComplete,
    isPrior: u.learnedModel ? u.learnedModel.isPrior : true,
    sampleSize: u.learnedModel ? u.learnedModel.sampleSize : 0,
    goals: safeParse(u.goals),
  });
}

function safeParse(s: string | null): any[] {
  if (!s) return [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
}
