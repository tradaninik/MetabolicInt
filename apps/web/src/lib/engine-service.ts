// Server-side glue: load a user's profile + history from Prisma, run the engine,
// and return dashboard-ready shapes. Pure data transformation - no React.
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
  attributeDeviation,
  type AttributionResult,
  mealSlotForHour,
  medsToday,
  sleepContext,
  stepsContext,
  stepsFromActivity,
  timeInRange,
  usualDailyCurve,
  usualPatternAt,
  deviationFromUsual,
  weightContext,
  DEVIATION_ALERT_MGDL,
  MIN_PATTERN_N,
  type TimeInRange,
  type SleepContext,
  type StepsContext,
  type WeightContext,
  type MedsToday,
  type UserProfile,
  type MealEntry,
  type GlucosePoint,
  type SleepRecord,
  type WeightPoint,
  type Food,
} from '@mi/engine';
import { mergedFoodIndex } from './food-index';
import { latestUpdate, type UpdateCandidate, type UpdateStamp } from './dashboard-stamp';
import { istDayBounds, istHour, istSlotEpoch } from './dashboard-stamp';
import { DAY_TAG_LABELS, istNow, type DayContextTagValue } from './clinical-db';

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
  return profile;
}

/** Glucose metric card (revamp item 2): latest reading vs the user's usual. */
export interface GlucoseCard {
  latest: { value: number; takenAt: number; source: string } | null;
  /** the user's own median at this hour-of-day over trailing 14 days */
  usual: { median: number | null; n: number; spread: number | null };
  /** latest minus usual median (mg/dL); null when no pattern yet */
  deviation: number | null;
  /** |deviation| >= DEVIATION_ALERT_MGDL with enough same-hour history */
  alert: boolean;
  /** "2 h after lunch" context for the reading, when a meal preceded it today */
  afterMeal: { hours: number; slot: string; mealName: string } | null;
}

/** Everything the six metric cards (revamp item 2) need. */
export interface MetricCards {
  glucose: GlucoseCard;
  timeInRange: TimeInRange;
  steps: StepsContext & { latestSource: string | null; latestAt: number | null };
  sleep: SleepContext;
  weight: WeightContext;
  meds: MedsToday;
}

/** Chart event marker (revamp item 3): meals, doses, activity, context tags. */
export interface ChartEvent {
  t: number;
  kind: 'meal' | 'dose' | 'activity' | 'context';
  label: string;
  detail?: string;
  /** planned = scheduled but not yet done (dashed marker; no claim made) */
  planned: boolean;
}

/** Today view: IST-day readings + events + dashed model forecast. */
export interface GlucoseChartToday {
  dayStart: number;
  dayEnd: number;
  readings: { t: number; value: number; dev: number | null; usualN: number }[];
  events: ChartEvent[];
  /** usual-pattern forecast from the last reading to end of day; band = uncertainty */
  forecast: { t: number; value: number | null; band: [number, number] | null }[];
  /** the reading the page is explaining (latest), for the highlight ring */
  focusT: number | null;
}

export interface GlucoseChartData {
  today: GlucoseChartToday;
  week: { t: number; value: number }[];
  fortnight: { t: number; value: number }[];
}

export interface DashboardData {
  profile: UserProfile;
  sensitivity: number;
  isPrior: boolean;
  sampleSize: number;
  /** most recent of the user's own records - powers the header stamp (revamp item 1) */
  updatedStamp: UpdateStamp | null;
  /** six metric cards (revamp item 2) */
  metricCards: MetricCards;
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
  /** glucose chart data (revamp item 3): today + events + forecast, week, 14d */
  glucoseChart: GlucoseChartData;
  /** "Why was it high?" attribution (revamp item 4) */
  attribution: AttributionResult;
  weightSeries: { t: number; kg: number }[];
  insights: ReturnType<typeof discoverInsights>;
  forecast: ReturnType<typeof forecast>;
  risks: ReturnType<typeof forecastRisk>;
}

