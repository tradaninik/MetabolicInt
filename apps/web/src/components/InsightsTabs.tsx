'use client';

// P6-b: one tab, both lenses. "Patterns" renders the auto-discovered insight
// cards exactly as the old /insights page did; "Ask coach" mounts the coach
// chat extracted from the old /coach page. Both implementations are intact -
// this component only switches which one is visible.
import { useState } from 'react';
import CoachChat from './CoachChat';

export interface InsightCardLite {
  id: string;
  title: string;
  body: string;
  effectPct: number;
  confidence: number;
  evidence: string[];
}

export default function InsightsTabs({ cards }: { cards: InsightCardLite[] }) {
  const [pane, setPane] = useState<'patterns' | 'coach'>('patterns');

  const segBtn = (active: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
      active
        ? 'bg-brand-600 text-white'
        : 'border border-neutral-300 text-neutral-700 hover:border-brand-400 dark:border-neutral-700 dark:text-neutral-300'
    }`;

  return (
    <div>
      <div className="flex gap-2" role="tablist" aria-label="Insights sections">
        <button role="tab" aria-selected={pane === 'patterns'} onClick={() => setPane('patterns')} className={segBtn(pane === 'patterns')}>
          📈 Patterns
        </button>
        <button role="tab" aria-selected={pane === 'coach'} onClick={() => setPane('coach')} className={segBtn(pane === 'coach')}>
          💬 Ask coach
        </button>
      </div>

      {pane === 'patterns' && (
        <div className="mt-6">
          <p className="text-sm text-neutral-500">
            Patterns auto-discovered from your logged history. Educational, not medical advice.
          </p>

          {cards.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
              <p className="text-neutral-500">No insights yet.</p>
              <p className="mt-2 text-sm text-neutral-400">
                Log meals, sleep, and glucose for ~5 days and patterns will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {cards.map((c) => (
                <div key={c.id} className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold">{c.title}</h2>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
                      c.confidence > 0.6 ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-900'
                    }`}>
                      {Math.round(c.confidence * 100)}% conf
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{c.body}</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {c.evidence.map((e, i) => (
                      <span key={i} className="rounded bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500 dark:bg-neutral-900">{e}</span>
                    ))}
                  </div>
                  <div className="mt-3 text-xs">
                    Effect:{' '}
                    <span className={c.effectPct > 0 ? 'text-red-600' : 'text-brand-600'}>
                      {c.effectPct > 0 ? '+' : ''}{c.effectPct}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {pane === 'coach' && (
        <div className="mt-6">
          <p className="text-sm text-neutral-500">
            Answers grounded in your own logged history ·{' '}
            <span className="text-amber-600">Educational, not medical advice</span>
          </p>
          <div className="mt-4">
            <CoachChat />
          </div>
        </div>
      )}
    </div>
  );
}
