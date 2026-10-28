// P8 Day 4 — by-ingredients matching unit tests (the pure core behind
// /api/recipes/by-ingredients). Parser: defaults, repeated ing params,
// dedupe, whitespace, caps, every invalid mode/limit with plain-language
// errors. Ranking: coverage ordering, zero-match exclusion, missing-item
// honesty, leftover-mode boost (never above coverage), deterministic ties.

import { describe, it, expect } from 'vitest';
import {
  parseByIngredientsQuery,
  rankRecipesByIngredients,
  BY_INGREDIENTS_DEFAULTS,
  type MatchCandidate,
} from '../recipe-match';

function parse(params: Record<string, string | string[]> = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    for (const one of Array.isArray(v) ? v : [v]) sp.append(k, one);
  }
  return parseByIngredientsQuery(sp);
}

/** Small candidate factory - catalog-shaped, no DB. */
function cand(
  id: string,
  name: string,
  foodIds: string[],
  tags: string[] = [],
): MatchCandidate {
  return {
    id,
    name,
    tags,
    items: foodIds.map((foodId) => ({ foodId, foodName: foodId.replace(/_/g, ' ') })),
  };
}

describe('parseByIngredientsQuery — defaults', () => {
  it('one ing -> pantry mode, default limit 20', () => {
    expect(parse({ ing: 'curd' })).toEqual({
      ok: true,
      have: ['curd'],
      mode: 'pantry',
      limit: BY_INGREDIENTS_DEFAULTS.limit,
    });
  });

  it('shares the route defaults (limit 20, max 50, max 30 ingredients)', () => {
    expect(BY_INGREDIENTS_DEFAULTS).toEqual({ limit: 20, maxLimit: 50, maxIngredients: 30 });
  });

  it('empty-string ing values are skipped, not fatal', () => {
    expect(parse({ ing: ['', '  ', 'onion'] })).toEqual({
      ok: true,
      have: ['onion'],
      mode: 'pantry',
      limit: 20,
    });
  });
});

describe('parseByIngredientsQuery — the ing list', () => {
  it('collects repeated ing params in order', () => {
    const r = parse({ ing: ['curd', 'onion', 'rice_sona_masoori'] });
    expect(r.ok && r.have).toEqual(['curd', 'onion', 'rice_sona_masoori']);
  });

  it('trims whitespace around each value', () => {
    const r = parse({ ing: ['  curd  ', 'onion'] });
    expect(r.ok && r.have).toEqual(['curd', 'onion']);
  });

  it('dedupes case-insensitively, keeping the first spelling', () => {
    const r = parse({ ing: ['Curd', 'curd', 'CURD'] });
    expect(r.ok && r.have).toEqual(['Curd']);
  });

  it('no ing at all -> plain-language error', () => {
    const r = parse({});
    expect(!r.ok && /ingredient/i.test(r.error)).toBe(true);
  });

  it('only-empty ing values -> same error as absent', () => {
    const r = parse({ ing: ['', '   '] });
    expect(r.ok).toBe(false);
  });

  it('more than 30 distinct ingredients -> error naming the cap', () => {
    const many = Array.from({ length: 31 }, (_, i) => `ing_${i}`);
    const r = parse({ ing: many });
    expect(!r.ok && /at most 30/i.test(r.error)).toBe(true);
  });

  it('exactly 30 distinct ingredients pass', () => {
    const thirty = Array.from({ length: 30 }, (_, i) => `ing_${i}`);
    const r = parse({ ing: thirty });
    expect(r.ok && r.have.length).toBe(30);
  });
});

describe('parseByIngredientsQuery — mode and limit', () => {
  it('mode=leftover is accepted', () => {
    const r = parse({ ing: 'curd', mode: 'leftover' });
    expect(r.ok && r.mode).toBe('leftover');
  });

  it('mode=pantry is accepted explicitly', () => {
    const r = parse({ ing: 'curd', mode: 'pantry' });
    expect(r.ok && r.mode).toBe('pantry');
  });

  it('unknown mode -> error naming both valid values', () => {
    const r = parse({ ing: 'curd', mode: 'fridge' });
    expect(!r.ok && /pantry or leftover/i.test(r.error)).toBe(true);
  });

  it('empty mode string -> default pantry (cleared UI toggle)', () => {
    const r = parse({ ing: 'curd', mode: '' });
    expect(r.ok && r.mode).toBe('pantry');
  });

  it('limit boundary values 1 and 50 pass; 0, 51, -1, 2.5, text fail', () => {
    expect(parse({ ing: 'curd', limit: '1' }).ok).toBe(true);
    expect(parse({ ing: 'curd', limit: '50' }).ok).toBe(true);
    for (const bad of ['0', '51', '-1', '2.5', 'many']) {
      const r = parse({ ing: 'curd', limit: bad });
      expect(!r.ok && /whole number between 1 and 50/i.test(r.error)).toBe(true);
    }
  });
});

