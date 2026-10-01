// Server-side glue: load a user's profile + history from Prisma, run the engine,
// and return dashboard-ready shapes. Pure data transformation — no React.
import { prisma } from './prisma';
import {
  healthScore as computeHealthScore,
  discoverInsights,
  forecast,
  forecastRisk,
  learnSensitivity,
  priorSensitivity,
  macrosForGrams,
  netCarbsG,
  type UserProfile,
  type MealEntry,
  type GlucosePoint,
  type SleepRecord,
  type WeightPoint,
  type Food,
} from '@mi/engine';
import { FOOD_INDEX } from '@mi/food-db';

const DAY = 86_400_000;

export function toUserProfile(u: {
  age: number | null; gender: string | null; heightCm: number | null; weightKg: number | null;
  hba1c: number | null; fastingGlucose: number | null; activityLevel: string | null;
  sleepHours: number | null; region: string | null;
}): UserProfile {
  const profile: UserProfile = {
    age: u.age ?? 40,
    gender: (u.gender as UserProfile['gender']) || 'other',
    heightCm: u.heightCm ?? 170,
    weightKg: u.weightKg ?? 70,
    activityLevel: (u.activityLevel as UserProfile['activityLevel']) || 'light',
    region: (u.region as UserProfile['region']) || 'global',
  };
  if (typeof u.hba1c === 'number' && u.hba1c > 0) profile.hba1c = u.hba1c;
  if (typeof u.fastingGlucose === 'number' && u.fastingGlucose > 0) profile.fastingGlucose = u.fastingGlucose;
  if (typeof u.sleepHours === 'number' && u.sleepHours > 0) profile.sleepHours = u.sleepHours;
  // Infer diabetic flag from conditions JSON if present.
  return profile;
}

export interface DashboardData {
  profile: UserProfile;
  sensitivity: number;
  isPrior: boolean;
  sampleSize: number;
  healthScore: ReturnType<typeof computeHealthScore>;
  dailySummary: {
    kcal: number;
    carbsG: number;
    proteinG: number;
    fatG: number;
    steps: number;
    sleepHours: number;
    glucoseReadings: { value: number; takenAt: number }[];
  };
  timeline: { t: number; label: string; type: 'meal' | 'glucose' | 'sleep' | 'activity' | 'weight'; value?: number; text?: string }[];
  glucoseSeries: { t: number; value: number }[];
  weightSeries: { t: number; kg: number }[];
  insights: ReturnType<typeof discoverInsights>;
  forecast: ReturnType<typeof forecast>;
  risks: ReturnType<typeof forecastRisk>;
}