export async function loadDashboardData(userId: string): Promise<DashboardData | null> {
  // S-1 perf: the user row (with relations) and the merged food index are
  // independent queries - run them concurrently instead of paying a full
  // server<->DB round trip between them. Column lists are explicit (lean
  // selects) so 200-meal histories don't drag every column over the wire.
  const [user, foodIndex] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        foodEntries: {
          orderBy: { loggedAt: 'desc' },
          take: 200,
          select: {
            id: true, foodId: true, portionType: true, portionValue: true, grams: true,
            kcal: true, carbsG: true, proteinG: true, fatG: true, loggedAt: true,
          },
        },
        glucoseReadings: {
          orderBy: { takenAt: 'desc' },
          take: 200,
          select: { value: true, takenAt: true, source: true },
        },
        weightEntries: {
          orderBy: { takenAt: 'desc' },
          take: 60,
          select: { kg: true, takenAt: true },
        },
        sleepEntries: {
          orderBy: { wokeAt: 'desc' },
          take: 30,
          select: { hours: true, wokeAt: true },
        },
        activityEntries: {
          orderBy: { at: 'desc' },
          take: 60,
          select: { type: true, durationMin: true, at: true, source: true },
        },
        bpEntries: {
          orderBy: { takenAt: 'desc' },
          take: 30,
          select: { systolic: true, diastolic: true, takenAt: true },
        },
        learnedModel: {
          select: { sensitivityMgDlPerGCarb: true, isPrior: true, sampleSize: true },
        },
        // Dashboard revamp item 2: the dashboard previously ignored these
        // streams. Meds -> "X / Y taken" card (+ planned slots for the chart
        // markers in item 3); day tags -> stress/context events (items 3-4).
        meds: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            scheduleTimes: true,
            logs: {
              where: { logDate: istNow().slice(0, 10) },
              select: { slotTime: true, logDate: true, status: true, createdAt: true },
            },
          },
        },
        dayTags: {
          orderBy: { createdAt: 'desc' },
          take: 14,
          select: { tagDate: true, tag: true, note: true, createdAt: true },
        },
      },
    }),
    mergedFoodIndex(userId),
  ]);
  if (!user) return null;

  const profile = toUserProfile(user);
  const conditions: string[] = safeParse(user.conditions);
  if (conditions.some((c) => c.includes('diabetes'))) profile.diabetic = true;

  let sensitivity = priorSensitivity(profile);
  let isPrior = true;
  let sampleSize = 0;
  if (user.learnedModel) {
    sensitivity = user.learnedModel.sensitivityMgDlPerGCarb;
    isPrior = user.learnedModel.isPrior;
    sampleSize = user.learnedModel.sampleSize;
  }

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

  const since = Date.now() - DAY;
  const timeline = buildTimeline(user, since, foodIndex);
  // --- Dashboard revamp item 2: six metric cards --------------------------
  // Every "usual" below is the user's OWN history (patterns.ts), never a
  // population reference, and every card carries its evidence count. The
  // IST calendar day (audience timezone, same convention as /api/meds/log)
  // is the single "today" used by the cards, the chart and the attribution.
  const readingsAll = user.glucoseReadings.map((g) => ({ value: g.value, takenAt: g.takenAt.getTime() }));
  const latestG = user.glucoseReadings[0];
  const nowMs = Date.now();
  const istDay = istDayBounds(nowMs);
  const usual = latestG
    ? usualPatternAt(readingsAll, latestG.takenAt.getTime(), { now: nowMs })
    : { median: null, n: 0, spread: null, windowHours: 1, days: 14 };
  const deviation = latestG ? deviationFromUsual(latestG.value, usual) : null;
  const alert =
    deviation !== null && usual.n >= MIN_PATTERN_N && Math.abs(deviation) >= DEVIATION_ALERT_MGDL;

  // "2 h after lunch": the most recent meal logged today before the reading.
  let afterMeal: MetricCards['glucose']['afterMeal'] = null;
  if (latestG) {
    const priorMeals = user.foodEntries
      .filter((m) => m.loggedAt.getTime() < latestG.takenAt.getTime() && m.loggedAt.getTime() >= istDay.start)
      .sort((a, b) => b.loggedAt.getTime() - a.loggedAt.getTime());
    const m = priorMeals[0];
    if (m) {
      const hours = (latestG.takenAt.getTime() - m.loggedAt.getTime()) / 3_600_000;
      afterMeal = {
        hours: Math.round(hours * 10) / 10,
        slot: mealSlotForHour(istHour(m.loggedAt.getTime())),
        mealName: foodIndex[m.foodId]?.name ?? m.foodId,
      };
    }
  }

  const stepsToday = sum(
    user.activityEntries
      .filter((a) => a.at >= startOfToday && a.type === 'walk')
      .map((a) => stepsFromActivity(a.type, a.durationMin)),
  );
  // Per-day step totals for the 7-day sparkline (server-local days, matching
  // the dailySummary convention already on this page).
  const daySteps: { dayStart: number; steps: number }[] = [];
  for (let d = 7; d >= 0; d--) {
    const ds = new Date(startOfToday.getTime() - d * DAY);
    const next = new Date(ds.getTime() + DAY);
    const steps = sum(
      user.activityEntries
        .filter((a) => a.type === 'walk' && a.at >= ds && a.at < next)
        .map((a) => stepsFromActivity(a.type, a.durationMin)),
    );
    daySteps.push({ dayStart: ds.getTime(), steps });
  }
  const latestActivity = user.activityEntries[0];

  const metricCards: MetricCards = {
    glucose: latestG
      ? {
          latest: { value: latestG.value, takenAt: latestG.takenAt.getTime(), source: latestG.source },
          usual: { median: usual.median, n: usual.n, spread: usual.spread },
          deviation,
          alert,
          afterMeal,
        }
      : { latest: null, usual: { median: null, n: 0, spread: null }, deviation: null, alert: false, afterMeal: null },
    timeInRange: timeInRange(readingsAll, nowMs),
    steps: {
      ...stepsContext(stepsToday, daySteps, startOfToday.getTime()),
      latestSource: latestActivity?.source ?? null,
      latestAt: latestActivity?.at.getTime() ?? null,
    },
    sleep: sleepContext(user.sleepEntries.map((s) => ({ hours: s.hours, wokeAt: s.wokeAt.getTime() }))),
    weight: weightContext(user.weightEntries.map((w) => ({ kg: w.kg, takenAt: w.takenAt.getTime() })), nowMs),
    meds: medsToday(
      user.meds.map((m) => ({ id: m.id, name: m.name, scheduleTimes: m.scheduleTimes, isActive: true })),
      user.meds.flatMap((m) =>
        m.logs.map((l) => ({
          medicationId: m.id,
          slotTime: l.slotTime,
          logDate: l.logDate,
          status: l.status,
          createdAt: l.createdAt.getTime(),
        })),
      ),
      istNow().slice(0, 10),
    ),
  };

  // --- Dashboard revamp item 3: glucose chart (today + events + forecast) --
  // The Today view is anchored to the IST calendar day (the app's audience
  // timezone and the same convention /api/meds/log uses for slot times).
  const todayReadings = readingsAll
    .filter((r) => r.takenAt >= istDay.start && r.takenAt < istDay.end)
    .map((r) => {
      const u = usualPatternAt(readingsAll, r.takenAt, { now: nowMs });
      return { t: r.takenAt, value: r.value, dev: deviationFromUsual(r.value, u), usualN: u.n };
    })
    .sort((a, b) => a.t - b.t);

  const chartEvents: ChartEvent[] = [];
  for (const m of user.foodEntries) {
    const t = m.loggedAt.getTime();
    if (t < istDay.start || t >= istDay.end) continue;
    chartEvents.push({
      t,
      kind: 'meal',
      label: foodIndex[m.foodId]?.name ?? m.foodId,
      detail: `${Math.round(m.carbsG)} g carbs`,
      planned: false, // planned meals arrive with the Phase C planner
    });
  }
  for (const slot of metricCards.meds.slots) {
    chartEvents.push({
      t: istSlotEpoch(istDay.dateStr, slot.slotTime),
      kind: 'dose',
      label: slot.name,
      detail: slot.status === 'taken' ? 'taken' : slot.status,
      planned: slot.status === 'planned',
    });
  }
  for (const a of user.activityEntries) {
    const t = a.at.getTime();
    if (t < istDay.start || t >= istDay.end) continue;
    chartEvents.push({ t, kind: 'activity', label: `${a.type} ${Math.round(a.durationMin)} min`, planned: false });
  }
  for (const tag of user.dayTags) {
    if (tag.tagDate !== istDay.dateStr) continue;
    chartEvents.push({
      t: tag.createdAt.getTime(),
      kind: 'context',
      label: DAY_TAG_LABELS[tag.tag as DayContextTagValue] ?? tag.tag,
      detail: tag.note ?? undefined,
      planned: false,
    });
  }
  chartEvents.sort((a, b) => a.t - b.t);

  // Dashed forecast: the user's usual hour-by-hour pattern (excluding today)
  // from the last reading to the end of the IST day, with an uncertainty band.
  const lastReadingToday = todayReadings.at(-1);
  const glucoseForecast: GlucoseChartToday['forecast'] = [];
  if (lastReadingToday) {
    glucoseForecast.push({ t: lastReadingToday.t, value: lastReadingToday.value, band: null });
    const hourMarks: number[] = [];
    for (
      let h = Math.ceil((lastReadingToday.t + 15 * 60_000) / 3_600_000) * 3_600_000;
      h < istDay.end;
      h += 3_600_000
    ) {
      hourMarks.push(h);
    }
    if (hourMarks.length) {
      for (const p of usualDailyCurve(readingsAll, hourMarks, { now: nowMs })) {
        if (p.value === null || p.low === null || p.high === null) continue;
        glucoseForecast.push({ t: p.at, value: p.value, band: [p.low, p.high] });
      }
    }
  }

  const glucoseChart: GlucoseChartData = {
    today: {
      dayStart: istDay.start,
      dayEnd: istDay.end,
      readings: todayReadings,
      events: chartEvents,
      forecast: glucoseForecast,
      focusT: metricCards.glucose.latest?.takenAt ?? null,
    },
    week: readingsAll.filter((r) => r.takenAt >= nowMs - 7 * DAY).map((r) => ({ t: r.takenAt, value: r.value })),
    fortnight: readingsAll.filter((r) => r.takenAt >= nowMs - 14 * DAY).map((r) => ({ t: r.takenAt, value: r.value })),
  };

  // --- Dashboard revamp item 4: "Why was it high?" -------------------------
  // Pure engine call (attribution.ts): candidate factors around the latest
  // reading, each labelled observed pattern / possible contributor /
  // insufficient data. Association only - the engine never claims causation.
  const latestGl = metricCards.glucose.latest;
  const mealsBeforeReading: { takenAt: number; carbsG: number; name: string }[] = [];
  let comparableMealCarbs: number[] = [];
  if (latestGl) {
    const todaysMealsBefore = user.foodEntries
      .filter((m) => m.loggedAt.getTime() < latestGl.takenAt && m.loggedAt.getTime() >= istDay.start)
      .sort((a, b) => a.loggedAt.getTime() - b.loggedAt.getTime());
    for (const m of todaysMealsBefore) {
      mealsBeforeReading.push({
        takenAt: m.loggedAt.getTime(),
        carbsG: m.carbsG,
        name: foodIndex[m.foodId]?.name ?? m.foodId,
      });
    }
    const lastMeal = todaysMealsBefore.at(-1);
    if (lastMeal) {
      const slot = mealSlotForHour(istHour(lastMeal.loggedAt.getTime()));
      comparableMealCarbs = user.foodEntries
        .filter((m) => {
          const t = m.loggedAt.getTime();
          return t < istDay.start && t >= nowMs - 30 * DAY && mealSlotForHour(istHour(t)) === slot;
        })
        .map((m) => m.carbsG);
    }
  }
  const medSlotsBeforeReading = latestGl
    ? metricCards.meds.slots
        .filter((s) => istSlotEpoch(istDay.dateStr, s.slotTime) < latestGl.takenAt)
        .map((s) => ({ name: s.name, slotTime: s.slotTime, status: s.status }))
    : [];
  const attribution = latestGl
    ? attributeDeviation({
        reading: { value: latestGl.value, takenAt: latestGl.takenAt },
        usual: { median: metricCards.glucose.usual.median, n: metricCards.glucose.usual.n },
        deviation: metricCards.glucose.deviation,
        mealsBefore: mealsBeforeReading,
        comparableMealCarbs,
        medSlotsBefore: medSlotsBeforeReading,
        steps: { today: metricCards.steps.today, usualAvg: metricCards.steps.usualAvg },
        sleep: { lastNight: metricCards.sleep.lastHours, usualAvg: metricCards.sleep.usualAvg },
        contextNotes: user.dayTags
          .filter((t) => t.tagDate === istDay.dateStr)
          .map((t) => ({ tag: t.tag, note: t.note ?? undefined })),
      })
    : { triggered: false, rows: [], totalEvidence: 0 };
  const weightSeries = user.weightEntries
    .map((w) => ({ t: w.takenAt.getTime(), kg: w.kg }))
    .sort((a, b) => a.t - b.t);

  const sleep: SleepRecord[] = user.sleepEntries.map((s) => ({ hours: s.hours, wokeAt: s.wokeAt.getTime() }));
  const glucose: GlucosePoint[] = user.glucoseReadings.map((g) => ({ value: g.value, takenAt: g.takenAt.getTime() }));
  const weights: WeightPoint[] = user.weightEntries.map((w) => ({ kg: w.kg, takenAt: w.takenAt.getTime() }));
  const meals: MealEntry[] = user.foodEntries.map((m) => ({
    foodId: m.foodId, portionType: m.portionType as MealEntry['portionType'],
    portionValue: m.portionValue, grams: m.grams, loggedAt: m.loggedAt.getTime(),
  }));
  const insights = discoverInsights({ sleep, glucose, meals, weights, foodIndex });

  // Dashboard revamp item 1: header "Updated <time> · <source>" stamp. The most
  // recent of the user's own records across every stream the dashboard reads -
  // honest provenance, recomputed on every render (no fake liveness). All the
  // relations above are ordered desc, so index 0 is the latest of each stream.
  const stampCandidates: UpdateCandidate[] = [
    ...user.glucoseReadings.slice(0, 1).map((g) => ({ t: g.takenAt.getTime(), kind: 'glucose' as const, source: g.source })),
    ...user.foodEntries.slice(0, 1).map((m) => ({ t: m.loggedAt.getTime(), kind: 'meal' as const })),
    ...user.activityEntries.slice(0, 1).map((a) => ({ t: a.at.getTime(), kind: 'activity' as const })),
    ...user.sleepEntries.slice(0, 1).map((s) => ({ t: s.wokeAt.getTime(), kind: 'sleep' as const })),
    ...user.weightEntries.slice(0, 1).map((w) => ({ t: w.takenAt.getTime(), kind: 'weight' as const })),
    ...user.bpEntries.slice(0, 1).map((b) => ({ t: b.takenAt.getTime(), kind: 'bp' as const })),
  ];
  const updatedStamp = latestUpdate(stampCandidates);

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
    updatedStamp,
    metricCards,
    healthScore: hs,
    dailySummary: daily,
    timeline,
    glucoseChart,
    attribution,
    weightSeries,
    insights,
    forecast: fc,
    risks,
  };
}

function buildTimeline(user: any, since: number, foodIndex: Record<string, Food>) {
  const events: DashboardData['timeline'] = [];
  for (const m of user.foodEntries) {
    const t = m.loggedAt.getTime();
    if (t < since) continue;
    const food = foodIndex[m.foodId];
    events.push({ t, type: 'meal', label: food?.name ?? m.foodId, text: `${Math.round(m.kcal)} kcal - ${m.carbsG}g carbs` });
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