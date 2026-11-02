"use client";

import { useEffect } from "react";
import { Home, ClipboardList, UtensilsCrossed, LineChart, MoreHorizontal, Plus, X } from "lucide-react";
import { useLog, type Screen } from "@/lib/store";
import { TEXT_STEPS } from "@/lib/data";
import Dashboard from "@/components/mi/Dashboard";
import LogMeal from "@/components/mi/LogMeal";
import MealAnalysis from "@/components/mi/MealAnalysis";
import Foods from "@/components/mi/Foods";
import Insights from "@/components/mi/Insights";
import More from "@/components/mi/More";

const TABS: { id: Screen; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "log", label: "Log", icon: ClipboardList },
  { id: "foods", label: "Foods", icon: UtensilsCrossed },
  { id: "insights", label: "Insights", icon: LineChart },
  { id: "more", label: "More", icon: MoreHorizontal },
];

function ScreenBody() {
  const screen = useLog((s) => s.screen);
  switch (screen) {
    case "log": return <LogMeal />;
    case "analysis": return <MealAnalysis />;
    case "foods": return <Foods />;
    case "insights": return <Insights />;
    case "more": return <More />;
    default: return <Dashboard />;
  }
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-800 text-lg font-extrabold text-white">
        M
      </div>
      <div className="leading-tight">
        <p className="text-base font-extrabold tracking-tight">MetabolicInt</p>
        <p className="text-xs text-ink-3">Diabetes care, the Indian way</p>
      </div>
    </div>
  );
}

export default function Page() {
  const { screen, setScreen, textSize, toast, dismissToast } = useLog();

  /* text size steps drive the root font size (all rem-based UI scales) */
  useEffect(() => {
    document.documentElement.style.fontSize = `${TEXT_STEPS[textSize].px}px`;
  }, [textSize]);

  /* PWA app-shortcut: /?action=log opens the Log screen directly */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("action") === "log") setScreen("log");
  }, [setScreen]);

  /* PWA service worker */
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  /* toast auto-dismiss */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismissToast, 2600);
    return () => clearTimeout(t);
  }, [toast, dismissToast]);

  const activeTab =
    screen === "analysis" ? "log" : (["home", "log", "foods", "insights", "more"] as Screen[]).includes(screen)
      ? screen
      : "home";

  return (
    <div className="min-h-screen bg-surface">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-1 border-r border-line bg-card px-4 py-5 lg:flex">
        <div className="px-2 pb-4">
          <Brand />
        </div>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setScreen(t.id)}
            className={`tap flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${
              activeTab === t.id ? "bg-teal-50 text-teal-950" : "text-ink-2 hover:bg-mint-50"
            }`}>
            <t.icon className="h-5 w-5" />
            {t.label}
          </button>
        ))}
        <button onClick={() => setScreen("log")}
          className="tap mt-3 flex min-h-12 items-center justify-center gap-2 rounded-full bg-teal-800 text-base font-bold text-white shadow-[0_8px_18px_rgba(15,118,110,.28)]">
          <Plus className="h-5 w-5" /> Log a meal
        </button>
        <p className="num mt-auto px-3 text-xs text-ink-3">
          Text size: {TEXT_STEPS[textSize].label} · change in More
        </p>
      </aside>

      {/* mobile content */}
      <div className="lg:pl-64">
        <ScreenBody />
      </div>

      {/* bottom tab bar (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch bg-card pb-2 pt-0 shadow-[0_-6px_20px_rgba(28,43,51,.07)] lg:hidden"
        style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}
        aria-label="Main navigation">
        {TABS.slice(0, 2).map((t) => (
          <TabButton key={t.id} t={t} active={activeTab === t.id} onClick={() => setScreen(t.id)} />
        ))}
        <div className="flex w-[4.5rem] shrink-0 flex-col items-center justify-end">
          <button onClick={() => setScreen("log")} aria-label="Log a meal"
            className="tap -mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-teal-800 text-white shadow-[0_10px_22px_rgba(15,118,110,.38)]">
            <Plus className="h-7 w-7" strokeWidth={2.2} />
          </button>
          <span className="mt-1 text-[.6875rem] font-semibold text-teal-950">Log</span>
        </div>
        {TABS.slice(2).map((t) => (
          <TabButton key={t.id} t={t} active={activeTab === t.id} onClick={() => setScreen(t.id)} />
        ))}
      </nav>

      {/* toast */}
      {toast && (
        <div role="status" aria-live="polite"
          className="fixed bottom-24 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-white shadow-lg lg:bottom-8">
          {toast.msg}
          <button onClick={dismissToast} aria-label="Dismiss" className="tap -mr-1 p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function TabButton({
  t, active, onClick,
}: { t: (typeof TABS)[number]; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-current={active ? "page" : undefined}
      className={`tap flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-1 py-1.5 text-[.72rem] font-medium ${
        active ? "font-bold text-teal-800" : "text-ink-3"
      }`}>
      <t.icon className="h-6 w-6" />
      {t.label}
    </button>
  );
}
