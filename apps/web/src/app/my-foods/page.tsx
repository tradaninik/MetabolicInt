'use client';

// C4 (F5): My Foods - every food this user created, with times logged,
// edit (past entries keep their frozen numbers) and delete (409 with
// plain-language reasons while referenced).
// R-1 (stream C): rebuilt in the compact-row language of the redesigned
// /healing-foods library - one card list, divide-y rows, at-a-glance chips,
// classical badges inline, full macros behind a native details disclosure.
// Presentation only: same API, same edit/delete semantics.
// P6-a: gains a Recipes section. Three concepts live here now -
//   * single foods: one ingredient with per-100g macros you edit yourself
//   * recipes: several foods + portions + a serving count; nutrition is
//     computed exactly per serving, and logging expands into one entry per
//     ingredient
//   * saved plates (combos): a tray you re-log in one tap (built on /log)
// Same API for foods as before; recipes come from /api/recipes.
import { useCallback, useEffect, useState } from 'react';
import { findTasteByName, findHealingFoodByName } from '@mi/food-db';
import { doshaFoodAdvice, recipeNutrition, type Food, type RecipeItemInput } from '@mi/engine';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import AddCustomFood from '@/components/AddCustomFood';

type CustomFood = {
  id: string;
  name: string;
  useCount: number;
  servingGrams: number;
  katoriGrams: number | null;
  kcalPer100g: number;
  carbsPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  gi: number;
  aliases: string[];
};

type RecipeRow = {
  id: string;
  name: string;
  servings: number;
  items: { food: Food; portionType: 'serving' | 'katori' | 'grams'; portionValue: number }[];
  missingFoodIds: string[];
  nutrition: { kcal: number; carbsG: number; proteinG: number; fatG: number; fiberG: number; netCarbsG: number; grams: number; gi: number };
  totals: { kcal: number; carbsG: number; proteinG: number; fatG: number; fiberG: number; netCarbsG: number; grams: number; gi: number };
};

const NUM_FIELDS = ['carbsPer100g', 'proteinPer100g', 'fatPer100g', 'fiberPer100g', 'kcalPer100g', 'gi', 'servingGrams'] as const;