describe('rankRecipesByIngredients — coverage ranking', () => {
  const full = cand('r-full', 'Full Pantry Dosa', ['curd', 'onion', 'rice_flour']);
  const partial = cand('r-part', 'Partial Dosa', ['curd', 'onion', 'rice_flour', 'ghee', 'chilli']);

  it('higher coverage ranks first', () => {
    const out = rankRecipesByIngredients(['curd', 'onion', 'rice_flour'], [partial, full]);
    expect(out.map((o) => o.candidate.id)).toEqual(['r-full', 'r-part']);
  });

  it('coverage is matched/total with exact fractions', () => {
    const out = rankRecipesByIngredients(['curd', 'onion', 'rice_flour'], [partial]);
    expect(out[0].match.coverage).toBe(3 / 5);
    expect(out[0].match.totalCount).toBe(5);
  });

  it('zero-match recipes are excluded entirely', () => {
    const alien = cand('r-alien', 'Alien Recipe', ['paneer', 'cream']);
    const out = rankRecipesByIngredients(['curd'], [alien, partial]);
    expect(out.map((o) => o.candidate.id)).toEqual(['r-part']);
  });

  it('matching is case-insensitive on foodId', () => {
    const out = rankRecipesByIngredients(['CURD'], [full]);
    expect(out.length).toBe(1);
    expect(out[0].match.matchedCount).toBe(1);
  });

  it('empty have -> empty result (total function)', () => {
    expect(rankRecipesByIngredients([], [full, partial])).toEqual([]);
  });

  it('candidates without items are skipped defensively', () => {
    const broken = { id: 'r-broken', name: 'Broken', items: [], tags: [] } satisfies MatchCandidate;
    expect(rankRecipesByIngredients(['curd'], [broken])).toEqual([]);
  });
});

describe('rankRecipesByIngredients — match info honesty', () => {
  it('missingNames and matchedNames use foodName, falling back to foodId', () => {
    const c: MatchCandidate = {
      id: 'r1',
      name: 'Mixed labels',
      tags: [],
      items: [
        { foodId: 'curd', foodName: 'Curd' },
        { foodId: 'unknown_id' }, // no foodName -> id is the label
      ],
    };
    const out = rankRecipesByIngredients(['curd'], [c]);
    expect(out[0].match.matchedNames).toEqual(['Curd']);
    expect(out[0].match.missingNames).toEqual(['unknown_id']);
    expect(out[0].match.missingCount).toBe(1);
  });

  it('isLeftoverFriendly is true only when the tag is present', () => {
    const tagged = cand('r-tag', 'Tagged', ['curd'], ['leftover-friendly']);
    const untagged = cand('r-untag', 'Untagged', ['curd'], ['quick']);
    const out = rankRecipesByIngredients(['curd'], [tagged, untagged]);
    expect(out[0].match.isLeftoverFriendly).toBe(true);
    expect(out[1].match.isLeftoverFriendly).toBe(false);
  });
});

describe('rankRecipesByIngredients — tie-breaking', () => {
  it('equal coverage: fewer missing items first (smaller shop run)', () => {
    // 3/4 = 0.75 vs 6/8 = 0.75 -> the 3/4 needs only 1 more ingredient.
    const small = cand('r-small', 'Small Recipe', ['a', 'b', 'c', 'd']);
    const big = cand('r-big', 'Big Recipe', ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    const out = rankRecipesByIngredients(['a', 'b', 'c'], [big, small]);
    expect(out.map((o) => o.candidate.id)).toEqual(['r-small', 'r-big']);
  });

  it('equal coverage and missing: name ASC (case-insensitive)', () => {
    const b = cand('r-b', 'Banana Dosa', ['a', 'b']);
    const a = cand('r-a', 'apple Dosa', ['a', 'b']);
    const out = rankRecipesByIngredients(['a'], [b, a]);
    expect(out.map((o) => o.candidate.id)).toEqual(['r-a', 'r-b']);
  });

  it('full tie: id ASC keeps the order deterministic', () => {
    const x1 = cand('id-2', 'Same Name', ['a']);
    const x2 = cand('id-1', 'Same Name', ['a']);
    const out = rankRecipesByIngredients(['a'], [x1, x2]);
    expect(out.map((o) => o.candidate.id)).toEqual(['id-1', 'id-2']);
  });
});

describe('rankRecipesByIngredients — leftover mode', () => {
  const friendly = cand('r-lo', 'Leftover Curd Rice', ['curd', 'rice'], ['leftover-friendly']);
  const plain = cand('r-plain', 'Plain Curd Rice', ['curd', 'rice']);

  it('leftover mode puts leftover-friendly first at equal coverage', () => {
    const out = rankRecipesByIngredients(['curd', 'rice'], [plain, friendly], 'leftover');
    expect(out.map((o) => o.candidate.id)).toEqual(['r-lo', 'r-plain']);
  });

  it('pantry mode leaves that boost off', () => {
    const out = rankRecipesByIngredients(['curd', 'rice'], [friendly, plain], 'pantry');
    // Equal coverage + missing -> name ASC: "Leftover Curd Rice" < "Plain..."
    expect(out.map((o) => o.candidate.id)).toEqual(['r-lo', 'r-plain']);
    // So prove the boost is off with a name ordering that flips only under it.
    const friendlyZ = cand('r-loz', 'Zebra Leftover Rice', ['curd', 'rice'], ['leftover-friendly']);
    const plainA = cand('r-plaina', 'Aloo Curd Rice', ['curd', 'rice']);
    const pantryOrder = rankRecipesByIngredients(['curd', 'rice'], [friendlyZ, plainA], 'pantry');
    const leftoverOrder = rankRecipesByIngredients(['curd', 'rice'], [friendlyZ, plainA], 'leftover');
    expect(pantryOrder.map((o) => o.candidate.id)).toEqual(['r-plaina', 'r-loz']);
    expect(leftoverOrder.map((o) => o.candidate.id)).toEqual(['r-loz', 'r-plaina']);
  });

  it('the boost never outranks higher coverage', () => {
    // friendly 2/3 vs plain 2/2 -> coverage wins in leftover mode too.
    const half = cand('r-half', 'Half Leftover Dish', ['curd', 'cream', 'saffron'], [
      'leftover-friendly',
    ]);
    const whole = cand('r-whole', 'Whole Pantry Dish', ['curd', 'cream']);
    const out = rankRecipesByIngredients(['curd', 'cream'], [half, whole], 'leftover');
    expect(out.map((o) => o.candidate.id)).toEqual(['r-whole', 'r-half']);
  });
});
