'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { istNow, a1cToEagMgDl } from '@/lib/clinical-db';

interface LabRow {
  id: string;
  value: number;
  unit: string;
  a1cPercent: number;
  performedAt: string;
  labName: string | null;
}

interface TrendPoint {
  date: string;
  a1cPercent: number;
  eagMgDl: number;
  eagMmolL: number;
}

export default function LabsPage() {
  const [labs, setLabs] = useState<LabRow[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('%');
  const [date, setDate] = useState('');
  const [labName, setLabName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch('/api/labs');
      if (r.ok) {
        const j = await r.json();
        setLabs(j.labs ?? []);
        setTrend(j.trend ?? []);
      }
    } catch {
      // offline-tolerant: keep whatever we already have
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    setDate(istNow().slice(0, 10));
    load();
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch('/api/labs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: Number(value),
          unit,
          performedAt: date,
          ...(labName.trim() ? { labName: labName.trim() } : {}),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Could not save this result.');
      setValue('');
      setLabName('');
      setMsg('Saved. Your trend below is updated.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this result.');
    } finally {
      setSaving(false);
    }
  }

  const latest = trend.at(-1);
  const prev = trend.length >= 2 ? trend[trend.length - 2] : null;
  const delta = latest && prev ? latest.a1cPercent - prev.a1cPercent : null;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Lab results</h1>
        <p className="mt-1 text-sm text-neutral-500">
          HbA1c from your lab reports, with eAG (estimated average glucose) - so two numbers that
          sound different tell one story.
        </p>

        <p className="mt-4 text-xs text-amber-700 dark:text-amber-400">
          Educational tool, not a diagnosis. Your doctor interprets lab results in the context of
          your full health picture.
        </p>

        <div className="mt-6 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="text-lg font-semibold">Add an HbA1c result</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-neutral-500">
              Value
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                inputMode="decimal"
                placeholder={unit === '%' ? 'e.g. 6.8' : 'e.g. 51'}
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
              />
            </label>
            <label className="text-xs text-neutral-500">
              Unit on the report
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
              >
                <option value="%">% (most Indian labs)</option>
                <option value="mmol/mol">mmol/mol (IFCC)</option>
              </select>
            </label>
            <label className="text-xs text-neutral-500">
              Test date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
              />
            </label>
            <label className="text-xs text-neutral-500">
              Lab name (optional)
              <input
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                placeholder="e.g. Metropolis, Dr Lal"
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
              />
            </label>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <button
            onClick={save}
            disabled={saving || !value || !date}
            className="mt-4 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save result'}
          </button>
        </div>

        {loaded && trend.length === 0 && (
          <p className="mt-6 text-sm text-neutral-500">
            No lab results yet - add your latest HbA1c above. A trend appears from the second
            result onwards.
          </p>
        )}

        {latest && (
          <div className="mt-6 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Your HbA1c trend</h2>
                <p className="text-xs text-neutral-500">Bars run from 4% to 14% for context.</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold">{latest.a1cPercent}%</div>
                <div className="text-xs text-neutral-500">
                  eAG {latest.eagMgDl} mg/dL ({latest.eagMmolL} mmol/L)
                </div>
                {delta != null && (
                  <div
                    className={
                      delta < 0
                        ? 'text-xs text-emerald-600'
                        : delta > 0
                          ? 'text-xs text-amber-600'
                          : 'text-xs text-neutral-400'
                    }
                  >
                    {delta < 0 ? 'down' : delta > 0 ? 'up' : 'no change'}{' '}
                    {Math.abs(delta).toFixed(2)} points vs previous
                  </div>
                )}
              </div>
            </div>

            <ul className="mt-4 space-y-2">
              {[...trend].reverse().map((p) => {
                const w = Math.max(4, Math.min(100, ((p.a1cPercent - 4) / 10) * 100));
                return (
                  <li key={p.date} className="flex items-center gap-3 text-xs">
                    <span className="w-24 shrink-0 tabular-nums text-neutral-500">{p.date}</span>
                    <div className="h-4 flex-1 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-900">
                      <div
                        className={p === latest ? 'h-full bg-brand-500' : 'h-full bg-brand-300 dark:bg-brand-700'}
                        style={{ width: w + '%' }}
                      />
                    </div>
                    <span className="w-44 shrink-0 text-right tabular-nums">
                      {p.a1cPercent}% - eAG {p.eagMgDl} mg/dL
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[11px] text-neutral-400">
              eAG = 28.7 x HbA1c - 46.7 (ADAG study). It translates HbA1c into the average glucose
              level it corresponds to, in the units your meter uses.
            </p>
          </div>
        )}

        {labs.length > 0 && (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs text-neutral-500 dark:bg-neutral-900">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">As reported</th>
                  <th className="px-4 py-3">HbA1c</th>
                  <th className="px-4 py-3">eAG</th>
                  <th className="px-4 py-3">Lab</th>
                </tr>
              </thead>
              <tbody>
                {labs.map((l) => (
                  <tr key={l.id} className="border-t border-neutral-200 dark:border-neutral-800">
                    <td className="px-4 py-3 tabular-nums">{l.performedAt}</td>
                    <td className="px-4 py-3">
                      {l.value} {l.unit}
                    </td>
                    <td className="px-4 py-3 font-medium">{l.a1cPercent}%</td>
                    <td className="px-4 py-3">{a1cToEagMgDl(l.a1cPercent)} mg/dL</td>
                    <td className="px-4 py-3 text-neutral-500">{l.labName ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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