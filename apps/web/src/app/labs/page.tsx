'use client';

// P6-d — /labs, rebuilt around the A–E catalog.
//
// HbA1c stays the first citizen: the legacy /api/labs trend (incl. eAG)
// renders exactly as before - new panel saves dual-write into it. Below it,
// the PanelBrowser hosts the grouped A–E entry form, panel history and
// per-test trends. Import / Compare / Documents sections land with P6-c/e/f.
import { useCallback, useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import PanelBrowser, { type PanelView, type TrendView } from '@/components/labs/PanelBrowser';
import ImportReport from '@/components/labs/ImportReport';
import ComparePanels from '@/components/labs/ComparePanels';
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
  const [panels, setPanels] = useState<PanelView[]>([]);
  const [trends, setTrends] = useState<TrendView[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<'panels' | 'import' | 'compare'>('panels');

  const load = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/labs').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/lab-panels').then((r) => (r.ok ? r.json() : null)),
      ]);
      if (r1) {
        setLabs(r1.labs ?? []);
        setTrend(r1.trend ?? []);
      }
      if (r2) {
        setPanels(r2.panels ?? []);
        setTrends(r2.trends ?? []);
      }
    } catch {
      // offline-tolerant: keep whatever we already have
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    istNow(); // import keeps the IST convention pinned on this page
    load();
  }, [load]);

  const latest = trend.at(-1);
  const prev = trend.length >= 2 ? trend[trend.length - 2] : null;
  const delta = latest && prev ? latest.a1cPercent - prev.a1cPercent : null;

  const segBtn = (active: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
      active
        ? 'bg-brand-600 text-white'
        : 'border border-neutral-300 text-neutral-700 hover:border-brand-400 dark:border-neutral-700 dark:text-neutral-300'
    }`;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Labs &amp; reports</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Every panel from HbA1c to micronutrients, organized A–E the way your reports file - with import,
          comparison and a document vault.
        </p>

        <p className="mt-4 text-xs text-amber-700 dark:text-amber-400">
          Educational tool, not a diagnosis. Values and reference ranges are shown as your lab printed them -
          your doctor interprets them in the context of your full health picture.
        </p>

        {/* ---------- HbA1c trend: the first citizen (unchanged view) ---------- */}
        {loaded && trend.length === 0 && (
          <p className="mt-6 text-sm text-neutral-500">
            No lab results yet - add your first panel below. A trend appears from the second result onwards.
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
          <details className="mt-4">
            <summary className="cursor-pointer text-xs font-medium text-brand-600 dark:text-brand-400">
              HbA1c history ({labs.length} result{labs.length === 1 ? '' : 's'})
            </summary>
            <div className="mt-2 overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
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
          </details>
        )}

        {/* ---------- A–E panels: entry, history, trends + import + compare ---------- */}
        <div className="mt-8 flex gap-2" role="tablist" aria-label="Labs sections">
          <button role="tab" aria-selected={tab === 'panels'} onClick={() => setTab('panels')} className={segBtn(tab === 'panels')}>
            Panels &amp; trends
          </button>
          <button role="tab" aria-selected={tab === 'import'} onClick={() => setTab('import')} className={segBtn(tab === 'import')}>
            ⤵ Import report
          </button>
          <button role="tab" aria-selected={tab === 'compare'} onClick={() => setTab('compare')} className={segBtn(tab === 'compare')}>
            ⇄ Compare
          </button>
        </div>

        {tab === 'panels' && <PanelBrowser panels={panels} trends={trends} onSaved={load} />}
        {tab === 'import' && <ImportReport onSaved={load} />}
        {tab === 'compare' && <ComparePanels panels={panels} />}
      </div>
    </AppShell>
  );
}
