'use client';

// P8 Day 3 (d3-H) — RecipeCatalog: the browse UI over the 300-recipe
// diabetic-friendly catalog (the CatalogRecipe table seeded on Day 2).
//
// Data: GET /api/recipes/catalog with AND-combined optional filters
// (mealType / carbTier / cuisine / tag / q over English + Telugu names),
// paged with "Load more" (take 24, skip grows, total gates the button).
// Saving a recipe into the user's own list is POST /api/recipes/from-catalog:
// 201 fresh / 200 already saved / 404 or any error surfaces the API's text.
//
// The filter vocabularies come from @mi/food-db (CATALOG_MEAL_TYPES /
// CATALOG_CUISINES / CATALOG_TAGS) so the chips and the seeded DB cannot
// drift apart. Net carbs per serving is the hero number for diabetics and
// carries the carbTier color coding (LOW green / MODERATE amber / HIGHER
// red). Plain copy only - each recipe carries its own notes, and this page
// makes no medical claims.
import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { CATALOG_MEAL_TYPES, CATALOG_CUISINES, CATALOG_TAGS } from '@mi/food-db';

// Row shape of GET /api/recipes/catalog (defined locally - the repo pattern).
type CatalogRecipeClient = {
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
};

type CatalogTier = CatalogRecipeClient['carbTier'];

const TAKE = 24; // the API default; explicit so the skip math stays honest

const MEAL_CHIP_LABELS: Record<CatalogRecipeClient['mealType'], string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
  drink: 'Drinks',
  side: 'Sides',
};

const MEAL_CARD_LABELS: Record<CatalogRecipeClient['mealType'], string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
  drink: 'Drink',
  side: 'Side',
};

