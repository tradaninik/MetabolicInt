// S2-B (Ayurveda Phase 1) — static, clearly-labelled traditional-content copy
// for the Know Your Body results page. Presentation data only (engine logic
// lives in packages/engine/src/prakriti.ts).
//
// Safety rules baked into every string here:
// - Traditional accounts are framed AS tradition ("the tradition links/associates…"),
//   never as statements of medical fact about the user.
// - Nothing describes a dosha as explaining, causing or aggravating any medical
//   measurement (glucose, weight, labs). No dosha-glucose causality anywhere.
// - No "your body is X% dosha" phrasing — shares describe ANSWERS, not biology.

export type DoshaKey = 'vata' | 'pitta' | 'kapha';

export interface DoshaInfo {
  name: string;
  /** What the Ayurvedic tradition associates with this dosha. */
  tradition: string;
  /** Qualities the tradition describes when in balance. */
  balanced: string;
  /** Qualities the tradition describes when out of balance. */
  imbalance: string;
}

export const DOSHA_INFO: Record<DoshaKey, DoshaInfo> = {
  vata: {
    name: 'Vata',
    tradition:
      'The tradition links Vata with movement — light frames, quick and restless minds, and variable appetite, sleep and energy.',
    balanced: 'Traditionally described as adaptable, imaginative and lively when in balance.',
    imbalance: 'Traditional accounts describe imbalance as dryness, restlessness, and irregular digestion or sleep.',
  },
  pitta: {
    name: 'Pitta',
    tradition:
      'The tradition links Pitta with transformation — medium muscular builds, strong digestion, and sharp, driven focus.',
    balanced: 'Traditionally described as discerning, warm and courageous when in balance.',
    imbalance: 'Traditional accounts describe imbalance as excess heat, irritation, acidity and impatience.',
  },
  kapha: {
    name: 'Kapha',
    tradition:
      'The tradition links Kapha with structure and stability — solid frames, steady energy, calm endurance and deep sleep.',
    balanced: 'Traditionally described as grounded, patient and loyal when in balance.',
    imbalance: 'Traditional accounts describe imbalance as heaviness, sluggishness and resistance to change.',
  },
};

/** Gentle reflection points per dosha — traditional framing only, never medical,
 *  never tied to any medical measurement. */
export const TRADITION_REFLECTIONS: Record<DoshaKey, string[]> = {
  vata: [
    'The tradition favours warm, freshly cooked meals and steady meal times for vata-leaning constitutions.',
    'Traditional practice recommends regular routines and gentle, grounding activity over bursts of intense effort.',
  ],
  pitta: [
    'The tradition suggests cooling, mildly spiced food and moderate — rather than competitive — exercise for pitta-leaning constitutions.',
    'Traditional practice recommends pacing work with real rest, and stepping back from heat, literal and emotional.',
  ],
  kapha: [
    'The tradition encourages lighter cooking, warming spices and brisk movement to bring energy for kapha-leaning constitutions.',
    'Traditional practice recommends earlier, lighter dinners and building variety into the daily routine.',
  ],
};

/** The three tied-in doshas for a result, derived from counts — mirrors the
 *  engine's tie rule (top count shared by 2+). Used to pick which reflection
 *  lists the results page shows. */
export function topDoshas(counts: Record<DoshaKey, number>): DoshaKey[] {
  const top = Math.max(counts.vata, counts.pitta, counts.kapha);
  const order: DoshaKey[] = ['vata', 'pitta', 'kapha'];
  return order.filter((d) => counts[d] === top);
}

// --- S2-B3: "What this means for your day" wellness ideas -------------------
// Gentle, traditional, non-medical. Every string is either a neutral action
// or explicitly framed as "the tradition favours/suggests/links…". Nothing
// claims a medical benefit, mentions any medical measurement, or says a dosha
// explains any reading. Selection is keyed to the user's own quiz answers
// (stated preferences) only.

