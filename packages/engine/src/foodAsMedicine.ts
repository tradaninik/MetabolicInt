// P4c / U16 - Food as Medicine: multi-lens knowledge base engine (educational, non-medical).
// Three lenses over the same entry: ayurveda (classical properties), science (research with
// honest evidence grades) and stories (lived experience of people living with diabetes).
// Pure engine: no I/O, integer-only scoring, deterministic ordering.
//
// Reuses Dosha (prakriti.ts) and RitucharyaSeason (ritucharya.ts) via type-only imports.
// Never re-exports them: the package barrel already exports both, and an `export *` here
// would collide (house barrel rule).
//
// Lens ids are an open set: a future "clinical guidance" lens (post-P4g doctor report) or
// DB-backed moderated user stories can join without re-architecture.

import type { Dosha } from './prakriti';
import type { RitucharyaSeason } from './ritucharya';

export type LensId = 'ayurveda' | 'science' | 'stories';
export type EvidenceGrade = 'A' | 'B' | 'C' | 'D';
export type PrakritiFit = 'good' | 'moderate' | 'avoid';
export type Prevalence = 'widely' | 'commonly' | 'scattered';
export type HealingFoodCategory =
  | 'grain'
  | 'legume'
  | 'spice'
  | 'vegetable'
  | 'fruit'
  | 'nut'
  | 'drink'
  | 'habit';

/** Canonical lens order - the order lens sections render in. */
export const LENS_ORDER: LensId[] = ['ayurveda', 'science', 'stories'];

export interface AyurvedaLensData {
  /** Classical tastes (rasa). Foods carry them; habits may omit. */
  rasa?: string[];
  /** Potency (virya). Optional for habits, required for foods. */
  virya?: 'heating' | 'cooling';
  pacifies: Dosha[];
  aggravates: Dosha[];
  /** Constitution fit per dosha - the Prakriti personalization hook. */
  prakritiFit: Record<Dosha, PrakritiFit>;
  /** Ritucharya seasons this entry is especially tied to. */
  seasons?: RitucharyaSeason[];
  seasonalNote?: string;
  classicalRef?: string;
  summary: string;
}

export interface ScienceLensData {
  grade: EvidenceGrade;
  headline: string;
  /** Descriptive summary - no fabricated citations. Named studies only where rock-solid. */
  evidenceSummary: string;
  giNote?: string;
  fiberNote?: string;
  nutrientNote?: string;
  mechanism?: string;
  /** Required on grade D: the popular claim AND the honest verdict, side by side. */
  debunk?: { claim: string; verdict: string };
}

export interface StoriesLensData {
  /** How widely the pattern shows up in community reports - always labeled, never proof. */
  prevalence: Prevalence;
  patterns: string[];
  summary: string;
}

/** Ancient practice lens (P5 tradition layer). Educational summary of what
 *  the classical tradition actually says about an entry: which texts mention
 *  it, how it was traditionally prepared and used, and the honest note that
 *  classical practice is tradition, not clinical evidence. Content-only:
 *  this lens never affects ranking; it renders as its own profile section. */
export interface TraditionPractice {
  /** Short practice name, e.g. "Soaked seeds at sunrise". */
  name: string;
  /** What the practice is, phrased educationally (2+ sentences). */
  detail: string;
}

export interface TraditionLensData {
  /** One-line traditional framing of the entry. */
  headline: string;
  /** Classical sources that describe the entry, phrased educationally
   *  (e.g. "Charaka Samhita, Sutrasthana - as commonly taught"). */
  classicalTexts?: string[];
  /** The traditional preparation form(s) (e.g. "yavagu - barley gruel"). */
  preparation?: string;
  /** Concrete traditional practices around this entry (1-4 items). */
  practices: TraditionPractice[];
  /** Interpretive honesty note: tradition vs evidence framing. */
  note?: string;
}

export interface HealingFood {
  slug: string;
  name: string;
  alsoKnownAs?: string[];
  category: HealingFoodCategory;
  headline: string;
  /** Safety strip (medication interactions, dosing cautions). Rendered amber, always visible. */
  cautions?: string[];
  ayurveda?: AyurvedaLensData;
  science?: ScienceLensData;
  stories?: StoriesLensData;
  /** Ancient-practice lens: classical texts, preparations and practices (P5). */
  tradition?: TraditionLensData;
}

