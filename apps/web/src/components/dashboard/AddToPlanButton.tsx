'use client';

// Add-to-plan action for a suggestion card (dashboard revamp item 6).
// The Phase C planner is not built yet, so the plan lives on THIS DEVICE
// (localStorage, keyed by IST day + suggestion id) and the card says so.
// When the planner ships this button will POST to it instead - the
// component is the swap point.

import { useEffect, useState } from 'react';

export default function AddToPlanButton({
  id, label, today,
}: {
  id: string;
  label: string;
  /** IST 'YYYY-MM-DD' so the plan resets each day */
  today: string;
}) {
  const key = `mi.plan.${today}.${id}`;
  const [added, setAdded] = useState(false);

  useEffect(() => {
    try {
      setAdded(window.localStorage.getItem(key) !== null);
    } catch {
      setAdded(false); // private mode etc. - degrade to a plain button
    }
  }, [key]);

  if (added) {
    return (
      <span className="text-xs font-medium text-brand-500 dark:text-brand-400" aria-live="polite">
        Added to today&rsquo;s plan ✓
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        try {
          window.localStorage.setItem(key, JSON.stringify({ at: Date.now() }));
          setAdded(true);
        } catch {
          setAdded(false);
        }
      }}
      className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
    >
      {label} →
    </button>
  );
}
