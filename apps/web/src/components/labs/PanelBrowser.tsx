'use client';

// P6-d — the A–E category browser on /labs.
//
// Entry is one grouped form: pick a date + lab name at the top, fill the
// tests you have (accordion by category A–E), save everything as ONE panel.
// HbA1c keeps its %/mmol/mol unit choice from the old form (one UX, no
// duplicated HbA1c form). CGM trends and BP logs stay where they already
// live (linked, never duplicated). Panel history and per-test trends render
// below. Reference ranges shown are the lab-printed range when captured,
// else the catalog's display-only adult default - never an interpretation.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  LAB_CATEGORIES,
  labTestsByCategory,
  labDocumentsByCategory,
  type LabCategoryLetter,
} from '@mi/engine';
import { istNow } from '@/lib/clinical-db';

export interface PanelResultView {
  testKey: string;
  label: string;
  category: string | null;
  unit: string;
  value: number;
  refLow: number | null;
  refHigh: number | null;
  flag: string | null;
  direction: string;
  derived: boolean;
}

export interface PanelView {
  id: string;
  name: string | null;
  labName: string | null;
  performedAt: string;
  sourceNote: string | null;
  results: PanelResultView[];
}

export interface TrendView {
  testKey: string;
  label: string;
  unit: string;
  direction: string;
  points: { date: string; value: number }[];
}

type FieldState = Record<string, { value: string; unit: string; refLow: string; refHigh: string }>;