export const LENS_META: Record<LensId, { id: LensId; label: string; blurb: string }> = {
  ayurveda: {
    id: 'ayurveda',
    label: 'Ayurveda',
    blurb: 'Classical properties: taste (rasa), potency (virya), dosha effects, Prakriti fit and seasonal notes.',
  },
  science: {
    id: 'science',
    label: 'Scientific research',
    blurb: 'What trials and studies report, with an honest evidence grade from A to D.',
  },
  stories: {
    id: 'stories',
    label: 'Lived experience',
    blurb: 'What people living with diabetes report helped them - patterns, never proof.',
  },
};

export const EVIDENCE_GRADE_META: Record<EvidenceGrade, { grade: EvidenceGrade; label: string; meaning: string }> = {
  A: { grade: 'A', label: 'Strong evidence', meaning: 'Multiple randomized controlled trials and/or meta-analyses.' },
  B: { grade: 'B', label: 'Good evidence', meaning: 'Several trials plus observational support.' },
  C: { grade: 'C', label: 'Early evidence', meaning: 'Early or limited human evidence.' },
  D: { grade: 'D', label: 'Not supported', meaning: 'A popular claim that human trials do not (yet) support.' },
};

export const CATEGORY_META: Record<HealingFoodCategory, { id: HealingFoodCategory; label: string }> = {
  grain: { id: 'grain', label: 'Grains' },
  legume: { id: 'legume', label: 'Pulses & legumes' },
  spice: { id: 'spice', label: 'Spices' },
  vegetable: { id: 'vegetable', label: 'Vegetables' },
  fruit: { id: 'fruit', label: 'Fruits' },
  nut: { id: 'nut', label: 'Nuts & seeds' },
  drink: { id: 'drink', label: 'Drinks' },
  habit: { id: 'habit', label: 'Habits' },
};

/** Tie-break order for equal scores: habits first, then foods, then drinks; slug last. */
export const CATEGORY_ORDER: HealingFoodCategory[] = ['habit', 'grain', 'legume', 'vegetable', 'fruit', 'nut', 'spice', 'drink'];

export const FOOD_AS_MEDICINE_DISCLAIMER =
  'Food as Medicine is educational information, not medical advice. The same food can look different through the three lenses - classical Ayurveda, published research and lived experience - and none of them replace the plan you make with your care team. If you live with diabetes, keep your clinician in the loop before changing what you eat or how you time it.';

export const STORIES_DISCLAIMER =
  'Lived-experience entries are individual reports, never clinical proof - what helped one person may not fit you. If you take glucose-lowering medication (especially insulin or sulfonylureas), adding or removing foods or habits can cause low blood sugar; keep your care team informed.';

/** Lenses present on an entry, in canonical order. */
export function lensesOf(food: HealingFood): LensId[] {
  const out: LensId[] = [];
  if (food.ayurveda) out.push('ayurveda');
  if (food.science) out.push('science');
  if (food.stories) out.push('stories');
  return out;
}

const DOSHA_IDS: Dosha[] = ['vata', 'pitta', 'kapha'];
const SEASON_IDS: RitucharyaSeason[] = ['shishira', 'vasant', 'grishma', 'varsha', 'sharad', 'hemant'];
const GRADE_IDS: EvidenceGrade[] = ['A', 'B', 'C', 'D'];
const FIT_IDS: PrakritiFit[] = ['good', 'moderate', 'avoid'];
const PREVALENCE_IDS: Prevalence[] = ['widely', 'commonly', 'scattered'];
const CATEGORY_IDS: HealingFoodCategory[] = [
  'grain', 'legume', 'spice', 'vegetable', 'fruit', 'nut', 'drink', 'habit',
];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string' && x.trim().length > 0);
}

function nonEmpty(s: unknown, min: number): s is string {
  return typeof s === 'string' && s.trim().length >= min;
}

/**
 * Editorial validator. Returns a list of problems; an empty list means the entry is
 * safe to ship. The dataset integrity test runs this over every entry, so the rules
 * below are the review checklist, expressed as code.
 */
