"use client";

// Composition screen for the additive preview route.
// Everything here runs on sample data (see sample-data.ts) so the page always
// renders, regardless of API state. When you pick the winners, lift the
// components you want into the real screens and feed them live data.

import { useState } from "react";

import { ContextTags } from "./ContextTags";
import { GlucoseEventChart } from "./GlucoseEventChart";
import { InsightList } from "./InsightList";
import { MealTray } from "./MealTray";
import { MetricStrip } from "./MetricStrip";
import { PhotoMealLog } from "./PhotoMealLog";
import { PostSaveCard } from "./PostSaveCard";
import { QuickLog, type QuickLogKind } from "./QuickLog";
import { RegionalPresets } from "./RegionalPresets";
import { useMealTray } from "./useMealTray";
import {
  CONTEXT_TAGS,
  DISHES,
  FOODS,
  GLUCOSE_EVENTS,
  GLUCOSE_POINTS,
  INSIGHTS,
  LAST_MEAL,
  METRICS,
  PHOTO_DEMO_DETECTION,
  PREDICTION,
  SLEEP_WINDOW,
  TARGET_RANGE,
} from "./sample-data";
import type { DetectedFood } from "./types";

const QUICK_LOG_LABELS: Record<QuickLogKind, string> = {
  "blood-sugar": "Blood sugar",
  walk: "Walk",
  sleep: "Sleep",
  weight: "Weight",
  exercise: "Exercise",
  bp: "BP",
  meal: LAST_MEAL,
};

// DEMO photo scanner — swap this for your vision API at integration
// (POST the file, get DetectedFood[] back). See README → "Wiring real data".
const scanPhotoDemo = (): Promise<DetectedFood[]> =>
  new Promise((resolve) => setTimeout(() => resolve(PHOTO_DEMO_DETECTION), 1700));

export function InsightsPreviewScreen() {
  const tray = useMealTray();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [quickLogDemo, setQuickLogDemo] = useState<string | null>(null);

  const toggleTag = (id: string) =>
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );

  const mealName = tray.items.map((it) => it.food.name).join(" + ") || "Your meal";

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <header className="flex items-baseline justify-between gap-3">
        <h1 className="text-lg font-semibold text-neutral-900">
          MetabolicInt <span className="font-normal text-neutral-400">· insights preview</span>
        </h1>
        <p className="shrink-0 text-xs text-neutral-400">Sample data · additive kit</p>
      </header>

      <section className="mt-4 rounded-xl border border-neutral-200 border-l-4 border-l-[#0a8e5f] bg-white p-4">
        <p className="text-sm leading-relaxed text-neutral-600">
          This page is an <span className="font-medium text-neutral-900">additive preview</span> —
          nothing on your current dashboard or logging flow has changed. Everything runs on sample
          data from the mockup scenario until you wire real sources. Browse both, compare, and keep
          what earns its place.
        </p>
      </section>

      {/* ── Quick log (from production, refined) ──────────── */}
      <h2 id="quick-log" className="mt-10 text-base font-semibold text-neutral-900">
        Quick log — kept from production, refined
      </h2>
      <p className="mt-1 text-xs text-neutral-500">
        The same one-tap loggers you have today; the meal tile drops the “Again:” prefix.
      </p>
      <div className="mt-3">
        <QuickLog
          lastMeal={LAST_MEAL}
          onQuickLog={(kind) =>
            setQuickLogDemo(
              kind === "meal"
                ? `Demo — in production this re-logs “${LAST_MEAL}” as a new meal.`
                : `Demo — in production this opens the one-tap ${QUICK_LOG_LABELS[kind]} logger.`,
            )
          }
        />
        {quickLogDemo ? (
          <p
            role="status"
            className="mt-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500"
          >
            {quickLogDemo}
          </p>
        ) : null}
      </div>

      {/* ── Reports ─────────────────────────────────────────── */}
      <h2 id="reports" className="mt-10 text-base font-semibold text-neutral-900">
        Reports — new candidates
      </h2>
      <p className="mt-1 text-xs text-neutral-500">
        Production’s metric set (glucose, time in range, sleep, weight, steps) kept — with blood
        pressure added. Swipe on mobile; every number keeps its freshness, source and status.
      </p>

      <div className="mt-3">
        <MetricStrip metrics={METRICS} />
      </div>
      <div className="mt-3">
        <GlucoseEventChart
          points={GLUCOSE_POINTS}
          targetRange={TARGET_RANGE}
          events={GLUCOSE_EVENTS}
          sleepWindow={SLEEP_WINDOW}
          updatedStamp="Updated 9:12 AM · CGM"
        />
      </div>
      <div className="mt-3">
        <InsightList insights={INSIGHTS} />
      </div>

      {/* ── Logging ─────────────────────────────────────────── */}
      <h2 id="logging" className="mt-10 text-base font-semibold text-neutral-900">
        Logging — new candidates
      </h2>
      <p className="mt-1 text-xs text-neutral-500">
        Fastest first: snap a photo (scan simulated in this preview), search, or pick a regional
        preset — then log in under a minute. Tap “Log meal” to see the after-save state.
      </p>

      <div className="mt-3">
        <PhotoMealLog
          onScan={scanPhotoDemo}
          onAddToTray={(items) => items.forEach((d) => tray.addFood(d.food, d.qty))}
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div>
          {saved ? (
            <div>
              <PostSaveCard
                mealName={mealName}
                loggedAt="just now"
                totals={tray.totals}
                prediction={PREDICTION}
                onRemind={() => {}}
                onLogGlucose={() => {}}
              />
              <button
                type="button"
                onClick={() => setSaved(false)}
                className="mt-2 text-xs text-[#0a8e5f] underline underline-offset-2"
              >
                ← Back to tray (preview only)
              </button>
            </div>
          ) : (
            <MealTray
              foods={FOODS}
              items={tray.items}
              totals={tray.totals}
              onAdd={tray.addFood}
              onSetQty={tray.setQty}
              onRemove={tray.removeItem}
              onClear={tray.clear}
              onLogMeal={() => setSaved(true)}
            />
          )}
        </div>
        <div className="grid gap-3">
          <RegionalPresets dishes={DISHES} onAddDish={tray.addFood} />
          <ContextTags tags={CONTEXT_TAGS} selected={selectedTags} onToggle={toggleTag} />
        </div>
      </div>

      <footer className="mt-10 border-t border-neutral-200 pt-4">
        <p className="text-xs leading-relaxed text-neutral-400">
          Values are estimates from sample data and may vary. Every number carries its source and
          freshness — that stays true when wired to real data. See this kit’s README for wiring
          instructions and an old-vs-new comparison guide.
        </p>
      </footer>
    </div>
  );
}
