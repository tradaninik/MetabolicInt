import { describe, it, expect } from 'vitest';
import {
  VIRUDDHA_PAIRS,
  VIRUDDHA_TAG_META,
  VIRUDDHA_SEVERITY_META,
  VIRUDDHA_DISCLAIMER,
  SEVERITY_ORDER,
  validateViruddhaPair,
  checkViruddha,
  type ViruddhaCheckItem,
  type ViruddhaPair,
  type ViruddhaTag,
} from './viruddha';

const FORBIDDEN = /\b(cure|curative|treat(?:s|ed|ment)?|revers(?:e|es|ed|ing|al)?)\b/i;

function item(key: string, label: string, tags: ViruddhaTag[]): ViruddhaCheckItem {
  return { key, label, tags };
}

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectStrings);
  return [];
}

describe('pair-table integrity', () => {
  it('ships the curated table with rows present', () => {
    expect(VIRUDDHA_PAIRS.length).toBeGreaterThanOrEqual(8);
  });

  it('every row passes the editorial validator', () => {
    for (const pair of VIRUDDHA_PAIRS) {
      expect(validateViruddhaPair(pair), `problems on ${pair.id}`).toEqual([]);
    }
  });

  it('has unique kebab-case ids', () => {
    const ids = VIRUDDHA_PAIRS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('uses 1-3 valid, non-repeating tags per row', () => {
    for (const pair of VIRUDDHA_PAIRS) {
      expect(pair.tags.length, pair.id).toBeGreaterThanOrEqual(1);
      expect(pair.tags.length, pair.id).toBeLessThanOrEqual(3);
      expect(new Set(pair.tags).size, pair.id).toBe(pair.tags.length);
      for (const t of pair.tags) {
        expect(Object.keys(VIRUDDHA_TAG_META), `${pair.id}: ${t}`).toContain(t);
      }
    }
  });

  it('the flagship rows ship with their spec-listed severities', () => {
    const byId: Record<string, ViruddhaPair> = Object.fromEntries(
      VIRUDDHA_PAIRS.map((p) => [p.id, p]),
    );
    expect(byId['milk-fish']?.severity).toBe('avoid');
    expect(byId['milk-sour-fruit']?.severity).toBe('caution');
    expect(byId['ghee-honey-equal']?.tags).toEqual(['ghee', 'honey']);
    expect(byId['heated-honey']?.tags).toEqual(['honey']);
  });

  it('every row carries BOTH a classical rationale and a modern note', () => {
    for (const pair of VIRUDDHA_PAIRS) {
      expect(pair.classical.length, pair.id).toBeGreaterThanOrEqual(25);
      expect(pair.modern.length, pair.id).toBeGreaterThanOrEqual(25);
    }
  });

  it('uses no cure/treatment/reverse language anywhere in the table or meta', () => {
    for (const pair of VIRUDDHA_PAIRS) {
      for (const s of collectStrings(pair)) {
        expect(s.match(FORBIDDEN), `${pair.id}: "${s}"`).toBeNull();
      }
    }
    for (const s of collectStrings(VIRUDDHA_TAG_META).concat(collectStrings(VIRUDDHA_SEVERITY_META))) {
      expect(s.match(FORBIDDEN), `"${s}"`).toBeNull();
    }
    expect(VIRUDDHA_DISCLAIMER.match(FORBIDDEN)).toBeNull();
  });

  it('the modern notes stay honest: danger language only ever appears negated', () => {
    // The trust policy: modern notes downgrade tradition rather than alarm. Phrases
    // like "acute danger" may appear ONLY to negate them ("not acute danger").
    for (const pair of VIRUDDHA_PAIRS) {
      const phrases = pair.modern.match(/acute (?:danger|toxicity|poisoning)/gi) ?? [];
      for (const phrase of phrases) {
        const idx = pair.modern.indexOf(phrase);
        const before = pair.modern.slice(Math.max(0, idx - 12), idx).toLowerCase().trim();
        expect(before.endsWith('not'), `${pair.id}: "${phrase}" must be negated`).toBe(true);
      }
      // Affirmative alarm phrasing is banned outright.
      expect(pair.modern.match(/(?:is|are|can be) (?:acutely )?(?:dangerous|toxic|poisonous)/i), pair.id).toBeNull();
    }
  });

  it('severity meta covers exactly the three steps in order', () => {
    expect(SEVERITY_ORDER).toEqual(['info', 'caution', 'avoid']);
    for (const s of SEVERITY_ORDER) {
      expect(VIRUDDHA_SEVERITY_META[s].label.length).toBeGreaterThan(3);
      expect(VIRUDDHA_SEVERITY_META[s].note.length).toBeGreaterThan(20);
    }
  });

  it('tag meta covers exactly the nine food classes', () => {
    expect(Object.keys(VIRUDDHA_TAG_META).sort()).toEqual(
      ['banana', 'curd', 'fish', 'garlic', 'ghee', 'honey', 'milk', 'radish', 'sourFruit'],
    );
    for (const meta of Object.values(VIRUDDHA_TAG_META)) {
      expect(meta.label.length).toBeGreaterThan(2);
      expect(meta.hint.length).toBeGreaterThan(10);
    }
  });

  it('the disclaimer is present and substantive', () => {
    expect(VIRUDDHA_DISCLAIMER.length).toBeGreaterThan(200);
    expect(VIRUDDHA_DISCLAIMER).toContain('not a food-safety warning');
  });
});

describe('validateViruddhaPair (editorial validator)', () => {
  const good: ViruddhaPair = {
    id: 'test-pair',
    tags: ['milk', 'fish'],
    severity: 'caution',
    classical: 'A classical rationale comfortably longer than the minimum.',
    modern: 'A modern note comfortably longer than the minimum length.',
  };

  it('accepts a well-formed row', () => {
    expect(validateViruddhaPair(good)).toEqual([]);
  });

  it('rejects a bad id, unknown tags, repeating tags and bad severity', () => {
    expect(validateViruddhaPair({ ...good, id: 'Not Kebab' })).toContain('id must be kebab-case');
    expect(validateViruddhaPair({ ...good, tags: ['milk', 'cheese'] as ViruddhaTag[] })).toContain(
      'unknown food class: cheese',
    );
    expect(validateViruddhaPair({ ...good, tags: ['milk', 'milk'] })).toContain(
      'tags must not repeat within a row',
    );
    expect(validateViruddhaPair({ ...good, severity: 'danger' as never })).toContain(
      'severity must be info, caution or avoid (got danger)',
    );
  });

  it('rejects empty, four-tag, and too-short rationale rows', () => {
    expect(validateViruddhaPair({ ...good, tags: [] })).toContain('tags must list 1 to 3 food classes');
    expect(
      validateViruddhaPair({ ...good, tags: ['milk', 'fish', 'curd', 'ghee'] }),
    ).toContain('tags must list 1 to 3 food classes');
    expect(validateViruddhaPair({ ...good, classical: 'too short' })).toContain(
      'classical rationale is required (min 25 chars)',
    );
    expect(validateViruddhaPair({ ...good, modern: 'too short' })).toContain(
      'modern note is required (min 25 chars)',
    );
  });
});

describe('checkViruddha - firing rules', () => {
  it('a known pair triggers a finding carrying BOTH lenses', () => {
    const out = checkViruddha([item('k', 'Kheer', ['milk']), item('f', 'Amritsari Fish', ['fish'])]);
    expect(out.length).toBe(1);
    expect(out[0].pairId).toBe('milk-fish');
    expect(out[0].severity).toBe('avoid');
    expect(out[0].classical).toBe(VIRUDDHA_PAIRS.find((p) => p.id === 'milk-fish')!.classical);
    expect(out[0].modern).toBe(VIRUDDHA_PAIRS.find((p) => p.id === 'milk-fish')!.modern);
    expect(out[0].items.map((i) => i.label)).toEqual(['Kheer', 'Amritsari Fish']);
  });

  it('a clean combo shows nothing', () => {
    expect(
      checkViruddha([
        item('chapati', 'Chapati', []),
        item('dal', 'Dal', []),
        item('sabzi', 'Sabzi', []),
      ]),
    ).toEqual([]);
  });

  it('a partial pair does not fire', () => {
    // Milk present, no fish: the milk-fish row must stay silent.
    const out = checkViruddha([
      item('kheer', 'Kheer', ['milk']),
      item('curd', 'Curd Rice', ['curd']),
    ]);
    expect(out.find((f) => f.pairId === 'milk-fish')).toBeUndefined();
  });

  it('a single-tag context row fires on its lone tag', () => {
    const out = checkViruddha([item('h', 'Honey', ['honey'])]);
    expect(out.map((f) => f.pairId)).toEqual(['heated-honey']);
    expect(out[0].severity).toBe('info');
    expect(out[0].items).toEqual([{ key: 'h', label: 'Honey' }]);
  });

  it('ghee + honey fires the equal-parts caution', () => {
    const out = checkViruddha([item('g', 'Ghee', ['ghee']), item('h', 'Honey', ['honey'])]);
    expect(out.map((f) => f.pairId)).toContain('ghee-honey-equal');
  });

  it('honey alone does NOT fire the ghee-honey pair (partial)', () => {
    const out = checkViruddha([item('h', 'Honey', ['honey']), item('m', 'Milk', ['milk'])]);
    expect(out.map((f) => f.pairId)).toEqual(['heated-honey']);
  });

  it('one item carrying both classes fires the pair on its own', () => {
    const out = checkViruddha([item('one', 'Fish in milk gravy', ['milk', 'fish'])]);
    expect(out.map((f) => f.pairId)).toEqual(['milk-fish']);
    expect(out[0].items).toEqual([{ key: 'one', label: 'Fish in milk gravy' }]);
  });

  it('a triple-tag row fires only when all three classes co-occur', () => {
    // Synthetic triple row injected via the exported table shape - proves the
    // machinery supports the spec's pair/triple table even though the shipped
    // data uses pairs plus one context row.
    const saved = VIRUDDHA_PAIRS.slice();
    const triple: ViruddhaPair = {
      id: 'test-triple',
      tags: ['milk', 'banana', 'sourFruit'],
      severity: 'info',
      classical: 'A classical rationale comfortably longer than the minimum.',
      modern: 'A modern note comfortably longer than the minimum length.',
    };
    (VIRUDDHA_PAIRS as ViruddhaPair[]).push(triple);
    try {
      const two = checkViruddha([
        item('m', 'Milk', ['milk']),
        item('b', 'Banana', ['banana']),
      ]);
      expect(two.find((f) => f.pairId === 'test-triple')).toBeUndefined();
      const three = checkViruddha([
        item('m', 'Milk', ['milk']),
        item('b', 'Banana', ['banana']),
        item('o', 'Orange', ['sourFruit']),
      ]);
      expect(three.find((f) => f.pairId === 'test-triple')?.items.map((i) => i.label)).toEqual([
        'Milk',
        'Banana',
        'Orange',
      ]);
    } finally {
      (VIRUDDHA_PAIRS as ViruddhaPair[]).splice(saved.length, VIRUDDHA_PAIRS.length - saved.length);
    }
    expect(VIRUDDHA_PAIRS.length).toBe(saved.length);
  });
});

describe('checkViruddha - dedup and ordering', () => {
  it('dedups by pair: one finding per row however many items match', () => {
    const out = checkViruddha([
      item('k1', 'Kheer', ['milk']),
      item('k2', 'Payesh', ['milk']),
      item('f1', 'Fish Moilee', ['fish']),
      item('f2', 'Macher Jhol', ['fish']),
    ]);
    const milkFish = out.filter((f) => f.pairId === 'milk-fish');
    expect(milkFish.length).toBe(1);
    // involved items list every carrier, in input order.
    expect(milkFish[0].items.map((i) => i.label)).toEqual(['Kheer', 'Payesh', 'Fish Moilee', 'Macher Jhol']);
  });

  it('dedups items by key: the same food twice counts once', () => {
    const out = checkViruddha([
      item('f', 'Fish Curry', ['fish']),
      item('f', 'Fish Curry', ['fish']),
      item('m', 'Milk', ['milk']),
    ]);
    expect(out.find((f) => f.pairId === 'milk-fish')?.items.map((i) => i.label)).toEqual([
      'Fish Curry',
      'Milk',
    ]);
  });

  it('orders findings avoid > caution > info, then by pair id', () => {
    const out = checkViruddha([
      item('m', 'Milk', ['milk']),
      item('f', 'Fish', ['fish']),
      item('o', 'Orange', ['sourFruit']),
      item('h', 'Honey', ['honey']),
      item('b', 'Banana', ['banana']),
      item('c', 'Curd Rice', ['curd']),
    ]);
    // Firing rows: milk-fish (avoid), milk-sour-fruit (caution), and the three
    // info rows: curd-fish, heated-honey, milk-banana.
    expect(out.length).toBe(5);
    expect(out.map((f) => f.severity)).toEqual(['avoid', 'caution', 'info', 'info', 'info']);
    expect(out[1].pairId).toBe('milk-sour-fruit');
    // Within equal severity the order is pair id ascending: curd-fish < heated-honey < milk-banana.
    expect(out.slice(2).map((f) => f.pairId)).toEqual(['curd-fish', 'heated-honey', 'milk-banana']);
  });

  it('is order-stable at the finding-set level: same items in any order fire the same rows', () => {
    const items: ViruddhaCheckItem[] = [
      item('m', 'Milk', ['milk']),
      item('f', 'Fish', ['fish']),
      item('r', 'Mooli', ['radish']),
      item('g', 'Ghee', ['ghee']),
      item('h', 'Honey', ['honey']),
    ];
    const forward = checkViruddha(items).map((f) => f.pairId).sort();
    const reverse = checkViruddha([...items].reverse()).map((f) => f.pairId).sort();
    expect(reverse).toEqual(forward);
    expect(forward).toContain('milk-fish');
    expect(forward).toContain('ghee-honey-equal');
    expect(forward).toContain('heated-honey');
    expect(forward).toContain('milk-radish');
  });
});

describe('checkViruddha - input tolerance', () => {
  it('returns [] for null, undefined and non-array input', () => {
    expect(checkViruddha(null)).toEqual([]);
    expect(checkViruddha(undefined)).toEqual([]);
    expect(checkViruddha('milk' as never)).toEqual([]);
  });

  it('skips malformed items and filters unknown tags', () => {
    const out = checkViruddha([
      null as never,
      { key: '', label: 'no key', tags: ['milk'] },
      { key: 'm', label: 'Milk', tags: ['milk', 'cheese' as ViruddhaTag] },
      { key: 'f', label: 'Fish', tags: ['fish'] },
      'junk' as never,
    ]);
    expect(out.map((f) => f.pairId)).toEqual(['milk-fish']);
  });

  it('falls back to the key as label when the label is missing', () => {
    const out = checkViruddha([
      { key: 'm', label: '', tags: ['milk'] },
      { key: 'f', label: 'Fish', tags: ['fish'] },
    ]);
    expect(out[0].items[0].label).toBe('m');
  });

  it('items without tags never fire anything', () => {
    expect(checkViruddha([item('a', 'Apple', []), item('b', 'Oats', undefined as never)])).toEqual([]);
  });

  it('the summary line names the items and the pair severity', () => {
    const out = checkViruddha([item('m', 'Milk', ['milk']), item('f', 'Fish Curry', ['fish'])]);
    expect(out[0].summary).toContain('Milk + Fish Curry');
    expect(out[0].summary).toContain('classically incompatible');
  });
});
