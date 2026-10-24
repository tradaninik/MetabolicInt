// P4c / U17 - Agni and meal-rhythm guidance (educational, non-medical).
// The classical day is divided into windows (IST, no DST): Kapha morning 06-10, Pitta
// midday 10-14 (digestive fire at its peak - the classical slot for the largest meal),
// Vata afternoon 14-18, Kapha evening 18-22 (agni winding down - dinner light and early),
// night 22-06 (agni at rest).
//
// Pure engine: no I/O, integer-only scoring, zero persistence (computed on read).
// IST helpers are exported so the web layer converts epoch ms exactly once, with one
// tested implementation (IST = UTC+5:30, fixed offset, no daylight saving).

export type AgniWindow = 'kapha_morning' | 'pitta_midday' | 'vata_afternoon' | 'kapha_evening' | 'night';

export interface AgniWindowMeta {
  id: AgniWindow;
  label: string;
  /** Display window, e.g. "06:00 - 10:00 IST". */
  window: string;
  /** Relative digestive fire in this window. */
  agniLevel: 'low' | 'rising' | 'peak' | 'steady' | 'winding-down' | 'resting';
  note: string;
}

export const AGNI_WINDOW_META: Record<AgniWindow, AgniWindowMeta> = {
  kapha_morning: {
    id: 'kapha_morning',
    label: 'Kapha morning',
    window: '06:00 - 10:00 IST',
    agniLevel: 'low',
    note: 'Digestive fire is still waking up. Classical advice: warm, freshly cooked breakfast; movement before the first meal helps Kapha mornings.',
  },
  pitta_midday: {
    id: 'pitta_midday',
    label: 'Pitta midday',
    window: '10:00 - 14:00 IST',
    agniLevel: 'peak',
    note: 'The classical peak of digestion - the best window for your largest meal. This is also where modern meal-timing research points for glucose control.',
  },
  vata_afternoon: {
    id: 'vata_afternoon',
    label: 'Vata afternoon',
    window: '14:00 - 18:00 IST',
    agniLevel: 'steady',
    note: 'Digestion is steady but cooling. Classical advice: a light snack or tea is fine here; keep it regular and not too late in the window.',
  },
  kapha_evening: {
    id: 'kapha_evening',
    label: 'Kapha evening',
    window: '18:00 - 22:00 IST',
    agniLevel: 'winding-down',
    note: 'Digestive fire is winding down. Classical advice: dinner light and early - ideally finished well before sleep (the app uses at least 2.5 h before a 22:30 bedtime as its benchmark).',
  },
  night: {
    id: 'night',
    label: 'Night window',
    window: '22:00 - 06:00 IST',
    agniLevel: 'resting',
    note: 'Agni is at rest and the body repairs instead of digesting. Classical advice: the kitchen closes before this window; water or herbal tea only.',
  },
};

/** Window boundaries in minutes of the IST day, [start, end) - exported for the card UI and tests. */
export const AGNI_WINDOW_BOUNDS: Record<AgniWindow, { startMin: number; endMin: number }> = {
  kapha_morning: { startMin: 360, endMin: 600 },
  pitta_midday: { startMin: 600, endMin: 840 },
  vata_afternoon: { startMin: 840, endMin: 1080 },
  kapha_evening: { startMin: 1080, endMin: 1320 },
  night: { startMin: 1320, endMin: 1440 },
};

/** Targets the score grades against. Small, readable, and surfaced in the card UI. */
export const AGNI_TARGETS = {
  /** Assumed typical bedtime, IST minutes (22:30). */
  sleepMin: 1350,
  /** Classical ideal: dinner finished at least this long before sleep (2.5 h). */
  dinnerLeadMin: 150,
  /** A "light" dinner has at most this many grams of carbs. */
  dinnerLightCarbG: 45,
  /** A "moderate" dinner has at most this many grams of carbs (above counts as heavy). */
  dinnerModerateCarbG: 75,
} as const;

/** Integer scoring weights - every rhythm decision is explainable by reading this table. */
export const AGNI_WEIGHTS = {
  largestMealTiming: { pitta_midday: 40, vata_afternoon: 25, kapha_morning: 20, kapha_evening: 10, night: 0 },
  dinnerLightness: { light: 20, moderate: 10, heavy: 0 },
  dinnerLead: { good: 20, close: 10, late: 0 },
  nightDiscipline: { clean: 20, eaten: 0 },
} as const;

/** Minutes of the IST day (0..1439) for an epoch-ms timestamp. IST is UTC+5:30, no DST. */
export function istMinuteOfDay(epochMs: number): number {
  if (typeof epochMs !== 'number' || !Number.isFinite(epochMs)) {
    throw new Error('istMinuteOfDay requires a finite epoch-ms number');
  }
  const minutesSinceEpoch = Math.floor(epochMs / 60_000);
  return ((minutesSinceEpoch + 330) % 1440 + 1440) % 1440;
}

