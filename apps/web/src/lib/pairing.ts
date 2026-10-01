// App-side meal/glucose pairing + learned-model updates.
//
// ALL math lives in @mi/engine (learnSensitivity) - this module only assembles
// history into MealGlucosePair[] and persists what the engine returns. The engine
// package is never modified.
//
// Derivation rules (no schema changes):
//  - FoodEntries within 45 min of each other form one meal (chained grouping).
//  - A meal trains the model when it has a pre-meal reading (up to 90 min before
//    the meal start) and a post-meal reading 90-240 min after the meal start.
//    observedDelta = post - pre. This matches the 2-hour check-in the UI prompts
//    for; the 4h tail tolerates late logging.
//  - activityAfterMin = activity minutes in the first 120 min after the meal
//    (the engine strips the expected activity effect before fitting).
//  - Late dinner: if the check-in window ends during sleep hours (23:00-07:00
//    IST) the prompt rolls to the next morning. A reading logged the next
//    morning still counts for trends, but only trains the model when its actual
//    time falls inside the pairing window (later readings are post-absorptive
//    and would bias the fit).
//
// Educational application - not medical advice.

import { prisma } from './prisma';
import { toUserProfile } from './engine-service';
import {
  learnSensitivity,
  netCarbsG,
  MIN_PAIRS_FOR_PERSONAL,
  type LearnedModel,
  type MealEntry,
  type MealGlucosePair,
  type UserProfile,
} from '@mi/engine';

/** Entries closer than this (ms) are treated as one meal. */
export const MEAL_GROUP_GAP_MS = 45 * 60_000;
/** How far before a meal a reading still counts as the pre-meal baseline. */
export const PRE_WINDOW_MS = 90 * 60_000;
/** Pairing window after the meal start (2h +/- late-logging tolerance). */
export const POST_WINDOW_FROM_MS = 90 * 60_000;
export const POST_WINDOW_TO_MS = 240 * 60_000;
/** Activity minutes counted toward a pair (engine convention: 2h after meal). */
export const ACTIVITY_AFTER_MS = 120 * 60_000;
/** Sleep hours in IST - late-dinner check-ins roll to the next morning. */
export const SLEEP_START_HOUR_IST = 23;
export const SLEEP_END_HOUR_IST = 7;
/** Carb floor for a meal to warrant a 2-hour check-in prompt. */
export const CHECKIN_MIN_NET_CARB_G = 15;
/** Mirrors the engine's shrink target (glucose.ts: fully personal at ~20 pairs). */
export const FULL_PERSONAL_PAIRS = 20;
/** History lookback for refits. */
const LOOKBACK_MS = 60 * 86_400_000;
/** Lookback for pending check-in prompts (covers a late dinner into next morning). */
const PENDING_LOOKBACK_MS = 36 * 3_600_000;

const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 5.5 * 3_600_000;

export type MealType = 'breakfast' | 'lunch' | 'tiffin' | 'dinner' | 'snack';

export interface PairingFoodRow {
  foodId: string;
  grams: number;
  carbsG: number;
  loggedAt: Date;
  food: { name: string; gi: number; fiberPer100g: number } | null;
}
export interface PairingReadingRow {
  value: number;
  takenAt: Date;
}
export interface PairingActivityRow {
  durationMin: number;
  at: Date;
}

export interface MealGroup {
  key: string;
  startedAt: number;
  endedAt: number;
  totalGrams: number;
  netCarbsG: number;
  gi: number;
  labels: string[];
  label: string;
  dominantFoodId: string;
  mealType: MealType;
}

export interface PendingCheckIn {
  key: string;
  label: string;
  mealType: MealType;
  startedAt: number;
  netCarbsG: number;
  dueAt: number;
  windowEndAt: number;
  state: 'upcoming' | 'active' | 'morning';
  morningAfter: boolean;
}

export interface LearnedModelInfo extends LearnedModel {
  pairsConsidered: number;
  mealsConsidered: number;
}

/** Local hour-of-day in IST (0-24) for an epoch-ms timestamp. */
export function istHourOf(t: number): number {
  return (((t + IST_OFFSET_MS) / 3_600_000) % 24 + 24) % 24;
}

/** Next occurrence of an IST clock hour strictly after `after`. */
function nextIstHour(after: number, targetHour: number): number {
  const shifted = after + IST_OFFSET_MS;
  let candidate = Math.floor(shifted / DAY_MS) * DAY_MS + targetHour * 3_600_000 - IST_OFFSET_MS;
  while (candidate <= after) candidate += DAY_MS;
  return candidate;
}

