// P4c / U19 - Viruddha Ahara checker: classical incompatible-food-pairing guidance,
// educational and non-medical. Every pair carries BOTH a one-line classical rationale
// (the Ayurveda lens) and a short modern note (the science lens) - dual-lens honesty
// instead of tradition alone, per spec section 4 (U19).
//
// Pure engine: no I/O, no external deps, deterministic ordering. The engine knows
// FOOD CLASSES (tags), not foods: callers resolve tray items / combo items / meal
// payloads to tags via @mi/food-db (curated ids + name matching). This keeps the
// pair table reviewable in one place and reusable by every surface (log tray,
// saved combos, the meals API, and the /api/ayurveda/viruddha endpoint).
//
// Severity is deliberately a THREE-step amber scale (info < caution < avoid). UIs
// render every finding amber, never red - viruddha is educational tradition, not a
// food-safety alarm, and the modern notes say so honestly.
//
// Table schema supports 1-3 tags per row: 2-3 tags = a combination that fires when
// all tags co-occur; 1 tag = a preparation/context note that fires when the single
// tag appears (e.g. heated honey).

export type ViruddhaTag =
  | 'milk'
  | 'curd'
  | 'fish'
  | 'sourFruit'
  | 'banana'
  | 'honey'
  | 'ghee'
  | 'radish'
  | 'garlic';

export type ViruddhaSeverity = 'info' | 'caution' | 'avoid';

/** Least to most serious; findings sort by severity DESCENDING (avoid first). */
export const SEVERITY_ORDER: ViruddhaSeverity[] = ['info', 'caution', 'avoid'];

export const VIRUDDHA_TAG_META: Record<ViruddhaTag, { id: ViruddhaTag; label: string; hint: string }> = {
  milk: { id: 'milk', label: 'Milk', hint: 'Milk and milk-forward dishes (kheer, payesh, basundi), or milk as an item.' },
  curd: { id: 'curd', label: 'Fresh curd / yogurt', hint: 'Fresh-curd dishes (curd rice, kadhi, shrikhand, doi, yogurt).' },
  fish: { id: 'fish', label: 'Fish & seafood', hint: 'Fish and shrimp dishes, or fish as an item.' },
  sourFruit: { id: 'sourFruit', label: 'Sour fruit', hint: 'Citrus, sweet lime, pineapple, amla, berries and other acid fruits.' },
  banana: { id: 'banana', label: 'Banana', hint: 'Ripe banana as a fruit item.' },
  honey: { id: 'honey', label: 'Honey', hint: 'Honey as an item (in tea, warm water, or as a topping).' },
  ghee: { id: 'ghee', label: 'Ghee', hint: 'Ghee / clarified butter as an item in meaningful quantity.' },
  radish: { id: 'radish', label: 'Radish (mooli)', hint: 'Radish-forward dishes, or radish as an item.' },
  garlic: { id: 'garlic', label: 'Garlic', hint: 'Garlic-forward dishes, or garlic as an item.' },
};

export const VIRUDDHA_SEVERITY_META: Record<ViruddhaSeverity, { id: ViruddhaSeverity; label: string; note: string }> = {
  info: {
    id: 'info',
    label: 'For your awareness',
    note: 'Classical guidance only - tradition speaks, and the modern lens has no specific concern.',
  },
  caution: {
    id: 'caution',
    label: 'Classical caution',
    note: 'Classical texts call this combination incompatible; weigh it against your own experience.',
  },
  avoid: {
    id: 'avoid',
    label: 'Classically incompatible',
    note: 'One of the flagship classical incompatibilities - the strongest traditional wording.',
  },
};

export interface ViruddhaPair {
  /** Kebab-case row id, unique in the table. */
  id: string;
  /** Food classes involved: 2-3 tags = combination row; 1 tag = context/preparation note. */
  tags: ViruddhaTag[];
  severity: ViruddhaSeverity;
  /** One-line classical rationale (the Ayurveda lens). */
  classical: string;
  /** Short modern note (the science lens) - honest, never alarmist. */
  modern: string;
}

/**
 * The curated pair/triple table. Editorial content, reviewed like code (spec section 6):
 * every row names a combination the classical viruddha-ahara lists actually carry, with
 * the modern note saying plainly what research does and does not support.
 */
