// P6-f — "Reports & documents" for linked patients/wards, shared by the
// /doctor and /family portals (server component: prisma directly, mirroring
// those pages' existing authorization - the link itself was checked by the
// caller; downloads re-check via /api/reports/documents/[id]).
//
// Renders the A–E category folders with the standard filenames as download
// links, plus a cheap P6-e summary: latest two lab panels compared with the
// engine (deltas + tone colors). Educational display only - doctors
// interpret.
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { LAB_CATEGORIES, LAB_TEST_MAP, compareLabPanels } from '@mi/engine';

export default async function PatientDocuments({ userId, whose }: { userId: string; whose: string }) {
  const [documents, panels] = await Promise.all([
    prisma.reportDocument.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, category: true, testKey: true, displayName: true,
        mimeType: true, sizeBytes: true, performedAt: true, note: true,
      },
      take: 200,
    }),
    prisma.labPanel.findMany({
      where: { userId },
      orderBy: [{ performedAt: 'desc' }, { createdAt: 'desc' }],
      take: 2,
      include: { results: true },
    }),
  ]);

  const byCategory = new Map<string, typeof documents>();
  for (const c of LAB_CATEGORIES) byCategory.set(c.id, []);
  for (const d of documents) {
    if (!byCategory.has(d.category)) byCategory.set(d.category, []);
    byCategory.get(d.category)!.push(d);
  }

  // Cheap comparison summary: the two latest panels, key markers only.
  let summary: { a: string; b: string; rows: ReturnType<typeof compareLabPanels>['rows'] } | null = null;
  if (panels.length === 2) {
    const [newer, older] = panels[0].performedAt >= panels[1].performedAt ? [panels[0], panels[1]] : [panels[1], panels[0]];
    const toInput = (p: typeof panels[number]) => ({
      performedAt: p.performedAt,
      values: Object.fromEntries(p.results.map((r) => [r.testKey, { value: r.value }])),
    });
    const comparison = compareLabPanels(toInput(older), toInput(newer));
    const keyMarkers = ['hba1c', 'fbg', 'ldl', 'hdl', 'triglycerides', 'homa_ir', 'creatinine', 'tsh'];
    summary = {
      a: older.performedAt,
      b: newer.performedAt,
      rows: comparison.rows.filter((r) => keyMarkers.includes(r.testKey)),
    };
  }

  return (
    <div className="mt-8 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">Reports &amp; documents - {whose}</h3>
        <span className="text-xs text-neutral-400">
          {documents.length} document{documents.length === 1 ? '' : 's'}
          {panels.length > 0 ? ` · ${panels.length} lab panel${panels.length === 1 ? '' : 's'}` : ''}
        </span>
      </div>

      {documents.length === 0 && panels.length === 0 && (
        <p className="mt-3 text-sm text-neutral-500">
          No report documents or lab panels shared yet. They appear here as soon as {whose} saves them on their Labs page.
        </p>
      )}

      {/* Latest-panel comparison summary (P6-e, cheap surface). */}
      {summary && summary.rows.length > 0 && (
        <div className="mt-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-xs font-medium text-neutral-500">
            Lab movement {summary.a} → {summary.b} (key markers)
          </p>
          <ul className="mt-2 grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
            {summary.rows.map((r) => {
              const toneClass =
                r.tone === 'better'
                  ? 'text-emerald-600'
                  : r.tone === 'worse'
                    ? 'text-red-600'
                    : 'text-neutral-500';
              return (
                <li key={r.testKey} className="flex items-baseline justify-between gap-2">
                  <span className="text-neutral-600 dark:text-neutral-400">
                    {LAB_TEST_MAP[r.testKey]?.label ?? r.label}
                  </span>
                  <span className={`tabular-nums ${toneClass}`}>
                    {r.a ?? '-'} → {r.b ?? '-'} {r.unit}
                    {r.deltaAbs != null && r.deltaAbs !== 0 ? ` (${r.deltaAbs > 0 ? '+' : ''}${r.deltaAbs})` : ''}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[11px] text-neutral-400">Educational display - values as entered; you interpret.</p>
        </div>
      )}

      {/* A–E folders */}
      {documents.length > 0 && (
        <div className="mt-4 space-y-2">
          {LAB_CATEGORIES.map((c) => {
            const docs = byCategory.get(c.id) ?? [];
            if (docs.length === 0) return null;
            return (
              <details key={c.id} className="rounded-xl border border-neutral-200 dark:border-neutral-800">
                <summary className="flex min-h-[44px] cursor-pointer items-center gap-2 px-4 py-3 text-sm">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                    {c.letter}
                  </span>
                  <span className="font-medium">{c.title}</span>
                  <span className="text-xs text-neutral-400">({docs.length})</span>
                </summary>
                <ul className="divide-y divide-neutral-100 border-t border-neutral-100 dark:divide-neutral-900 dark:border-neutral-900">
                  {docs.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-xs text-neutral-700 dark:text-neutral-300" title={d.displayName}>
                          {d.displayName}
                        </p>
                        <p className="text-[11px] text-neutral-400">
                          {Math.round(d.sizeBytes / 1024)} KB{d.note ? ` · ${d.note}` : ''}
                        </p>
                      </div>
                      <a
                        href={`/api/reports/documents/${encodeURIComponent(d.id)}`}
                        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
                      >
                        Download
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-[11px] text-neutral-400">
        Downloads carry the standard filename (YYYY-MM-DD_Category_TestName_Patient). The patient&apos;s own
        document vault lives on their <Link href="/labs" className="text-brand-600 underline dark:text-brand-400">Labs</Link> page.
      </p>
    </div>
  );
}