export const WELLNESS_CATEGORIES = ['food', 'movement', 'relaxation', 'sleep', 'reflection'] as const;
export type WellnessCategory = (typeof WELLNESS_CATEGORIES)[number];

export const WELLNESS_CATEGORY_LABEL: Record<WellnessCategory, string> = {
  food: 'Food',
  movement: 'Movement',
  relaxation: 'Relaxation',
  sleep: 'Sleep',
  reflection: 'Reflection',
};

/** Links into existing modules only, and only where one maps naturally. */
export const WELLNESS_LINK: Partial<Record<WellnessCategory, { href: string; label: string }>> = {
  food: { href: '/recipes', label: 'Recipes' },
  movement: { href: '/log', label: 'Log activity' },
  sleep: { href: '/log', label: 'Log sleep' },
};

export const WELLNESS_IDEAS: Record<DoshaKey, Record<WellnessCategory, string[]>> = {
  vata: {
    food: [
      'Warm, freshly cooked food at steady times — the tradition favours regularity for vata-leaning answers.',
      'A warm drink with meals instead of cold, dry snacks — the traditional choice for vata-leaning answers.',
    ],
    movement: [
      'A gentle 15-minute walk after your largest meal.',
      'Easy, rhythmic movement — the tradition prefers it to bursts of intense effort for vata-leaning answers.',
    ],
    relaxation: [
      'Five minutes of slow, even breathing before your evening meal.',
      'A few quiet minutes without screens before bed — the tradition links stillness with settled vata.',
    ],
    sleep: [
      'A fixed wind-down time tonight — regularity is the tradition’s theme for vata-leaning answers.',
      'Warm feet, warm drink, early lights-out — the traditional wind-down for vata-leaning answers.',
    ],
    reflection: [
      'Note one moment today when you felt scattered — just notice, no judging.',
      'Jot down tomorrow’s one most-important thing; the tradition links settled plans with settled vata.',
    ],
  },
  pitta: {
    food: [
      'Cooling, mildly spiced food — the tradition suggests going easy on chilli and fried heat for pitta-leaning answers.',
      'Eat without working at the same time — the tradition ties undistracted meals to balanced pitta.',
    ],
    movement: [
      'A moderate walk in the cooler part of the day.',
      'Exercise at an effort you could still chat at — the tradition prefers moderation over competition for pitta-leaning answers.',
    ],
    relaxation: [
      'Ten minutes of something deliberately slow after your busiest stretch.',
      'Step away from the heat — literal or emotional — for a few quiet minutes.',
    ],
    sleep: [
      'Lights out before the second wind — the tradition links late nights with heated pitta.',
      'A cool, dark, quiet room tonight — the traditional setup for pitta-leaning answers.',
    ],
    reflection: [
      'Notice one irritation today without acting on it — just watch it pass.',
      'End the day noting one thing that went right; the tradition favours contentment over conquest for pitta.',
    ],
  },
  kapha: {
    food: [
      'Lighter cooking with warming spices — the tradition favours these for kapha-leaning answers.',
      'An earlier, lighter dinner tonight; the tradition suggests giving the evening a long gap.',
    ],
    movement: [
      'A brisk 20-minute walk, ideally before your first meal.',
      'A few minutes of movement that makes you breathe harder — the tradition favours invigorating effort for kapha-leaning answers.',
    ],
    relaxation: [
      'Rest after effort, not instead of it — the tradition ties balanced kapha to earned rest.',
      'A few energising breaths instead of a nap this afternoon.',
    ],
    sleep: [
      'Up and into daylight early — the tradition favours early rising for kapha-leaning answers.',
      'Keep tonight’s sleep to a steady window; long lie-ins traditionally weigh kapha down.',
    ],
    reflection: [
      'Note one small thing you finished today — momentum is the tradition’s kapha theme.',
      'Choose tomorrow’s first move tonight, and start with it before anything slow.',
    ],
  },
};
