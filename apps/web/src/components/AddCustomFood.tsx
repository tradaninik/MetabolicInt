'use client';
// C3: the accelerators join the core form (C2) - the packet-label
// paste-parser (F2) and the fork-from-catalog mini-search (F4). The tray's
// "Save as food" button (F3) opens this same component in recipe mode: the
// page computes blended numbers and passes them via `initial`.
import { useState } from 'react';
import { GI_BANDS, GI_DEFAULT, atwaterKcal } from '@/lib/food-validation';
import { parseNutritionLabel } from '@/lib/label-parser';

export interface CustomFoodCreated { id: string; name: string; [k: string]: unknown; }

interface Props {
  initial?: Record<string, unknown>;
  onCreated: (food: CustomFoodCreated) => void;
  onCancel?: () => void;
}

const num = (v: string) => (v.trim() === '' ? undefined : v.trim());

/** Aliases arrive as string[] (engine foods) or a JSON string (prisma rows). */
function aliasesToForm(a: unknown): string {
  if (Array.isArray(a)) return a.join(',');
  if (typeof a === 'string' && a) {
    try { const v = JSON.parse(a); return Array.isArray(v) ? v.join(',') : ''; } catch { return ''; }
  }
  return '';
}

export default function AddCustomFood({ initial, onCreated, onCancel }: Props) {
  const g = (k: string, d = '') => String(initial?.[k] ?? d);
  const [name, setName] = useState(g('name'));
  const [carbs, setCarbs] = useState(g('carbsPer100g'));
  const [protein, setProtein] = useState(g('proteinPer100g'));
  const [fat, setFat] = useState(g('fatPer100g'));
  const [fiber, setFiber] = useState(g('fiberPer100g'));
  const [kcal, setKcal] = useState(g('kcalPer100g'));
  const [gi, setGi] = useState(Number(initial?.gi ?? GI_DEFAULT));
  const [aliases, setAliases] = useState(aliasesToForm(initial?.aliases));
  const [serving, setServing] = useState(g('servingGrams'));
  // Carried through from a fork (a forked dosa keeps its katori portion) but
  // not shown as a field - smallest surface, no fidelity loss.
  const [katori, setKatori] = useState(g('katoriGrams'));
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState<string[]>([]);
  const [forkQ, setForkQ] = useState('');
  const [forkHits, setForkHits] = useState<{ id: string; name: string; [k: string]: unknown }[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState('');
  const [busy, setBusy] = useState(false);

  const impliedKcal = [carbs, protein, fat].every((v) => v === '' || !isNaN(Number(v)))
    ? atwaterKcal(Number(carbs || 0), Number(protein || 0), Number(fat || 0))
    : null;

  // F2: parse the pasted label, rescaled to per-100g by the lib.
  function applyParsed() {
    const p = parseNutritionLabel(label);
    if (p.carbsPer100g !== undefined) setCarbs(String(p.carbsPer100g));
    if (p.proteinPer100g !== undefined) setProtein(String(p.proteinPer100g));
    if (p.fatPer100g !== undefined) setFat(String(p.fatPer100g));
    if (p.fiberPer100g !== undefined) setFiber(String(p.fiberPer100g));
    if (p.kcalPer100g !== undefined) setKcal(String(p.kcalPer100g));
    setNotes(p.notes);
  }

  // F4: mini-search over /api/foods (catalog + mine).
  async function runFork() {
    if (!forkQ.trim()) return;
    const res = await fetch(`/api/foods?q=${encodeURIComponent(forkQ.trim())}`);
    const data = await res.json().catch(() => ({ foods: [] }));
    setForkHits((data.foods ?? []).slice(0, 8));
  }

  function prefillFrom(f: Record<string, unknown>) {
    setName(String(f.name ?? ''));
    setCarbs(String(f.carbsPer100g ?? ''));
    setProtein(String(f.proteinPer100g ?? ''));
    setFat(String(f.fatPer100g ?? ''));
    setFiber(String(f.fiberPer100g ?? ''));
    setKcal(String(f.kcalPer100g ?? ''));
    setGi(Number(f.gi ?? GI_DEFAULT));
    setServing(String(f.servingGrams ?? ''));
    setAliases(aliasesToForm(f.aliases));
    setKatori(f.katoriGrams != null ? String(f.katoriGrams) : '');
    setForkHits([]);
  }

  async function save() {
    setBusy(true); setErrors({}); setBanner('');
    const body: Record<string, unknown> = { name, gi };
    for (const [k, v] of Object.entries({
      carbsPer100g: num(carbs), proteinPer100g: num(protein), fatPer100g: num(fat),
      fiberPer100g: num(fiber), kcalPer100g: num(kcal), servingGrams: num(serving),
      katoriGrams: num(katori),
    })) if (v !== undefined) body[k] = v;
    if (aliases.trim()) body.aliases = aliases;
    const res = await fetch('/api/foods/custom', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setLabel(''); setNotes([]); onCreated(data.food); return; }
    if (res.status === 400 && data.errors) setErrors(data.errors);
    else setBanner(data.error ?? 'Could not save this food.');
  }

  const input = 'w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700';
  return (
    <div className="space-y-3">
      <input className={input} placeholder="Food name (the only required field)" value={name} onChange={(e) => setName(e.target.value)} />
      {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}

      <details className="rounded-lg border border-neutral-200 dark:border-neutral-800">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400">Paste a packet label</summary>
        <div className="space-y-2 p-3">
          <textarea className={input} rows={2} value={label} onChange={(e) => setLabel(e.target.value)} onPaste={(e) => { const text = e.clipboardData.getData('text'); if (text) { e.preventDefault(); setLabel(text); const p = parseNutritionLabel(text); if (p.carbsPer100g !== undefined) setCarbs(String(p.carbsPer100g)); if (p.proteinPer100g !== undefined) setProtein(String(p.proteinPer100g)); if (p.fatPer100g !== undefined) setFat(String(p.fatPer100g)); if (p.fiberPer100g !== undefined) setFiber(String(p.fiberPer100g)); if (p.kcalPer100g !== undefined) setKcal(String(p.kcalPer100g)); setNotes(p.notes); } }} placeholder="Per 30g - Energy 150 kcal, Carbohydrate 20g, Protein 4g, Fat 5g, Dietary Fibre 2g" />
          <button type="button" onClick={applyParsed} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium dark:border-neutral-700">Parse label</button>
          {notes.map((n) => <p key={n} className="text-xs text-amber-700 dark:text-amber-400">{n}</p>)}
        </div>
      </details>

      <details className="rounded-lg border border-neutral-200 dark:border-neutral-800">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400">Start from an existing food</summary>
        <div className="space-y-2 p-3">
          <div className="flex gap-2">
            <input className={input} value={forkQ} onChange={(e) => setForkQ(e.target.value)} placeholder="Search the catalog - dosa, upma..." />
            <button type="button" onClick={runFork} className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium dark:border-neutral-700">Find</button>
          </div>
          <ul className="space-y-1">
            {forkHits.map((f) => (
              <li key={f.id}>
                <button type="button" onClick={() => prefillFrom(f)} className="text-sm text-brand-600 hover:underline dark:text-brand-400">
                  {String(f.name)}{f.id.startsWith('custom-') ? ' (yours)' : ''}
                </button>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-neutral-500">Prefills the form - tweak anything and save as your own.</p>
        </div>
      </details>

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