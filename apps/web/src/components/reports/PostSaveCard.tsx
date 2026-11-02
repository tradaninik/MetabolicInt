"use client";

// Post-save card — replaces the dead-end "meal saved ✓" with the two things
// users actually want next: what to expect (with confidence + evidence), and
// the 1–2 hour glucose nudge as a one-tap reminder.

import { useState } from "react";

import { ConfidenceChip } from "./InsightList";
import type { MacroTotals, Prediction } from "./types";

export interface PostSaveCardProps {
  mealName: string;
  loggedAt: string;
  totals: MacroTotals;
  prediction: Prediction;
  onRemind?: () => void;
  onLogGlucose?: () => void;
}

export function PostSaveCard({
  mealName,
  loggedAt,
  totals,
  prediction,
  onRemind,
  onLogGlucose,
}: PostSaveCardProps) {
  const [reminded, setReminded] = useState(false);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0a8e5f]/10">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3.5 8.5 6.5 11.5 12.5 5"
              stroke="#0a8e5f"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-neutral-900">Meal logged</h3>
          <p className="truncate text-xs text-neutral-500">
            {mealName} · {loggedAt}
          </p>
        </div>
      </div>

      <p className="mt-2.5 text-xs text-neutral-500">
        {Math.round(totals.kcal)} kcal · {Math.round(totals.carbs)} g carbs ·{" "}
        {Math.round(totals.protein)} g protein · {Math.round(totals.fat)} g fat
      </p>

      <div className="my-4 border-t border-neutral-100" />

      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-neutral-900">What to expect</h4>
        <ConfidenceChip level={prediction.confidence} />
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
        Based on {prediction.comparable} comparable meals over the {prediction.period}, your glucose
        typically peaks around{" "}
        <span className="font-medium text-neutral-900">
          {prediction.low}–{prediction.high} mg/dL
        </span>{" "}
        about {prediction.minutesAfter} minutes after a meal like this.
      </p>

      <div className="mt-4 rounded-lg bg-[#0a8e5f]/[0.05] p-3 sm:p-4">
        <p className="text-sm font-medium text-neutral-900">
          Log your glucose reading in 1–2 hours
        </p>
        <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              setReminded(true);
              onRemind?.();
            }}
            disabled={reminded}
            className="h-10 w-full rounded-lg bg-[#0a8e5f] px-4 text-sm font-medium text-white hover:bg-[#07724c] disabled:cursor-default disabled:opacity-60 sm:w-auto"
          >
            {reminded ? "Reminder set" : "Remind me"}
          </button>
          <button
            type="button"
            onClick={onLogGlucose}
            className="h-10 w-full rounded-lg border border-[#0a8e5f]/40 px-4 text-sm font-medium text-[#0a8e5f] hover:bg-[#0a8e5f]/5 sm:w-auto"
          >
            Log glucose now
          </button>
        </div>
        <p className="mt-2 text-xs text-neutral-400">
          {reminded
            ? "We’ll nudge you when it’s time."
            : "You can also log glucose any time from the dashboard."}
        </p>
      </div>
    </div>
  );
}