export async function loadDashboardData(userId: string): Promise<DashboardData | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      foodEntries: { orderBy: { loggedAt: 'desc' }, take: 200 },
      glucoseReadings: { orderBy: { takenAt: 'desc' }, take: 200 },
      weightEntries: { orderBy: { takenAt: 'desc' }, take: 60 },
      sleepEntries: { orderBy: { wokeAt: 'desc' }, take: 30 },
      activityEntries: { orderBy: { at: 'desc' }, take: 60 },
      bpEntries: { orderBy: { takenAt: 'desc' }, take: 30 },
      learnedModel: true,
    },
  });
  if (!user) return null;

  const profile = toUserProfile(user);
  // Mark diabetic if conditions include diabetes.
  const conditions: string[] = safeParse(user.conditions);
  if (conditions.some((c) => c.includes('diabetes'))) profile.diabetic = true;

  // Sensitivity: prefer learned cache, else compute prior.
  let sensitivity = priorSensitivity(profile);
  let isPrior = true;
  let sampleSize = 0;
  if (user.learnedModel) {
    sensitivity = user.learnedModel.sensitivityMgDlPerGCarb;
    isPrior = user.learnedModel.isPrior;
    sampleSize = user.learnedModel.sampleSize;
  }

  // --- Daily summary (today) ---
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todaysMeals = user.foodEntries.filter((m) => m.loggedAt >= startOfToday);
  const daily = {
    kcal: sum(todaysMeals.map((m) => m.kcal)),
    carbsG: +sum(todaysMeals.map((m) => m.carbsG)).toFixed(1),
    proteinG: +sum(todaysMeals.map((m) => m.proteinG)).toFixed(1),
    fatG: +sum(todaysMeals.map((m) => m.fatG)).toFixed(1),
    steps: sum(user.activityEntries.filter((a) => a.at >= startOfToday && a.type === 'walk').map((a) => a.durationMin * 110)),
    sleepHours: user.sleepEntries[0]?.hours ?? 0,
    glucoseReadings: user.glucoseReadings
      .filter((g) => g.takenAt >= startOfToday)
      .map((g) => ({ value: g.value, takenAt: g.takenAt.getTime() }))
      .sort((a, b) => a.takenAt - b.takenAt),
  };

  // --- Health score inputs ---
  const last14 = user.glucoseReadings.slice(0, 30).map((g) => g.value);
  const avgGlucose = last14.length ? sum(last14) / last14.length : undefined;
  const lastBp = user.bpEntries[0];
  const recentSleep = user.sleepEntries.slice(0, 7).map((s) => s.hours);
  const avgSleep = recentSleep.length ? sum(recentSleep) / recentSleep.length : undefined;
  const greenFraction = daily.kcal > 0 ? 0.6 : undefined; // placeholder until scoring runs

  const hs = computeHealthScore(profile, {
    avgGlucose,
    systolicBp: lastBp?.systolic,
    diastolicBp: lastBp?.diastolic,
    avgSleepHours: avgSleep,
    avgSteps: daily.steps || undefined,
    greenMealFraction: greenFraction,
  });

  // --- Timeline (last 24h) ---
  const since = Date.now() - DAY;
  const timeline = buildTimeline(user, since);

  // --- Series for charts ---
  const glucoseSeries = user.glucoseReadings
    .map((g) => ({ t: g.takenAt.getTime(), value: g.value }))
    .filter((p) => p.t >= since - 13 * DAY)
    .sort((a, b) => a.t - b.t);
  const weightSeries = user.weightEntries
    .map((w) => ({ t: w.takenAt.getTime(), kg: w.kg }))
    .sort((a, b) => a.t - b.t);

  // --- Insights ---
  const sleep: SleepRecord[] = user.sleepEntries.map((s) => ({ hours: s.hours, wokeAt: s.wokeAt.getTime() }));
  const glucose: GlucosePoint[] = user.glucoseReadings.map((g) => ({ value: g.value, takenAt: g.takenAt.getTime() }));
  const weights: WeightPoint[] = user.weightEntries.map((w) => ({ kg: w.kg, takenAt: w.takenAt.getTime() }));
  const meals: MealEntry[] = user.foodEntries.map((m) => ({
    foodId: m.foodId, portionType: m.portionType as MealEntry['portionType'],
    portionValue: m.portionValue, grams: m.grams, loggedAt: m.loggedAt.getTime(),
  }));
  const insights = discoverInsights({ sleep, glucose, meals, weights, foodIndex: FOOD_INDEX as Record<string, Food> });

  // --- Forecast ---
  const tdeeValue = profileTdee(profile);
  const fc = forecast(profile, {
    avgKcalIntake: Math.max(daily.kcal || 0, tdeeValue * 0.9),
    avgKcalExpenditure: tdeeValue,
    avgGlucose,
    hba1c: profile.hba1c,
  }, 30);
  const risks = forecastRisk(profile, { hba1c: profile.hba1c, avgGlucose });

  return {
    profile,
    sensitivity,
    isPrior,
    sampleSize,
    healthScore: hs,
    dailySummary: daily,
    timeline,
    glucoseSeries,
    weightSeries,
    insights,
    forecast: fc,
    risks,
  };
}

function buildTimeline(user: any, since: number) {
  const events: DashboardData['timeline'] = [];
  for (const m of user.foodEntries) {
    const t = m.loggedAt.getTime();
    if (t < since) continue;
    const food = FOOD_INDEX[m.foodId];
    events.push({ t, type: 'meal', label: food?.name ?? m.foodId, text: `${Math.round(m.kcal)} kcal · ${m.carbsG}g carbs` });
  }
  for (const g of user.glucoseReadings) {
    const t = g.takenAt.getTime();
    if (t < since) continue;
    events.push({ t, type: 'glucose', label: `Glucose ${g.value} mg/dL`, value: g.value });
  }
  for (const s of user.sleepEntries.slice(0, 1)) {
    events.push({ t: s.wokeAt.getTime() - 7 * 3600_000, type: 'sleep', label: `Slept ${s.hours.toFixed(1)}h`, value: s.hours });
  }
  for (const a of user.activityEntries) {
    const t = a.at.getTime();
    if (t < since) continue;
    events.push({ t, type: 'activity', label: `${a.type} ${a.durationMin}min` });
  }
  for (const w of user.weightEntries.slice(0, 1)) {
    events.push({ t: w.takenAt.getTime(), type: 'weight', label: `${w.kg} kg`, value: w.kg });
  }
  return events.sort((a, b) => b.t - a.t);
}

function profileTdee(p: UserProfile): number {
  // Mifflin-St Jeor + activity factor.
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.gender === 'male' ? 5 : p.gender === 'female' ? -161 : -78);
  const factor = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 }[p.activityLevel];
  return Math.round(Math.max(0, bmr) * factor);
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
function safeParse(s: string | null): string[] {
  if (!s) return [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
}

// Re-export macros helpers for API routes.
export { macrosForGrams, netCarbsG };
