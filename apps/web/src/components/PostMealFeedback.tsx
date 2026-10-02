'use client';

// Post-meal feedback on /log: celebrates the log itself (self-monitoring),
// offers an optional pre-meal reading (back-dated, honest), and states the
// 2-hour check-in time. MI tone + educational disclaimer.
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  meal: { loggedAt: number; name: string; dueAt: number };
  onDismiss: () => void;
}

const MINUTES_BEFORE = [15, 30, 45, 60, 90];

export default function PostMealFeedback({ meal, onDismiss }: Props) {
  const router = useRouter();
  const [pre, setPre] = useState('');
  const [mins, setMins] = useState(30);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const mealTimeStr = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(meal.loggedAt));
  const dueStr = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(meal.dueAt));

  async function savePre() {
    const v = Number(pre);
    if (!Number.isFinite(v) || v <= 0) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/glucose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: v, takenAt: meal.loggedAt - mins * 60_000 }),
      });
      if (!res.ok) throw new Error('save failed');
      setMsg('Pre-meal reading saved. Pair it with a reading around ' + dueStr + ' and this meal teaches your model.');
      setPre('');
      router.refresh();
    } catch {
      setMsg('Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/60 p-4 text-sm dark:border-brand-800 dark:bg-brand-950/20">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-brand-900 dark:text-brand-100">{meal.name} logged - nice work.</h3>
        <button onClick={onDismiss} className="text-xs text-neutral-500 hover:underline">dismiss</button>
      </div>
      <p className="mt-1 text-xs text-brand-800 dark:text-brand-300" suppressHydrationWarning>
        Logged at {mealTimeStr} - check in around {dueStr} - your dashboard will remind you. Know your glucose from just before eating? Adding it now makes this meal count double.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="number" value={pre}
          onChange={(e) => setPre(e.target.value)}
          placeholder="pre-meal mg/dL"
          className="w-36 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        />
        <select
          value={mins}
          onChange={(e) => setMins(Number(e.target.value))}
          className="rounded-lg border border-neutral-300 bg-white px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        >
          {MINUTES_BEFORE.map((m) => (
            <option key={m} value={m}>{m} min before</option>
          ))}
        </select>
        <button
          onClick={savePre} disabled={busy || !pre}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? 'Saving...' : 'Add pre-meal reading'}
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-brand-800 dark:text-brand-300">{msg}</p>}
      <p className="mt-2 text-[11px] text-neutral-500">
        Educational logging, not medical advice. Readings are data, not a grade.
      </p>
    </div>
  );
}