export default function MyFoodsPage() {
  const [tab, setTab] = useState<'foods' | 'recipes'>('foods');
  const [foods, setFoods] = useState<CustomFood[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [banner, setBanner] = useState('');
  const [editing, setEditing] = useState<CustomFood | null>(null);
  // P7: the foods tab had no create entry point of its own (only /log had one),
  // which read as "how do I even add my food here?" - same inline-creator
  // pattern the recipes tab already uses.
  const [foodCreator, setFoodCreator] = useState(false);

  // Recipes state
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [recipesLoaded, setRecipesLoaded] = useState(false);
  const [recipeEditor, setRecipeEditor] = useState<{ initial: RecipeRow | null } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/foods/custom');
      const data = await res.json().catch(() => ({}));
      setFoods(res.ok ? (data.foods ?? []) : []);
      if (!res.ok) setBanner(data.error ?? 'Could not load your foods.');
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadRecipes = useCallback(async () => {
    try {
      const res = await fetch('/api/recipes');
      const data = await res.json().catch(() => ({}));
      setRecipes(res.ok ? (data.recipes ?? []) : []);
      if (!res.ok) setBanner(data.error ?? 'Could not load your recipes.');
    } finally {
      setRecipesLoaded(true);
    }
  }, []);
  useEffect(() => { loadRecipes(); }, [loadRecipes]);

  async function remove(f: CustomFood) {
    setBanner('');
    // Plain-language confirm that shows WHY when blocked - the 409 counts.
    if (!window.confirm(`Delete "${f.name}"?`)) return;
    const res = await fetch(`/api/foods/custom?id=${encodeURIComponent(f.id)}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { load(); return; }
    setBanner(data.error ?? 'Could not delete this food.');
  }

  async function saveEdit() {
    if (!editing) return;
    setBanner('');
    const res = await fetch('/api/foods/custom', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: editing.id, name: editing.name, gi: editing.gi,
        carbsPer100g: editing.carbsPer100g, proteinPer100g: editing.proteinPer100g,
        fatPer100g: editing.fatPer100g, fiberPer100g: editing.fiberPer100g,
        kcalPer100g: editing.kcalPer100g, servingGrams: editing.servingGrams,
        aliases: editing.aliases.join(','),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { setEditing(null); load(); return; }
    // 400s arrive as { errors: {...} }; 409/401 as { error: string }.
    setBanner(typeof data.error === 'string' ? data.error : Object.values(data.errors ?? {})[0] ?? 'Could not save.');
  }

  async function removeRecipe(r: RecipeRow) {
    setBanner('');
    if (!window.confirm(`Delete recipe "${r.name}"? Meals already logged keep their numbers.`)) return;
    const res = await fetch(`/api/recipes?id=${encodeURIComponent(r.id)}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { loadRecipes(); return; }
    setBanner(data.error ?? 'Could not delete this recipe.');
  }

  const input = 'w-full rounded-lg border border-neutral-300 bg-transparent px-2 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-neutral-700';
  const chip = 'rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300';
  const action = 'rounded-lg px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
  const segBtn = (active: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
      active
        ? 'bg-brand-600 text-white'
        : 'border border-neutral-300 text-neutral-700 hover:border-brand-400 dark:border-neutral-700 dark:text-neutral-300'
    }`;

// S-1: wrapped in AppShell like every authed page - restores the sidebar,
// mobile navigation and the medical disclaimer footer this page had been
// silently missing since it was created (pinned by appshell-wiring.test.ts).
  return (
    <AppShell>
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">My Foods</h1>
      <p className="mt-1 text-sm text-neutral-500">Your private food dictionary - searchable everywhere, editable, yours alone.</p>

      {/* P6-a: the three concepts, in one place. */}
      <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs leading-relaxed text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-400">
        <p><span className="font-semibold text-neutral-700 dark:text-neutral-200">Single foods</span> are one ingredient each - you set the per-100g macros, GI and serving size, and every food search in the app finds them.</p>
        <p className="mt-1.5"><span className="font-semibold text-neutral-700 dark:text-neutral-200">Recipes</span> (new) combine several foods with portions and a serving count - nutrition is computed exactly per serving, and logging a recipe enters each ingredient as its own entry.</p>
        <p className="mt-1.5"><span className="font-semibold text-neutral-700 dark:text-neutral-200">Saved plates</span> are quick re-logs of a meal tray you repeat - build them on <Link href="/log" className="text-brand-600 underline dark:text-brand-400">Log a meal</Link> with &quot;Save tray as combo&quot;.</p>
      </div>

      {/* Segmented control (P6-a) */}
      <div className="mt-5 flex gap-2" role="tablist" aria-label="My Foods sections">
        <button role="tab" aria-selected={tab === 'foods'} onClick={() => { setTab('foods'); setBanner(''); }} className={segBtn(tab === 'foods')}>
          My foods ({foods.length})
        </button>
        <button role="tab" aria-selected={tab === 'recipes'} onClick={() => { setTab('recipes'); setBanner(''); }} className={segBtn(tab === 'recipes')}>
          Recipes ({recipes.length})
        </button>
      </div>

      {banner && <p role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">{banner}</p>}

      {tab === 'foods' && (
        <>
          {!loaded && <p role="status" className="mt-6 text-sm text-neutral-500">Loading...</p>}
          {loaded && foods.length === 0 && !foodCreator && (
            <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 p-6 text-center dark:border-neutral-700">
              <p className="text-sm text-neutral-500">No foods of your own yet.</p>
              <p className="mt-1 text-xs text-neutral-400">
                Add the foods you actually eat with their per-100g numbers (paste a packet label if you have it), or
                add one later from{' '}
                <Link href="/log" className="text-brand-600 underline dark:text-brand-400">Log a meal</Link>{' '}
                while logging.
              </p>
              <button
                onClick={() => { setFoodCreator(true); setBanner(''); }}
                className="mt-3 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                Add your first food
              </button>
            </div>
          )}

          {(loaded && foods.length > 0 && !editing && !foodCreator) && (
            <button
              onClick={() => { setFoodCreator(true); setBanner(''); }}
              className="mt-4 rounded-lg border border-brand-300 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950/30 dark:text-brand-300"
            >
              + New food
            </button>
          )}

          {foodCreator && (
            <div className="mt-4">
              <AddCustomFood
                onCreated={() => { setFoodCreator(false); load(); setBanner(''); }}
                onCancel={() => setFoodCreator(false)}
              />
            </div>
          )}

          {loaded && foods.length > 0 && (
            <ul className="mt-6 divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white dark:divide-neutral-900 dark:border-neutral-800 dark:bg-neutral-950">
              {foods.map((f) => {
                // P4c-b / U16: classical-property overlay. A custom food gets the rasa/dosha
                // badge when its name or an alias matches a curated classic; a Food as Medicine
                // chip when it matches a knowledge-base entry. No match, no badge - no guessing.
                const tasteMatch = findTasteByName(f.name, f.aliases);
                const advice = tasteMatch ? doshaFoodAdvice(tasteMatch.taste) : null;
                const healing = findHealingFoodByName(f.name, f.aliases);
                return (
                  <li key={f.id} className="px-4 py-3">
                    {editing?.id === f.id ? (
                      <div className="space-y-3 py-1">
                        <input className={input} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} aria-label="food name" />
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {NUM_FIELDS.map((k) => (
                            <label key={k} className="text-xs text-neutral-500">
                              {k === 'gi' ? 'GI' : k === 'servingGrams' ? 'Serving g' : k.replace('Per100g', '/100g')}
                              <input className={input} inputMode="decimal" value={editing[k]} onChange={(e) => setEditing({ ...editing, [k]: e.target.value })} />
                            </label>
                          ))}
                        </div>
                        <input className={input} placeholder="Also searchable as (comma-separated)" value={editing.aliases.join(',')} onChange={(e) => setEditing({ ...editing, aliases: e.target.value.split(',') })} aria-label="aliases" />
                        <p className="text-[11px] text-neutral-500">Past logged meals keep the numbers they were logged with.</p>
                        <div className="flex gap-2">
                          <button onClick={saveEdit} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">Save</button>
                          <button onClick={() => setEditing(null)} className={`${action} border border-neutral-300 dark:border-neutral-700`}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{f.name}</span>
                            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">yours</span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className={chip}>{f.kcalPer100g} kcal/100g</span>
                            <span className={chip}>GI {f.gi}</span>
                            <span className={chip}>logged {f.useCount} time{f.useCount === 1 ? '' : 's'}</span>
                          </div>
                          {(tasteMatch || healing) && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {tasteMatch && advice && (
                                <>
                                  <span
                                    title={`Matched to the classical properties of ${tasteMatch.matchedName} - educational approximation, not medical advice`}
                                    className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                                  >
                                    {tasteMatch.taste.rasa.join(' · ')}
                                    {tasteMatch.taste.virya ? ` · ${tasteMatch.taste.virya}` : ''}
                                  </span>
                                  <span title={advice.label} className={chip}>
                                    {advice.badge}
                                  </span>
                                </>
                              )}
                              {healing?.science && (
                                <Link
                                  href="/healing-foods"
                                  title={healing.headline}
                                  className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700 hover:underline dark:bg-brand-900/40 dark:text-brand-300"
                                >
                                  Food as Medicine · evidence {healing.science.grade}
                                </Link>
                              )}
                            </div>
                          )}
                          {f.aliases.length > 0 && <p className="mt-1 text-xs text-neutral-400">also searchable as: {f.aliases.join(', ')}</p>}
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs font-medium text-brand-600 dark:text-brand-400">Nutrition details</summary>
                            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
                              <div><dt className="text-neutral-400 dark:text-neutral-500">Carbs</dt><dd className="text-neutral-700 dark:text-neutral-300">{f.carbsPer100g} g/100g</dd></div>
                              <div><dt className="text-neutral-400 dark:text-neutral-500">Protein</dt><dd className="text-neutral-700 dark:text-neutral-300">{f.proteinPer100g} g/100g</dd></div>
                              <div><dt className="text-neutral-400 dark:text-neutral-500">Fat</dt><dd className="text-neutral-700 dark:text-neutral-300">{f.fatPer100g} g/100g</dd></div>
                              <div><dt className="text-neutral-400 dark:text-neutral-500">Fiber</dt><dd className="text-neutral-700 dark:text-neutral-300">{f.fiberPer100g} g/100g</dd></div>
                              <div><dt className="text-neutral-400 dark:text-neutral-500">Serving</dt><dd className="text-neutral-700 dark:text-neutral-300">{f.servingGrams} g</dd></div>
                              {f.katoriGrams !== null && (
                                <div><dt className="text-neutral-400 dark:text-neutral-500">Katori</dt><dd className="text-neutral-700 dark:text-neutral-300">{f.katoriGrams} g</dd></div>
                              )}
                            </dl>
                          </details>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button onClick={() => setEditing(f)} aria-label={`Edit ${f.name}`} className={`${action} border border-neutral-300 dark:border-neutral-700`}>Edit</button>
                          <button onClick={() => remove(f)} aria-label={`Delete ${f.name}`} className={`${action} border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40`}>Delete</button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {tab === 'recipes' && (
        <>
          {!recipesLoaded && <p role="status" className="mt-6 text-sm text-neutral-500">Loading...</p>}
          {recipesLoaded && recipes.length === 0 && !recipeEditor && (
            <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 p-6 text-center dark:border-neutral-700">
              <p className="text-sm text-neutral-500">No recipes yet.</p>
              <p className="mt-1 text-xs text-neutral-400">A recipe combines any foods - catalog or your own - with portions and a serving count. Nutrition is computed exactly per serving.</p>
              <button
                onClick={() => setRecipeEditor({ initial: null })}
                className="mt-3 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                Create your first recipe
              </button>
            </div>
          )}

          {(recipes.length > 0 || recipeEditor) && !recipeEditor && (
            <button
              onClick={() => setRecipeEditor({ initial: null })}
              className="mt-4 rounded-lg border border-brand-300 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950/30 dark:text-brand-300"
            >
              + New recipe
            </button>
          )}

          {recipeEditor && (
            <RecipeEditor
              initial={recipeEditor.initial}
              onSaved={() => { setRecipeEditor(null); loadRecipes(); }}
              onCancel={() => setRecipeEditor(null)}
              onError={setBanner}
            />
          )}

          {recipesLoaded && recipes.length > 0 && (
            <ul className="mt-4 divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white dark:divide-neutral-900 dark:border-neutral-800 dark:bg-neutral-950">
              {recipes.map((r) => (
                <li key={r.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{r.name}</span>
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">recipe</span>
                        <span className="text-xs text-neutral-400">{r.servings} serving{r.servings === 1 ? '' : 's'}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className={chip}>{r.nutrition.kcal} kcal / serving</span>
                        <span className={chip}>{r.nutrition.carbsG} g carbs</span>
                        <span className={chip}>{r.nutrition.proteinG} g protein</span>
                        <span className={chip}>GI {r.nutrition.gi}</span>
                      </div>
                      {r.missingFoodIds.length > 0 && (
                        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                          {r.missingFoodIds.length} ingredient{r.missingFoodIds.length === 1 ? '' : 's'} no longer available - edit the recipe to fix.
                        </p>
                      )}
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-medium text-brand-600 dark:text-brand-400">Ingredients &amp; nutrition</summary>
                        <ul className="mt-2 space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
                          {r.items.map((it) => (
                            <li key={it.food.id}>
                              {it.food.name} - {it.portionValue} {it.portionType === 'grams' ? 'g' : it.portionType + (it.portionValue === 1 ? '' : 's')}
                            </li>
                          ))}
                        </ul>
                        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
                          <div><dt className="text-neutral-400 dark:text-neutral-500">Per serving</dt><dd className="text-neutral-700 dark:text-neutral-300">{r.nutrition.kcal} kcal</dd></div>
                          <div><dt className="text-neutral-400 dark:text-neutral-500">Carbs / fiber</dt><dd className="text-neutral-700 dark:text-neutral-300">{r.nutrition.carbsG} g / {r.nutrition.fiberG} g</dd></div>
                          <div><dt className="text-neutral-400 dark:text-neutral-500">Net carbs</dt><dd className="text-neutral-700 dark:text-neutral-300">{r.nutrition.netCarbsG} g</dd></div>
                          <div><dt className="text-neutral-400 dark:text-neutral-500">Fat</dt><dd className="text-neutral-700 dark:text-neutral-300">{r.nutrition.fatG} g</dd></div>
                          <div><dt className="text-neutral-400 dark:text-neutral-500">Whole recipe</dt><dd className="text-neutral-700 dark:text-neutral-300">{r.totals.kcal} kcal</dd></div>
                          <div><dt className="text-neutral-400 dark:text-neutral-500">Weight</dt><dd className="text-neutral-700 dark:text-neutral-300">{r.nutrition.grams} g / serving</dd></div>
                        </dl>
                      </details>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Link
                        href="/log"
                        title="Log this recipe on Log a meal"
                        className={`${action} border border-brand-300 text-brand-700 hover:bg-brand-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-950/40`}
                      >
                        Log it
                      </Link>
                      <button onClick={() => setRecipeEditor({ initial: r })} aria-label={`Edit ${r.name}`} className={`${action} border border-neutral-300 dark:border-neutral-700`}>Edit</button>
                      <button onClick={() => removeRecipe(r)} aria-label={`Delete ${r.name}`} className={`${action} border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40`}>Delete</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 text-xs text-neutral-400">
            Logging a recipe from <Link href="/log" className="text-brand-600 underline dark:text-brand-400">Log a meal</Link> enters each ingredient as its own entry, so your history and the coach see the real foods. Already-logged meals keep the numbers they were logged with.
          </p>
        </>
      )}
    </div>
    </AppShell>
  );
}

// ---------- P6-a: recipe create/edit form ----------

function RecipeEditor({
  initial,
  onSaved,
  onCancel,
  onError,
}: {
  initial: RecipeRow | null;
  onSaved: () => void;
  onCancel: () => void;
  onError: (msg: string) => void;
}) {
  // Client items are the lean {foodId, portionType, portionValue} triples the
  // API stores; the decorated food objects ride along in the local index.
  const [name, setName] = useState(initial?.name ?? '');
  const [servings, setServings] = useState(String(initial?.servings ?? 2));
  const [items, setItems] = useState<RecipeItemInput[]>(() =>
    (initial?.items ?? []).map((it) => ({ foodId: it.food.id, portionType: it.portionType, portionValue: it.portionValue })),
  );
  // Local food index for the live per-serving preview (foods gathered from search).
  const [index, setIndex] = useState<Record<string, Food>>(() => {
    const out: Record<string, Food> = {};
    for (const it of initial?.items ?? []) out[it.food.id] = it.food;
    return out;
  });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [saving, setSaving] = useState(false);

  // Debounced ingredient search (same endpoint as /log).
  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/foods?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const j = await res.json();
          setResults((j.foods ?? []).slice(0, 6));
        }
      } catch { /* offline-tolerant: keep what we have */ }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  function addIngredient(f: Food) {
    setIndex((prev) => ({ ...prev, [f.id]: f }));
    setItems((prev) =>
      prev.some((it) => it.foodId === f.id)
        ? prev.map((it) => (it.foodId === f.id ? { ...it, portionValue: it.portionValue + 1 } : it))
        : [...prev, { foodId: f.id, portionType: 'serving', portionValue: 1 }],
    );
    setQuery('');
    setResults([]);
  }

  const preview = recipeNutrition(items, index, Number(servings) || 1);

  async function save() {
    setSaving(true);
    onError('');
    try {
      const payload = {
        ...(initial ? { id: initial.id } : {}),
        name: name.trim(),
        servings: Number(servings),
        items,
      };
      const res = await fetch('/api/recipes', {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? 'Could not save the recipe.');
      onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not save the recipe.');
    } finally {
      setSaving(false);
    }
  }

  const input = 'w-full rounded-lg border border-neutral-300 bg-transparent px-2 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-neutral-700';

  return (
    <div className="mt-4 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="text-lg font-semibold">{initial ? `Edit "${initial.name}"` : 'New recipe'}</h2>
      <p className="mt-1 text-xs text-neutral-500">Pick ingredients (catalog or your own foods), set portions, and name how many servings the whole recipe makes.</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-neutral-500">
          Recipe name
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Moong dal khichdi" maxLength={60} />
        </label>
        <label className="text-xs text-neutral-500">
          Servings the recipe makes
          <input className={input} inputMode="decimal" value={servings} onChange={(e) => setServings(e.target.value)} placeholder="e.g. 2" />
        </label>
      </div>

      <div className="mt-3">
        <input
          className={input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search foods to add as ingredients - dosa, dal, paneer..."
          aria-label="search ingredients"
        />
        {results.length > 0 && (
          <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            {results.map((f) => (
              <li key={f.id}>
                <button
                  onClick={() => addIngredient(f)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-900"
                >
                  <span>
                    <span className="font-medium">{f.name}</span>
                    <span className="ml-2 text-xs text-neutral-400">GI {f.gi}</span>
                  </span>
                  <span className="text-xs font-medium text-brand-600">+ Add</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {items.map((it, i) => {
            const f = index[it.foodId];
            return (
              <li key={it.foodId} className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 p-2.5 text-sm dark:border-neutral-800">
                <span className="min-w-0 flex-1 truncate font-medium">{f?.name ?? it.foodId}</span>
                <select
                  value={it.portionType}
                  onChange={(e) => setItems((prev) => prev.map((x, idx) => (idx === i ? { ...x, portionType: e.target.value as RecipeItemInput['portionType'] } : x)))}
                  className="rounded border border-neutral-300 bg-transparent px-2 py-1 text-xs dark:border-neutral-700"
                  aria-label="portion type"
                >
                  <option value="serving">serving</option>
                  <option value="katori">katori</option>
                  <option value="grams">grams</option>
                </select>
                <input
                  value={it.portionValue}
                  inputMode="decimal"
                  onChange={(e) => setItems((prev) => prev.map((x, idx) => (idx === i ? { ...x, portionValue: Number(e.target.value) || 0 } : x)))}
                  className="w-16 rounded border border-neutral-300 bg-transparent px-2 py-1 text-xs dark:border-neutral-700"
                  aria-label="portion value"
                />
                <button onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))} className="text-xs text-neutral-400 hover:text-red-500" aria-label="remove ingredient">
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {items.length > 0 && (
        <div className="mt-3 rounded-xl bg-neutral-50 p-3 text-xs text-neutral-600 dark:bg-neutral-900/40 dark:text-neutral-400">
          <span className="font-medium text-neutral-700 dark:text-neutral-200">Per serving:</span>{' '}
          {preview.perServing.kcal} kcal · {preview.perServing.carbsG} g carbs · {preview.perServing.proteinG} g protein · {preview.perServing.fatG} g fat · {preview.perServing.fiberG} g fiber · GI {preview.perServing.gi}
          <span className="block text-[11px] text-neutral-400">Whole recipe: {preview.totals.kcal} kcal across {preview.totals.grams} g.</span>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={save}
          disabled={saving || !name.trim() || items.length === 0 || !(Number(servings) > 0)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? 'Saving...' : initial ? 'Save changes' : 'Save recipe'}
        </button>
        <button onClick={onCancel} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-700 dark:border-neutral-700 dark:text-neutral-300">Cancel</button>
      </div>
    </div>
  );
}
