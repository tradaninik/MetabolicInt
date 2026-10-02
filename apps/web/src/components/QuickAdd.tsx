'use client';

// Quick Add: log anything in seconds, no prompts, no required fields.
// Design law: every input optional; whatever exists, whenever logged, is enough.
// v3: Exercise with type picker (yoga/gym/run/cycle/swim/sports), Blood Pressure
// (two numbers, feeds the health score), and a repeat label that shows the WHOLE
// meal group (short label + tooltip with every item that will be logged).
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Kind = 'sugar' | 'walk' | 'sleep' | 'weight' | 'exercise' | 'bp';

const FIELDS: Record<Kind, { label: string; icon: string; unit: string; endpoint: string; field: string; hint: string }> = {
  sugar: { label: 'Blood sugar', icon: '\u{1FA78}', unit: 'mg/dL', endpoint: '/api/glucose', field: 'value', hint: 'One number is enough.' },
  walk: { label: 'Walk', icon: '\u{1F6B6}', unit: 'min', endpoint: '/api/activity', field: 'minutes', hint: 'Any movement counts.' },
  sleep: { label: 'Sleep', icon: '\u{1F634}', unit: 'hours', endpoint: '/api/sleep', field: 'hours', hint: 'Last night.' },
  weight: { label: 'Weight', icon: '\u2696', unit: 'kg', endpoint: '/api/weight', field: 'kg', hint: 'Morning is fine.' },
  exercise: { label: 'Exercise', icon: '\u{1F3CB}', unit: 'min', endpoint: '/api/activity', field: 'minutes', hint: 'Pick the type below.' },
  bp: { label: 'BP', icon: '\u{1FA7A}', unit: 'mmHg', endpoint: '/api/bp', field: '', hint: 'Both numbers, e.g. 120 / 80.' },
};

const EXERCISE_TYPES: { label: string; value: string }[] = [
  { label: 'Yoga', value: 'yoga' },
  { label: 'Gym / strength', value: 'strength' },
  { label: 'Run', value: 'run' },
  { label: 'Cycle', value: 'cycle' },
  { label: 'Swim', value: 'swim' },
  { label: 'Sports', value: 'sports' },
  { label: 'Other', value: 'other' },
];

const BACK_OPTIONS: { label: string; minutes: number }[] = [
  { label: 'now', minutes: 0 },
  { label: '30 min ago', minutes: 30 },
  { label: '1 hr ago', minutes: 60 },
  { label: '2 hr ago', minutes: 120 },
  { label: '3 hr ago', minutes: 180 },
];

const MEAL_GROUP_GAP_MS = 45 * 60_000;

function fmtIst(t: number): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(t));
}

function shortFoodName(n: string): string {
  return n.replace(/\s*\(.*?\)\s*/g, '').trim();
}

interface QuickEntry {
  foodId: string;
  portionType: string;
  portionValue: number;
  loggedAt: string;
  food?: { name?: string } | null;
}
interface RepeatItem {
  foodId: string;
  portionType: string;
  portionValue: number;
}
interface MyCombo {
  id: string;
  name: string;
  items: RepeatItem[];
}

