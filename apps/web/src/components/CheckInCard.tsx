'use client';

// Check-in prompt card: surfaces pending 2-hour post-meal glucose check-ins.
// Fed by server pages via getPendingCheckIns() (src/lib/pairing.ts).
// Copy follows MI tone: person-first, data-not-judgment, options not orders.
import { useState } from 'react';
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
  const [value, setValue] = useState('');
  const [when, setWhen] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const actionable =
    pending.find((p) => p.state === 'active') ??
    pending.find((p) => p.state === 'morning') ??
    null;
  const upcoming = pending.filter((p) => p.state === 'upcoming').slice(0, 1);
  const morningDefault = actionable ? toDateTimeInputValue(actionable.dueAt) : '';
  const whenValue = when || morningDefault;

  async function save() {
    if (!actionable) return;
    const v = Number(value);
    if (!Number.isFinite(v) || v <= 0) return;
    setBusy(true);
    setMsg(null);
    const body: Record<string, unknown> = { value: v };
    if (actionable.state === 'morning') {
      const t = new Date(whenValue).getTime();
      if (!Number.isFinite(t) || t > Date.now() + 5 * 60_000) {
        setBusy(false);
        setMsg('Please enter the actual date and time of the reading (it cannot be in the future).');
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
      setMsg(
        j.pairedWith
          ? `Paired with ${j.pairedWith.label}. That is ${n} of 5 check-ins toward your personal model.`
          : 'Reading saved. Data, not a grade - thanks for checking in.',
      );
      setValue('');
      router.refresh();
    } catch {
      setMsg('Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const show = !!actionable || upcoming.length > 0 || sampleSize > 0;
  if (!show || dismissed) return null;

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-900/60 dark:bg-amber-950/20">
      {actionable && (
        <div>
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {actionable.state === 'morning' ? 'After-dinner check-in' : '2-hour check-in'}
          </h2>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300" suppressHydrationWarning>
            {actionable.state === 'morning'
              ? `You logged ${actionable.label} at ${fmtTime(actionable.startedAt)}. If you took a reading after dinner, add it with its actual time - it still counts for your model.`
              : `You logged ${actionable.label} at ${fmtTime(actionable.startedAt)}. One reading now shows how that meal affected you.`}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="number" value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="mg/dL"
              className="w-28 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            />
            {actionable.state === 'morning' && (
              <input
                type="datetime-local" value={whenValue}
                onChange={(e) => setWhen(e.target.value)}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              />
            )}
            <button
              onClick={save} disabled={busy || !value || (actionable.state === 'morning' && !whenValue)}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
            >
              {busy ? 'Saving...' : 'Save reading'}
            </button>
            <button type='button' onClick={() => setDismissed(true)} className='text-xs text-neutral-500 hover:underline'>Not now</button>
          </div>
        </div>
      )}
      {upcoming.length > 0 && !actionable && (
        <p className="text-sm text-amber-800 dark:text-amber-300" suppressHydrationWarning>
          Next check-in: {upcoming[0].label} around {fmtTime(upcoming[0].dueAt)}. Your dashboard will remind you.
        </p>
      )}
      {msg && <p className="mt-2 text-xs text-amber-900 dark:text-amber-200">{msg}</p>}
      <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
        {isPrior
          ? `${sampleSize} of 5 check-ins toward your personal model (fully tuned at 20).`
          : `Personal model active - learned from ${sampleSize} paired meals.`}
      </p>
      <p className="mt-1 text-[11px] text-neutral-500">
        Educational logging, not medical advice. Your doctor&apos;s targets take precedence.
      </p>
    </section>
  );
}