export default function PanelBrowser({
  panels,
  trends,
  onSaved,
}: {
  panels: PanelView[];
  trends: TrendView[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState<LabCategoryLetter | null>('A');
  const [date, setDate] = useState('');
  const [labName, setLabName] = useState('');
  const [panelName, setPanelName] = useState('');
  const [fields, setFields] = useState<FieldState>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [openPanel, setOpenPanel] = useState<string | null>(null);

  useEffect(() => { setDate(istNow().slice(0, 10)); }, []);

  const setField = useCallback((key: string, patch: Partial<FieldState[string]>) => {
    setFields((prev) => ({
      ...prev,
      [key]: {
        value: patch.value ?? prev[key]?.value ?? '',
        unit: patch.unit ?? prev[key]?.unit ?? '',
        refLow: patch.refLow ?? prev[key]?.refLow ?? '',
        refHigh: patch.refHigh ?? prev[key]?.refHigh ?? '',
      },
    }));
  }, []);

  const filledCount = useMemo(
    () => Object.values(fields).filter((f) => f.value.trim() !== '' && Number.isFinite(Number(f.value))).length,
    [fields],
  );

  async function save() {
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const results = Object.entries(fields)
        .filter(([, f]) => f.value.trim() !== '')
        .map(([testKey, f]) => ({
          testKey,
          value: Number(f.value),
          ...(f.unit && testKey === 'hba1c' ? { unit: f.unit } : {}),
          ...(f.refLow.trim() !== '' ? { refLow: Number(f.refLow) } : {}),
          ...(f.refHigh.trim() !== '' ? { refHigh: Number(f.refHigh) } : {}),
        }));
      const res = await fetch('/api/lab-panels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          performedAt: date,
          ...(panelName.trim() ? { name: panelName.trim() } : {}),
          ...(labName.trim() ? { labName: labName.trim() } : {}),
          results,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? 'Could not save this panel.');
      setFields({});
      setPanelName('');
      setLabName('');
      setMsg(`Saved panel of ${results.length} result${results.length === 1 ? '' : 's'}. Trends update below.`);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this panel.');
    } finally {
      setSaving(false);
    }
  }

  const input = 'w-full rounded-lg border border-neutral-300 bg-transparent px-2 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-neutral-700';

  return (
    <div>
      {/* ---------- Entry form ---------- */}
      <div className="mt-6 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="text-lg font-semibold">Add a panel</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Fill what your report shows - only the fields you enter are saved, as one dated panel. Reference ranges
          you type are the ones your lab printed.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-neutral-500">
            Test date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
          </label>
          <label className="text-xs text-neutral-500">
            Lab name (optional)
            <input value={labName} onChange={(e) => setLabName(e.target.value)} placeholder="e.g. Metropolis, Dr Lal" className={input} />
          </label>
          <label className="text-xs text-neutral-500">
            Panel name (optional)
            <input value={panelName} onChange={(e) => setPanelName(e.target.value)} placeholder="e.g. Quarterly check" className={input} />
          </label>
        </div>

        <div className="mt-4 space-y-2">
          {LAB_CATEGORIES.map((cat) => {
            const tests = labTestsByCategory(cat.letter);
            const docs = labDocumentsByCategory(cat.letter);
            const isOpen = open === cat.letter;
            const groups = [...new Set(tests.map((t) => t.group))];
            return (
              <div key={cat.id} className="rounded-xl border border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : cat.letter)}
                  aria-expanded={isOpen}
                  className="flex min-h-[44px] w-full items-center justify-between gap-2 px-4 py-3 text-left"
                >
                  <span>
                    <span className="text-sm font-semibold">
                      <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                        {cat.letter}
                      </span>
                      {cat.title}
                    </span>
                    <span className="ml-2 text-xs text-neutral-400">{cat.description}</span>
                  </span>
                  <span className="text-xs text-neutral-400" aria-hidden>{isOpen ? '−' : '+'}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-neutral-100 px-4 py-3 dark:border-neutral-900">
                    {groups.map((g) => (
                      <div key={g} className="mb-3 last:mb-0">
                        <p className="text-xs font-medium text-neutral-500">{g}</p>
                        <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                          {tests.filter((t) => t.group === g).map((t) => (
                            <div key={t.key} className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-800">
                              <label className="min-w-0 flex-1 text-xs text-neutral-600 dark:text-neutral-400">
                                {t.label}
                                <input
                                  inputMode="decimal"
                                  value={fields[t.key]?.value ?? ''}
                                  onChange={(e) => setField(t.key, { value: e.target.value })}
                                  placeholder={t.refLow != null && t.refHigh != null ? `${t.refLow}-${t.refHigh}` : 'value'}
                                  className="mt-1 w-full rounded border border-neutral-300 bg-transparent px-2 py-1.5 text-sm dark:border-neutral-700"
                                />
                              </label>
                              {t.key === 'hba1c' ? (
                                <select
                                  value={fields[t.key]?.unit || '%'}
                                  onChange={(e) => setField(t.key, { unit: e.target.value })}
                                  className="rounded border border-neutral-300 bg-transparent px-1 py-1 text-xs dark:border-neutral-700"
                                  aria-label="HbA1c unit"
                                >
                                  <option value="%">%</option>
                                  <option value="mmol/mol">mmol/mol</option>
                                </select>
                              ) : (
                                <span className="shrink-0 text-[11px] text-neutral-400">{t.unit}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {cat.letter === 'A' && (
                      <p className="mt-2 text-[11px] text-neutral-400">
                        CGM trends already live in <Link href="/glucose" className="text-brand-600 underline dark:text-brand-400">Glucose</Link> - linked, not duplicated here.
                      </p>
                    )}
                    {cat.letter === 'B' && (
                      <p className="mt-2 text-[11px] text-neutral-400">
                        Your logged blood pressure lives on the <Link href="/dashboard" className="text-brand-600 underline dark:text-brand-400">Dashboard</Link> quick-add; summaries appear in report comparisons.
                      </p>
                    )}
                    {docs.length > 0 && (
                      <p className="mt-2 text-[11px] text-neutral-400">
                        {docs.map((d) => d.label).join(', ')} - upload the document itself under Documents (report vault).
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving || filledCount === 0 || !date}
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Saving...' : `Save panel (${filledCount} result${filledCount === 1 ? '' : 's'})`}
          </button>
          {filledCount > 0 && (
            <button onClick={() => setFields({})} className="text-xs text-neutral-500 hover:underline">
              Clear values
            </button>
          )}
        </div>
      </div>

      {msg && (
        <p className="mt-4 rounded-lg border border-brand-300 bg-brand-50 p-3 text-sm text-brand-800 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-200">
          {msg}
        </p>
      )}

      {/* ---------- Panel history ---------- */}
      {panels.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Panel history</h2>
          <ul className="mt-3 space-y-2">
            {panels.map((p) => {
              const isOpen = openPanel === p.id;
              return (
                <li key={p.id} className="rounded-xl border border-neutral-200 dark:border-neutral-800">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setOpenPanel(isOpen ? null : p.id)}
                      className="min-w-0 flex-1 text-left"
                      aria-expanded={isOpen}
                    >
                      <span className="text-sm font-medium tabular-nums">{p.performedAt}</span>
                      {p.name && <span className="ml-2 text-sm text-neutral-600 dark:text-neutral-400">{p.name}</span>}
                      <span className="ml-2 text-xs text-neutral-400">
                        {p.results.length} result{p.results.length === 1 ? '' : 's'}
                        {p.labName ? ` · ${p.labName}` : ''}
                        {p.sourceNote ? ` · via ${p.sourceNote}` : ''}
                      </span>
                    </button>
                    <button
                      onClick={async () => {
                        if (!window.confirm(`Delete the ${p.performedAt} panel? Its HbA1c mirror row goes too.`)) return;
                        await fetch(`/api/lab-panels?id=${encodeURIComponent(p.id)}`, { method: 'DELETE' });
                        onSaved();
                      }}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
                      aria-label={`Delete panel ${p.performedAt}`}
                    >
                      Delete
                    </button>
                  </div>
                  {isOpen && (
                    <div className="border-t border-neutral-100 px-4 py-3 dark:border-neutral-900">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="text-left text-xs text-neutral-500">
                            <tr>
                              <th className="py-1.5 pr-4">Test</th>
                              <th className="py-1.5 pr-4">Value</th>
                              <th className="py-1.5 pr-4">Ref range (as printed)</th>
                              <th className="py-1.5">Flag</th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.results.map((r) => (
                              <tr key={r.testKey} className="border-t border-neutral-100 dark:border-neutral-900">
                                <td className="py-1.5 pr-4">
                                  {r.label}
                                  {r.derived && <span className="ml-1 text-[10px] italic text-neutral-400">computed</span>}
                                </td>
                                <td className="py-1.5 pr-4 tabular-nums">
                                  {r.value} <span className="text-xs text-neutral-400">{r.unit}</span>
                                </td>
                                <td className="py-1.5 pr-4 tabular-nums text-neutral-500">
                                  {r.refLow != null || r.refHigh != null ? `${r.refLow ?? ''} - ${r.refHigh ?? ''}` : '-'}
                                </td>
                                <td className="py-1.5">
                                  {r.flag ? (
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.flag === 'L' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                                      {r.flag}
                                    </span>
                                  ) : (
                                    <span className="text-neutral-300">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="mt-2 text-[11px] text-neutral-400">
                        Flags repeat what the lab printed (or compare against the printed range). Educational display -
                        your doctor interprets.
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ---------- Per-test trends (>= 2 datapoints) ---------- */}
      {trends.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Trends</h2>
          <p className="mt-1 text-sm text-neutral-500">Every test you have tracked twice or more.</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {trends.map((t) => (
              <TrendCard key={t.testKey} trend={t} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TrendCard({ trend }: { trend: TrendView }) {
  const pts = trend.points;
  const latest = pts.at(-1)!;
  const prev = pts.length >= 2 ? pts[pts.length - 2] : null;
  const delta = prev ? latest.value - prev.value : null;
  const min = Math.min(...pts.map((p) => p.value));
  const max = Math.max(...pts.map((p) => p.value));
  const span = max - min || Math.max(Math.abs(max), 1);
  // Direction-aware coloring: an improvement is emerald, a worsening amber,
  // context tests neutral - associations, never judgments.
  const improving =
    delta == null ? null : (delta < 0 && trend.direction === 'lower-better') || (delta > 0 && trend.direction === 'higher-better');
  const worsening =
    delta == null ? null : (delta > 0 && trend.direction === 'lower-better') || (delta < 0 && trend.direction === 'higher-better');

  return (
    <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold">{trend.label}</h3>
        <span className="text-sm tabular-nums">
          {latest.value} <span className="text-xs text-neutral-400">{trend.unit}</span>
        </span>
      </div>
      {delta != null && (
        <p
          className={`mt-0.5 text-xs ${
            improving ? 'text-emerald-600' : worsening ? 'text-amber-600' : 'text-neutral-400'
          }`}
        >
          {delta < 0 ? '↓' : delta > 0 ? '↑' : '→'} {Math.abs(delta)} {trend.unit} vs previous
        </p>
      )}
      <ul className="mt-3 space-y-1.5">
        {[...pts].reverse().slice(0, 8).map((p) => {
          const w = Math.max(4, Math.min(100, ((p.value - min) / span) * 100));
          return (
            <li key={p.date} className="flex items-center gap-2 text-xs">
              <span className="w-24 shrink-0 tabular-nums text-neutral-500">{p.date}</span>
              <div className="h-3 flex-1 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-900">
                <div
                  className={p === latest ? 'h-full bg-brand-500' : 'h-full bg-brand-300 dark:bg-brand-700'}
                  style={{ width: w + '%' }}
                />
              </div>
              <span className="w-20 shrink-0 text-right tabular-nums">{p.value}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
