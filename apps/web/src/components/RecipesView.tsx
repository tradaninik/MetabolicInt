'use client';

// P8 Day 4 — RecipesView: the two modes of /recipes. The Day-3 catalog
// browser stays the default; "Cook with what I have" is the Day-4 surface
// (pick your ingredients, get coverage-ranked matches). The toggle is a
// plain segmented control in the page's chip language - no URL state, the
// choice resets on navigation like every other tabbed page in the app.
import { useState } from 'react';
import RecipeCatalog from '@/components/RecipeCatalog';
import CookWithWhatIHave from '@/components/CookWithWhatIHave';

type View = 'browse' | 'have';

const VIEWS: { value: View; label: string }[] = [
  { value: 'browse', label: 'Browse catalog' },
  { value: 'have', label: 'Cook with what I have' },
];

export default function RecipesView() {
  const [view, setView] = useState<View>('browse');

  return (
    <div>
      <div
        role="tablist"
        aria-label="Recipes views"
        className="mx-auto mb-4 flex max-w-5xl gap-2 rounded-full border border-neutral-200 bg-white p-1 dark:border-neutral-800 dark:bg-neutral-950"
      >
        {VIEWS.map((v) => {
          const on = view === v.value;
          return (
            <button
              key={v.value}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setView(v.value)}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
                on
                  ? 'bg-brand-600 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900'
              }`}
            >
              {v.label}
            </button>
          );
        })}
      </div>
      {view === 'browse' ? <RecipeCatalog /> : <CookWithWhatIHave />}
    </div>
  );
}
