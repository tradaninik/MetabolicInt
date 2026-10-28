// P8 Day 4 — by-ingredients matching (the pure core behind
// /api/recipes/by-ingredients, the "cook with what I have" surface).
//
// Two jobs, both pure — no Prisma, no DB, no fetch, fully unit-testable:
//
//   1. parseByIngredientsQuery turns the route's search params into a plain
//      { have, mode, limit } object, with plain-language 400-style errors in
//      the repo's voice (same posture as catalog-filters.ts).
//   2. rankRecipesByIngredients takes the foodIds the user HAS plus catalog
//      candidates and ranks them by ingredient COVERAGE — how much of each
//      recipe the user can already make. A recipe the user cannot start
//      (zero shared ingredients) never appears; a recipe they can fully make
//      outranks one that needs a shop run.
//
// Sorting contract (deterministic, total):
//   1. coverage DESC (matched items / total items)
//   2. leftover mode only: leftover-friendly recipes first — cooking down
//      last night's rice or curd is the whole point of that mode, but never
//      ahead of a recipe the user can make MORE of
//   3. missingCount ASC (fewer things to buy wins ties)
//   4. name ASC (case-insensitive), then id ASC — stable across calls
//
// Matching is case-insensitive on foodId so a hand-typed "Curd" still hits
// the catalog's "curd". No nutrition is computed here — per-serving numbers
// stay pipeline-owned, exactly like every other read surface.

/** The two product modes of "cook with what I have". */
export type MatchMode = 'pantry' | 'leftover';

export const BY_INGREDIENTS_DEFAULTS = {
  limit: 20,
  maxLimit: 50,
  /** Distinct ingredients per query — a pantry longer than this is a shop. */
  maxIngredients: 30,
} as const;

/** One ingredient row of a candidate recipe (catalog shape, fields optional). */
export interface MatchItem {
  foodId: string;
  foodName?: string;
}

/** The minimum a candidate must expose for ranking (catalog rows qualify). */
export interface MatchCandidate {
  id: string;
  name: string;
  items: readonly MatchItem[];
  tags: readonly string[];
}

/** Per-recipe match outcome — everything the UI says aloud to the user. */
export interface MatchInfo {
  matchedCount: number;
  missingCount: number;
  totalCount: number;
  /** matched / total, 0..1 (recipes with no items are skipped, never 0/0). */
  coverage: number;
  matchedNames: string[];
  missingNames: string[];
  isLeftoverFriendly: boolean;
}

export type ByIngredientsQuery =
  | { ok: true; have: string[]; mode: MatchMode; limit: number }
  | { ok: false; error: string };

/** Validate /api/recipes/by-ingredients search params. First problem wins. */
export function parseByIngredientsQuery(searchParams: URLSearchParams): ByIngredientsQuery {
  // ing is a REPEATED param: ?ing=curd&ing=rice_sona_masoori. Empty values
  // (a cleared picker serializing to ing='') are skipped, not fatal.
  const raw = searchParams
    .getAll('ing')
    .map((v) => v.trim())
    .filter((v) => v !== '');

  // Dedupe case-insensitively but keep the first spelling the user sent.
  const seen = new Set<string>();
  const have: string[] = [];
  for (const v of raw) {
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    have.push(v);
  }

  if (have.length === 0) {
    return {
      ok: false,
      error:
        'Tell us at least one ingredient you have - repeat the ing parameter for each one, e.g. ?ing=curd&ing=onion.',
    };
  }
  if (have.length > BY_INGREDIENTS_DEFAULTS.maxIngredients) {
    return {
      ok: false,
      error: `Send at most ${BY_INGREDIENTS_DEFAULTS.maxIngredients} distinct ingredients.`,
    };
  }

  const modeParam = searchParams.get('mode');
  let mode: MatchMode = 'pantry';
  if (modeParam != null && modeParam !== '') {
    if (modeParam !== 'pantry' && modeParam !== 'leftover') {
      return { ok: false, error: 'Unknown mode. Use pantry or leftover.' };
    }
    mode = modeParam;
  }

  let limit: number = BY_INGREDIENTS_DEFAULTS.limit;
  const limitParam = searchParams.get('limit');
  if (limitParam != null && limitParam !== '') {
    const n = Number(limitParam);
    if (!Number.isInteger(n) || n < 1 || n > BY_INGREDIENTS_DEFAULTS.maxLimit) {
      return {
        ok: false,
        error: `limit must be a whole number between 1 and ${BY_INGREDIENTS_DEFAULTS.maxLimit}.`,
      };
    }
    limit = n;
  }

  return { ok: true, have, mode, limit };
}

const LEFTOVER_TAG = 'leftover-friendly';

/** Rank candidates by coverage. Total function: empty have -> empty result. */
export function rankRecipesByIngredients<T extends MatchCandidate>(
  have: readonly string[],
  candidates: readonly T[],
  mode: MatchMode = 'pantry',
): Array<{ candidate: T; match: MatchInfo }> {
  if (have.length === 0 || candidates.length === 0) return [];

  const haveSet = new Set(have.map((h) => h.toLowerCase()));

  const out: Array<{ candidate: T; match: MatchInfo }> = [];
  for (const c of candidates) {
    // Defensive: a corrupt row with no parsable items has nothing to match.
    if (!Array.isArray(c.items) || c.items.length === 0) continue;

    const matchedNames: string[] = [];
    const missingNames: string[] = [];
    for (const it of c.items) {
      if (typeof it?.foodId !== 'string' || it.foodId === '') continue;
      const label = it.foodName ?? it.foodId;
      if (haveSet.has(it.foodId.toLowerCase())) matchedNames.push(label);
      else missingNames.push(label);
    }

    // A recipe the user cannot start at all stays out of the results.
    if (matchedNames.length === 0) continue;

    const totalCount = c.items.length;
    out.push({
      candidate: c,
      match: {
        matchedCount: matchedNames.length,
        missingCount: missingNames.length,
        totalCount,
        coverage: matchedNames.length / totalCount,
        matchedNames,
        missingNames,
        isLeftoverFriendly: Array.isArray(c.tags) && c.tags.includes(LEFTOVER_TAG),
      },
    });
  }

  out.sort((a, b) => {
    if (a.match.coverage !== b.match.coverage) return b.match.coverage - a.match.coverage;
    if (mode === 'leftover' && a.match.isLeftoverFriendly !== b.match.isLeftoverFriendly) {
      return a.match.isLeftoverFriendly ? -1 : 1;
    }
    if (a.match.missingCount !== b.match.missingCount) return a.match.missingCount - b.match.missingCount;
    const an = a.candidate.name.toLowerCase();
    const bn = b.candidate.name.toLowerCase();
    if (an !== bn) return an < bn ? -1 : 1;
    return a.candidate.id < b.candidate.id ? -1 : a.candidate.id > b.candidate.id ? 1 : 0;
  });

  return out;
}