/** Epoch ms of the IST midnight that starts the IST calendar day containing epochMs. */
export function istTodayStartEpoch(epochMs: number): number {
  if (typeof epochMs !== 'number' || !Number.isFinite(epochMs)) {
    throw new Error('istTodayStartEpoch requires a finite epoch-ms number');
  }
  const minutesSinceEpoch = Math.floor(epochMs / 60_000);
  const istMin = ((minutesSinceEpoch + 330) % 1440 + 1440) % 1440;
  return (minutesSinceEpoch - istMin) * 60_000;
}

/** The agni window for a minute of the IST day. Windows are [start, end). */
export function agniWindowAt(minuteOfDay: number): AgniWindow {
  if (!Number.isInteger(minuteOfDay) || minuteOfDay < 0 || minuteOfDay > 1439) {
    throw new Error('minuteOfDay must be an integer between 0 and 1439');
  }
  if (minuteOfDay < 360) return 'night';
  if (minuteOfDay < 600) return 'kapha_morning';
  if (minuteOfDay < 840) return 'pitta_midday';
  if (minuteOfDay < 1080) return 'vata_afternoon';
  if (minuteOfDay < 1320) return 'kapha_evening';
  return 'night';
}

/** A meal as the rhythm engine sees it: when (IST minute of day) and how much (carbs). */
export interface AgniMeal {
  minuteOfDay: number;
  carbsG: number;
}

export interface AgniRhythmResult {
  /** 0-100 integer. */
  score: number;
  components: {
    largestMealTiming: number;
    dinnerLightness: number;
    dinnerLead: number;
    nightDiscipline: number;
  };
  largestMeal: AgniMeal | null;
  /** The largest evening-window meal (the "dinner" the score grades), if any. */
  dinner: AgniMeal | null;
  /** The last evening-window meal (latest fork-down before sleep). */
  lastEveningMeal: AgniMeal | null;
  nightMeals: number;
  /** Prioritized, plain-language nudges (at most 3). */
  nudges: string[];
}

