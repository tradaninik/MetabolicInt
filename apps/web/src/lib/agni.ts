// P4c-b / U17 - Agni rhythm loader, shared by /api/ayurveda/agni and the dashboard card.
// Reads today's meals (IST day), computes the rhythm on read (zero persistence),
// and joins the three rhythm habits from the Food as Medicine knowledge base so the
// science / lived-experience lenses meet the classical rhythm story (spec U17).

import { prisma } from '@/lib/prisma';
import {
  agniScore,
  agniWindowAt,
  istMinuteOfDay,
  istTodayStartEpoch,
  AGNI_WINDOW_META,
  AGNI_HABIT_SLUGS,
  AGNI_DISCLAIMER,
  type AgniRhythmResult,
  type AgniWindowMeta,
  type EvidenceGrade,
} from '@mi/engine';
import { HEALING_FOOD_INDEX } from '@mi/food-db';

export interface AgniHabitRef {
  slug: string;
  name: string;
  headline: string;
  grade: EvidenceGrade;
}

export interface AgniRhythmSnapshot {
  /** Current IST minute of day (0-1439). */
  nowIstMinute: number;
  window: AgniWindowMeta;
  /** Null when no meals are logged yet today. */
  rhythm: AgniRhythmResult | null;
  mealsToday: number;
  habits: AgniHabitRef[];
  disclaimer: string;
}

export async function loadAgniRhythm(userId: string): Promise<AgniRhythmSnapshot> {
  const now = Date.now();
  const since = istTodayStartEpoch(now);

  const entries = await prisma.foodEntry.findMany({
    where: { userId, loggedAt: { gte: new Date(since) } },
    orderBy: { loggedAt: 'asc' },
    select: { loggedAt: true, carbsG: true },
  });

  const meals = entries.map((e) => ({
    minuteOfDay: istMinuteOfDay(e.loggedAt.getTime()),
    carbsG: e.carbsG,
  }));

  const habits: AgniHabitRef[] = AGNI_HABIT_SLUGS.flatMap((slug) => {
    const f = HEALING_FOOD_INDEX[slug];
    const grade = f?.science?.grade;
    if (!f || !grade) return [];
    return [{ slug, name: f.name, headline: f.headline, grade }];
  });

  return {
    nowIstMinute: istMinuteOfDay(now),
    window: AGNI_WINDOW_META[agniWindowAt(istMinuteOfDay(now))],
    rhythm: agniScore(meals),
    mealsToday: meals.length,
    habits,
    disclaimer: AGNI_DISCLAIMER,
  };
}
