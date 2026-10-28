'use client';

// P8 Day 4 — CookWithWhatIHave: the "what can I make with what I have"
// surface on /recipes. The user picks the ingredients they have (the same
// raw-building-block picker the recipe editor uses - GET /api/foods with
// ingredients=1), chooses Pantry or Leftover night, and GET
// /api/recipes/by-ingredients ranks the 300-recipe catalog by COVERAGE:
// "you have 6 of 8 - need mustard seeds and curry leaves".
//
// Honest by construction: unrecognized hand-typed values come back in
// 'unknown' and are said aloud; recipes sharing zero ingredients never
// appear; every number on a card is the seed pipeline's per-serving math,
// never recomputed. Plain copy, no medical claims.
//
// Saving works exactly like the catalog browser: POST /api/recipes/from-catalog
// (idempotent - 201 fresh / 200 already saved).
import { useCallback, useEffect, useRef, useState } from 'react';

type PickerFood = {
  id: string;
  name: string;
  aliases?: string[];
};

type MatchInfoClient = {
  matchedCount: number;
  missingCount: number;
  totalCount: number;
  coverage: number;
  matchedNames: string[];
  missingNames: string[];
  isLeftoverFriendly: boolean;
};

type MatchRecipeClient = {
  id: string;
  name: string;
  nameTe: string | null;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'drink' | 'side';
  cuisine: 'telugu' | 'hyderabadi' | 'south-indian' | 'north-indian' | 'pan-indian';
  servings: number;
  prepMinutes: number;
  steps: string[];
  tags: string[];
  notes: string | null;
  kcal: number;
  carbsG: number;
  netCarbsG: number;
  proteinG: number;
  fatG: number;
  fiberG: number;
  gi: number;
  carbTier: 'LOW' | 'MODERATE' | 'HIGHER';
  items: { foodId: string; foodName: string; grams: number }[];
  match: MatchInfoClient;
};

type MatchMode = 'pantry' | 'leftover';

const MEAL_CARD_LABELS: Record<MatchRecipeClient['mealType'], string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
  drink: 'Drink',
  side: 'Side',
};

const CUISINE_LABELS: Record<MatchRecipeClient['cuisine'], string> = {
  telugu: 'Telugu',
  hyderabadi: 'Hyderabadi',
  'south-indian': 'South Indian',
  'north-indian': 'North Indian',
  'pan-indian': 'Pan-Indian',
};

const TIER_BADGE_LABELS: Record<MatchRecipeClient['carbTier'], string> = {
  LOW: 'Low carb',
  MODERATE: 'Moderate',
  HIGHER: 'Higher carb',
};

const TIER_BADGE: Record<MatchRecipeClient['carbTier'], string> = {
  LOW: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  MODERATE: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  HIGHER: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300',
};

const TIER_TEXT: Record<MatchRecipeClient['carbTier'], string> = {
  LOW: 'text-emerald-600 dark:text-emerald-400',
  MODERATE: 'text-amber-600 dark:text-amber-400',
  HIGHER: 'text-red-600 dark:text-red-400',
};

const TAG_LABELS: Record<string, string> = {
  'high-fiber': 'High fiber',
  'high-protein': 'High protein',
  'low-gi': 'Low GI',
  quick: 'Quick ≤20m',
  'one-pot': 'One-pot',
  'no-cook': 'No-cook',
  'leftover-friendly': 'Leftover-friendly',
  budget: 'Budget',
  festive: 'Festive',
  'iron-rich': 'Iron-rich',
  'calcium-rich': 'Calcium-rich',
  vegan: 'Vegan',
};

const fmt = (n: number) => String(Math.round(n * 10) / 10);

