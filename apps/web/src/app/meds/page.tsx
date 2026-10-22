'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { istNow } from '@/lib/clinical-db';

interface MedLogRow {
  medicationId: string;
  logDate: string;
  slotTime: string;
  status: string;
}

interface Med {
  id: string;
  name: string;
  scheduleTimes: string;
  isActive: boolean;
  logs: MedLogRow[];
}

interface Adherence {
  expected: number;
  taken: number;
  skipped: number;
  pending: number;
  pct: number | null;
}

function parseSlots(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export default function MedsPage() {
  const [meds, setMeds] = useState<Med[]>([]);
  const [adherence, setAdherence] = useState<Adherence | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
  const [times, setTimes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [today, setToday] = useState('');

  async function load() {
    try {
      const r = await fetch('/api/meds');
      if (r.ok) {
        const j = await r.json();
        setMeds(j.meds ?? []);
        setAdherence(j.adherence ?? null);
      }
    } catch {
      // keep whatever we already have
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    setToday(istNow().slice(0, 10));
    load();
  }, []);

  async function addMed() {
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const scheduleTimes = times.split(',').map((t) => t.trim()).filter((t) => t !== '');
      const res = await fetch('/api/meds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), scheduleTimes }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Could not add.');
      setName('');
      setTimes('');
      setMsg('Added. Mark today\u0027s times below as they happen.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add.');
    } finally {
      setSaving(false);
    }
  }

  async function mark(medicationId: string, slotTime: string, status: 'taken' | 'skipped') {
    setError(null);
    try {
      const res = await fetch('/api/meds/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicationId, logDate: today, slotTime, status }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Could not save.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  }

  async function undo(medicationId: string, slotTime: string) {
    setError(null);
    try {
      const res = await fetch(
        '/api/meds/log?medicationId=' +
          encodeURIComponent(medicationId) +
          '&logDate=' +
          today +
          '&slotTime=' +
          encodeURIComponent(slotTime),
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setError('Could not undo. Please try again.');
    }
  }

  async function toggleActive(m: Med) {
    setError(null);
    try {
      const res = await fetch('/api/meds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: m.id, isActive: !m.isActive }),
      });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setError('Could not update. Please try again.');
    }
  }

  const active = meds.filter((m) => m.isActive);
  const inactive = meds.filter((m) => !m.isActive);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Medication times</h1>
        <p className="mt-1 text-sm text-neutral-500">
          A gentle record of whether you kept your scheduled medicine times - for you and your
          doctor to see, nothing more.
        </p>

        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          MetabolicInt stores no dose amounts and gives no medication advice - only the times you
          set. Your prescription and your doctor come first.
        </p>

        {adherence && adherence.expected > 0 && (
          <div className="mt-6 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
            <h2 className="text-sm font-semibold">Last 7 days</h2>
            <p className="mt-1 text-sm">
              You marked <strong>{adherence.taken} of {adherence.expected}</strong> scheduled doses
              as taken ({adherence.pct ?? 0}%).
              {adherence.pending > 0 && ' ' + adherence.pending + ' still unmarked.'}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              This is your record, not a scorecard - bring it to your visit.
            </p>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="text-lg font-semibold">Track a medicine</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-neutral-500">
              Name (as on your prescription)
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Metformin"
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
              />
            </label>
            <label className="text-xs text-neutral-500">
              Times per day (24-hour, comma separated)
              <input
                value={times}
                onChange={(e) => setTimes(e.target.value)}
                placeholder="e.g. 08:00, 20:00"
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
              />
            </label>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <button
            onClick={addMed}
            disabled={saving || !name.trim() || !times.trim()}
            className="mt-4 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Adding...' : 'Add'}
          </button>
        </div>

        {loaded && active.length === 0 && (
          <p className="mt-6 text-sm text-neutral-500">
            Nothing tracked yet. Add the medicines on your prescription - just their names and
            times, never doses.
          </p>
        )}

        {active.map((m) => (
          <div key={m.id} className="mt-4 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{m.name}</h3>
                <p className="text-xs text-neutral-500">Today ({today}) - tap as they happen:</p>
              </div>
              <button
                onClick={() => toggleActive(m)}
                className="text-xs text-neutral-400 hover:underline"
              >
                Stop tracking
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {parseSlots(m.scheduleTimes).map((s) => {
                const log = m.logs.find((l) => l.logDate === today && l.slotTime === s);
                return (
                  <span
                    key={s}
                    className="flex items-center gap-2 rounded-full border border-neutral-200 px-3 py-1.5 text-xs dark:border-neutral-800"
                  >
                    <span className="tabular-nums text-neutral-500">{s}</span>
                    {!log && (
                      <>
                        <button
                          type="button"
                          onClick={() => mark(m.id, s, 'taken')}
                          className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                        >
                          taken
                        </button>
                        <button
                          type="button"
                          onClick={() => mark(m.id, s, 'skipped')}
                          className="text-neutral-400 hover:underline"
                        >
                          skipped
                        </button>
                      </>
                    )}
                    {log?.status === 'taken' && (
                      <>
                        <span className="font-medium text-brand-600 dark:text-brand-400">taken</span>
                        <button type="button" onClick={() => undo(m.id, s)} className="text-neutral-400 hover:underline">
                          undo
                        </button>
                      </>
                    )}
                    {log?.status === 'skipped' && (
                      <>
                        <span className="text-neutral-400">skipped</span>
                        <button type="button" onClick={() => undo(m.id, s)} className="text-neutral-400 hover:underline">
                          undo
                        </button>
                      </>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        ))}

        {inactive.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-neutral-500">Stopped tracking (history kept)</h2>
            <ul className="mt-2 space-y-2">
              {inactive.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-2 text-sm dark:border-neutral-800"
                >
                  <span className="text-neutral-500">{m.name}</span>
                  <button onClick={() => toggleActive(m)} className="text-xs text-brand-600 hover:underline">
                    Resume
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {msg && (
          <p className="mt-4 rounded-lg border border-brand-300 bg-brand-50 p-3 text-sm text-brand-800 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-200">
            {msg}
          </p>
        )}
      </div>
    </AppShell>
  );
}