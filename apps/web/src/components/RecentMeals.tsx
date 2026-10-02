'use client';

// Recent meals: fix a portion or remove an entry. Owner-checked server-side.
// Every change refits the learned model automatically (history changed).
// Tone: neutral - fixing a typo is normal, not a failure.
import { useCallback, useEffect, useState } from 'react';

interface EntryRow {
  id: string;
  portionType: string;
  portionValue: number;
  grams: number;
  kcal: number;
  carbsG: number;
  loggedAt: string;
  food: { name: string; katoriGrams: number | null; servingGrams: number };
}

const timeFmt = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

export default function RecentMeals() {
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState('serving');
  const [editValue, setEditValue] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch('/api/meals');
      if (res.ok) {
        const j = await res.json();
        setEntries(j.entries ?? []);
      }
    } catch {
      // the list is a convenience - silent on failure
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    const handler = () => fetchEntries();
    window.addEventListener('meals-updated', handler);
    return () => window.removeEventListener('meals-updated', handler);
  }, [fetchEntries]);

  function startEdit(e: EntryRow) {
    setEditingId(e.id);
    setEditType(e.portionType);
    setEditValue(e.portionValue);
    setMsg(null);
  }

  async function saveEdit() {
    if (!editingId) return;
    const v = Number(editValue);
    if (!Number.isFinite(v) || v <= 0) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/meals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, portionType: editType, portionValue: v }),
      });
      if (!res.ok) throw new Error('update failed');
      setEditingId(null);
      setMsg('Updated.');
      await fetchEntries();
    } catch {
      setMsg('Could not update. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/meals?id=' + encodeURIComponent(id), { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      setMsg('Removed.');
      await fetchEntries();
    } catch {
      setMsg('Could not remove. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const shown = entries.slice(0, 10);

  return (
    <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="text-sm font-semibold">Recent meals</h2>
      <p className="mt-0.5 text-xs text-neutral-500">
        Fix a portion or remove an entry - your model stays in sync automatically.
      </p>

      {!loaded ? (
        <p className="mt-3 text-sm text-neutral-500">Loading...</p>
      ) : shown.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">Nothing logged yet - your meals will appear here.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {shown.map((e) => (
            <li key={e.id} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-sm font-medium">{e.food.name}</span>
                  <span className="ml-2 text-xs text-neutral-400">
                    {e.portionValue} {e.portionType} - {Math.round(e.grams)} g - {Math.round(e.kcal)} kcal - {Math.round(e.carbsG)} g carbs
                  </span>
                </div>
                <span className="text-xs text-neutral-400" suppressHydrationWarning>{timeFmt.format(new Date(e.loggedAt))}</span>
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs">
                {editingId === e.id ? (
                  <>
                    <select value={editType} onChange={(ev) => setEditType(ev.target.value)} className="rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700">
                      <option value="serving">Serving</option>
                      {e.food.katoriGrams && <option value="katori">Katori</option>}
                      <option value="grams">Grams</option>
                    </select>
                    <input type="number" min={0.5} value={editValue} onChange={(ev) => setEditValue(Number(ev.target.value) || 1)} className="w-20 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700" />
                    <button onClick={saveEdit} disabled={busy} className="font-medium text-brand-600 hover:underline disabled:opacity-60">Save</button>
                    <button onClick={() => setEditingId(null)} className="text-neutral-500 hover:underline">Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => startEdit(e)} className="font-medium text-brand-600 hover:underline">Edit portion</button>
                    <button onClick={() => remove(e.id)} disabled={busy} className="text-neutral-500 hover:text-red-500 hover:underline disabled:opacity-60">Remove</button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {entries.length > 10 && (
        <p className="mt-2 text-xs text-neutral-400">Showing the latest 10 of {entries.length} entries.</p>
      )}
      {msg && <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">{msg}</p>}
      <p className="mt-2 text-[11px] text-neutral-500">
        Every entry is optional - data, not a grade. Educational logging, not medical advice.
      </p>
    </section>
  );
}