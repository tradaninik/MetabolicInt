'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import PostMealFeedback from '@/components/PostMealFeedback';
import RecentMeals from '@/components/RecentMeals';
import type { Food, GlucoseSpike } from '@mi/engine';
import { macrosForGrams, netCarbsG, estimateGlucoseSpike } from '@mi/engine';
import { REGION_LABELS } from '@mi/food-db';
import { classifyMealType } from '@/lib/meal-bits';

interface TrayItem {
  food: Food;
  portionType: 'serving' | 'katori' | 'grams';
  portionValue: number;
}

interface EntryLite {
  kcal: number;
  carbsG: number;
  loggedAt: string;
}

const CATEGORY_CHIPS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Grains', value: 'cereal' },
  { label: 'Dals & beans', value: 'legume' },
  { label: 'Vegetables', value: 'vegetable' },
  { label: 'Fruits', value: 'fruit' },
  { label: 'Dairy', value: 'dairy' },
  { label: 'Eggs', value: 'egg' },
  { label: 'Meat', value: 'meat' },
  { label: 'Fish', value: 'fish' },
  { label: 'Nuts', value: 'nut' },
  { label: 'Snacks', value: 'snack' },
  { label: 'Sweets', value: 'sweet' },
  { label: 'Drinks', value: 'beverage' },
  { label: 'Fats', value: 'fat' },
];

const WHEN_OPTIONS: { label: string; minutes: number }[] = [
  { label: 'Just now', minutes: 0 },
  { label: '30 min ago', minutes: 30 },
  { label: '1 hr ago', minutes: 60 },
  { label: '2 hrs ago', minutes: 120 },
  { label: '3 hrs ago', minutes: 180 },
];

function itemGrams(it: TrayItem): number {
  if (it.portionType === 'grams') return it.portionValue;
  if (it.portionType === 'katori') return it.portionValue * (it.food.katoriGrams ?? it.food.servingGrams);
  return it.portionValue * it.food.servingGrams;
}