export default function QuickAdd() {
  const router = useRouter();
  const [open, setOpen] = useState<Kind | null>(null);
  const [value, setValue] = useState('');
  const [backMin, setBackMin] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [exerciseType, setExerciseType] = useState('yoga');
  const [bedHour, setBedHour] = useState(23);
  const [sysVal, setSysVal] = useState('');
  const [diaVal, setDiaVal] = useState('');
  const [lastMeal, setLastMeal] = useState<{ items: RepeatItem[]; name: string; names: string[] } | null>(null);
  const [repeatBusy, setRepeatBusy] = useState(false);
  const [myCombos, setMyCombos] = useState<MyCombo[]>([]);
  const [comboBusy, setComboBusy] = useState(false);

  useEffect(() => {
    fetch('/api/meals')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const entries: QuickEntry[] = d?.entries ?? [];
        const first = entries[0];
        if (!first?.foodId) return;
        const t0 = new Date(first.loggedAt).getTime();
        const group: RepeatItem[] = [];
        const names: string[] = [];
        for (const en of entries) {
          if (t0 - new Date(en.loggedAt).getTime() > MEAL_GROUP_GAP_MS) break;
          group.push({ foodId: en.foodId, portionType: en.portionType, portionValue: en.portionValue });
          names.push(en.food?.name ?? 'food');
        }
        const firstShort = shortFoodName(names[0] ?? 'meal');
        const name =
          names.length > 1 ? `${firstShort.slice(0, 14)} +${names.length - 1}` : (names[0] ?? 'last meal').slice(0, 22);
        setLastMeal({ items: group, name, names });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/combos')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.combos) setMyCombos(d.combos);
      })
      .catch(() => {});
  }, []);

  function sleepWakeMs(): number {
    return Date.now() - backMin * 60_000;
  }
  function sleepBedMs(): number {
    let bed = sleepWakeMs() - (Number(value) || 7) * 3_600_000;
    const h = bedHour; // IST bedtime hour (0-24) picked by the user
    const IST = 5.5 * 3_600_000;
    const wakeIst = sleepWakeMs() + IST;
    const dayStart = Math.floor(wakeIst / 86_400_000) * 86_400_000;
    let bedIst = dayStart + h * 3_600_000;
    if (bedIst > wakeIst) bedIst -= 86_400_000; // bedtime on the previous day
    return bedIst - IST;
  }
  async function save(kind: Kind) {
    if (kind === 'bp') {
      const s = Number(sysVal);
      const d = Number(diaVal);
      if (!Number.isFinite(s) || s <= 0 || !Number.isFinite(d) || d <= 0) return;
    } else {
      const v = Number(value);
      if (!Number.isFinite(v) || v <= 0) return;
    }
    setBusy(true);
    setMsg(null);
    try {
      let res: Response;
      if (kind === 'bp') {
        const body: Record<string, unknown> = { systolic: Number(sysVal), diastolic: Number(diaVal) };
        if (backMin > 0) body.takenAt = Date.now() - backMin * 60_000;
        res = await fetch('/api/bp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        const cfg = FIELDS[kind];
        const body: Record<string, unknown> = { [cfg.field]: Number(value) };
        if (kind === 'exercise') body.type = exerciseType;
        if (kind === 'sugar' && backMin > 0) body.takenAt = Date.now() - backMin * 60_000;
        if (kind === 'walk' && backMin > 0) body.at = Date.now() - backMin * 60_000;
        if (kind === 'exercise' && backMin > 0) body.at = Date.now() - backMin * 60_000;
        if (kind === 'sleep' && backMin > 0) body.wokeAt = Date.now() - backMin * 60_000;if (kind === 'sleep') body.bedAt = sleepBedMs();
        if (kind === 'weight' && backMin > 0) body.takenAt = Date.now() - backMin * 60_000;
        res = await fetch(cfg.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      if (!res.ok) throw new Error('save failed');
      setMsg(FIELDS[kind].label + ' saved. Thank you.');
      setValue('');
      setSysVal('');
      setDiaVal('');
      setOpen(null);
      setBackMin(0);
      router.refresh();
    } catch {
      setMsg('Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function postItems(items: RepeatItem[]): Promise<void> {
    for (const it of items) {
      const res = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foodId: it.foodId, portionType: it.portionType, portionValue: it.portionValue }),
      });
      if (!res.ok) throw new Error('save failed');
    }
  }

  async function repeatMeal() {
    if (!lastMeal || lastMeal.items.length === 0) return;
    setRepeatBusy(true);
    setMsg(null);
    try {
      await postItems(lastMeal.items);
      setMsg('Logged ' + lastMeal.names.slice(0, 3).join(' + ') + (lastMeal.names.length > 3 ? ' +' + (lastMeal.names.length - 3) + ' more' : '') + '.');
      router.refresh();
    } catch {
      setMsg('Could not save. Please try again.');
    } finally {
      setRepeatBusy(false);
    }
  }

  async function logCombo(c: MyCombo) {
    if (!c.items || c.items.length === 0) return;
    setComboBusy(true);
    setMsg(null);
    try {
      await postItems(c.items);
      setMsg('Logged ' + c.name + '.');
      router.refresh();
    } catch {
      setMsg('Could not save. Please try again.');
    } finally {
      setComboBusy(false);
    }
  }

  const canSave =
    open === 'bp' ? !!sysVal && !!diaVal : open !== null && !!value;

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="text-sm font-semibold">Quick log</h2>
      <p className="mt-0.5 text-xs text-neutral-500">No time? One number is enough - log it in seconds.</p>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {(Object.keys(FIELDS) as Kind[]).map((k) => (
          <button
            key={k}
            onClick={() => { setOpen(open === k ? null : k); setMsg(null); setValue(''); setSysVal(''); setDiaVal(''); setBackMin(0); }}
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
          title={lastMeal ? 'Repeat: ' + lastMeal.names.join(', ') : undefined}
          className="flex flex-col items-center gap-1 rounded-xl border border-neutral-200 p-3 text-xs font-medium hover:border-brand-300 disabled:opacity-50 dark:border-neutral-800 dark:hover:border-brand-700"
        >
          <span className="text-xl">{'\u{1F35C}'}</span>
          <span>{lastMeal ? 'Again: ' + lastMeal.name : 'Meal again'}</span>
        </button>
      </div>

      {myCombos.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-neutral-500">My combos:</p>
          <div className="mt-1 -mx-1 overflow-x-auto px-1 pb-1">
            <div className="flex gap-2">
              {myCombos.map((c) => (
                <button
                  key={c.id}
                  onClick={() => logCombo(c)}
                  disabled={comboBusy}
                  title={c.items.length + ' items'}
                  className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50/50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {open === 'exercise' && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXERCISE_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setExerciseType(t.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                exerciseType === t.value
                  ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-950/40 dark:text-brand-300'
                  : 'border-neutral-200 text-neutral-600 hover:border-brand-300 dark:border-neutral-800 dark:text-neutral-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {open === 'bp' ? (
            <>
              <input
                type="number" value={sysVal}
                onChange={(e) => setSysVal(e.target.value)}
                placeholder="systolic"
                className="w-24 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
              />
              <span className="text-sm text-neutral-400">/</span>
              <input
                type="number" value={diaVal}
                onChange={(e) => setDiaVal(e.target.value)}
                placeholder="diastolic"
                className="w-24 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
              />
            </>
          ) : (
            <input
              type="number" value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={FIELDS[open].unit}
              className="w-28 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
            />
          )}
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
            onClick={() => save(open)} disabled={busy || !canSave}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? 'Saving...' : 'Save'}
          </button>
          <span className="text-xs text-neutral-500">{FIELDS[open].hint}</span>
          {open === 'sleep' && (
            <span className="text-xs text-neutral-400" suppressHydrationWarning>
              {fmtIst(sleepBedMs())} to {fmtIst(sleepWakeMs())}.
            </span>
          )}
          <span className="text-xs text-neutral-400" suppressHydrationWarning>
            Records as {fmtIst(Date.now() - backMin * 60_000)}.
          </span>
        </div>
      )}

      <p className="mt-2 text-xs text-neutral-500">
        Want more food choices? <Link href="/log" className="font-medium text-brand-600 hover:underline">Build a meal</Link>
      </p>
      {msg && <p className="mt-1 text-xs text-brand-700 dark:text-brand-300">{msg}</p>}
      <p className="mt-1 text-[11px] text-neutral-500">
        Educational logging, not medical advice. Every entry is optional - data, not a grade.
      </p>
    </section>
  );
}