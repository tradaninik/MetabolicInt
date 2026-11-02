"use client";

import Image from "next/image";
import { Droplets, Footprints, Pill, Bell, ChevronRight } from "lucide-react";
import { useLog } from "@/lib/store";
import { TODAY_CURVE, totals, weekAvg, weekTir } from "@/lib/data";
import { ScoreRing, TodaySpark } from "./Charts";
import { AyuCard, ForYou, SectionHead, StatCard } from "./shared";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const { todayMeals, ayurveda, setScreen, showToast } = useLog();

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pb-28 pt-3 lg:max-w-none lg:px-8 lg:pb-8">
      {/* greeting */}
      <header className="flex items-center gap-3 px-0.5 py-1">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-100 text-lg font-bold text-teal-950">
          P
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-2">{greeting()}</p>
          <h1 className="text-[1.375rem] font-extrabold leading-tight tracking-tight">Priya</h1>
        </div>
        <button
          aria-label="Alerts"
          onClick={() => showToast("No new alerts")}
          className="tap relative flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-[0_1px_2px_rgba(28,43,51,.05),0_2px_8px_rgba(28,43,51,.04)]">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-rose-700 ring-2 ring-white" />
        </button>
      </header>

      <div className="grid gap-3 lg:grid-cols-12">
        {/* health score */}
        <section className="mi-card flex items-center gap-4 p-4 lg:col-span-5">
          <ScoreRing score={78} />
          <div>
            <h2 className="text-[1.0625rem] font-bold tracking-tight">Metabolic health score</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="pill pill-ok">On track</span>
              <span className="num flex items-center gap-1 text-[.8125rem] font-bold text-teal-950">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" />
                </svg>
                4 this week
              </span>
            </div>
            <p className="num mt-1.5 text-xs text-ink-3">Updated today at 6:00 PM</p>
          </div>
        </section>

        {/* glance row */}
        <div className="grid grid-cols-3 gap-2 lg:col-span-7 lg:grid-cols-3">
          <StatCard icon={<Droplets className="h-5 w-5" />} value="132" label="Latest glucose"
            sub="mg/dL · 6:00 PM" />
          <StatCard icon={<Footprints className="h-5 w-5" />} value="3,840" label="Steps"
            sub="of 6,000 goal" />
          <StatCard icon={<Pill className="h-5 w-5" />} value="2 of 3" label="Meds taken"
            sub="next dose 9:00 PM" />
        </div>

        {/* sparkline */}
        <section className="mi-card p-4 lg:col-span-7">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-base font-bold tracking-tight">Today&apos;s glucose</h3>
            <span className="pill pill-teal num">In range 82%</span>
          </div>
          <TodaySpark values={TODAY_CURVE} labels={["8 AM", "12 PM", "4 PM", "6 PM"]} />
          <p className="num mt-2 text-xs text-ink-3">
            Target range 70–180 mg/dL · spike after lunch at 2:30 PM
          </p>
        </section>

        {/* meals & check-ins */}
        <section className="lg:col-span-5">
          <SectionHead
            title="Today's meals & check-ins"
            right={
              <button onClick={() => setScreen("log")}
                className="tap flex min-h-12 items-center gap-0.5 text-sm font-semibold text-teal-800">
                Log <ChevronRight className="h-4 w-4" />
              </button>
            }
          />
          <div className="mi-card px-4 py-1">
            {todayMeals.map((m) => {
              const t = totals(m.items);
              return (
                <div key={m.id} className="flex items-center gap-3 border-b border-[#F0F6F2] py-2.5 last:border-0">
                  {m.photo ? (
                    <Image src={m.photo} alt="" width={44} height={44}
                      className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800">
                      <Droplets className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <b className="num block text-[.9375rem] font-semibold">
                      {m.type} · {m.time}
                    </b>
                    <span className="block truncate text-[.8125rem] text-ink-2">
                      {m.items.map((i) => i.food.name).join(", ")}
                    </span>
                  </div>
                  <span className="num shrink-0 text-sm font-bold text-teal-950">{t.kcal} kcal</span>
                </div>
              );
            })}
            <div className="flex items-center gap-3 py-2.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800">
                <Footprints className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <b className="num block text-[.9375rem] font-semibold">Evening walk · 4:45 PM</b>
                <span className="block text-[.8125rem] text-ink-2">30 minutes · 2,100 steps</span>
              </div>
              <span className="pill pill-ok">Done</span>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ForYou note="From your last 7 days">
          Your midday glucose was steadier on days with a morning walk. A 10-minute stroll
          before lunch could help tomorrow.
        </ForYou>
        {ayurveda && <AyuCard />}
      </div>

      <p className="num px-0.5 text-xs text-ink-3 lg:hidden">
        Week so far: average {weekAvg} mg/dL · time in range {weekTir}%
      </p>
    </main>
  );
}
