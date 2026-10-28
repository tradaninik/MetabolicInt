'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { useAyurvedaEnabled } from '@/lib/ayurveda-prefs';

interface TargetPair {
  low: number;
  high: number;
}

interface SettingsResp {
  glucoseUnit: string;
  targets: {
    fasting: TargetPair;
    premeal: TargetPair;
    postprandial: TargetPair;
    bedtime: TargetPair;
  };
  educational: {
    fasting: TargetPair;
    premeal: TargetPair;
    postprandial: TargetPair;
    bedtime: TargetPair;
  };
  raw: Record<string, number | null> | null;
}

const PAIRS = [
  { key: 'Fasting', low: 'tFastingLow', high: 'tFastingHigh', hint: 'first thing in the morning' },
  { key: 'Pre-meal', low: 'tPremealLow', high: 'tPremealHigh', hint: 'before you eat' },
  { key: 'Post-meal', low: 'tPostprandialLow', high: 'tPostprandialHigh', hint: 'about 2 hours after eating' },
  { key: 'Bedtime', low: 'tBedtimeLow', high: 'tBedtimeHigh', hint: 'before sleep' },
] as const;

function rawToForm(raw: Record<string, number | null> | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of PAIRS) {
    out[p.low] = raw && raw[p.low] != null ? String(raw[p.low]) : '';
    out[p.high] = raw && raw[p.high] != null ? String(raw[p.high]) : '';
  }
  return out;
}

export default function SettingsPage() {
  const [unit, setUnit] = useState('mg/dL');
  const [form, setForm] = useState<Record<string, string>>(rawToForm(null));
  const [edu, setEdu] = useState<SettingsResp['educational'] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // S2-B5 off-switch — device-local preference (no schema change).
  const [ayurvedaOn, setAyurvedaOn] = useAyurvedaEnabled();

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: SettingsResp | null) => {
        if (!j) return;
        setUnit(j.glucoseUnit);
        setForm(rawToForm(j.raw));
        setEdu(j.educational);
      })
      .catch(() => {});
  }, []);

  function set(k: string, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const body: Record<string, unknown> = { glucoseUnit: unit };
      for (const p of PAIRS) {
        body[p.low] = form[p.low]?.trim() === '' ? null : Number(form[p.low]);
        body[p.high] = form[p.high]?.trim() === '' ? null : Number(form[p.high]);
      }
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Could not save.');
      setMsg('Saved. Your targets are in effect.');
      const r2 = await fetch('/api/settings');
      if (r2.ok) {
        const j2: SettingsResp = await r2.json();
        setForm(rawToForm(j2.raw));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Glucose display unit and personal target ranges. Leave a box blank to stay on the
          educational default.
        </p>

        <p className="mt-4 text-xs text-amber-700 dark:text-amber-400">
          If your doctor has given you targets, enter those - they take precedence over anything
          here. These are display and context ranges, not treatment goals set by an app.
        </p>

        <div className="mt-6 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
          <label className="text-xs text-neutral-500">
            Glucose unit
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="mt-1 w-full max-w-xs rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
            >
              <option value="mg/dL">mg/dL (used by most Indian meters)</option>
              <option value="mmol/L">mmol/L</option>
            </select>
          </label>
        </div>

        {/* P5-a: phone install - one tap from the desktop site to the QR page. */}
        <div className="mt-4 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="text-lg font-semibold">Phone app</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Install Metabolic on your phone - it opens full screen with its own icon, like any app.
          </p>
          <a
            href="/install"
            className="mt-3 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            Install on this device
          </a>
        </div>

        <div className="mt-4 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="text-lg font-semibold">Target ranges (mg/dL)</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Placeholders show the educational defaults. Blank = keep the default.
          </p>
          <div className="mt-4 space-y-4">
            {PAIRS.map((p) => {
              const d = edu ? edu[p.key === 'Fasting' ? 'fasting' : p.key === 'Pre-meal' ? 'premeal' : p.key === 'Post-meal' ? 'postprandial' : 'bedtime'] : null;
              return (
                <div key={p.key} className="grid items-end gap-3 sm:grid-cols-3">
                  <div>
                    <div className="text-sm font-medium">{p.key}</div>
                    <div className="text-xs text-neutral-400">{p.hint}</div>
                  </div>
                  <label className="text-xs text-neutral-500">
                    Low
                    <input
                      value={form[p.low] ?? ''}
                      onChange={(e) => set(p.low, e.target.value)}
                      inputMode="numeric"
                      placeholder={d ? String(d.low) : ''}
                      className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
                    />
                  </label>
                  <label className="text-xs text-neutral-500">
                    High
                    <input
                      value={form[p.high] ?? ''}
                      onChange={(e) => set(p.high, e.target.value)}
                      inputMode="numeric"
                      placeholder={d ? String(d.high) : ''}
                      className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
                    />
                  </label>
                </div>
              );
            })}
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <button
            onClick={save}
            disabled={saving}
            className="mt-4 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save settings'}
          </button>
          {msg && <p className="mt-3 text-sm text-brand-600 dark:text-brand-400">{msg}</p>}
        </div>

        {/* S2-B5: Ayurveda personalisation off-switch (device-local). Off hides
            the traditional suggestion surfaces with ZERO loss of medical
            features; the user's own assessment + history always stay visible. */}
        <div className="mt-4 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="text-lg font-semibold">Ayurveda personalisation</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Show traditional (Ayurvedic) wellbeing content — the Know Your Body tradition sections and
            daily ideas. Turning this off hides them; every medical feature stays exactly as it is.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={ayurvedaOn}
              aria-label="Ayurveda personalisation"
              onClick={() => setAyurvedaOn(!ayurvedaOn)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${ayurvedaOn ? 'bg-brand-600' : 'bg-neutral-300 dark:bg-neutral-700'}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${ayurvedaOn ? 'left-[22px]' : 'left-0.5'}`}
              />
            </button>
            <span className="text-sm">
              {ayurvedaOn ? 'On — tradition sections and daily ideas visible' : 'Off — traditional suggestions hidden'}
            </span>
          </div>
          <p className="mt-2 text-xs text-neutral-400">
            This preference lives on this device only (like your daily plan ticks). Your Know Your Body
            answers and assessment history always remain visible under Know Your Body.
          </p>
        </div>
      </div>
    </AppShell>
  );
}