'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import type { Food, GlucoseSpike } from '@mi/engine';
import { macrosForGrams, netCarbsG, estimateGlucoseSpike } from '@mi/engine';
import { REGION_LABELS } from '@mi/food-db';
import PostMealFeedback from '@/components/PostMealFeedback';

export default function LogPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [fallback, setFallback] = useState(false);
  const [selected, setSelected] = useState<Food | null>(null);
  const [portionType, setPortionType] = useState<'serving' | 'katori' | 'grams'>('serving');
  const [portionValue, setPortionValue] = useState(1);
  const [region, setRegion] = useState('');
  const [sensitivity, setSensitivity] = useState(1.5);
  const [diabetic, setDiabetic] = useState(false);
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

  // Debounced search.
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/foods?q=${encodeURIComponent(query)}${region ? `&region=${region}` : ''}`);
      if (res.ok) {
        const j = await res.json();
        if (j.foods.length === 0 && region) {
          const res2 = await fetch('/api/foods?q=' + encodeURIComponent(query));
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
  }, [query, region]);

  const grams = selected
    ? portionType === 'grams'
      ? portionValue
      : portionType === 'katori'
        ? portionValue * (selected.katoriGrams ?? selected.servingGrams)
        : portionValue * selected.servingGrams
    : 0;

  const macros = selected ? macrosForGrams(selected, grams) : null;
  const previewSpike: GlucoseSpike | null = selected && macros
    ? estimateGlucoseSpike({
        carbsG: netCarbsG(macros.carbsG, macros.fiberG),
        gi: selected.gi,
        sensitivity,
        mealAt: Date.now(),
      })
    : null;

  const band = previewSpike
    ? previewSpike.deltaMgDl <= (diabetic ? 30 : 20) ? 'green' : previewSpike.deltaMgDl <= (diabetic ? 60 : 40) ? 'yellow' : 'red'
    : null;

  async function handlePhoto(file: File) {
    // v1: store as a data URL in memory only (no upload). Real CV recognition is a Phase-2 swap-in.
    if (file.size > 4_000_000) {
      setError('Photo is large (>4MB). Using a smaller image is recommended.');
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoPath(reader.result as string);
    reader.readAsDataURL(file);
    setSavedMsg(null);
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    const res = await fetch('/api/meals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        foodId: selected.id,
        portionType,
        portionValue,
        photoPath,
        notes,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const j = await res.json();
      if (j.entry && j.checkIn) {
        setPostMeal({
          loggedAt: new Date(j.entry.loggedAt).getTime(),
          name: selected.name,
          dueAt: j.checkIn.dueAt,
        });
      } else {
        setPostMeal(null);
      }
      const spike = j.predictedSpike?.deltaMgDl ?? 0;
      setSavedMsg(`Logged ${selected.name}. Predicted glucose rise ≈ ${Math.round(spike)} mg/dL.`);
      setSelected(null);
      setQuery('');
      setResults([]);
      setPhotoPath(null);
      setNotes('');
      if (fileRef.current) fileRef.current.value = '';
    } else {
      setError('Could not save the meal. Please try again.');
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Log a meal</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Pick a food, set the portion, and see your predicted glucose response in real time.
        </p>

        {/* Photo capture (Phase-2 CV hook noted below) */}
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
            {photoPath && (
              <img src={photoPath} alt="meal" className="h-16 w-16 rounded-lg object-cover" />
            )}
          </div>
          <p className="mt-2 text-[11px] text-neutral-400">
            Photo is stored locally for now. Automatic food recognition (OpenAI Vision) is a Phase-2 upgrade — for v1, pick the food below and adjust the portion.
          </p>
        </div>

        {/* Search */}
        <div className="mt-6">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 139 foods — dosa, biryani, chapati, pizza…"
            className="w-full rounded-lg border border-neutral-300 bg-transparent px-4 py-3 outline-none focus:border-brand-500 dark:border-neutral-700"
          />
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-neutral-500">Filter:</span>
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
                    onClick={() => { setSelected(f); setSavedMsg(null); }}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-900"
                  >
                    <span>
                      <span className="font-medium">{f.name}</span>
                      <span className="ml-2 text-xs text-neutral-400">{REGION_LABELS[f.region]} · GI {f.gi}</span>
                    </span>
                    <span className="text-xs text-neutral-400">{f.kcalPer100g} kcal/100g</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Selected food + portion + preview */}
        {selected && macros && previewSpike && band && (
          <div className="mt-6 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">{selected.name}</h2>
                <p className="text-xs text-neutral-500">{REGION_LABELS[selected.region]} · {selected.category} · GI {selected.gi}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${bandColor(band)}`}>
                {band.toUpperCase()} · +{Math.round(previewSpike.deltaMgDl)} mg/dL
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-4">
              <label className="text-sm">
                <span className="mb-1 block text-neutral-500">Portion type</span>
                <select
                  value={portionType}
                  onChange={(e) => setPortionType(e.target.value as typeof portionType)}
                  className="rounded border border-neutral-300 bg-transparent px-2 py-1.5 dark:border-neutral-700"
                >
                  <option value="serving">Serving</option>
                  {selected.katoriGrams && <option value="katori">Katori</option>}
                  <option value="grams">Grams</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-neutral-500">{portionType === 'grams' ? 'Grams' : 'Quantity'}</span>
                <input
                  type="number"
                  min={1}
                  value={portionValue}
                  onChange={(e) => setPortionValue(Math.max(0.5, Number(e.target.value) || 1))}
                  className="w-24 rounded border border-neutral-300 bg-transparent px-2 py-1.5 dark:border-neutral-700"
                />
              </label>
              <div className="text-xs text-neutral-500">= {Math.round(grams)} g</div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="Calories" value={`${macros.kcal}`} unit="kcal" />
              <MiniStat label="Carbs" value={`${macros.carbsG}`} unit="g" />
              <MiniStat label="Protein" value={`${macros.proteinG}`} unit="g" />
              <MiniStat label="Fat" value={`${macros.fatG}`} unit="g" />
            </div>

            <div className="mt-4 rounded-lg bg-neutral-50 p-3 text-sm dark:bg-neutral-900">
              <p>
                Predicted glucose rise: <strong>+{previewSpike.deltaMgDl} mg/dL</strong> peaking ~{previewSpike.timeToPeakMin} min after the meal.
              </p>
              {band !== 'green' && (
                <p className="mt-1 text-xs text-neutral-500">
                  Tip: a 15-minute walk after eating can cut this spike by up to half.
                </p>
              )}
            </div>

            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional)…"
              className="mt-4 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
            />

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="mt-4 flex gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Log this meal'}
              </button>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg border border-neutral-300 px-5 py-2.5 text-sm dark:border-neutral-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {postMeal && (
          <PostMealFeedback meal={postMeal} onDismiss={() => setPostMeal(null)} />
        )}

        {savedMsg && (
          <div className="mt-4 rounded-lg border border-brand-300 bg-brand-50 p-4 text-sm text-brand-800 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-200">
            ✓ {savedMsg}{' '}
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