/** Heuristic meal classification: time-of-day (IST) + carb load. */
export function classifyMealType(startedAt: number, netCarbsG: number): MealType {
  if (netCarbsG < CHECKIN_MIN_NET_CARB_G) return 'snack';
  const h = istHourOf(startedAt);
  if (h >= 5 && h < 11) return 'breakfast';
  if (h >= 11 && h < 15.5) return 'lunch';
  if (h >= 15.5 && h < 18.5) return 'tiffin';
  if (h >= 18.5 && h < 24) return 'dinner';
  return 'snack'; // late-night / pre-dawn
}

/** Group food entries into meals: entries within 45 min of the previous entry chain together. */
export function groupMeals(entries: PairingFoodRow[]): MealGroup[] {
  const sorted = [...entries].sort((a, b) => a.loggedAt.getTime() - b.loggedAt.getTime());
  const raw: PairingFoodRow[][] = [];
  for (const e of sorted) {
    const prev = raw.length > 0 ? raw[raw.length - 1][raw[raw.length - 1].length - 1] : null;
    if (prev && e.loggedAt.getTime() - prev.loggedAt.getTime() <= MEAL_GROUP_GAP_MS) {
      raw[raw.length - 1].push(e);
    } else {
      raw.push([e]);
    }
  }
  return raw.map(toMealGroup);
}

function toMealGroup(rows: PairingFoodRow[]): MealGroup {
  const startedAt = rows[0].loggedAt.getTime();
  const endedAt = rows[rows.length - 1].loggedAt.getTime();
  let netCarbs = 0;
  let grams = 0;
  let giWeighted = 0;
  let giWeight = 0;
  let dominantFoodId = rows[0].foodId;
  let dominantCarbs = -1;
  const labels: string[] = [];
  for (const r of rows) {
    const fiberG = r.food ? (r.food.fiberPer100g * r.grams) / 100 : 0;
    const nc = r.food ? netCarbsG(r.carbsG, fiberG) : Math.max(0, r.carbsG);
    netCarbs += nc;
    grams += r.grams;
    if (r.food) {
      giWeighted += r.food.gi * Math.max(nc, 1);
      giWeight += Math.max(nc, 1);
      if (!labels.includes(r.food.name)) labels.push(r.food.name);
    }
    if (nc > dominantCarbs) {
      dominantCarbs = nc;
      dominantFoodId = r.foodId;
    }
  }
  const gi = giWeight > 0 ? giWeighted / giWeight : 0;
  const shown = labels.slice(0, 3);
  const label = labels.length > 3 ? shown.join(' + ') + ' +...' : shown.join(' + ');
  return {
    key: String(startedAt),
    startedAt,
    endedAt,
    totalGrams: grams,
    netCarbsG: +netCarbs.toFixed(1),
    gi: +gi.toFixed(1),
    labels,
    label: label || 'meal',
    dominantFoodId,
    mealType: classifyMealType(startedAt, netCarbs),
  };
}

/** Latest reading with takenAt in [from, to]. */
function lastBefore(readings: PairingReadingRow[], from: number, to: number): PairingReadingRow | null {
  let best: PairingReadingRow | null = null;
  for (const r of readings) {
    const t = r.takenAt.getTime();
    if (t >= from && t <= to && (!best || t > best.takenAt.getTime())) best = r;
  }
  return best;
}

/** Earliest reading with takenAt in [from, to]. */
function firstAfter(readings: PairingReadingRow[], from: number, to: number): PairingReadingRow | null {
  let best: PairingReadingRow | null = null;
  for (const r of readings) {
    const t = r.takenAt.getTime();
    if (t >= from && t <= to && (!best || t < best.takenAt.getTime())) best = r;
  }
  return best;
}

function hasReadingIn(readings: PairingReadingRow[], from: number, to: number): boolean {
  return readings.some((r) => {
    const t = r.takenAt.getTime();
    return t >= from && t <= to;
  });
}

/**
 * Derive (meal, glucose) training pairs from history. Pure function - the same
 * rows always produce the same pairs.
 */