export default function CookWithWhatIHave() {
  // Picker state: query, suggestions, picked ids.
  const [pickInput, setPickInput] = useState('');
  const [suggestions, setSuggestions] = useState<PickerFood[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [picked, setPicked] = useState<PickerFood[]>([]); // id + display name

  const [mode, setMode] = useState<MatchMode>('pantry');

  // Results.
  const [matches, setMatches] = useState<MatchRecipeClient[] | null>(null);
  const [unknown, setUnknown] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [banner, setBanner] = useState('');
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [savedIds, setSavedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [savingIds, setSavingIds] = useState<ReadonlySet<string>>(() => new Set());

  // Drop stale picker responses.
  const suggestReq = useRef(0);

  // ~300ms debounce on the picker search (recipes-page pattern).
  useEffect(() => {
    const q = pickInput.trim();
    if (q.length < 2) {
      setSuggestOpen(false);
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      const id = ++suggestReq.current;
      try {
        const res = await fetch(`/api/foods?ingredients=1&limit=12&q=${encodeURIComponent(q)}`);
        if (id !== suggestReq.current) return;
        if (!res.ok) return; // picker stays usable; the Find button surfaces errors
        const data = await res.json().catch(() => ({}));
        const foods: PickerFood[] = Array.isArray(data.foods) ? data.foods : [];
        setSuggestions(foods);
        setSuggestOpen(foods.length > 0);
      } catch {
        /* network hiccup: keep the list closed, user can retry */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [pickInput]);

  // The action toast self-dismisses (labs-page pattern).
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const addPick = (f: PickerFood) => {
    setPicked((prev) => (prev.some((p) => p.id === f.id) ? prev : [...prev, f]));
    setPickInput('');
    setSuggestOpen(false);
    setSuggestions([]);
  };

  const removePick = (id: string) => {
    setPicked((prev) => prev.filter((p) => p.id !== id));
  };

  const findRecipes = useCallback(async () => {
    if (picked.length === 0) return;
    setSearching(true);
    setBanner('');
    const params = new URLSearchParams();
    for (const p of picked) params.append('ing', p.id);
    params.set('mode', mode);
    try {
      const res = await fetch(`/api/recipes/by-ingredients?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner(
          res.status === 401
            ? 'Please log in to find recipes from your ingredients.'
            : typeof data.error === 'string'
              ? data.error
              : 'Could not match recipes right now.',
        );
        setMatches(null);
        setUnknown([]);
        return;
      }
      setMatches(Array.isArray(data.matches) ? data.matches : []);
      setUnknown(Array.isArray(data.unknown) ? data.unknown : []);
    } catch {
      setBanner('Could not match recipes - check your connection and try again.');
      setMatches(null);
      setUnknown([]);
    } finally {
      setSearching(false);
    }
  }, [picked, mode]);

  // POST /api/recipes/from-catalog: 201 fresh / 200 already saved / 404 error.
  const saveToMyRecipes = useCallback(async (r: MatchRecipeClient) => {
    setSavingIds((s) => new Set(s).add(r.id));
    try {
      const res = await fetch('/api/recipes/from-catalog', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ catalogId: r.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSavedIds((s) => new Set(s).add(r.id));
        setToast(
          data.existing === true
            ? { kind: 'ok', text: `"${r.name}" is already in your recipes - log it from My Foods.` }
            : { kind: 'ok', text: `Saved "${r.name}" to your recipes - log it from My Foods.` },
        );
      } else {
        setToast({
          kind: 'err',
          text:
            res.status === 401
              ? 'Please log in to save recipes.'
              : typeof data.error === 'string'
                ? data.error
                : 'Could not save this recipe.',
        });
      }
    } catch {
      setToast({ kind: 'err', text: 'Could not save this recipe - check your connection and try again.' });
    } finally {
      setSavingIds((s) => {
        const next = new Set(s);
        next.delete(r.id);
        return next;
      });
    }
  }, []);

  const pickedIds = new Set(picked.map((p) => p.id));

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight">Cook with what I have</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Tell us what is in your kitchen - we rank the catalog by how much of each recipe you can
        already make. Numbers are per serving, diabetic-friendly by design.
      </p>

      {toast && (
        <p
          role={toast.kind === 'err' ? 'alert' : 'status'}
          className={`mt-4 rounded-lg border p-3 text-sm ${
            toast.kind === 'err'
              ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
              : 'border-brand-300 bg-brand-50 text-brand-800 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-200'
          }`}
        >
          {toast.text}
        </p>
      )}

      {/* ---------- Pantry picker ---------- */}
      <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="relative">
          <input
            type="search"
            value={pickInput}
            onChange={(e) => setPickInput(e.target.value)}
            onFocus={() => setSuggestOpen(suggestions.length > 0)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSuggestOpen(false);
            }}
            placeholder="Add an ingredient - rice, curd, onion, poha..."
            aria-label="Search for an ingredient you have"
            aria-expanded={suggestOpen}
            aria-controls="ingredient-suggestions"
            role="combobox"
            autoComplete="off"
            className="w-full rounded-lg border border-neutral-300 bg-transparent px-4 py-2 text-sm outline-none focus:border-brand-500 dark:border-neutral-700"
          />
          {suggestOpen && suggestions.length > 0 && (
            <ul
              id="ingredient-suggestions"
              role="listbox"
              aria-label="Ingredient suggestions"
              className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-950"
            >
              {suggestions.map((f) => {
                const already = pickedIds.has(f.id);
                return (
                  <li key={f.id} role="option" aria-selected={already}>
                    <button
                      type="button"
                      onClick={() => addPick(f)}
                      disabled={already}
                      className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm ${
                        already
                          ? 'cursor-default text-neutral-400'
                          : 'text-neutral-700 hover:bg-brand-50 dark:text-neutral-300 dark:hover:bg-neutral-900'
                      }`}
                    >
                      <span>{f.name}</span>
                      {already && <span className="text-xs">added</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {picked.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {picked.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => removePick(p.id)}
                aria-label={`Remove ${p.name}`}
                className="rounded-full border border-brand-300 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 hover:border-brand-400 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300"
              >
                {p.name} ✕
              </button>
            ))}
          </div>
        )}

        {/* Mode: pantry cooking vs leftover night. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-neutral-500">Mode</span>
          {(
            [
              { value: 'pantry', label: 'Pantry cooking' },
              { value: 'leftover', label: 'Leftover night' },
            ] as const
          ).map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              aria-pressed={mode === m.value}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
                mode === m.value
                  ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-950/40 dark:text-brand-300'
                  : 'border-neutral-200 text-neutral-600 hover:border-brand-300 dark:border-neutral-800 dark:text-neutral-400'
              }`}
            >
              {m.label}
            </button>
          ))}
          {mode === 'leftover' && (
            <span className="text-xs text-neutral-400">
              Leftover-friendly plates move up when coverage ties.
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={findRecipes}
          disabled={picked.length === 0 || searching}
          className="mt-4 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60 sm:w-auto"
        >
          {searching ? 'Finding recipes...' : `Find recipes (${picked.length} ingredient${picked.length === 1 ? '' : 's'})`}
        </button>
      </div>

      {banner && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        >
          {banner}
        </p>
      )}

      {unknown.length > 0 && matches != null && (
        <p className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-400">
          We did not recognize: {unknown.join(', ')}. Try picking from the suggestions so matches are
          exact.
        </p>
      )}

      {/* ---------- Results ---------- */}
      {searching && (
        <p role="status" className="mt-5 text-xs text-neutral-500">
          Matching the catalog against your ingredients...
        </p>
      )}

      {matches != null && matches.length === 0 && !banner && (
        <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 p-6 text-center dark:border-neutral-700">
          <p className="text-sm text-neutral-500">
            No catalog recipe shares even one of these ingredients. Try adding a staple - rice,
            dal, curd, onion or tomato.
          </p>
        </div>
      )}

      {matches != null && matches.length > 0 && (
        <>
          <p className="mt-5 text-xs text-neutral-500">
            {matches.length} match{matches.length === 1 ? '' : 'es'} - best coverage first
            {mode === 'leftover' ? ', leftover-friendly first on ties' : ''}
          </p>
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map((r) => (
              <MatchCard
                key={r.id}
                r={r}
                saved={savedIds.has(r.id)}
                saving={savingIds.has(r.id)}
                onSave={saveToMyRecipes}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// ---------- One match card: coverage bar, hero numbers, save ----------

function MatchCard({
  r,
  saved,
  saving,
  onSave,
}: {
  r: MatchRecipeClient;
  saved: boolean;
  saving: boolean;
  onSave: (r: MatchRecipeClient) => void;
}) {
  const pct = Math.round(r.match.coverage * 100);
  const full = r.match.missingCount === 0;
  return (
    <li className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      {/* Category image: honest category-level art (not a dish photo), shared
          by every recipe of this meal x cuisine combo; lazy + fixed 16:10. */}
      <div className="mb-3 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
        <img
          src={`/images/catalog/cat-${r.mealType}-${r.cuisine}.webp`}
          alt={`${CUISINE_LABELS[r.cuisine]} ${MEAL_CARD_LABELS[r.mealType]} category card`}
          width={480}
          height={300}
          loading="lazy"
          decoding="async"
          className="aspect-[16/10] w-full object-cover"
        />
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-snug">{r.name}</h3>
          {r.nameTe && (
            <p lang="te" className="mt-0.5 text-xs text-neutral-500">
              {r.nameTe}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TIER_BADGE[r.carbTier]}`}
        >
          {TIER_BADGE_LABELS[r.carbTier]}
        </span>
      </div>

      <p className="mt-1.5 text-xs text-neutral-400">
        {MEAL_CARD_LABELS[r.mealType]} · {CUISINE_LABELS[r.cuisine]}
        {r.match.isLeftoverFriendly && ' · leftover-friendly'}
      </p>

      {/* Coverage: the headline of this surface. */}
      <div className="mt-3">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-medium text-neutral-600 dark:text-neutral-300">
            {full ? 'You have everything' : `You have ${r.match.matchedCount} of ${r.match.totalCount}`}
          </span>
          <span className="tabular-nums text-neutral-500">{pct}%</span>
        </div>
        <div
          className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-900"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Ingredient coverage ${pct}%`}
        >
          <div
            className={`h-full rounded-full ${
              full
                ? 'bg-emerald-500'
                : 'bg-brand-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {!full && (
          <p className="mt-1.5 text-xs text-neutral-500">
            Need: {r.match.missingNames.join(', ')}
          </p>
        )}
      </div>

      {/* Per-serving numbers; net carbs is the hero number (tier-colored). */}
      <div className="mt-3 grid grid-cols-5 gap-1 rounded-xl bg-neutral-50 px-2 py-2 text-center dark:bg-neutral-900/60">
        <div>
          <div className="text-sm font-semibold tabular-nums">{fmt(r.kcal)}</div>
          <div className="text-[10px] leading-tight text-neutral-500">kcal</div>
        </div>
        <div>
          <div className={`text-sm font-bold tabular-nums ${TIER_TEXT[r.carbTier]}`}>{fmt(r.netCarbsG)}g</div>
          <div className="text-[10px] leading-tight text-neutral-500">net carbs</div>
        </div>
        <div>
          <div className="text-sm font-semibold tabular-nums">{fmt(r.proteinG)}g</div>
          <div className="text-[10px] leading-tight text-neutral-500">protein</div>
        </div>
        <div>
          <div className="text-sm font-semibold tabular-nums">{fmt(r.gi)}</div>
          <div className="text-[10px] leading-tight text-neutral-500">GI</div>
        </div>
        <div>
          <div className="text-sm font-semibold tabular-nums">{r.prepMinutes}m</div>
          <div className="text-[10px] leading-tight text-neutral-500">prep</div>
        </div>
      </div>

      {/* Tags: top 3 like the catalog cards. */}
      {r.tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {r.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300"
            >
              {TAG_LABELS[t] ?? t}
            </span>
          ))}
          {r.tags.length > 3 && (
            <span
              title={r.tags.slice(3).map((t) => TAG_LABELS[t] ?? t).join(', ')}
              className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400"
            >
              +{r.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Expand: ingredients (have vs need), numbered steps, the note. */}
      <details className="mt-2.5">
        <summary className="cursor-pointer text-xs font-medium text-brand-600 dark:text-brand-400">
          Ingredients &amp; steps
        </summary>
        <ul className="mt-2 space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
          {r.items.map((it) => {
            const have = r.match.matchedNames.includes(it.foodName);
            return (
              <li key={it.foodId} className={have ? '' : 'text-neutral-400'}>
                {have ? '✓' : '·'} {it.foodName} - {it.grams} g
              </li>
            );
          })}
        </ul>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-neutral-600 dark:text-neutral-400">
          {r.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        {r.notes && (
          <p className="mt-2 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Note: </span>
            {r.notes}
          </p>
        )}
        <p className="mt-2 text-xs text-neutral-400">
          Makes {r.servings} serving{r.servings === 1 ? '' : 's'} - every number above is per serving.
        </p>
      </details>

      {/* Save into the user's own recipes (same idempotent POST as the catalog). */}
      <div className="mt-auto pt-3">
        {saved ? (
          <button
            type="button"
            disabled
            className="w-full cursor-default rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            Saved ✓
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSave(r)}
            disabled={saving}
            className="w-full rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60 dark:border-brand-800 dark:bg-brand-950/30 dark:text-brand-300"
          >
            {saving ? 'Saving...' : 'Save to my recipes'}
          </button>
        )}
      </div>
    </li>
  );
}
