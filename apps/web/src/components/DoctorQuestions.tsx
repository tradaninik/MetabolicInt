'use client';

import { useState } from 'react';

// Phase 2c: questions to bring to the next visit. Tick what you want to ask -
// checked questions travel with the printed report.
const GROUPS = [
  {
    title: 'About my numbers',
    items: [
      'What should my HbA1c target be for the next 3-6 months?',
      'Are my fasting or post-meal glucose numbers a concern?',
      'How often should I check my glucose at home?',
    ],
  },
  {
    title: 'About food',
    items: [
      'Which of my usual foods seem to affect my numbers most?',
      'Should I change anything about meal timing or portions?',
    ],
  },
  {
    title: 'About my medication',
    items: [
      'What should I do if I miss a scheduled dose?',
      'Could any of my medicines be affecting my weight, sleep or appetite?',
    ],
  },
  {
    title: 'About lifestyle',
    items: [
      'How much activity is right for me right now?',
      'Could my sleep be affecting my glucose numbers?',
    ],
  },
];

export default function DoctorQuestions() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [own, setOwn] = useState<string[]>([]);
  const [draft, setDraft] = useState('');

  function toggle(q: string) {
    setChecked((p) => ({ ...p, [q]: !p[q] }));
  }

  function addOwn() {
    const q = draft.trim();
    if (!q) return;
    setOwn((p) => [...p, q]);
    setChecked((p) => ({ ...p, [q]: true }));
    setDraft('');
  }

  const total = Object.values(checked).filter(Boolean).length;

  return (
    <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
      <h3 className="text-sm font-semibold">Questions for this visit</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Tick the ones you want to ask - checked questions ({total} so far) are included when you
        print this report.
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="text-xs font-medium text-neutral-500">{g.title}</div>
            <ul className="mt-1 space-y-1">
              {g.items.map((q) => (
                <li key={q}>
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!checked[q]}
                      onChange={() => toggle(q)}
                      className="mt-1 accent-brand-600"
                    />
                    <span>{q}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {own.length > 0 && (
        <ul className="mt-3 space-y-1">
          {own.map((q) => (
            <li key={q}>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!checked[q]}
                  onChange={() => toggle(q)}
                  className="mt-1 accent-brand-600"
                />
                <span>{q}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addOwn();
            }
          }}
          placeholder="Add your own question..."
          className="flex-1 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
        />
        <button
          type="button"
          onClick={addOwn}
          className="rounded-lg border border-brand-300 px-4 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-950/40"
        >
          Add
        </button>
      </div>
    </div>
  );
}