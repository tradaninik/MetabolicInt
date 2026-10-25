'use client';

// C4 (F5): My Foods - every food this user created, with times logged,
// edit (past entries keep their frozen numbers) and delete (409 with
// plain-language reasons while referenced).
import { useCallback, useEffect, useState } from 'react';
import { findTasteByName, findHealingFoodByName } from '@mi/food-db';
import { doshaFoodAdvice } from '@mi/engine';
import Link from 'next/link';

type Food = {
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

const NUM_FIELDS = ['carbsPer100g', 'proteinPer100g', 'fatPer100g', 'fiberPer100g', 'kcalPer100g', 'gi', 'servingGrams'] as const;

export default function MyFoodsPage() {
  const [foods, setFoods] = useState<Food[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [banner, setBanner] = useState('');
  const [editing, setEditing] = useState<Food | null>(null);

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

  async function remove(f: Food) {
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

  const input = 'w-full rounded-lg border border-neutral-300 bg-transparent px-2 py-1.5 text-sm dark:border-neutral-700';
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">My Foods</h1>
      <p className="mt-1 text-sm text-neutral-500">Foods you created - searchable everywhere, editable, yours alone.</p>

      {banner && <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">{banner}</p>}

      {!loaded && <p className="mt-6 text-sm text-neutral-500">Loading...</p>}
      {loaded && foods.length === 0 && (
        <p className="mt-6 text-sm text-neutral-500">
          Nothing here yet. Add your own food from{' '}
          <a href="/log" className="text-brand-600 underline dark:text-brand-400">Log a meal</a>{' '}
          - search something, then &quot;Add your own food&quot;.
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {foods.map((f) => {
          // P4c-b / U16: classical-property overlay. A custom food gets the rasa/dosha
          // badge when its name or an alias matches a curated classic; a Food as Medicine
          // chip when it matches a knowledge-base entry. No match, no badge - no guessing.
          const tasteMatch = findTasteByName(f.name, f.aliases);
          const advice = tasteMatch ? doshaFoodAdvice(tasteMatch.taste) : null;
          const healing = findHealingFoodByName(f.name, f.aliases);
          return (
          <li key={f.id} className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
            {editing?.id === f.id ? (
              <div className="space-y-3">
                <input className={input} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} aria-label="name" />
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
                  <button onClick={saveEdit} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Save</button>
                  <button onClick={() => setEditing(null)} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-medium">{f.name}</span>
                  <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">yours</span>
                  <p className="mt-1 text-xs text-neutral-500">
                    {f.kcalPer100g} kcal/100g · GI {f.gi} · logged {f.useCount} time{f.useCount === 1 ? '' : 's'}
                  </p>
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
                          <span
                            title={advice.label}
                            className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300"
                          >
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
                  {f.aliases.length > 0 && <p className="text-xs text-neutral-400">also searchable as: {f.aliases.join(', ')}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => setEditing(f)} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">Edit</button>
                  <button onClick={() => remove(f)} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40">Delete</button>
                </div>
              </div>
            )}
          </li>
          );
        })}
      </ul>
    </div>
  );
}