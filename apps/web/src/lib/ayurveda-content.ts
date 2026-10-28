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