export const VIRUDDHA_PAIRS: ViruddhaPair[] = [
  {
    id: 'milk-fish',
    tags: ['milk', 'fish'],
    severity: 'avoid',
    classical:
      'Milk and fish head the classical incompatible list (Charaka Samhita, Sutrasthana 26) - two heavy foods the tradition calls opposite in nature.',
    modern:
      'No human trials show harm from fish and milk at the same meal; the realistic issue is slow, heavy digestion and discomfort in sensitive people, not acute danger.',
  },
  {
    id: 'milk-sour-fruit',
    tags: ['milk', 'sourFruit'],
    severity: 'caution',
    classical:
      'Sour fruits (citrus, pineapple, amla) with milk are a textbook incompatible pair - the acidity is said to curdle milk in the stomach.',
    modern:
      'Milk does curdle when acid reaches it - for most people that means texture and mild digestive discomfort, not a proven harm; fruit-in-milk drinks stay a personal-tolerance question.',
  },
  {
    id: 'milk-radish',
    tags: ['milk', 'radish'],
    severity: 'caution',
    classical:
      'Radish (mooli) with milk appears on the classical incompatible lists - the pungent root and sweet milk are called opposing.',
    modern:
      'A traditional caution with no modern-trial backing; mooli dishes followed by milk are routine in many homes without reported issues.',
  },
  {
    id: 'ghee-honey-equal',
    tags: ['ghee', 'honey'],
    severity: 'caution',
    classical:
      'Ghee and honey mixed in equal parts by weight are classically called incompatible; unequal mixes - a spoon of one with more of the other - are routine and fine.',
    modern:
      'No modern-trial evidence of harm at kitchen amounts; the classical rule targets the specific equal-by-weight mixture, not ghee and honey appearing at the same meal.',
  },
  {
    id: 'heated-honey',
    tags: ['honey'],
    severity: 'info',
    classical:
      'Classically honey is never cooked or boiled - it is stirred into warm (not hot) food at most, and heating honey has its own entry on the viruddha list.',
    modern:
      'Food-safety overlap: prolonged high heat degrades honey\'s beneficial compounds and raises HMF levels - a quality concern at ordinary amounts, not acute toxicity.',
  },
  {
    id: 'milk-banana',
    tags: ['milk', 'banana'],
    severity: 'info',
    classical:
      'Ripe sweet fruit taken with milk is broadly acceptable classically; the banana-with-milk caution comes from later practice texts that list banana specifically.',
    modern:
      'No trial evidence of harm; banana shakes and fruit smoothies digest comfortably for most people - a tolerance question, not a proven incompatibility.',
  },
  {
    id: 'curd-fish',
    tags: ['curd', 'fish'],
    severity: 'info',
    classical:
      'Fish together with fresh curd appears on later incompatible lists (Bhavaprakasha era) - both are classically heavy and said to sit poorly together.',
    modern:
      'No human-trial evidence of harm; fish cooked in curd-based gravies is a routine, much-loved dish in Bengali and coastal kitchens.',
  },
  {
    id: 'milk-garlic',
    tags: ['milk', 'garlic'],
    severity: 'info',
    classical:
      'Garlic with milk is listed among classical incompatibilities - the pungent bulb and sweet milk are described as opposing in nature.',
    modern:
      'No modern-trial backing for this as a food pair; garlic and milk each have their own rich research stories, and neither flags the combination.',
  },
];

export const VIRUDDHA_DISCLAIMER =
  'Viruddha ahara (incompatible food pairing) is classical Ayurvedic educational guidance, not a food-safety warning. Classical lists flag combinations the tradition considers heavy or opposing to digest together; modern research has not found acute dangers in these pairs at ordinary meal amounts. Every note above shows both lenses so you can weigh tradition against your own experience - none of this replaces the plan you make with your care team.';

const TAG_IDS: ViruddhaTag[] = [
  'milk', 'curd', 'fish', 'sourFruit', 'banana', 'honey', 'ghee', 'radish', 'garlic',
];
const SEVERITY_IDS: ViruddhaSeverity[] = ['info', 'caution', 'avoid'];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function nonEmpty(s: unknown, min: number): s is string {
  return typeof s === 'string' && s.trim().length >= min;
}

/**
 * Editorial validator for one pair row. Returns a list of problems; an empty list
 * means the row is safe to ship. The dataset integrity test runs this over every
 * row, so the rules below are the review checklist, expressed as code.
 */
