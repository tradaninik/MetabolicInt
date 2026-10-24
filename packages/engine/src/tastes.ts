// P4c / U16 - Tastes (rasa) and dosha effects for the logging flow (educational, non-medical).
// The Ayurveda lens deepened into /log and /my-foods: per-food taste badges ("P+ K-" style)
// and a "Tastes in this meal" strip aggregated over the tray.
//
// Pure engine: no I/O, integer counts only, deterministic ordering. Dosha effect per food is
// DERIVED from the classical saptarasa-dosha matrix (below) rather than hand-authored per
// food, so the derivation is reviewable in one place and matches classical tables:
//   sweet      pacifies Vata + Pitta, aggravates Kapha
//   sour       pacifies Vata,        aggravates Pitta + Kapha
//   salty      pacifies Vata,        aggravates Pitta + Kapha
//   bitter     pacifies Pitta + Kapha, aggravates Vata
//   pungent    pacifies Kapha,       aggravates Vata + Pitta
//   astringent pacifies Pitta + Kapha, aggravates Vata
//
// Reuses Dosha (prakriti.ts) via a type-only import - never re-exported (house barrel rule).

import type { Dosha } from './prakriti';

export type Rasa = 'sweet' | 'sour' | 'salty' | 'bitter' | 'pungent' | 'astringent';
export type Virya = 'heating' | 'cooling';

/** Canonical order - the order taste chips and badge parts render in. */
export const RASA_ORDER: Rasa[] = ['sweet', 'sour', 'salty', 'bitter', 'pungent', 'astringent'];

export const RASA_META: Record<Rasa, { id: Rasa; label: string; hint: string }> = {
  sweet: {
    id: 'sweet',
    label: 'Sweet',
    hint: 'Builds and grounds the body; in excess it adds Kapha and raises glucose load.',
  },
  sour: {
    id: 'sour',
    label: 'Sour',
    hint: 'Kindles appetite and digestion; in excess it heats Pitta and adds Kapha.',
  },
  salty: {
    id: 'salty',
    label: 'Salty',
    hint: 'Adds flavor and moistens; in excess it heats Pitta, adds Kapha and raises BP.',
  },
  bitter: {
    id: 'bitter',
    label: 'Bitter',
    hint: 'Classically the taste that clears excess and helps detoxify; in excess it dries Vata.',
  },
  pungent: {
    id: 'pungent',
    label: 'Pungent',
    hint: 'Heats and sparks digestion; in excess it burns Pitta and dries Vata.',
  },
  astringent: {
    id: 'astringent',
    label: 'Astringent',
    hint: 'Drying and tightening; in excess it constipates and unsettles Vata.',
  },
};

/** Classical taste for a food (or dish). rasa is required; virya is the classical potency. */
export interface FoodTaste {
  rasa: Rasa[];
  virya?: Virya;
}

/** The classical saptarasa -> dosha matrix. Educational reference, not medical advice. */
export const RASA_DOSHA_MATRIX: Record<Rasa, { pacifies: Dosha[]; aggravates: Dosha[] }> = {
  sweet: { pacifies: ['vata', 'pitta'], aggravates: ['kapha'] },
  sour: { pacifies: ['vata'], aggravates: ['pitta', 'kapha'] },
  salty: { pacifies: ['vata'], aggravates: ['pitta', 'kapha'] },
  bitter: { pacifies: ['pitta', 'kapha'], aggravates: ['vata'] },
  pungent: { pacifies: ['kapha'], aggravates: ['vata', 'pitta'] },
  astringent: { pacifies: ['pitta', 'kapha'], aggravates: ['vata'] },
};

const DOSHA_ORDER: Dosha[] = ['vata', 'pitta', 'kapha'];
const DOSHA_MARK: Record<Dosha, string> = { vata: 'V', pitta: 'P', kapha: 'K' };

export type DoshaEffect = 'pacifies' | 'aggravates' | 'mixed' | 'neutral';

export interface DoshaFoodAdvice {
  /** Doshas this food's tastes settle classically (pacified by >=1 rasa, aggravated by none). */
  pacifies: Dosha[];
  /** Doshas this food's tastes stir classically (aggravated by >=1 rasa, pacified by none). */
  aggravates: Dosha[];
  /** Doshas touched both ways by a mixed taste profile (e.g. sour + pungent on Vata). */
  mixed: Dosha[];
  /** Compact badge, e.g. "V- P- K+" (pacifies -, aggravates +, mixed +/-). */
  badge: string;
  /** Plain-language line for tooltips and screen readers. */
  label: string;
}

function validRasaList(rasa: unknown): rasa is Rasa[] {
  return Array.isArray(rasa) && rasa.length > 0 && rasa.every((r) => RASA_ORDER.includes(r as Rasa));
}

/**
 * Derive a food's dosha effect from its tastes via the classical matrix. Throws on an
 * invalid taste payload - callers pass dataset rows that the integrity tests pre-validate.
 */
