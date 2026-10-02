'use client';

// Check-in prompt card: surfaces pending 2-hour post-meal glucose check-ins.
// v2: one prompt block PER pending meal (up to 3, most recent first) - several
// meals can be waiting at once. Fed by getPendingCheckIns() (src/lib/pairing.ts).
// Copy follows MI tone: person-first, data-not-judgment, options not orders.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PendingCheckIn } from '@/lib/pairing';

interface Props {
  pending: PendingCheckIn[];
  sampleSize: number;
  isPrior: boolean;
}

function fmtTime(t: number): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(t));
}

// Default value for the datetime-local input: the suggested actual time
// (2h after the meal), formatted in IST. Parsed back as browser-local time.
function toDateTimeInputValue(t: number): string {
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(t));
  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(t));
  const d = (k: string) => dateParts.find((p) => p.type === k)?.value ?? '01';
  const h = (k: string) => timeParts.find((p) => p.type === k)?.value ?? '00';
  return `${d('year')}-${d('month')}-${d('day')}T${h('hour')}:${h('minute')}`;
}

export default function CheckInCard({ pending, sampleSize, isPrior }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [whens, setWhens] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Record<string, string>>({});
  const [dismissed, setDismissed] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const waiting = pending.filter((p) => p.state === 'active' || p.state === 'morning');
  const actionables = waiting.slice(0, 3);
  const extraWaiting = waiting.length - actionables.length;
  const upcomings = pending.filter((p) => p.state === 'upcoming').slice(0, 2);

  const show = actionables.length > 0 || upcomings.length > 0 || sampleSize > 0;
  if (!show || dismissed) return null;

  async function save(p: PendingCheckIn) {
    const v = Number(values[p.key] ?? '');
    if (!Number.isFinite(v) || v <= 0) return;
    setBusyKey(p.key);
    setMsgs((m) => ({ ...m, [p.key]: '' }));
    const body: Record<string, unknown> = { value: v };
    if (p.state === 'morning') {
      const w = whens[p.key] || toDateTimeInputValue(p.dueAt);
      const t = new Date(w).getTime();
      if (!Number.isFinite(t) || t > Date.now() + 5 * 60_000) {
        setBusyKey(null);
        setMsgs((m) => ({
          ...m,
          [p.key]: 'Please enter the actual date and time of the reading (it cannot be in the future).',
        }));
        return;
      }
      body.takenAt = t;
    }
    try {
      const res = await fetch('/api/glucose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('save failed');
      const j = await res.json();
      const n = j.model?.sampleSize ?? sampleSize;
      setMsgs((m) => ({
        ...m,
        [p.key]: j.pairedWith
          ? `Paired with ${j.pairedWith.label}. That is ${n} of 5 check-ins toward your personal model.`
          : 'Reading saved. Data, not a grade - thanks for checking in.',
      }));
      setValues((vs) => ({ ...vs, [p.key]: '' }));
      router.refresh();
    } catch {
      setMsgs((m) => ({ ...m, [p.key]: 'Could not save. Please try again.' }));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-900/60 dark:bg-amber-950/20">
      {actionables.length > 1 && (
        <h2 className="mb-3 text-sm font-semibold text-amber-900 dark:text-amber-200">
          {actionables.length} meals are waiting for a check-in
        </h2>
      )}

      {actionables.map((p, idx) => (
        <div
          key={p.key}
          className={idx > 0 ? 'mt-4 border-t border-amber-200/60 pt-4 dark:border-amber-900/40' : ''}
        >
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {p.state === 'morning' ? 'After-dinner check-in' : '2-hour check-in'}
          </h3>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300" suppressHydrationWarning>
            {p.state === 'morning'
              ? `You logged ${p.label} at ${fmtTime(p.startedAt)}. If you took a reading after dinner, add it with its actual time - it still counts for your model.`
              : `You logged ${p.label} at ${fmtTime(p.startedAt)}. One reading now shows how that meal affected you. Reading window open until ${fmtTime(p.windowEndAt)} - about ${Math.max(0, Math.ceil((p.windowEndAt - nowTick) / 60_000))} min left.`}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="number"
              value={values[p.key] ?? ''}
              onChange={(e) => setValues((vs) => ({ ...vs, [p.key]: e.target.value }))}
              placeholder="mg/dL"
              className="w-28 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            />
            {p.state === 'morning' && (
              <input
                type="datetime-local"
                value={whens[p.key] || toDateTimeInputValue(p.dueAt)}
                onChange={(e) => setWhens((ws) => ({ ...ws, [p.key]: e.target.value }))}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              />
            )}
            <button
              onClick={() => save(p)}
              disabled={busyKey === p.key || !(values[p.key] ?? '')}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
            >
              {busyKey === p.key ? 'Saving...' : 'Save reading'}
            </button>
          </div>
          {msgs[p.key] && (
            <p className="mt-2 text-xs text-amber-900 dark:text-amber-200">{msgs[p.key]}</p>
          )}
        </div>
      ))}

      {extraWaiting > 0 && (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
          +{extraWaiting} more meal{extraWaiting > 1 ? 's' : ''} waiting for a check-in.
        </p>
      )}

      {actionables.length === 0 && upcomings.length > 0 && (
        <div>
          {upcomings.map((p) => (
            <p key={p.key} className="text-sm text-amber-800 dark:text-amber-300" suppressHydrationWarning>
              Next check-in: {p.label} at {fmtTime(p.dueAt)} - in {Math.max(0, Math.ceil((p.dueAt - nowTick) / 60_000))} min. Your dashboard will remind you.
            </p>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-start justify-between gap-2">
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {isPrior
            ? `${sampleSize} of 5 check-ins toward your personal model (fully tuned at 20).`
            : `Personal model active - learned from ${sampleSize} paired meals.`}
        </p>
        <button type="button" onClick={() => setDismissed(true)} className="shrink-0 text-xs text-neutral-500 hover:underline">
          Not now
        </button>
      </div>
      <p className="mt-1 text-[11px] text-neutral-500">
        Educational logging, not medical advice. Your doctor&apos;s targets take precedence.
      </p>
    </section>
  );
}