export function validateHealingFood(food: HealingFood): string[] {
  const p: string[] = [];
  if (!food || typeof food !== 'object') return ['entry must be an object'];

  if (typeof food.slug !== 'string' || !SLUG_RE.test(food.slug)) p.push('slug must be kebab-case');
  if (!nonEmpty(food.name, 2)) p.push('name is required');
  if (!CATEGORY_IDS.includes(food.category)) p.push(`unknown category: ${String(food.category)}`);
  if (!nonEmpty(food.headline, 8)) p.push('headline is required (min 8 chars)');
  if (food.alsoKnownAs !== undefined && !isStringArray(food.alsoKnownAs)) {
    p.push('alsoKnownAs must be non-empty strings');
  }
  if (food.cautions !== undefined && !isStringArray(food.cautions)) {
    p.push('cautions must be non-empty strings');
  }

  if (lensesOf(food).length === 0) p.push('at least one lens payload is required');

  const a = food.ayurveda;
  if (a) {
    if (!nonEmpty(a.summary, 10)) p.push('ayurveda.summary is required');
    if (food.category !== 'habit') {
      if (!isStringArray(a.rasa)) p.push('ayurveda.rasa is required for non-habit entries');
      if (a.virya !== 'heating' && a.virya !== 'cooling') {
        p.push('ayurveda.virya must be heating or cooling for non-habit entries');
      }
    } else {
      if (a.rasa !== undefined && !isStringArray(a.rasa)) p.push('ayurveda.rasa must be non-empty strings');
      if (a.virya !== undefined && a.virya !== 'heating' && a.virya !== 'cooling') {
        p.push('ayurveda.virya must be heating or cooling');
      }
    }
    if (!Array.isArray(a.pacifies) || !a.pacifies.every((d) => DOSHA_IDS.includes(d))) {
      p.push('ayurveda.pacifies must list valid doshas');
    }
    if (!Array.isArray(a.aggravates) || !a.aggravates.every((d) => DOSHA_IDS.includes(d))) {
      p.push('ayurveda.aggravates must list valid doshas');
    }
    if (Array.isArray(a.pacifies) && Array.isArray(a.aggravates) && a.pacifies.some((d) => a.aggravates.includes(d))) {
      p.push('ayurveda.pacifies and aggravates must be disjoint');
    }
    const fit = a.prakritiFit;
    if (!fit || typeof fit !== 'object') {
      p.push('ayurveda.prakritiFit is required');
    } else {
      for (const d of DOSHA_IDS) {
        if (!(d in fit)) p.push(`ayurveda.prakritiFit.${d} is missing`);
        else if (!FIT_IDS.includes(fit[d])) p.push(`ayurveda.prakritiFit.${d} must be good, moderate or avoid`);
      }
    }
    if (a.seasons !== undefined) {
      if (!Array.isArray(a.seasons) || a.seasons.length === 0 || !a.seasons.every((s) => SEASON_IDS.includes(s))) {
        p.push('ayurveda.seasons must list valid Ritucharya season ids');
      } else if (!nonEmpty(a.seasonalNote, 8)) {
        p.push('ayurveda.seasonalNote is required when seasons are listed');
      }
    }
    if (a.seasonalNote !== undefined && !nonEmpty(a.seasonalNote, 8)) p.push('ayurveda.seasonalNote must be non-empty');
    if (a.classicalRef !== undefined && !nonEmpty(a.classicalRef, 8)) p.push('ayurveda.classicalRef must be non-empty');
  }

  const s = food.science;
  if (s) {
    if (!GRADE_IDS.includes(s.grade)) p.push(`science.grade must be one of A/B/C/D (got ${String(s.grade)})`);
    if (!nonEmpty(s.headline, 8)) p.push('science.headline is required');
    if (!nonEmpty(s.evidenceSummary, 40)) p.push('science.evidenceSummary must be descriptive (min 40 chars)');
    if (s.grade === 'D' && (!s.debunk || !nonEmpty(s.debunk.claim, 8) || !nonEmpty(s.debunk.verdict, 8))) {
      p.push('science.debunk (claim + verdict) is required on grade D entries');
    }
    if (s.debunk && (!nonEmpty(s.debunk.claim, 8) || !nonEmpty(s.debunk.verdict, 8))) {
      p.push('science.debunk must carry a non-empty claim and verdict');
    }
    if (s.giNote !== undefined && !nonEmpty(s.giNote, 4)) p.push('science.giNote must be non-empty');
    if (s.fiberNote !== undefined && !nonEmpty(s.fiberNote, 4)) p.push('science.fiberNote must be non-empty');
    if (s.nutrientNote !== undefined && !nonEmpty(s.nutrientNote, 4)) p.push('science.nutrientNote must be non-empty');
    if (s.mechanism !== undefined && !nonEmpty(s.mechanism, 4)) p.push('science.mechanism must be non-empty');
  }

  const st = food.stories;
  if (st) {
    if (!PREVALENCE_IDS.includes(st.prevalence)) {
      p.push(`stories.prevalence must be widely, commonly or scattered (got ${String(st.prevalence)})`);
    }
    if (!isStringArray(st.patterns)) p.push('stories.patterns must be non-empty strings');
    if (!nonEmpty(st.summary, 10)) p.push('stories.summary is required');
  }

  // P5 tradition lens: optional; when present, editorial rules mirror the
  // dataset policy - descriptive classical framing, real practices, no
  // treatment claims (the dataset integrity test separately scans strings
  // for forbidden medical language, and tradition strings are included).
  const tr = food.tradition;
  if (tr) {
    if (!nonEmpty(tr.headline, 8)) p.push('tradition.headline is required (min 8 chars)');
    if (tr.classicalTexts !== undefined && !isStringArray(tr.classicalTexts)) {
      p.push('tradition.classicalTexts must be non-empty strings');
    }
    if (tr.preparation !== undefined && !nonEmpty(tr.preparation, 8)) {
      p.push('tradition.preparation must be non-empty');
    }
    if (!Array.isArray(tr.practices) || tr.practices.length === 0 || tr.practices.length > 4) {
      p.push('tradition.practices must carry 1-4 practices');
    } else if (!tr.practices.every((pr) => nonEmpty(pr.name, 4) && nonEmpty(pr.detail, 20))) {
      p.push('tradition.practices must carry a name and a descriptive detail each');
    }
    if (tr.note !== undefined && !nonEmpty(tr.note, 8)) p.push('tradition.note must be non-empty');
  }

  return p;
}