export default function LogPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [fallback, setFallback] = useState(false);
  const [category, setCategory] = useState('');
  const [region, setRegion] = useState('');
  const [sensitivity, setSensitivity] = useState(1.5);
  const [diabetic, setDiabetic] = useState(false);
  const [tray, setTray] = useState<TrayItem[]>([]);
  const [whenMin, setWhenMin] = useState(0);
  const [notes, setNotes] = useState('');
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [postMeal, setPostMeal] = useState<{ loggedAt: number; name: string; dueAt: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load user sensitivity for the live preview.
  useEffect(() => {
    fetch('/api/me/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setSensitivity(d.sensitivity ?? 1.5);
          setDiabetic(!!d.diabetic);
          if (d.region) setRegion(d.region);
        }
      })
      .catch(() => {});
  }, []);

  // Debounced search / browse. Empty query + a category chip = browse that category.
  useEffect(() => {
    if (!query.trim() && !category) {
      setResults([]);
      setFallback(false);
      return;
    }
    const t = setTimeout(async () => {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (region) params.set('region', region);
      if (category) params.set('category', category);
      const res = await fetch(`/api/foods?${params.toString()}`);
      if (res.ok) {
        const j = await res.json();
        if (j.foods.length === 0 && region) {
          const p2 = new URLSearchParams();
          if (query.trim()) p2.set('q', query.trim());
          if (category) p2.set('category', category);
          const res2 = await fetch(`/api/foods?${p2.toString()}`);
          if (res2.ok) {
            const j2 = await res2.json();
            setResults(j2.foods);
            setFallback(true);
            return;
          }
        }
        setResults(j.foods);
        setFallback(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, region, category]);

  const whenMs = useMemo(() => Date.now() - whenMin * 60_000, [whenMin]);

  const items = useMemo(
    () =>
      tray.map((it) => {
        const grams = itemGrams(it);
        const macros = macrosForGrams(it.food, grams);
        const nc = netCarbsG(macros.carbsG, macros.fiberG);
        return { it, grams, macros, nc };
      }),
    [tray],
  );

  const totals = useMemo(() => {
    let kcal = 0;
    let carbs = 0;
    let protein = 0;
    let fat = 0;
    let nc = 0;
    let giW = 0;
    let giWt = 0;
    for (const x of items) {
      kcal += x.macros.kcal;
      carbs += x.macros.carbsG;
      protein += x.macros.proteinG;
      fat += x.macros.fatG;
      nc += x.nc;
      const w = Math.max(x.nc, 1);
      giW += x.it.food.gi * w;
      giWt += w;
    }
    return { kcal, carbs, protein, fat, nc, gi: giWt > 0 ? giW / giWt : 0 };
  }, [items]);

  const previewSpike: GlucoseSpike | null =
    items.length > 0
      ? estimateGlucoseSpike({ carbsG: totals.nc, gi: totals.gi, sensitivity, mealAt: whenMs })
      : null;

  const band = previewSpike
    ? previewSpike.deltaMgDl <= (diabetic ? 30 : 20)
      ? 'green'
      : previewSpike.deltaMgDl <= (diabetic ? 60 : 40)
        ? 'yellow'
        : 'red'
    : null;

  const mealType = items.length > 0 ? classifyMealType(whenMs, totals.nc) : null;

  // What-if 1: halve the top-carb item (macros are linear in grams, so nc/2 is exact).
  const halfPortion = useMemo(() => {
    if (items.length === 0) return null;
    let topIdx = -1;
    let topNc = -1;
    items.forEach((x, i) => {
      if (x.nc > topNc) {
        topNc = x.nc;
        topIdx = i;
      }
    });
    if (topIdx < 0 || tray[topIdx].portionValue / 2 < 0.5) return null;
    let nc = 0;
    let giW = 0;
    let giWt = 0;
    items.forEach((x, i) => {
      const effNc = i === topIdx ? x.nc / 2 : x.nc;
      nc += effNc;
      const w = Math.max(effNc, 1);
      giW += x.it.food.gi * w;
      giWt += w;
    });
    return {
      idx: topIdx,
      name: tray[topIdx].food.name,
      spike: estimateGlucoseSpike({ carbsG: nc, gi: giWt > 0 ? giW / giWt : 0, sensitivity, mealAt: whenMs }),
    };
  }, [items, tray, sensitivity, whenMs]);

  // What-if 2: a 15-minute walk after the meal (the engine applies its own adjustment).
  const walkSpike: GlucoseSpike | null =
    items.length > 0
      ? estimateGlucoseSpike({ carbsG: totals.nc, gi: totals.gi, sensitivity, mealAt: whenMs, activityAfterMin: 15 })
      : null;

  function trayLabel(): string {
    if (tray.length === 0) return 'meal';
    if (tray.length === 1) return tray[0].food.name;
    const two = tray.slice(0, 2).map((t) => t.food.name).join(' + ');
    return tray.length > 2 ? `${two} +${tray.length - 2} more` : two;
  }

  function addFood(f: Food) {
    setSavedMsg(null);
    setError(null);
    setTray((t) => {
      const existing = t.findIndex((x) => x.food.id === f.id);
      if (existing >= 0) {
        const copy = [...t];
        copy[existing] = { ...copy[existing], portionValue: copy[existing].portionValue + 1 };
        return copy;
      }
      return [...t, { food: f, portionType: 'serving', portionValue: 1 }];
    });
  }

  function updateItem(i: number, patch: Partial<TrayItem>) {
    setTray((t) => t.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  function removeItem(i: number) {
    setTray((t) => t.filter((_, idx) => idx !== i));
  }

  async function handlePhoto(file: File) {
    if (file.size > 4_000_000) {
      setError('Photo is large (>4MB). Using a smaller image is recommended.');
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoPath(reader.result as string);
    reader.readAsDataURL(file);
    setSavedMsg(null);
  }

  async function save() {
    if (items.length === 0) return;
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    const label = trayLabel();
    const loggedAt = whenMs;
    let lastCheckIn: { label?: string; dueAt: number } | null = null;
    let savedCount = 0;
    try {
      for (let i = 0; i < tray.length; i++) {
        const it = tray[i];
        const res = await fetch('/api/meals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            foodId: it.food.id,
            portionType: it.portionType,
            portionValue: it.portionValue,
            ...(i === 0 ? { photoPath, notes } : {}),
            loggedAt,
          }),
        });
        if (!res.ok) throw new Error(`could not save ${it.food.name}`);
        const j = await res.json();
        if (j.checkIn) lastCheckIn = j.checkIn as { label?: string; dueAt: number };
        savedCount++;
      }

      // Instant feedback: day so far vs the user's recent usual day. Optional - a
      // failure here never blocks the save message.
      let dayNote = '';
      try {
        const r2 = await fetch('/api/meals');
        if (r2.ok) {
          const { entries } = (await r2.json()) as { entries: EntryLite[] };
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const today = entries.filter((e) => new Date(e.loggedAt) >= todayStart);
          const kcal = Math.round(today.reduce((s, e) => s + e.kcal, 0));
          const carbs = Math.round(today.reduce((s, e) => s + e.carbsG, 0));
          const perDay = new Map<string, { kcal: number }>();
          for (const e of entries) {
            const d = new Date(e.loggedAt);
            if (d < todayStart) {
              const k = d.toDateString();
              const v = perDay.get(k) ?? { kcal: 0 };
              v.kcal += e.kcal;
              perDay.set(k, v);
            }
          }
          dayNote =
            perDay.size >= 2
              ? ` Today so far: ${kcal} kcal, ${carbs} g carbs (your usual day is around ${Math.round([...perDay.values()].reduce((s, v) => s + v.kcal, 0) / perDay.size)} kcal).`
              : ` Today so far: ${kcal} kcal, ${carbs} g carbs.`;
        }
      } catch {
        // summary is a bonus, never a blocker
      }

      const spike = previewSpike?.deltaMgDl ?? 0;
      setSavedMsg(`Logged ${label}. Predicted glucose rise about ${Math.round(spike)} mg/dL.${dayNote}`);
      if (lastCheckIn) {
        setPostMeal({ loggedAt, name: lastCheckIn.label ?? label, dueAt: lastCheckIn.dueAt });
      }
      setTray([]);
      setQuery('');
      setResults([]);
      setPhotoPath(null);
      setNotes('');
      setWhenMin(0);
      if (fileRef.current) fileRef.current.value = '';
      window.dispatchEvent(new Event('meals-updated'));
    } catch {
      setTray((t) => t.slice(savedCount));
      setError(`Saved ${savedCount} of ${tray.length} items. Could not save the rest - please try again.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Log a meal</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Add each item to your tray, set portions, and see the combined prediction for the whole meal.
        </p>

        {/* Photo capture (kept from v1) */}
        <div className="mt-6 rounded-xl border border-dashed border-neutral-300 p-4 dark:border-neutral-700">
          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0])}
              className="text-xs"
            />
            {photoPath && <img src={photoPath} alt="meal" className="h-16 w-16 rounded-lg object-cover" />}
          </div>
          <p className="mt-2 text-[11px] text-neutral-400">
            Photo is stored locally for now. Automatic food recognition is a later upgrade - for now, add items below.
          </p>
        </div>

        {/* Category chips */}
        <div className="mt-6 -mx-1 overflow-x-auto px-1 pb-1">
          <div className="flex gap-2">
            {CATEGORY_CHIPS.map((c) => (
              <button
                key={c.value || 'all'}
                onClick={() => setCategory(c.value)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${
                  category === c.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-950/40 dark:text-brand-300'
                    : 'border-neutral-200 text-neutral-600 hover:border-brand-300 dark:border-neutral-800 dark:text-neutral-400'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="mt-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={category ? `Search within ${CATEGORY_CHIPS.find((c) => c.value === category)?.label ?? 'category'}...` : 'Search 139 foods - dosa, biryani, chapati, pizza...'}
            className="w-full rounded-lg border border-neutral-300 bg-transparent px-4 py-3 outline-none focus:border-brand-500 dark:border-neutral-700"
          />
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-neutral-500">Region:</span>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
            >
              <option value="">All regions</option>
              {Object.entries(REGION_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          {fallback && results.length > 0 && (
            <p className='mt-2 text-xs text-neutral-500'>
              No {(REGION_LABELS as Record<string, string | undefined>)[region] ?? 'regional'} matches for &quot;{query}&quot; - showing matches from all regions.
            </p>
          )}

          {results.length > 0 && (
            <ul className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
              {results.map((f) => (
                <li key={f.id}>
                  <button
                    onClick={() => addFood(f)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-900"
                  >
                    <span>
                      <span className="font-medium">{f.name}</span>
                      <span className="ml-2 text-xs text-neutral-400">{REGION_LABELS[f.region]} - GI {f.gi}</span>
                    </span>
                    <span className="text-xs font-medium text-brand-600">+ Add</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Tray */}
        {items.length > 0 && (
          <div className="mt-6 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Your tray ({items.length})</h2>
              <button
                onClick={() => setTray([])}
                className="text-xs text-neutral-500 hover:underline"
              >
                Clear all
              </button>
            </div>

            <ul className="mt-3 space-y-3">
              {items.map((x, i) => (
                <li key={x.it.food.id} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-sm font-medium">{x.it.food.name}</span>
                      <span className="ml-2 text-xs text-neutral-400">GI {x.it.food.gi} - {Math.round(x.nc)} g net carbs</span>
                    </div>
                    <button onClick={() => removeItem(i)} className="text-xs text-neutral-400 hover:text-red-500" aria-label="remove">
                      Remove
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      value={x.it.portionType}
                      onChange={(e) => updateItem(i, { portionType: e.target.value as TrayItem['portionType'] })}
                      className="rounded border border-neutral-300 bg-transparent px-2 py-1 text-xs dark:border-neutral-700"
                    >
                      <option value="serving">{x.it.food.katoriGrams ? 'Serving' : 'Count (1 = one ' + x.it.food.name.toLowerCase() + ')'}</option>
                      {x.it.food.katoriGrams && <option value="katori">Katori</option>}
                      <option value="grams">Grams</option>
                    </select>
                    <input
                      type="number"
                      min={0.5} step={0.5}
                      value={x.it.portionValue}
                      onChange={(e) => updateItem(i, { portionValue: Math.max(0.5, Number(e.target.value) || 1) })}
                      className="w-20 rounded border border-neutral-300 bg-transparent px-2 py-1 text-xs dark:border-neutral-700"
                    />
                    <span className="text-xs text-neutral-500">= {Math.round(x.grams)} g</span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="Calories" value={`${Math.round(totals.kcal)}`} unit="kcal" />
              <MiniStat label="Carbs" value={`${Math.round(totals.carbs)}`} unit="g" />
              <MiniStat label="Protein" value={`${Math.round(totals.protein)}`} unit="g" />
              <MiniStat label="Fat" value={`${Math.round(totals.fat)}`} unit="g" />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="text-xs text-neutral-500">
                When did you eat?
                <select
                  value={whenMin}
                  onChange={(e) => setWhenMin(Number(e.target.value))}
                  className="ml-2 rounded border border-neutral-300 bg-transparent px-2 py-1 text-xs dark:border-neutral-700"
                >
                  {WHEN_OPTIONS.map((o) => (
                    <option key={o.minutes} value={o.minutes}>{o.label}</option>
                  ))}
                </select>
              </label>
              {mealType && (
                <span className="text-xs text-neutral-500">This counts as your <strong>{mealType}</strong> (about {Math.round(totals.nc)} g net carbs).</span>
              )}
            </div>

            {previewSpike && band && (
              <div className="mt-4 rounded-lg bg-neutral-50 p-3 text-sm dark:bg-neutral-900">
                <div className="flex items-center justify-between">
                  <p>
                    Predicted glucose rise: <strong>+{Math.round(previewSpike.deltaMgDl)} mg/dL</strong> peaking ~{previewSpike.timeToPeakMin} min after eating.
                  </p>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${bandColor(band)}`}>
                    {band.toUpperCase()}
                  </span>
                </div>
                {band !== 'green' && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {halfPortion && halfPortion.spike.deltaMgDl < previewSpike.deltaMgDl - 3 && (
                      <button
                        onClick={() =>
                          setTray((t) =>
                            t.map((x, i) =>
                              i === halfPortion.idx ? { ...x, portionValue: +(x.portionValue / 2).toFixed(2) } : x,
                            ),
                          )
                        }
                        className="rounded-full border border-brand-300 bg-brand-50 px-3 py-1 text-xs text-brand-700 hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300"
                      >
                        One option: half portion of {halfPortion.name} - rise about +{Math.round(halfPortion.spike.deltaMgDl)} mg/dL
                      </button>
                    )}
                    {walkSpike && walkSpike.deltaMgDl < previewSpike.deltaMgDl - 3 && (
                      <span className="rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-xs text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
                        Or: a 15-min walk after - rise about +{Math.round(walkSpike.deltaMgDl)} mg/dL
                      </span>
                    )}
                  </div>
                )}
                <p className="mt-2 text-[11px] text-neutral-500">
                  Educational estimate from your model, not medical advice.
                </p>
              </div>
            )}

            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes for this meal (optional)..."
              className="mt-4 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
            />

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="mt-4 flex gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {saving ? 'Saving...' : `Log this meal (${items.length} item${items.length > 1 ? 's' : ''})`}
              </button>
              <button
                onClick={() => setTray([])}
                className="rounded-lg border border-neutral-300 px-5 py-2.5 text-sm dark:border-neutral-700"
              >
                Clear tray
              </button>
            </div>
          </div>
        )}

        {postMeal && <PostMealFeedback meal={postMeal} onDismiss={() => setPostMeal(null)} />}

        <RecentMeals />

        {savedMsg && (
          <div className="mt-4 rounded-lg border border-brand-300 bg-brand-50 p-4 text-sm text-brand-800 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-200">
            {savedMsg}{' '}
            <Link href="/dashboard" className="ml-1 font-medium underline">View dashboard</Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function bandColor(band: string) {
  return band === 'green'
    ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
    : band === 'yellow'
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
      : 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300';
}

function MiniStat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-0.5 font-semibold">{value} {unit && <span className="text-xs font-normal text-neutral-400">{unit}</span>}</div>
    </div>
  );
}