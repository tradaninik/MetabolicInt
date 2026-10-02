'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function istTime(): string {
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date());
}

export default function GlucoseLogger() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    const v = Number(value);
    if (!v) return;
    setLoading(true);
    const res = await fetch('/api/glucose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: v }),
    });
    setLoading(false);
    if (res.ok) {
      setMsg(`Logged ${v} mg/dL at ${istTime()}.`);
      setValue('');
      router.refresh();
    } else {
      setMsg('Could not save.');
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="number" value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="mg/dL"
          className="w-32 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
        />
        <button onClick={save} disabled={loading || !value}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          {loading ? 'Saving…' : 'Save reading'}
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-neutral-500">{msg}</p>}
    </div>
  );
}