export interface RankContext {
  /** Primary dosha from the user's stored PrakritiProfile (migration 0004). */
  prakriti?: Dosha;
  /** The lens the user is currently viewing; drives the +/- preference and D demotion. */
  lensPreference?: LensId;
}

export interface RankedHealingFood {
  food: HealingFood;
  score: number;
  reasons: string[];
}

/**
 * Integer-only scoring weights. Deliberately small, readable numbers so every ranking
 * decision is explainable by reading this table:
 *   - lens completeness: +5 per present lens
 *   - evidence bonus: A +20 / B +12 / C +5 / D +0
 *   - Prakriti fit: good +10 / moderate 0 / avoid -12
 *   - lens preference: +6 when the entry carries the preferred lens, -6 when not
 *   - D-grade demotion: -40 under the science lens (trust & safety, spec §3.6)
 */
export const RANK_WEIGHTS: {
  perLens: number;
  evidence: Record<EvidenceGrade, number>;
  prakritiFit: Record<PrakritiFit, number>;
  lensMatch: number;
  lensMiss: number;
  scienceDemotesD: number;
} = {
  perLens: 5,
  evidence: { A: 20, B: 12, C: 5, D: 0 },
  prakritiFit: { good: 10, moderate: 0, avoid: -12 },
  lensMatch: 6,
  lensMiss: -6,
  scienceDemotesD: -40,
};

/**
 * Rank healing foods for a user. Deterministic: equal scores fall through to category
 * order (habits first) and then slug, so the same input can never reorder between runs
 * or across the API/UI boundary.
 */
export function rankHealingFoods(foods: HealingFood[], ctx: RankContext = {}): RankedHealingFood[] {
  const entries: RankedHealingFood[] = foods.map((food) => {
    const reasons: string[] = [];
    let score = 0;

    const lenses = lensesOf(food);
    score += lenses.length * RANK_WEIGHTS.perLens;
    reasons.push(`${lenses.length} of ${LENS_ORDER.length} lenses`);

    const grade = food.science?.grade;
    if (grade) {
      score += RANK_WEIGHTS.evidence[grade];
      reasons.push(`evidence grade ${grade}`);
    }

    if (ctx.prakriti && food.ayurveda) {
      const fit = food.ayurveda.prakritiFit[ctx.prakriti];
      if (fit) {
        score += RANK_WEIGHTS.prakritiFit[fit];
        reasons.push(`${fit} fit for ${ctx.prakriti} Prakriti`);
      }
    }

    if (ctx.lensPreference) {
      if (lenses.includes(ctx.lensPreference)) {
        score += RANK_WEIGHTS.lensMatch;
        reasons.push(`includes the ${ctx.lensPreference} lens`);
      } else {
        score += RANK_WEIGHTS.lensMiss;
        reasons.push(`missing the ${ctx.lensPreference} lens`);
      }
    }

    if (ctx.lensPreference === 'science' && grade === 'D') {
      score += RANK_WEIGHTS.scienceDemotesD;
      reasons.push('grade D demoted under the science lens');
    }

    return { food, score, reasons };
  });

  return entries.sort(
    (a, b) =>
      b.score - a.score ||
      CATEGORY_ORDER.indexOf(a.food.category) - CATEGORY_ORDER.indexOf(b.food.category) ||
      (a.food.slug < b.food.slug ? -1 : a.food.slug > b.food.slug ? 1 : 0)
  );
}