const CUISINE_LABELS: Record<CatalogRecipeClient['cuisine'], string> = {
  telugu: 'Telugu',
  hyderabadi: 'Hyderabadi',
  'south-indian': 'South Indian',
  'north-indian': 'North Indian',
  'pan-indian': 'Pan-Indian',
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

const TIER_CHIP_LABELS: Record<CatalogTier, string> = {
  LOW: 'Low',
  MODERATE: 'Moderate',
  HIGHER: 'Higher',
};

const TIER_BADGE_LABELS: Record<CatalogTier, string> = {
  LOW: 'Low carb',
  MODERATE: 'Moderate',
  HIGHER: 'Higher carb',
};

// Color coding: LOW = green, MODERATE = amber, HIGHER = red (the same shade
// families the app already uses for warnings and tier accents elsewhere).
const TIER_BADGE: Record<CatalogTier, string> = {
  LOW: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  MODERATE: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  HIGHER: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300',
};

const TIER_TEXT: Record<CatalogTier, string> = {
  LOW: 'text-emerald-600 dark:text-emerald-400',
  MODERATE: 'text-amber-600 dark:text-amber-400',
  HIGHER: 'text-red-600 dark:text-red-400',
};

const TIER_CHIP_ACTIVE: Record<CatalogTier, string> = {
  LOW: 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
  MODERATE: 'border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-300',
  HIGHER: 'border-red-500 bg-red-50 text-red-700 dark:border-red-600 dark:bg-red-950/40 dark:text-red-300',
};

// One decimal at most (the seed pipeline rounds anyway - this is belt and
// braces against any float noise in the JSON round-trip).
const fmt = (n: number) => String(Math.round(n * 10) / 10);

export default function RecipeCatalog() {
  // Filters (all optional, AND-combined; '' = the "All" chip).
  const [mealType, setMealType] = useState('');
  const [carbTier, setCarbTier] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [tag, setTag] = useState('');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');

  // Results.
  const [recipes, setRecipes] = useState<CatalogRecipeClient[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [banner, setBanner] = useState('');
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [savedIds, setSavedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [savingIds, setSavingIds] = useState<ReadonlySet<string>>(() => new Set());

  // Drops stale responses that land after a newer filter change.
  const reqId = useRef(0);

  // ~300ms debounce on the search box so typing does not spam the API.
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 300);
    return () => clearTimeout(t);
  }, [qInput]);

  // The action toast self-dismisses (labs-page pattern).
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchPage = useCallback(
    async (skip: number, append: boolean) => {
      const id = ++reqId.current;
      const params = new URLSearchParams({ take: String(TAKE), skip: String(skip) });
      if (mealType) params.set('mealType', mealType);
      if (carbTier) params.set('carbTier', carbTier);
      if (cuisine) params.set('cuisine', cuisine);
      if (tag) params.set('tag', tag);
      if (q) params.set('q', q);
      try {
        const res = await fetch(`/api/recipes/catalog?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (id !== reqId.current) return; // superseded by a newer filter/page
        if (!res.ok) {
          // 401 gets the plain "please log in" wording; every other error
          // arrives as { error } and is shown as-is (my-foods banner pattern).
          setBanner(
            res.status === 401
              ? 'Please log in to browse the recipe catalog.'
              : typeof data.error === 'string'
                ? data.error
                : 'Could not load the catalog.',
          );
          if (!append) {
            setRecipes([]);
            setTotal(0);
          }
          return;
        }
        setBanner('');
        const page: CatalogRecipeClient[] = Array.isArray(data.recipes) ? data.recipes : [];
        setTotal(typeof data.total === 'number' ? data.total : page.length);
        setRecipes((prev) => {
          if (!append) return page;
          const seen = new Set(prev.map((r) => r.id));
          return [...prev, ...page.filter((r) => !seen.has(r.id))];
        });
      } catch {
        if (id !== reqId.current) return;
        setBanner('Could not load the catalog - check your connection and try again.');
        if (!append) {
          setRecipes([]);
          setTotal(0);
        }
      } finally {
        if (id === reqId.current) {
          setLoaded(true);
          setLoadingMore(false);
        }
      }
    },
    [mealType, carbTier, cuisine, tag, q],
  );

  // Any filter change restarts the list from page one (skeletons in between).
  useEffect(() => {
    setLoaded(false);
    fetchPage(0, false);
  }, [fetchPage]);

  // POST /api/recipes/from-catalog: 201 fresh / 200 already saved / 404 error.
  const saveToMyRecipes = useCallback(async (r: CatalogRecipeClient) => {
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

  const anyFilter = Boolean(mealType || carbTier || cuisine || tag || q);
  const clearFilters = () => {
    setMealType('');
    setCarbTier('');
    setCuisine('');
    setTag('');
    setQInput(''); // q follows through the debounce
  };

  // Chip vocabulary (the log-page chip language).
  const chipBase =
    'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
  const chipIdle =
    'border-neutral-200 text-neutral-600 hover:border-brand-300 dark:border-neutral-800 dark:text-neutral-400';
  const chipOn =
    'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-950/40 dark:text-brand-300';

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight">Recipes</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Everyday Telugu, Hyderabadi and pan-Indian plates, diabetic-friendly by design - numbers are per
        serving. Save any recipe to your list, then log it from My Foods.
      </p>

      {/* Action feedback (labs-page toast pattern; errors carry role=alert). */}
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

      {/* ---------- Filter bar: everything optional, AND-combined ---------- */}
      <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search by name - English or Telugu"
            aria-label="Search recipes by name"
            className="w-full flex-1 rounded-lg border border-neutral-300 bg-transparent px-4 py-2 text-sm outline-none focus:border-brand-500 dark:border-neutral-700"
          />
          <select
            value={cuisine}
            onChange={(e) => setCuisine(e.target.value)}
            aria-label="Filter by cuisine"
            className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-neutral-700 sm:w-44"
          >
            <option value="">All cuisines</option>
            {CATALOG_CUISINES.map((c) => (
              <option key={c} value={c}>
                {CUISINE_LABELS[c]}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-neutral-500">Meal</span>
          <button
            type="button"
            onClick={() => setMealType('')}
            aria-pressed={mealType === ''}
            className={`${chipBase} ${mealType === '' ? chipOn : chipIdle}`}
          >
            All
          </button>
          {CATALOG_MEAL_TYPES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMealType(mealType === m ? '' : m)}
              aria-pressed={mealType === m}
              className={`${chipBase} ${mealType === m ? chipOn : chipIdle}`}
            >
              {MEAL_CHIP_LABELS[m]}
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-neutral-500">Carbs</span>
          <button
            type="button"
            onClick={() => setCarbTier('')}
            aria-pressed={carbTier === ''}
            className={`${chipBase} ${carbTier === '' ? chipOn : chipIdle}`}
          >
            All
          </button>
          {(['LOW', 'MODERATE', 'HIGHER'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setCarbTier(carbTier === t ? '' : t)}
              aria-pressed={carbTier === t}
              className={`${chipBase} ${carbTier === t ? TIER_CHIP_ACTIVE[t] : chipIdle}`}
            >
              {TIER_CHIP_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="mt-2 -mx-1 overflow-x-auto px-1 pb-1">
          <div className="flex items-center gap-2">
            <span className="shrink-0 pl-1 text-xs text-neutral-500">Tags</span>
            {CATALOG_TAGS.map((tg) => (
              <button
                key={tg}
                type="button"
                onClick={() => setTag(tag === tg ? '' : tg)}
                aria-pressed={tag === tg}
                className={`${chipBase} ${tag === tg ? chipOn : chipIdle}`}
              >
                {TAG_LABELS[tg] ?? tg}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Load banner (401s and network errors land here - my-foods pattern). */}
      {banner && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        >
          {banner}
        </p>
      )}

      {/* ---------- Results ---------- */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        {loaded ? (
          <p className="text-xs text-neutral-500">
            Showing {recipes.length} of {total} recipes
          </p>
        ) : (
          <p role="status" className="text-xs text-neutral-500">
            Loading the catalog...
          </p>
        )}
        {anyFilter && (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600 hover:border-brand-400 hover:text-brand-700 dark:border-neutral-700 dark:text-neutral-400"
          >
            Clear filters
          </button>
        )}
      </div>

      {!loaded && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50"
            />
          ))}
        </div>
      )}

      {loaded && recipes.length === 0 && !banner && (
        <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 p-6 text-center dark:border-neutral-700">
          <p className="text-sm text-neutral-500">No recipes match - try clearing a filter.</p>
          {anyFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {loaded && recipes.length > 0 && (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((r) => (
            <CatalogCard
              key={r.id}
              r={r}
              saved={savedIds.has(r.id)}
              saving={savingIds.has(r.id)}
              onSave={saveToMyRecipes}
            />
          ))}
        </ul>
      )}

      {loaded && recipes.length < total && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setLoadingMore(true);
              fetchPage(recipes.length, true);
            }}
            disabled={loadingMore}
            className="rounded-lg border border-brand-300 bg-brand-50 px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-60 dark:border-brand-800 dark:bg-brand-950/30 dark:text-brand-300"
          >
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- One catalog card: hero numbers, expandable method, save ----------

function CatalogCard({
  r,
  saved,
  saving,
  onSave,
}: {
  r: CatalogRecipeClient;
  saved: boolean;
  saving: boolean;
  onSave: (r: CatalogRecipeClient) => void;
}) {
  return (
    <li className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      {/* Category image: honest category-level art (not a dish photo), shared
          by every recipe of this meal x cuisine combo; lazy + fixed 16:10. */}
      <div className="mb-3 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
        {/* S2-E: next/image — lazy by default, same fixed 16:10 box. */}
        <Image
          src={`/images/catalog/cat-${r.mealType}-${r.cuisine}.webp`}
          alt={`${CUISINE_LABELS[r.cuisine]} ${MEAL_CARD_LABELS[r.mealType]} category card`}
          width={480}
          height={300}
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
      </p>

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

      {/* Tags: top 3, the rest behind a "+n" (its title lists them). */}
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

      {/* Expand: ingredients with grams, numbered steps, the recipe's own note. */}
      <details className="mt-2.5">
        <summary className="cursor-pointer text-xs font-medium text-brand-600 dark:text-brand-400">
          Ingredients &amp; steps
        </summary>
        <ul className="mt-2 space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
          {r.items.map((it) => (
            <li key={it.foodId}>
              {it.foodName} - {it.grams} g
            </li>
          ))}
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

      {/* Save into the user's own recipes (POST /api/recipes/from-catalog). */}
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
