'use client';

import { useEffect, useState } from 'react';
import { DAY_CONTEXT_TAGS, DAY_TAG_LABELS, istNow, type DayContextTagValue } from '@/lib/clinical-db';

interface TagRow {
  id: string;
  tag: string;
  tagDate: string;
}

// Phase 2c: day-context tags on the log page. Associations from the user's
// notes - "stressful day", "festival" - never causes. Optional by design.
export default function DayTagPicker() {
  const [rows, setRows] = useState<TagRow[]>([]);
  const [today, setToday] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = istNow().slice(0, 10);
    setToday(d);
    fetch('/api/day-tags?date=' + d)
      .then((r) => (r.ok ? r.json() : { rows: [] }))
      .then((j) => setRows(j.rows ?? []))
      .catch(() => {});
  }, []);

  async function toggle(tag: DayContextTagValue) {
    setError(null);
    const existing = rows.find((r) => r.tag === tag);
    try {
      if (existing) {
        const res = await fetch('/api/day-tags?id=' + encodeURIComponent(existing.id), { method: 'DELETE' });
        if (!res.ok) throw new Error();
        setRows((p) => p.filter((r) => r.id !== existing.id));
      } else {
        const res = await fetch('/api/day-tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag, tagDate: today }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? 'Could not save.');
        setRows((p) => [...p, j.row]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  }

  const active = new Set(rows.map((r) => r.tag));

  return (
    <div className="mt-6 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
      <h2 className="text-sm font-semibold">Anything unusual about today? (optional)</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Tags help you remember the context behind your numbers - they are notes, not causes.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {DAY_CONTEXT_TAGS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => toggle(t)}
            className={
              active.has(t)
                ? 'rounded-full border border-brand-500 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 dark:border-brand-500 dark:bg-brand-950/40 dark:text-brand-300'
                : 'rounded-full border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 hover:border-brand-300 dark:border-neutral-800 dark:text-neutral-400'
            }
          >
            {DAY_TAG_LABELS[t]}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}