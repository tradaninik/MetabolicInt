'use client';

// P6-e — "Compare two reports" on /labs: pick panel A and B (e.g. 3 months
// apart) -> delta table with arrows and direction-aware colors (HDL up =
// green, LDL up = red, context tests gray), derived markers (HOMA-IR,
// non-HDL) compared too, plus the "Between your reports" context card and
// rule-based association notes - hedged, never causal.
import { useEffect, useState } from 'react';
import type { PanelView } from './PanelBrowser';

interface CompareRow {
  testKey: string;
  label: string;
  unit: string;
  category: string | null;
  a: number | null;
  b: number | null;
  deltaAbs: number | null;
  deltaPct: number | null;
  arrow: 'up' | 'down' | 'flat' | null;
  tone: 'better' | 'worse' | 'neutral' | null;
  derived: boolean;
}

interface BetweenCtx {
  days: number;
  mealsLogged: number;
  avgDailyKcal: number | null;
  avgDailyCarbsG: number | null;
  avgDailyFiberG: number | null;
  avgDailyProteinG: number | null;
  activitySessions: number;
  activityMinutes: number;
  avgSleepHours: number | null;
  weightChangeKg: number | null;
  avgGlucoseMgDl: number | null;
  cgmReadings: number;
  medsTakenPct: number | null;
  avgSystolic: number | null;
  avgDiastolic: number | null;
}

interface CompareResponse {
  a: { id: string; performedAt: string; name: string | null; labName: string | null };
  b: { id: string; performedAt: string; name: string | null; labName: string | null };
  rows: CompareRow[];
  context: BetweenCtx;
  notes: string[];
  adherence: { expected: number; taken: number; pct: number | null };
}

const CATEGORY_LABEL: Record<string, string> = {
  A: 'Diabetes & Metabolic',
  B: 'Cardiovascular & Lipid',
  C: 'Liver & Thyroid',
  D: 'Nutrition',
  E: 'Screening',
};

