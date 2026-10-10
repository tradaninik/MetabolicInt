'use client';
// F1: the core creation form. Only the name is required (promptless law);
// every other field stays blank and the server fills it in (Atwater kcal,
// GI band default, category/region). C3 adds the label paste-parser and
// the fork-from-catalog mini-search to this component.
import { useState } from 'react';
import { GI_BANDS, GI_DEFAULT, atwaterKcal } from '@/lib/food-validation';

export interface CustomFoodCreated { id: string; name: string; [k: string]: unknown; }

interface Props {
  initial?: Record<string, unknown>;
  onCreated: (food: CustomFoodCreated) => void;
  onCancel?: () => void;
}

const num = (v: string) => (v.trim() === '' ? undefined : v.trim());

export default function AddCustomFood({ initial, onCreated, onCancel }: Props) {
  const g = (k: string, d = '') => String(initial?.[k] ?? d);
  const [name, setName] = useState(g('name'));
  const [carbs, setCarbs] = useState(g('carbsPer100g'));
  const [protein, setProtein] = useState(g('proteinPer100g'));
  const [fat, setFat] = useState(g('fatPer100g'));
  const [fiber, setFiber] = useState(g('fiberPer100g'));
  const [kcal, setKcal] = useState(g('kcalPer100g'));
  const [gi, setGi] = useState(Number(initial?.gi ?? GI_DEFAULT));
  const [aliases, setAliases] = useState(Array.isArray(initial?.aliases) ? (initial?.aliases as string[]).join(',') : '');
  const [serving, setServing] = useState(g('servingGrams'));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState('');
  const [busy, setBusy] = useState(false);

  // Live Atwater hint: what the server will store if kcal stays blank.
  const impliedKcal = [carbs, protein, fat].every((v) => v === '' || !isNaN(Number(v)))
    ? atwaterKcal(Number(carbs || 0), Number(protein || 0), Number(fat || 0))
    : null;

  async function save() {
    setBusy(true); setErrors({}); setBanner('');
    const body: Record<string, unknown> = { name, gi };
    for (const [k, v] of Object.entries({
      carbsPer100g: num(carbs), proteinPer100g: num(protein), fatPer100g: num(fat),
      fiberPer100g: num(fiber), kcalPer100g: num(kcal), servingGrams: num(serving),
    })) if (v !== undefined) body[k] = v;
    if (aliases.trim()) body.aliases = aliases;
    const res = await fetch('/api/foods/custom', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { onCreated(data.food); return; }
    if (res.status === 400 && data.errors) setErrors(data.errors);
    else setBanner(data.error ?? 'Could not save this food.');
  }

  const input = 'w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700';
  return (
    <div className="space-y-3">
      <input className={input} placeholder="Food name (the only required field)" value={name} onChange={(e) => setName(e.target.value)} />
      {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}

      <div className="grid grid-cols-2 gap-2 text-sm">
        <label>Carbs /100g<input className={input} inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} /></label>
        <label>Protein /100g<input className={input} inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} /></label>
        <label>Fat /100g<input className={input} inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} /></label>
        <label>Fibre /100g<input className={input} inputMode="decimal" value={fiber} onChange={(e) => setFiber(e.target.value)} /></label>
        <label>kcal /100g<input className={input} inputMode="decimal" value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder={impliedKcal !== null ? `auto: ${impliedKcal}` : ''} /></label>
        <label>Serving grams<input className={input} inputMode="decimal" value={serving} onChange={(e) => setServing(e.target.value)} /></label>
      </div>
      {errors.kcalPer100g && <p className="text-sm text-red-600">{errors.kcalPer100g}</p>}

      <div className="flex flex-wrap items-center gap-1 text-sm">
        <span>GI:</span>
        {GI_BANDS.map((b) => (
          <button key={b.value} type="button" onClick={() => setGi(b.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              gi === b.value
                ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-950/40 dark:text-brand-300'
                : 'border-neutral-200 text-neutral-600 dark:border-neutral-800 dark:text-neutral-400'
            }`}>{b.label}</button>
        ))}
        <input className="w-16 rounded border border-neutral-300 bg-transparent px-2 py-1 text-xs dark:border-neutral-700" inputMode="numeric" value={gi} onChange={(e) => setGi(Number(e.target.value) || 0)} />
        <span className="text-xs text-neutral-500">a starting guess - your 2-hour check-ins learn the truth</span>
      </div>
      {errors.gi && <p className="text-sm text-red-600">{errors.gi}</p>}

      <input className={input} placeholder="Also searchable as (comma-separated, max 5) - chawal, anna, atta" value={aliases} onChange={(e) => setAliases(e.target.value)} />
      {errors.aliases && <p className="text-sm text-red-600">{errors.aliases}</p>}
      {banner && <p className="text-sm text-red-600">{banner}</p>}

      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={save}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          {busy ? 'Saving...' : 'Save food'}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700">Cancel</button>}
      </div>
    </div>
  );
}