export function validateViruddhaPair(pair: ViruddhaPair): string[] {
  const p: string[] = [];
  if (!pair || typeof pair !== 'object') return ['row must be an object'];
  if (typeof pair.id !== 'string' || !SLUG_RE.test(pair.id)) p.push('id must be kebab-case');
  if (!Array.isArray(pair.tags) || pair.tags.length < 1 || pair.tags.length > 3) {
    p.push('tags must list 1 to 3 food classes');
  } else {
    for (const t of pair.tags) {
      if (!TAG_IDS.includes(t)) p.push(`unknown food class: ${String(t)}`);
    }
    if (new Set(pair.tags).size !== pair.tags.length) p.push('tags must not repeat within a row');
  }
  if (!SEVERITY_IDS.includes(pair.severity)) {
    p.push(`severity must be info, caution or avoid (got ${String(pair.severity)})`);
  }
  if (!nonEmpty(pair.classical, 25)) p.push('classical rationale is required (min 25 chars)');
  if (!nonEmpty(pair.modern, 25)) p.push('modern note is required (min 25 chars)');
  return p;
}

/** One item offered to the checker: a tray item, combo item or meal-payload food. */
export interface ViruddhaCheckItem {
  /** Unique item key (food id, or any stable key). Duplicate keys are ignored after the first. */
  key: string;
  /** Display name used in the finding line. */
  label: string;
  /** Resolved food classes; items without classes participate in nothing. */
  tags?: ViruddhaTag[];
}

export interface ViruddhaFinding {
  pairId: string;
  severity: ViruddhaSeverity;
  /** The items that carry the row's classes, in input order. */
  items: { key: string; label: string }[];
  pair: ViruddhaPair;
  classical: string;
  modern: string;
  /** One-line human summary for API consumers and alt text. */
  summary: string;
}

/**
 * Check a set of items against the pair table. Pure and tolerant: null input returns
 * no findings, malformed items are skipped, unknown tags are filtered out. Deterministic
 * output: findings sort by severity (avoid first), then pair id; the same input can never
 * reorder between runs or across the API/UI boundary.
 *
 * Dedup rules: one finding per pair row (a row fires once however many items match),
 * and items are deduplicated by key (the same food twice counts once).
 */
export function checkViruddha(items: ViruddhaCheckItem[] | null | undefined): ViruddhaFinding[] {
  if (!Array.isArray(items)) return [];

  // Normalize + dedup items by key, preserving input order.
  const clean: { key: string; label: string; tags: ViruddhaTag[] }[] = [];
  const seenKeys = new Set<string>();
  for (const it of items) {
    if (!it || typeof it !== 'object') continue;
    const key = typeof it.key === 'string' && it.key.trim() ? it.key.trim() : '';
    if (!key || seenKeys.has(key)) continue;
    const label = nonEmpty(it.label, 1) ? (it.label as string).trim() : key;
    const tags = Array.isArray(it.tags) ? it.tags.filter((t) => TAG_IDS.includes(t)) : [];
    seenKeys.add(key);
    clean.push({ key, label, tags });
  }

  const findings: ViruddhaFinding[] = [];
  for (const pair of VIRUDDHA_PAIRS) {
    const involved: { key: string; label: string }[] = [];
    const matched = new Set<ViruddhaTag>();
    for (const it of clean) {
      const carries = pair.tags.filter((t) => it.tags.includes(t));
      if (carries.length > 0) {
        involved.push({ key: it.key, label: it.label });
        for (const t of carries) matched.add(t);
      }
    }
    // A row fires only when EVERY one of its classes is present across the items.
    if (pair.tags.every((t) => matched.has(t))) {
      const tagLabels = pair.tags.map((t) => VIRUDDHA_TAG_META[t].label).join(' + ');
      findings.push({
        pairId: pair.id,
        severity: pair.severity,
        items: involved,
        pair,
        classical: pair.classical,
        modern: pair.modern,
        summary: `${involved.map((i) => i.label).join(' + ')} - ${tagLabels}: ${VIRUDDHA_SEVERITY_META[pair.severity].label.toLowerCase()}. ${pair.classical}`,
      });
    }
  }

  findings.sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(b.severity) - SEVERITY_ORDER.indexOf(a.severity) ||
      (a.pairId < b.pairId ? -1 : a.pairId > b.pairId ? 1 : 0),
  );
  return findings;
}