export function derivePairs(
  groups: MealGroup[],
  readings: PairingReadingRow[],
  activities: PairingActivityRow[],
): MealGlucosePair[] {
  const pairs: MealGlucosePair[] = [];
  for (const g of groups) {
    if (g.netCarbsG <= 1 || g.gi <= 0) continue; // uninformative for the fit
    const pre = lastBefore(readings, g.startedAt - PRE_WINDOW_MS, g.startedAt);
    const post = firstAfter(readings, g.startedAt + POST_WINDOW_FROM_MS, g.startedAt + POST_WINDOW_TO_MS);
    if (!pre || !post) continue;
    const activityAfterMin = activities
      .filter((a) => {
        const t = a.at.getTime();
        return t >= g.startedAt && t <= g.startedAt + ACTIVITY_AFTER_MS;
      })
      .reduce((sum, a) => sum + a.durationMin, 0);
    const meal: MealEntry = {
      foodId: g.dominantFoodId,
      portionType: 'grams',
      portionValue: g.totalGrams,
      grams: g.totalGrams,
      loggedAt: g.startedAt,
    };
    pairs.push({
      meal,
      carbsG: g.netCarbsG,
      gi: g.gi,
      observedDelta: post.value - pre.value,
      activityAfterMin,
    });
  }
  return pairs;
}

/**
 * Meals in the check-in window that still lack a paired reading.
 * state: 'upcoming' (before window), 'active' (in window now),
 * 'morning' (late dinner rolled to the next morning, 07:00-12:00 IST).
 * Paired or expired meals are omitted.
 */
export function buildPendingCheckIns(
  groups: MealGroup[],
  readings: PairingReadingRow[],
  now: number,
): PendingCheckIn[] {
  const out: PendingCheckIn[] = [];
  for (const g of groups) {
    if (g.netCarbsG < CHECKIN_MIN_NET_CARB_G) continue;
    if (hasReadingIn(readings, g.startedAt + POST_WINDOW_FROM_MS, g.startedAt + POST_WINDOW_TO_MS)) continue;
    const windowEnd = g.startedAt + POST_WINDOW_TO_MS;
    const endHour = istHourOf(windowEnd);
    const morningAfter = endHour >= SLEEP_START_HOUR_IST || endHour < SLEEP_END_HOUR_IST;
    let state: PendingCheckIn['state'] | null = null;
    if (now < g.startedAt + POST_WINDOW_FROM_MS) {
      state = 'upcoming';
    } else if (!morningAfter && now <= windowEnd) {
      state = 'active';
    } else if (morningAfter) {
      const morningFrom = nextIstHour(windowEnd, SLEEP_END_HOUR_IST);
      if (now >= morningFrom && now <= morningFrom + 5 * 3_600_000) state = 'morning';
    }
    if (!state) continue; // paired or expired
    out.push({
      key: g.key,
      label: g.label,
      mealType: g.mealType,
      startedAt: g.startedAt,
      netCarbsG: g.netCarbsG,
      dueAt: g.startedAt + 120 * 60_000,
      windowEndAt: windowEnd,
      state,
      morningAfter,
    });
  }
  return out;
}

function parseConditions(s: string | null): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

async function loadHistory(userId: string) {
  const since = new Date(Date.now() - LOOKBACK_MS);
  const [entries, readings, activities] = await Promise.all([
    prisma.foodEntry.findMany({
      where: { userId, loggedAt: { gte: since } },
      include: { food: { select: { name: true, gi: true, fiberPer100g: true } } },
      orderBy: { loggedAt: 'asc' },
    }),
    prisma.glucoseReading.findMany({ where: { userId, takenAt: { gte: since } }, orderBy: { takenAt: 'asc' } }),
    prisma.activityEntry.findMany({ where: { userId, at: { gte: since } }, orderBy: { at: 'asc' } }),
  ]);
  return { groups: groupMeals(entries), readings, activities };
}

/**
 * Refit the user's learned model from their full recent history and persist it.
 * The engine does all the math (learnSensitivity) - this only feeds it pairs.
 */
export async function updateLearnedModel(userId: string): Promise<LearnedModelInfo | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      age: true, gender: true, heightCm: true, weightKg: true, hba1c: true,
      fastingGlucose: true, activityLevel: true, sleepHours: true, region: true, conditions: true,
    },
  });
  if (!user) return null;

  const { groups, readings, activities } = await loadHistory(userId);
  const pairs = derivePairs(groups, readings, activities);

  const profile: UserProfile = toUserProfile(user);
  if (parseConditions(user.conditions).some((c) => c.toLowerCase().includes('diabetes'))) {
    profile.diabetic = true;
  }

  const model = learnSensitivity(pairs, profile);
  await prisma.userLearnedModel.upsert({
    where: { userId },
    create: {
      userId,
      sensitivityMgDlPerGCarb: model.sensitivityMgDlPerGCarb,
      sampleSize: model.sampleSize,
      isPrior: model.isPrior,
    },
    update: {
      sensitivityMgDlPerGCarb: model.sensitivityMgDlPerGCarb,
      sampleSize: model.sampleSize,
      isPrior: model.isPrior,
    },
  });
  return { ...model, pairsConsidered: pairs.length, mealsConsidered: groups.length };
}