export default function ComparePanels({ panels }: { panels: PanelView[] }) {
  // Default: the two most recent panels (list is newest-first).
  const [aId, setAId] = useState('');
  const [bId, setBId] = useState('');
  const [data, setData] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (panels.length >= 2) {
      setBId((prev) => prev || panels[0].id);
      setAId((prev) => prev || panels[1].id);
    }
  }, [panels]);

  async function run() {
    if (!aId || !bId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/lab-panels/compare?a=${encodeURIComponent(aId)}&b=${encodeURIComponent(bId)}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? 'Could not compare these reports.');
      setData(j as CompareResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not compare these reports.');
    } finally {
      setLoading(false);
    }
  }

  const label = (p: { performedAt: string; name: string | null }) =>
    `${p.performedAt}${p.name ? ` - ${p.name}` : ''}`;

  const toneClass = (tone: CompareRow['tone']) =>
    tone === 'better'
      ? 'text-emerald-600'
      : tone === 'worse'
        ? 'text-red-600'
        : 'text-neutral-400';

  return (
    <div>
      <div className="mt-6 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="text-lg font-semibold">Compare two reports</h2>
        <p className="mt-1 text-sm text-neutral-500">
          What went up, what went down - and what you logged in between. Colors follow what each marker means for
          you (HDL up = green, LDL up = red), not a verdict.
        </p>

        {panels.length < 2 ? (
          <p className="mt-3 text-sm text-neutral-500">
            Two saved reports are needed for a comparison - save your latest panel first.
          </p>
        ) : (
          <div className="mt-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-neutral-500">
                Earlier report
                <select value={aId} onChange={(e) => setAId(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-2 py-2 text-sm dark:border-neutral-700">
                  {panels.map((p) => (
                    <option key={p.id} value={p.id}>{label(p)}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-neutral-500">
                Later report
                <select value={bId} onChange={(e) => setBId(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-2 py-2 text-sm dark:border-neutral-700">
                  {panels.map((p) => (
                    <option key={p.id} value={p.id}>{label(p)}</option>
                  ))}
                </select>
              </label>
            </div>
            <button
              onClick={run}
              disabled={loading || !aId || !bId || aId === bId}
              className="mt-3 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? 'Comparing...' : 'Compare'}
            </button>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {data && (
        <>
          {/* ---------- Delta table ---------- */}
          <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs text-neutral-500 dark:bg-neutral-900">
                <tr>
                  <th className="px-4 py-3">Test</th>
                  <th className="px-4 py-3">{data.a.performedAt}</th>
                  <th className="px-4 py-3">{data.b.performedAt}</th>
                  <th className="px-4 py-3">Change</th>
                  <th className="px-4 py-3">%</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.testKey} className="border-t border-neutral-200 dark:border-neutral-800">
                    <td className="px-4 py-3">
                      {r.label}
                      {r.derived && <span className="ml-1 text-[10px] italic text-neutral-400">computed</span>}
                      {r.category && (
                        <span className="ml-2 text-[10px] text-neutral-400">{CATEGORY_LABEL[r.category] ?? r.category}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {r.a ?? <span className="text-neutral-300">-</span>}{' '}
                      <span className="text-xs text-neutral-400">{r.unit}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums font-medium">
                      {r.b ?? <span className="text-neutral-300">-</span>}{' '}
                      <span className="text-xs text-neutral-400">{r.unit}</span>
                    </td>
                    <td className={`px-4 py-3 tabular-nums ${toneClass(r.tone)}`}>
                      {r.arrow === 'up' ? '↑' : r.arrow === 'down' ? '↓' : r.arrow === 'flat' ? '→' : ''}
                      {r.deltaAbs != null ? ` ${Math.abs(r.deltaAbs)}` : ''}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-neutral-500">
                      {r.deltaPct != null ? `${r.deltaPct > 0 ? '+' : ''}${r.deltaPct}%` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-neutral-400">
            Green = moved the way that marker prefers; red = the other way; gray = context marker where direction
            depends on your full picture. Your doctor interprets.
          </p>

          {/* ---------- Between your reports ---------- */}
          <div className="mt-6 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
            <h3 className="text-base font-semibold">Between your reports</h3>
            <p className="mt-1 text-xs text-neutral-500">
              What you logged from {data.a.performedAt} to {data.b.performedAt} ({data.context.days} days).
            </p>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
              <Ctx label="Meals logged" value={`${data.context.mealsLogged}`} />
              <Ctx label="Avg kcal / logged day" value={data.context.avgDailyKcal != null ? `${data.context.avgDailyKcal}` : '-'} />
              <Ctx label="Avg carbs / day" value={data.context.avgDailyCarbsG != null ? `${data.context.avgDailyCarbsG} g` : '-'} />
              <Ctx label="Avg fiber / day" value={data.context.avgDailyFiberG != null ? `${data.context.avgDailyFiberG} g` : '-'} />
              <Ctx label="Avg protein / day" value={data.context.avgDailyProteinG != null ? `${data.context.avgDailyProteinG} g` : '-'} />
              <Ctx label="Activity" value={data.context.activitySessions > 0 ? `${data.context.activitySessions} sessions, ${data.context.activityMinutes} min` : '-'} />
              <Ctx label="Avg sleep" value={data.context.avgSleepHours != null ? `${data.context.avgSleepHours} h` : '-'} />
              <Ctx label="Weight change" value={data.context.weightChangeKg != null ? `${data.context.weightChangeKg > 0 ? '+' : ''}${data.context.weightChangeKg} kg` : '-'} />
              <Ctx label="Avg glucose" value={data.context.avgGlucoseMgDl != null ? `${data.context.avgGlucoseMgDl} mg/dL` : '-'} />
              <Ctx label="CGM readings" value={`${data.context.cgmReadings}`} />
              <Ctx label="Meds taken" value={data.context.medsTakenPct != null ? `${data.context.medsTakenPct}%` : '-'} />
              <Ctx label="Avg BP" value={data.context.avgSystolic != null ? `${data.context.avgSystolic}/${data.context.avgDiastolic}` : '-'} />
            </div>
          </div>

          {/* ---------- Hedged association notes ---------- */}
          {data.notes.length > 0 && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/50 p-5 dark:border-amber-900 dark:bg-amber-950/20">
              <h3 className="text-base font-semibold text-amber-800 dark:text-amber-300">What moved together</h3>
              <ul className="mt-2 space-y-2">
                {data.notes.map((n, i) => (
                  <li key={i} className="text-sm leading-relaxed text-amber-900 dark:text-amber-200">{n}</li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-amber-700 dark:text-amber-400">
                These are associations from your own logged history, not proven causes. Many things change
                together over three months.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Ctx({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-neutral-400 dark:text-neutral-500">{label}</div>
      <div className="font-medium tabular-nums text-neutral-700 dark:text-neutral-300">{value}</div>
    </div>
  );
}
