'use client';

// Quick Add: log anything in seconds, no prompts, no required fields.
// Design law: every input optional; whatever exists, whenever logged, is enough.
// One number field per item; late entry welcome (optional minutes-ago back-time).
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Kind = 'sugar' | 'walk' | 'sleep' | 'weight';

const FIELDS: Record<Kind, { label: string; icon: string; unit: string; endpoint: string; field: string; hint: string }> = {
  sugar: { label: 'Blood sugar', icon: '\u{1FA78}', unit: 'mg/dL', endpoint: '/api/glucose', field: 'value', hint: 'One number is enough.' },
  walk: { label: 'Walk', icon: '\u{1F6B6}', unit: 'min', endpoint: '/api/activity', field: 'minutes', hint: 'Any movement counts.' },
  sleep: { label: 'Sleep', icon: '\u{1F634}', unit: 'hours', endpoint: '/api/sleep', field: 'hours', hint: 'Last night.' },
  weight: { label: 'Weight', icon: '\u2696}', unit: 'kg', endpoint: '/api/weight', field: 'kg', hint: 'Morning is fine.' },
};

const BACK_OPTIONS: { label: string; minutes: number }[] = [
  { label: 'now', minutes: 0 },
  { label: '30 min ago', minutes: 30 },
  { label: '1 hr ago', minutes: 60 },
  { label: '2 hr ago', minutes: 120 },
  { label: '3 hr ago', minutes: 180 },
];

function fmtIst(t: number): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(t));
}

export default function QuickAdd() {
  const router = useRouter();
  const [open, setOpen] = useState<Kind | null>(null);
  const [value, setValue] = useState('');
  const [backMin, setBackMin] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [lastMeal, setLastMeal] = useState<{ foodId: string; portionType: string; portionValue: number; name: string } | null>(null);
  const [repeatBusy, setRepeatBusy] = useState(false);

  useEffect(() => {
    fetch('/api/meals')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const e = d?.entries?.[0];
        if (e?.foodId) {
          setLastMeal({ foodId: e.foodId, portionType: e.portionType, portionValue: e.portionValue, name: e.food?.name ?? 'last meal' });
        }
      })
      .catch(() => {});
  }, []);

  async function save(kind: Kind) {
    const v = Number(value);
    if (!Number.isFinite(v) || v <= 0) return;
    const cfg = FIELDS[kind];
    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = { [cfg.field]: v };
      if (backMin > 0) body.at = Date.now() - backMin * 60_000;
      if (kind === 'sugar' && backMin > 0) { delete body.at; body.takenAt = Date.now() - backMin * 60_000; }
      if (kind === 'sleep') { delete body.at; if (backMin > 0) body.wokeAt = Date.now() - backMin * 60_000; }
      if (kind === 'weight') { delete body.at; if (backMin > 0) body.takenAt = Date.now() - backMin * 60_000; }
      const res = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('save failed');
      setMsg(cfg.label + ' saved. Thank you.');
      setValue('');
      setOpen(null);
      setBackMin(0);
      router.refresh();
    } catch {
      setMsg('Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function repeatMeal() {
    if (!lastMeal) return;
    setRepeatBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foodId: lastMeal.foodId, portionType: lastMeal.portionType, portionValue: lastMeal.portionValue }),
      });
      if (!res.ok) throw new Error('save failed');
      setMsg('Logged ' + lastMeal.name + ' again.');
      router.refresh();
    } catch {
      setMsg('Could not save. Please try again.');
    } finally {
      setRepeatBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="text-sm font-semibold">Quick log</h2>
      <p className="mt-0.5 text-xs text-neutral-500">No time? One number is enough - log it in seconds.</p>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(Object.keys(FIELDS) as Kind[]).map((k) => (
          <button
            key={k}
            onClick={() => { setOpen(open === k ? null : k); setMsg(null); setValue(''); setBackMin(0); }}
            className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium transition-colors ${
              open === k
                ? 'border-brand-500 bg-brand-50 dark:border-brand-500 dark:bg-brand-950/40'
                : 'border-neutral-200 hover:border-brand-300 dark:border-neutral-800 dark:hover:border-brand-700'
            }`}
          >
            <span className="text-xl">{FIELDS[k].icon}</span>
            <span>{FIELDS[k].label}</span>
          </button>
        ))}
        <button
          onClick={repeatMeal}
          disabled={!lastMeal || repeatBusy}
          className="flex flex-col items-center gap-1 rounded-xl border border-neutral-200 p-3 text-xs font-medium hover:border-brand-300 disabled:opacity-50 dark:border-neutral-800 dark:hover:border-brand-700"
        >
          <span className="text-xl">{'\u{1F35C}'}</span>
          <span>{lastMeal ? 'Again: ' + lastMeal.name.slice(0, 14) : 'Meal again'}</span>
        </button>
      </div>

      {open && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="number" value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={FIELDS[open].unit}
            className="w-28 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
          />
          <select
            value={backMin}
            onChange={(e) => setBackMin(Number(e.target.value))}
            className="rounded-lg border border-neutral-300 bg-transparent px-2 py-2 text-sm dark:border-neutral-700"
          >
            {BACK_OPTIONS.map((o) => (
              <option key={o.minutes} value={o.minutes}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={() => save(open)} disabled={busy || !value}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? 'Saving...' : 'Save'}
          </button>
          <span className="text-xs text-neutral-500">{FIELDS[open].hint}</span>
          <span className="text-xs text-neutral-400" suppressHydrationWarning>
            Records as {fmtIst(Date.now() - backMin * 60_000)}.
          </span>
        </div>
      )}

      <p className="mt-2 text-xs text-neutral-500">
        Want more food choices? <Link href="/log" className="font-medium text-brand-600 hover:underline">Search all foods</Link>
      </p>
      {msg && <p className="mt-1 text-xs text-brand-700 dark:text-brand-300">{msg}</p>}
      <p className="mt-1 text-[11px] text-neutral-500">
        Educational logging, not medical advice. Every entry is optional - data, not a grade.
      </p>
    </section>
  );
}