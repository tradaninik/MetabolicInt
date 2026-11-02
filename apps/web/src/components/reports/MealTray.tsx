"use client";

// Meal tray — the mockups' tray model, simplified to the 80% path:
// search → add → adjust servings → log. Nutrition is shown exactly once
// (per-item inline + one live total), never three times.
// Mobile-first: sticky totals bar stays visible while the tray grows.

import { useState } from "react";

import type { Food, MacroTotals, TrayItem } from "./types";

export interface MealTrayProps {
  /** Searchable catalog (wire your food DB here). */
  foods: Food[];
  items: TrayItem[];
  totals: MacroTotals;
  onAdd: (food: Food) => void;
  onSetQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onLogMeal?: () => void;
}

function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function MealTray({
  foods,
  items,
  totals,
  onAdd,
  onSetQty,
  onRemove,
  onClear,
  onLogMeal,
}: MealTrayProps) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const results = q ? foods.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 6) : [];

  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <div className="p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-neutral-900">Log a meal</h3>
        <p className="mt-0.5 text-xs text-neutral-500">
          Search, build your tray, log in under a minute.
        </p>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search foods — e.g. dosa, dal, rajma"
          aria-label="Search foods"
          className="mt-3 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#0a8e5f] focus:outline-none focus:ring-2 focus:ring-[#0a8e5f]/15"
        />

        {q.length > 0 ? (
          <div className="mt-2 overflow-hidden rounded-lg border border-neutral-200">
            {results.length > 0 ? (
              results.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    onAdd(f);
                    setQuery("");
                  }}
                  className="flex w-full items-center justify-between gap-3 border-b border-neutral-100 px-3 py-2.5 text-left last:border-0 hover:bg-neutral-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-neutral-900">
                      {f.name}
                    </span>
                    <span className="block text-xs text-neutral-400">
                      {f.serving} · {f.kcal} kcal
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-[#0a8e5f]">Add</span>
                </button>
              ))
            ) : (
              <p className="px-3 py-3 text-xs text-neutral-500">
                No close match for “{query}”. Try the regional presets, or log a custom food.
              </p>
            )}
          </div>
        ) : null}

        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <h4 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Tray{items.length > 0 ? ` · ${items.length} item${items.length === 1 ? "" : "s"}` : ""}
            </h4>
            {items.length > 0 ? (
              <button
                type="button"
                onClick={onClear}
                className="text-xs text-neutral-400 underline underline-offset-2 hover:text-neutral-600"
              >
                Clear
              </button>
            ) : null}
          </div>

          {items.length === 0 ? (
            <div className="mt-2 rounded-lg border border-dashed border-neutral-300 p-5 text-center text-xs text-neutral-400">
              Your tray is empty — snap a photo above, search, or pick a regional preset.
            </div>
          ) : (
            <ul className="mt-1">
              {items.map((it) => (
                <li
                  key={it.food.id}
                  className="flex items-start gap-3 border-b border-neutral-100 py-3 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-900">{it.food.name}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {Math.round(it.food.kcal * it.qty)} kcal · {Math.round(it.food.carbs * it.qty)}{" "}
                      g carbs · {Math.round(it.food.protein * it.qty)} g protein ·{" "}
                      {Math.round(it.food.fat * it.qty)} g fat
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Reduce ${it.food.name}`}
                      onClick={() => onSetQty(it.food.id, it.qty - 0.5)}
                      className="h-10 w-10 rounded-lg border border-neutral-300 text-base text-neutral-600 hover:bg-neutral-50"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm tabular-nums text-neutral-900">
                      {fmtQty(it.qty)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Increase ${it.food.name}`}
                      onClick={() => onSetQty(it.food.id, it.qty + 0.5)}
                      className="h-10 w-10 rounded-lg border border-neutral-300 text-base text-neutral-600 hover:bg-neutral-50"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${it.food.name}`}
                      onClick={() => onRemove(it.food.id)}
                      className="ml-1 h-10 w-8 text-neutral-400 hover:text-red-600"
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Sticky totals bar — the one place nutrition is aggregated */}
      <div className="sticky bottom-3 mx-3 mb-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-lg shadow-neutral-900/5 sm:mx-4 sm:mb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-neutral-600">
            <span className="text-sm font-semibold tabular-nums text-neutral-900">
              {Math.round(totals.kcal)} kcal
            </span>
            <span className="text-neutral-500">
              {" "}
              · {Math.round(totals.carbs)} g carbs · {Math.round(totals.protein)} g protein ·{" "}
              {Math.round(totals.fat)} g fat
            </span>
          </p>
          <button
            type="button"
            onClick={onLogMeal}
            disabled={items.length === 0}
            className="h-10 w-full rounded-lg bg-[#0a8e5f] px-5 text-sm font-medium text-white hover:bg-[#07724c] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            Log meal
          </button>
        </div>
      </div>
    </div>
  );
}