/** Pending 2-hour check-ins for prompts (dashboard / glucose surfaces). */
export async function getPendingCheckIns(userId: string): Promise<PendingCheckIn[]> {
  const since = new Date(Date.now() - PENDING_LOOKBACK_MS);
  const [entries, readings] = await Promise.all([
    prisma.foodEntry.findMany({
      where: { userId, loggedAt: { gte: since } },
      include: { food: { select: { name: true, gi: true, fiberPer100g: true } } },
      orderBy: { loggedAt: 'asc' },
    }),
    prisma.glucoseReading.findMany({ where: { userId, takenAt: { gte: since } }, orderBy: { takenAt: 'asc' } }),
  ]);
  return buildPendingCheckIns(groupMeals(entries), readings, Date.now());
}

/**
 * Which meal (if any) a just-logged reading completed a pair with.
 * Returns null unless the reading time falls in a meal's pairing window AND
 * that meal has a pre-meal baseline reading.
 */
export async function findPairedMealForReading(
  userId: string,
  takenAtMs: number,
): Promise<{ key: string; label: string; mealType: MealType; startedAt: number } | null> {
  const since = new Date(takenAtMs - 8 * 3_600_000);
  const [entries, readings] = await Promise.all([
    prisma.foodEntry.findMany({
      where: { userId, loggedAt: { gte: since } },
      include: { food: { select: { name: true, gi: true, fiberPer100g: true } } },
      orderBy: { loggedAt: 'asc' },
    }),
    prisma.glucoseReading.findMany({ where: { userId, takenAt: { gte: since } }, orderBy: { takenAt: 'asc' } }),
  ]);
  for (const g of groupMeals(entries)) {
    if (g.netCarbsG <= 1 || g.gi <= 0) continue;
    if (takenAtMs < g.startedAt + POST_WINDOW_FROM_MS || takenAtMs > g.startedAt + POST_WINDOW_TO_MS) continue;
    if (!lastBefore(readings, g.startedAt - PRE_WINDOW_MS, g.startedAt)) continue;
    return { key: g.key, label: g.label, mealType: g.mealType, startedAt: g.startedAt };
  }
  return null;
}

/**
 * Called right after a meal is logged: derives the check-in schedule for that
 * meal, and refits the model if the (retro-logged) meal just completed a pair.
 */
export async function afterMealLogged(
  userId: string,
): Promise<{ checkIn: PendingCheckIn | null; model: LearnedModelInfo | null }> {
  const since = new Date(Date.now() - PENDING_LOOKBACK_MS);
  const [entries, readings] = await Promise.all([
    prisma.foodEntry.findMany({
      where: { userId, loggedAt: { gte: since } },
      include: { food: { select: { name: true, gi: true, fiberPer100g: true } } },
      orderBy: { loggedAt: 'asc' },
    }),
    prisma.glucoseReading.findMany({ where: { userId, takenAt: { gte: since } }, orderBy: { takenAt: 'asc' } }),
  ]);
  const groups = groupMeals(entries);
  const latest = groups.length > 0 ? groups[groups.length - 1] : null;
  if (!latest) return { checkIn: null, model: null };
  const pending = buildPendingCheckIns([latest], readings, Date.now());
  const checkIn = pending.length > 0 ? pending[0] : null;
  const hasPost = hasReadingIn(readings, latest.startedAt + POST_WINDOW_FROM_MS, latest.startedAt + POST_WINDOW_TO_MS);
  const model = hasPost ? await updateLearnedModel(userId) : null;
  return { checkIn, model };
}

/** Progress toward a personal model, for UI counters. Uses the engine's thresholds. */
export interface PersonalizationProgress {
  sampleSize: number;
  minPairs: number;
  fullAt: number;
  isPrior: boolean;
  phase: 'starting' | 'learning' | 'personal';
}
export function personalizationProgress(model: { sampleSize: number; isPrior: boolean } | null): PersonalizationProgress {
  const sampleSize = model?.sampleSize ?? 0;
  return {
    sampleSize,
    minPairs: MIN_PAIRS_FOR_PERSONAL,
    fullAt: FULL_PERSONAL_PAIRS,
    isPrior: model?.isPrior ?? true,
    phase:
      sampleSize >= FULL_PERSONAL_PAIRS ? 'personal' : sampleSize >= MIN_PAIRS_FOR_PERSONAL ? 'learning' : 'starting',
  };
}
