"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, Search, Trash2, Check } from "lucide-react";
import { useLog } from "@/lib/store";
import { FOODS, type MealType, totals } from "@/lib/data";
import { MacroRing } from "./Charts";
import { PageHeader } from "./shared";

const MEAL_TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

export default function LogMeal() {
  const { mealType, setMealType, tray, addToTray, setQty, clearTray, logTray, setScreen } = useLog();
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = s
      ? FOODS.filter((f) => f.name.toLowerCase().includes(s) || f.regional?.toLowerCase().includes(s))
      : FOODS.slice(0, 8);
    return base.slice(0, 8);
  }, [q]);

  const t = totals(tray);
  const inTray = (id: string) => tray.some((i) => i.food.id === id);

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-40 pt-2 lg:max-w-4xl lg:px-8 lg:pb-32">
      <PageHeader
        title="Log a meal"
        sub="Search Indian foods, adjust portions, and log in one tap."
      />

      {/* meal type chips */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0" role="tablist"
        aria-label="Meal type">
        {MEAL_TYPES.map((m) => (
          <button key={m} role="tab" aria-selected={mealType === m} onClick={() => setMealType(m)}
            className={`tap min-h-12 shrink-0 rounded-full px-3.5 text-sm font-semibold shadow-[0_1px_2px_rgba(28,43,51,.05),0_2px_8px_rgba(28,43,51,.04)] ${
              mealType === m ? "bg-teal-800 text-white" : "bg-card"
            }`}>
            {m}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div>
          {/* search */}
          <div className="mi-card flex h-12 items-center gap-2.5 rounded-full px-4">
            <Search className="h-5 w-5 shrink-0 text-ink-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search idli, sambar, pongal…"
              aria-label="Search Indian foods"
              className="w-full bg-transparent text-base outline-none placeholder:text-ink-3"
            />
          </div>

          {/* results */}
          <div className="mi-card mt-3 px-4 py-1">
            {results.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-3">
                No foods found. Try &ldquo;dal&rdquo;, &ldquo;dosa&rdquo; or &ldquo;khichdi&rdquo;.
              </p>
            )}
            {results.map((f) => (
              <div key={f.id} className="flex items-center gap-3 border-b border-[#F0F6F2] py-2.5 last:border-0">
                <div className="min-w-0 flex-1">
                  <b className="block text-[.9375rem] font-semibold">
                    {f.name}
                    {f.regional && <span className="pill pill-teal ml-1.5 align-middle">{f.regional}</span>}
                  </b>
                  <span className="num block text-[.8125rem] text-ink-2">
                    {f.serving} · {f.kcal} kcal · carbs {f.carbs}g
                  </span>
                </div>
                <button
                  onClick={() => addToTray(f.id)}
                  aria-label={`Add ${f.name} to meal`}
                  className={`tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition ${
                    inTray(f.id) ? "bg-mint-100 text-[#14532d]" : "bg-teal-50 text-teal-950"
                  }`}>
                  {inTray(f.id) ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* tray + live totals */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="mi-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-bold tracking-tight">Your {mealType.toLowerCase()}</h2>
              {tray.length > 0 && (
                <button onClick={clearTray} className="tap flex min-h-12 items-center gap-1 text-xs font-semibold text-ink-3">
                  <Trash2 className="h-4 w-4" /> Clear
                </button>
              )}
            </div>

            {tray.length === 0 ? (
              <p className="py-4 text-sm text-ink-3">
                Nothing added yet. Search and tap <Plus className="inline h-4 w-4" aria-hidden /> to build
                your {mealType.toLowerCase()}.
              </p>
            ) : (
              <div>
                {tray.map((i) => (
                  <div key={i.food.id} className="flex items-center gap-2 border-b border-[#F0F6F2] py-2 last:border-0">
                    <div className="min-w-0 flex-1">
                      <b className="block truncate text-[.9375rem] font-semibold">{i.food.name}</b>
                      <span className="num block text-xs text-ink-3">{i.food.serving}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button aria-label={`Less ${i.food.name}`} onClick={() => setQty(i.food.id, i.qty - 1)}
                        className="tap flex h-11 w-11 items-center justify-center rounded-full bg-teal-50 text-teal-950">
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="num w-8 text-center text-base font-bold">{i.qty}</span>
                      <button aria-label={`More ${i.food.name}`} onClick={() => setQty(i.food.id, i.qty + 1)}
                        className="tap flex h-11 w-11 items-center justify-center rounded-full bg-teal-50 text-teal-950">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* live nutrition estimate - always visible */}
            <div className="mt-3 flex items-center gap-4 rounded-xl bg-mint-50 p-3">
              <MacroRing kcal={t.kcal} carbs={t.carbs} protein={t.protein} fat={t.fat} size={84} />
              <div className="num flex min-w-0 flex-1 flex-col gap-1.5 text-sm text-ink-2">
                <span className="flex items-center gap-2">
                  <i className="h-2 w-2 rounded-full bg-m-carbs" />Carbs <b className="ml-auto text-ink">{t.carbs}g</b>
                </span>
                <span className="flex items-center gap-2">
                  <i className="h-2 w-2 rounded-full bg-m-protein" />Protein <b className="ml-auto text-ink">{t.protein}g</b>
                </span>
                <span className="flex items-center gap-2">
                  <i className="h-2 w-2 rounded-full bg-m-fat" />Fat <b className="ml-auto text-ink">{t.fat}g</b>
                </span>
                <span className="flex items-center gap-2">
                  <i className="h-2 w-2 rounded-full bg-m-fiber" />Fibre <b className="ml-auto text-ink">{t.fiber}g</b>
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={logTray}
            disabled={tray.length === 0}
            className={`tap mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-base font-bold ${
              tray.length === 0
                ? "bg-track text-ink-3"
                : "bg-teal-800 text-white shadow-[0_8px_18px_rgba(15,118,110,.28)]"
            }`}>
            <Check className="h-5 w-5" />
            Log this {mealType.toLowerCase()}
          </button>
          <button onClick={() => setScreen("foods")} className="tap mt-1 min-h-12 w-full text-sm font-semibold text-teal-800">
            Or pick a preset
          </button>
        </div>
      </div>
    </main>
  );
}