export function doshaFoodAdvice(taste: FoodTaste): DoshaFoodAdvice {
  if (!taste || typeof taste !== 'object' || !validRasaList(taste.rasa)) {
    throw new Error('doshaFoodAdvice requires a non-empty rasa array of valid taste ids');
  }
  const pacifies: Dosha[] = [];
  const aggravates: Dosha[] = [];
  const mixed: Dosha[] = [];
  for (const d of DOSHA_ORDER) {
    const pacified = taste.rasa.some((r) => RASA_DOSHA_MATRIX[r].pacifies.includes(d));
    const aggravated = taste.rasa.some((r) => RASA_DOSHA_MATRIX[r].aggravates.includes(d));
    if (pacified && aggravated) mixed.push(d);
    else if (pacified) pacifies.push(d);
    else if (aggravated) aggravates.push(d);
  }
  const badgeParts: string[] = [];
  for (const d of DOSHA_ORDER) {
    if (pacifies.includes(d)) badgeParts.push(`${DOSHA_MARK[d]}-`);
    else if (aggravates.includes(d)) badgeParts.push(`${DOSHA_MARK[d]}+`);
    else if (mixed.includes(d)) badgeParts.push(`${DOSHA_MARK[d]}+/-`);
  }
  const labelParts: string[] = [];
  if (pacifies.length > 0) {
    labelParts.push(`pacifies ${pacifies.map((d) => d).join(' and ')}`);
  }
  if (aggravates.length > 0) {
    labelParts.push(`aggravates ${aggravates.join(' and ')}`);
  }
  if (mixed.length > 0) {
    labelParts.push(`mixed effect on ${mixed.join(' and ')}`);
  }
  return {
    pacifies,
    aggravates,
    mixed,
    badge: badgeParts.length > 0 ? badgeParts.join(' ') : 'balanced',
    label: labelParts.length > 0 ? `Classically ${labelParts.join(', ')}.` : 'Classically balanced across doshas.',
  };
}

/** One tray/basket item for the taste strip. Items without taste data count toward totals only. */
export interface MealTasteItem {
  /** Present when the food has classical taste data; absent for unknown foods. */
  rasa?: Rasa[];
  virya?: Virya;
  /** Grams in this portion, when the caller wants virya balance gram-weighted later. */
  grams?: number;
}

export interface MealTasteBalance {
  /** How many items carry each taste (integer). */
  counts: Record<Rasa, number>;
  /** Highest-count tastes, in canonical order (deterministic tie-break). */
  dominant: Rasa[];
  /** Dosha effect of the meal's tastes combined, via the same matrix rules. */
  dosha: { pacifies: Dosha[]; aggravates: Dosha[]; mixed: Dosha[]; badge: string; label: string };
  /** How many items carry heating vs cooling virya (only counted where virya is known). */
  virya: { heating: number; cooling: number };
  /** Honest coverage: items with taste data vs total items. */
  coverage: { known: number; total: number };
  /** One-line human summary for API consumers and alt text. */
  summary: string;
}

/**
 * Aggregate the tastes of a meal. Pure: never mutates the input, deterministic output.
 * Items with missing/invalid rasa are counted in coverage.total only - the strip stays
 * honest about what it does not know instead of guessing.
 */
export function mealTasteBalance(items: MealTasteItem[]): MealTasteBalance {
  const counts: Record<Rasa, number> = { sweet: 0, sour: 0, salty: 0, bitter: 0, pungent: 0, astringent: 0 };
  let known = 0;
  let heating = 0;
  let cooling = 0;
  const present: Rasa[] = [];
  for (const it of items ?? []) {
    if (!it || !validRasaList(it.rasa)) continue;
    known += 1;
    if (it.virya === 'heating') heating += 1;
    if (it.virya === 'cooling') cooling += 1;
    for (const r of it.rasa) {
      if (counts[r] === 0) present.push(r);
      counts[r] += 1;
    }
  }
  const total = Array.isArray(items) ? items.length : 0;
  const maxCount = Math.max(0, ...present.map((r) => counts[r]));
  const dominant = maxCount > 0 ? present.filter((r) => counts[r] === maxCount) : [];
  // present is already in first-seen order; canonicalize to RASA_ORDER for determinism.
  dominant.sort((a, b) => RASA_ORDER.indexOf(a) - RASA_ORDER.indexOf(b));

  const dosha =
    present.length > 0
      ? doshaFoodAdvice({ rasa: present })
      : { pacifies: [] as Dosha[], aggravates: [] as Dosha[], mixed: [] as Dosha[], badge: '', label: '' };

  let summary: string;
  if (known === 0) {
    summary = 'No classical taste data for the foods in this meal yet.';
  } else {
    const tasteLine =
      dominant.length > 0
        ? dominant.length === 1
          ? `Mostly ${dominant[0]}`
          : `Mostly ${dominant.slice(0, -1).join(', ')} and ${dominant[dominant.length - 1]}`
        : 'Balanced across tastes';
    const unknown = total - known;
    summary =
      `${tasteLine} - ${known} of ${total} items with taste data` +
      (unknown > 0 ? ` (${unknown} without classical data)` : '') +
      '. ' +
      dosha.label;
  }

  return {
    counts,
    dominant,
    dosha: { pacifies: dosha.pacifies, aggravates: dosha.aggravates, mixed: dosha.mixed, badge: dosha.badge, label: dosha.label },
    virya: { heating, cooling },
    coverage: { known, total },
    summary,
  };
}

export const TASTE_DISCLAIMER =
  'Taste (rasa) and potency (virya) assignments are classical Ayurvedic educational approximations for whole foods and common dishes - they are not medical advice and not a dosing instruction. Effects shown are the classical textbook pattern for each taste, not a prediction for you.';