function fmtIst(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60);
  const m = minuteOfDay % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm} IST`;
}

/**
 * Score a day's meals (so far) against the classical rhythm. Returns null when no meals
 * are logged yet - the caller renders an "awaiting today's meals" state instead of a fake 0.
 *
 * Integer-only arithmetic throughout; deterministic nudges ordered night > dinner lead >
 * dinner lightness > largest-meal window.
 */
export function agniScore(meals: AgniMeal[]): AgniRhythmResult | null {
  if (!Array.isArray(meals) || meals.length === 0) return null;

  const clean = meals
    .filter((m) => m && Number.isFinite(m.minuteOfDay) && Number.isFinite(m.carbsG))
    .map((m) => ({ minuteOfDay: Math.round(m.minuteOfDay), carbsG: m.carbsG }));
  if (clean.length === 0) return null;

  let largest: AgniMeal | null = null;
  for (const m of clean) {
    if (!largest || m.carbsG > largest.carbsG || (m.carbsG === largest.carbsG && m.minuteOfDay < largest.minuteOfDay)) {
      largest = m;
    }
  }

  const evening = clean.filter((m) => m.minuteOfDay >= 1080 && m.minuteOfDay < 1320);
  const nightMeals = clean.filter((m) => m.minuteOfDay >= 1320 || m.minuteOfDay < 360).length;

  // Dinner = the largest evening meal (the meal the lightness rule grades).
  let dinner: AgniMeal | null = null;
  for (const m of evening) {
    if (!dinner || m.carbsG > dinner.carbsG || (m.carbsG === dinner.carbsG && m.minuteOfDay < dinner.minuteOfDay)) {
      dinner = m;
    }
  }
  // The last fork-down of the evening (latest by IST minute, deterministic).
  let latestEvening: AgniMeal | null = null;
  for (const m of evening) {
    if (!latestEvening || m.minuteOfDay > latestEvening.minuteOfDay) latestEvening = m;
  }

  const nudges: string[] = [];

  // Component 1: where the largest meal landed.
  const largestWindow = largest ? agniWindowAt(largest.minuteOfDay) : 'pitta_midday';
  const largestMealTiming = largest ? AGNI_WEIGHTS.largestMealTiming[largestWindow] : 0;
  if (largest && largestWindow !== 'pitta_midday') {
    nudges.push(
      `Your largest meal so far was at ${fmtIst(largest.minuteOfDay)} (${AGNI_WINDOW_META[largestWindow].label}). The classical peak-digestion slot for the biggest meal is the Pitta window, 10:00 - 14:00.`,
    );
  }

  // Component 2: dinner lightness (no evening meal yet = full credit + a gentle note).
  let dinnerLightness: number;
  if (!dinner) {
    dinnerLightness = AGNI_WEIGHTS.dinnerLightness.light;
    if (evening.length === 0 && nightMeals === 0) {
      nudges.push('No evening meal logged yet. When dinner comes, classical guidance keeps it lighter than midday.');
    }
  } else if (dinner.carbsG <= AGNI_TARGETS.dinnerLightCarbG) {
    dinnerLightness = AGNI_WEIGHTS.dinnerLightness.light;
  } else if (dinner.carbsG <= AGNI_TARGETS.dinnerModerateCarbG) {
    dinnerLightness = AGNI_WEIGHTS.dinnerLightness.moderate;
    nudges.push(
      `Dinner carried about ${Math.round(dinner.carbsG)} g carbs - a touch above the classical "light dinner" mark (about ${AGNI_TARGETS.dinnerLightCarbG} g).`,
    );
  } else {
    dinnerLightness = AGNI_WEIGHTS.dinnerLightness.heavy;
    nudges.push(
      `Dinner carried about ${Math.round(dinner.carbsG)} g carbs - classically the evening meal works best lighter than midday (about ${AGNI_TARGETS.dinnerLightCarbG} g or less).`,
    );
  }

  // Component 3: dinner lead time before the assumed bedtime.
  let dinnerLead: number;
  if (!latestEvening) {
    dinnerLead = AGNI_WEIGHTS.dinnerLead.good;
  } else {
    const lead = AGNI_TARGETS.sleepMin - latestEvening.minuteOfDay;
    if (lead >= AGNI_TARGETS.dinnerLeadMin) {
      dinnerLead = AGNI_WEIGHTS.dinnerLead.good;
    } else if (lead >= 60) {
      dinnerLead = AGNI_WEIGHTS.dinnerLead.close;
      nudges.push(
        `Dinner at ${fmtIst(latestEvening.minuteOfDay)} leaves about ${Math.max(0, Math.round(lead / 60))} h before a typical 22:30 bedtime - the classical ideal is at least 2.5 h.`,
      );
    } else {
      dinnerLead = AGNI_WEIGHTS.dinnerLead.late;
      nudges.push(
        `Dinner at ${fmtIst(latestEvening.minuteOfDay)} is close to bedtime - the classical ideal is at least 2.5 h of gap (finish by about 20:00 for a 22:30 bedtime).`,
      );
    }
  }

  // Component 4: night-window discipline.
  const nightDiscipline = nightMeals > 0 ? AGNI_WEIGHTS.nightDiscipline.eaten : AGNI_WEIGHTS.nightDiscipline.clean;
  if (nightMeals > 0) {
    nudges.unshift(
      `${nightMeals} meal${nightMeals === 1 ? '' : 's'} logged inside the night window (22:00 - 06:00), when agni is classically at rest - the gentle goal is to finish the kitchen before 22:00.`,
    );
  }

  const score = Math.max(
    0,
    Math.min(100, largestMealTiming + dinnerLightness + dinnerLead + nightDiscipline),
  );

  return {
    score,
    components: { largestMealTiming, dinnerLightness, dinnerLead, nightDiscipline },
    largestMeal: largest,
    dinner,
    lastEveningMeal: latestEvening,
    nightMeals,
    nudges: nudges.slice(0, 3),
  };
}

export interface LateMealBanner {
  window: AgniWindow;
  title: string;
  body: string;
}

/**
 * The educational banner for /log after a meal is saved deep in a low-agni window:
 * from 20:30 IST (dinner inside the 2.5-h no-go zone before a 22:30 bedtime) through the
 * night window until 06:00. Null otherwise - breakfast and normal dinner times never nag.
 */
export function lateMealBanner(minuteOfDay: number): LateMealBanner | null {
  if (!Number.isInteger(minuteOfDay) || minuteOfDay < 0 || minuteOfDay > 1439) {
    throw new Error('minuteOfDay must be an integer between 0 and 1439');
  }
  const deep = minuteOfDay >= 1230 || minuteOfDay < 360;
  if (!deep) return null;
  const win = agniWindowAt(minuteOfDay);
  const meta = AGNI_WINDOW_META[win];
  return {
    window: win,
    title: 'Logged in a low-agni window',
    body:
      `${meta.label} (${meta.window}) - ${meta.agniLevel === 'resting' ? 'agni is classically at rest' : 'agni is winding down'} at this hour. ` +
      'Classical guidance: keep late meals small and warm, sit a few minutes, and a gentle 10-minute walk afterwards is the habit most reported to help. ' +
      'This is educational, not a scolding - tomorrow is a fresh Pitta window.',
  };
}

/**
 * Habit slugs from the Food as Medicine knowledge base that belong inside the rhythm
 * story (post-meal walk, plate order, early dinner). The web layer joins these to
 * HEALING_FOOD_INDEX and renders them with their evidence grades - the science and
 * lived-experience lenses meeting the Ayurvedic rhythm (spec U17 lens upgrade).
 */
export const AGNI_HABIT_SLUGS: string[] = ['post-meal-10min-walk', 'plate-order-veg-first', 'early-dinner'];

export const AGNI_DISCLAIMER =
  'Agni rhythm guidance is classical Ayurvedic education mapped onto IST day windows - it is not medical advice and knows nothing about your medications. If you take glucose-lowering medication (especially insulin or sulfonylureas), changing WHEN you eat can change your glucose pattern; keep your care team informed.';
