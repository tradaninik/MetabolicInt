"use client";

import Image from "next/image";
import { Check, Droplets } from "lucide-react";
import { useLog } from "@/lib/store";
import { totals } from "@/lib/data";
import { MacroRing } from "./Charts";
import { PageHeader } from "./shared";

export default function MealAnalysis() {
  const { lastLogged, confirmLogged } = useLog();
  if (!lastLogged) return null;
  const m = lastLogged;
  const t = totals(m.items);
  const carbsHeavy = t.carbs >= 55;

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-28 pt-2 lg:max-w-2xl lg:px-8">
      <PageHeader
        back="Home"
        onBack={confirmLogged}
        title={`${m.type} logged`}
        sub={`Today · ${m.time}`}
        right={
          <span className="pill pill-ok">
            <Check className="h-3.5 w-3.5" /> Saved
          </span>
        }
      />

      {m.photo && (
        <div className="relative mb-3 h-28 overflow-hidden rounded-2xl shadow-[0_1px_2px_rgba(28,43,51,.05),0_2px_8px_rgba(28,43,51,.04)]">
          <Image src={m.photo} alt="" fill className="object-cover" />
          <span className="pill num absolute bottom-2.5 left-2.5 bg-white/95 font-extrabold text-teal-950">
            {t.kcal} kcal
          </span>
        </div>
      )}

      {/* nutrition */}
      <section className="mi-card flex items-center gap-4 p-4">
        <MacroRing kcal={t.kcal} carbs={t.carbs} protein={t.protein} fat={t.fat} />
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
      </section>

      {/* food list */}
      <section className="mt-3">
        <h2 className="mb-2 px-0.5 text-[1.0625rem] font-bold tracking-tight">In this meal</h2>
        <div className="mi-card px-4 py-1">
          {m.items.map((i) => (
            <div key={i.food.id} className="flex items-center justify-between border-b border-[#F0F6F2] py-2.5 last:border-0">
              <div className="min-w-0">
                <b className="block text-[.9375rem] font-semibold">
                  {i.food.name}
                  {i.qty > 1 && <span className="num text-ink-3"> × {i.qty}</span>}
                </b>
                <span className="num block text-[.8125rem] text-ink-2">
                  {i.qty} × {i.food.serving}
                </span>
              </div>
              <span className="num shrink-0 text-sm font-bold text-teal-950">
                {Math.round(i.food.kcal * i.qty)} kcal
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* analysis */}
      <section className="mi-card mt-3 p-4">
        <h2 className="text-base font-bold tracking-tight">How this meal looks</h2>
        <p className="mt-1.5 text-base leading-normal">
          {carbsHeavy ? (
            <>
              This is a carb-forward meal (~{t.carbs} g). Expect a noticeable rise in glucose —
              a short walk within an hour can help soften it.
            </>
          ) : (
            <>
              Balanced plate — fibre and protein should keep your glucose rise gentle after this meal.
            </>
          )}
        </p>
        <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-teal-50 p-3">
          <Droplets className="mt-0.5 h-5 w-5 shrink-0 text-teal-800" />
          <div>
            <b className="block text-[.9375rem] font-bold">Check glucose 1–2 h after this meal</b>
            <p className="mt-0.5 text-[.8125rem] text-ink-2">
              Target: under 180 mg/dL. Log it from Home with one tap.
            </p>
          </div>
        </div>
      </section>

      <button
        onClick={confirmLogged}
        className="tap mt-3 flex min-h-12 w-full items-center justify-center rounded-full bg-teal-800 text-base font-bold text-white shadow-[0_8px_18px_rgba(15,118,110,.28)]">
        Done
      </button>
    </main>
  );
}
