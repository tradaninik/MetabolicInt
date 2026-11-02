"use client";

import Image from "next/image";
import { ChevronRight, Repeat } from "lucide-react";
import { useLog } from "@/lib/store";
import { PRESETS, RECENTS, totals } from "@/lib/data";
import { PageHeader, SectionHead } from "./shared";

function PresetRow({ p, onLog }: { p: (typeof PRESETS)[number]; onLog: () => void }) {
  const t = totals(p.items);
  return (
    <div className="mi-card flex items-center gap-3 p-3">
      <Image src={p.photo} alt="" width={56} height={56}
        className="h-14 w-14 shrink-0 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <b className="block text-[.9375rem] font-semibold">{p.name}</b>
        <span className="num block truncate text-[.8125rem] text-ink-2">
          {p.sub} · {t.kcal} kcal
        </span>
      </div>
      <button
        onClick={onLog}
        className="tap flex min-h-12 shrink-0 items-center gap-1 rounded-full bg-teal-50 px-3.5 text-sm font-bold text-teal-950">
        <Repeat className="h-4 w-4" /> Log again
      </button>
    </div>
  );
}

export default function Foods() {
  const { quickLog, setScreen } = useLog();
  return (
    <main className="mx-auto w-full max-w-md px-4 pb-28 pt-2 lg:max-w-2xl lg:px-8">
      <PageHeader
        title="Foods"
        sub="Your regional presets and recent meals — one tap to log again."
        right={
          <button onClick={() => setScreen("log")}
            className="tap flex min-h-12 items-center gap-0.5 text-sm font-semibold text-teal-800">
            Search all <ChevronRight className="h-4 w-4" />
          </button>
        }
      />

      <SectionHead title="Regional presets" />
      <div className="flex flex-col gap-2">
        {PRESETS.map((p) => (
          <PresetRow key={p.id} p={p} onLog={() => quickLog(p, "Lunch")} />
        ))}
      </div>

      <div className="h-3" />
      <SectionHead title="Recent meals" />
      <div className="flex flex-col gap-2">
        {RECENTS.map((p) => (
          <PresetRow key={p.id} p={p} onLog={() => quickLog(p, "Dinner")} />
        ))}
      </div>

      <p className="mt-4 px-0.5 text-xs text-ink-3">
        Portions are your usual servings — you can adjust them before logging from the Log screen.
      </p>
    </main>
  );
}
