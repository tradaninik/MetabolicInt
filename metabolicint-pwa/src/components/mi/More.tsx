"use client";

import { useEffect, useState } from "react";
import { Leaf, Minus, Plus, Download, UserRound } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useLog } from "@/lib/store";
import { TEXT_STEPS } from "@/lib/data";
import { PageHeader } from "./shared";

export default function More() {
  const { textSize, setTextSize, ayurveda, toggleAyurveda } = useLog();
  const [installEvt, setInstallEvt] = useState<Event | null>(null);

  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-28 pt-2 lg:max-w-2xl lg:px-8">
      <PageHeader title="Settings" sub="Make MetabolicInt comfortable for your eyes." />

      {/* Text size */}
      <section className="mi-card p-4">
        <h2 className="text-base font-bold tracking-tight">Text size</h2>
        <p className="mt-0.5 text-sm text-ink-2">
          Makes all text bigger or smaller across the app — cards and buttons grow too.
        </p>

        <div className="mt-3 flex items-center justify-between">
          <button aria-label="Smaller text" onClick={() => setTextSize(textSize - 1)}
            disabled={textSize === 0}
            className="tap flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-950 disabled:opacity-40">
            <Minus className="h-4 w-4" />
          </button>
          <div className="num text-center">
            <p className="text-sm font-bold">{TEXT_STEPS[textSize].label}</p>
            <p className="text-[.625rem] text-ink-3">{TEXT_STEPS[textSize].pct} of standard</p>
          </div>
          <button aria-label="Larger text" onClick={() => setTextSize(textSize + 1)}
            disabled={textSize === 3}
            className="tap flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-950 disabled:opacity-40">
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* 4 step buttons */}
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {TEXT_STEPS.map((s, i) => (
            <button key={s.label} onClick={() => setTextSize(i)} aria-pressed={textSize === i}
              className={`tap flex min-h-12 flex-col items-center justify-center rounded-xl text-xs font-semibold ${
                textSize === i ? "bg-teal-800 text-white" : "bg-teal-50 text-teal-950"
              }`}>
              <span className="text-base font-extrabold" style={{ fontSize: `${0.8 + i * 0.14}rem` }}>
                A
              </span>
              {s.label}
            </button>
          ))}
        </div>

        {/* live preview */}
        <div className="mt-3 rounded-xl bg-mint-50 p-3">
          <p className="text-sm font-semibold">Live preview</p>
          <p className="mt-1 text-base leading-normal">
            Your glucose was 132 mg/dL at 6:00 PM — nicely in range after your evening walk.
          </p>
        </div>
      </section>

      {/* Ayurveda toggle */}
      <section className="mi-card mt-3 flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amberu-50 text-amberu-700">
          <Leaf className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <b className="block text-[.9375rem] font-semibold">Ayurveda content</b>
          <span className="block text-[.8125rem] text-ink-2">
            Traditional tips alongside medical guidance. Off removes it everywhere.
          </span>
        </div>
        <Switch checked={ayurveda} onCheckedChange={toggleAyurveda} aria-label="Ayurveda content" />
      </section>

      {/* Install */}
      <section className="mi-card mt-3 flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <b className="block text-[.9375rem] font-semibold">Install app</b>
          <span className="block text-[.8125rem] text-ink-2">
            {installEvt
              ? "Add MetabolicInt to your home screen."
              : "Use your browser menu → “Add to Home screen”."}
          </span>
        </div>
        {installEvt && (
          <button
            onClick={() => (installEvt as PromptEvent).prompt()}
            className="tap min-h-12 shrink-0 rounded-full bg-teal-800 px-3.5 text-sm font-bold text-white">
            Install
          </button>
        )}
      </section>

      <div className="mi-card mt-3 flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-lg font-bold text-teal-950">
          P
        </div>
        <div className="min-w-0 flex-1">
          <b className="block text-[.9375rem] font-semibold">Priya Sharma, 63</b>
          <span className="block text-[.8125rem] text-ink-2">Type 2 diabetes · metformin 500 mg</span>
        </div>
        <UserRound className="h-5 w-5 text-ink-3" />
      </div>

      <p className="mt-4 px-0.5 text-xs text-ink-3">
        MetabolicInt supports your routine but is not a substitute for medical advice. Demo data shown.
      </p>
    </main>
  );
}

interface PromptEvent extends Event {
  prompt: () => Promise<void>;
}
