"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type LoggedMeal,
  type MealType,
  type TrayItem,
  foodById,
  type Preset,
  totals,
} from "@/lib/data";

export type Screen =
  | "home"
  | "log"
  | "analysis"
  | "foods"
  | "insights"
  | "more";

export type TrendRange = "Day" | "Week" | "Month" | "3M";

const nowTime = () =>
  new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

interface LogState {
  screen: Screen;
  mealType: MealType;
  tray: TrayItem[];
  lastLogged: LoggedMeal | null;
  todayMeals: LoggedMeal[];
  textSize: number;
  ayurveda: boolean;
  trend: { range: TrendRange; day: number; month: number };
  toast: { msg: string; key: number } | null;

  setScreen: (s: Screen) => void;
  setMealType: (t: MealType) => void;
  addToTray: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clearTray: () => void;
  logTray: () => void;
  quickLog: (p: Preset, type?: MealType) => void;
  confirmLogged: () => void;
  setTextSize: (i: number) => void;
  toggleAyurveda: () => void;
  setTrend: (t: Partial<LogState["trend"]>) => void;
  showToast: (msg: string) => void;
  dismissToast: () => void;
}

const STARTER_MEALS: LoggedMeal[] = [
  {
    id: "m1",
    type: "Breakfast",
    items: [
      { food: foodById("idli"), qty: 1 },
      { food: foodById("sambar"), qty: 1 },
      { food: foodById("coconut-chutney"), qty: 1 },
    ],
    time: "8:12 AM",
    photo: "/photos/breakfast.jpg",
    homeCooked: true,
  },
  {
    id: "m2",
    type: "Lunch",
    items: [
      { food: foodById("khichdi"), qty: 1 },
      { food: foodById("curd"), qty: 1 },
    ],
    time: "1:30 PM",
    photo: "/photos/khichdi.jpg",
    homeCooked: true,
  },
];

export const useLog = create<LogState>()(
  persist(
    (set, get) => ({
      screen: "home",
      mealType: "Dinner",
      tray: [],
      lastLogged: null,
      todayMeals: STARTER_MEALS,
      textSize: 0,
      ayurveda: true,
      trend: { range: "Week", day: 6, month: 2 },
      toast: null,

      setScreen: (screen) => set({ screen }),
      setMealType: (mealType) => set({ mealType }),
      addToTray: (id) => {
        const ex = get().tray.find((t) => t.food.id === id);
        if (ex) setQtyFn(set, get, id, ex.qty + 1);
        else
          set((s) => ({ tray: [...s.tray, { food: foodById(id), qty: 1 }] }));
      },
      setQty: (id, qty) => setQtyFn(set, get, id, qty),
      clearTray: () => set({ tray: [] }),
      logTray: () => {
        const { tray, mealType } = get();
        if (!tray.length) return;
        set({
          lastLogged: {
            id: "u" + Date.now(),
            type: mealType,
            items: tray,
            time: nowTime(),
          },
          tray: [],
          screen: "analysis",
        });
      },
      quickLog: (p, type = "Dinner") =>
        set({
          lastLogged: {
            id: "u" + Date.now(),
            type,
            items: p.items,
            time: nowTime(),
            photo: p.photo,
          },
          screen: "analysis",
        }),
      confirmLogged: () => {
        const m = get().lastLogged;
        if (m)
          set({
            todayMeals: [...get().todayMeals, m],
            lastLogged: null,
            screen: "home",
            toast: { msg: `${m.type} logged · ${totals(m.items).kcal} kcal`, key: Date.now() },
          });
        else set({ screen: "home" });
      },
      setTextSize: (i) => set({ textSize: Math.max(0, Math.min(3, i)) }),
      toggleAyurveda: () => set((s) => ({ ayurveda: !s.ayurveda })),
      setTrend: (t) => set((s) => ({ trend: { ...s.trend, ...t } })),
      showToast: (msg) => set({ toast: { msg, key: Date.now() } }),
      dismissToast: () => set({ toast: null }),
    }),
    {
      name: "metabolicint",
      partialize: (s) => ({ textSize: s.textSize, ayurveda: s.ayurveda }),
    }
  )
);

function setQtyFn(
  set: (p: Partial<LogState>) => void,
  get: () => LogState,
  id: string,
  qty: number
) {
  const tray = get().tray
    .map((t) => (t.food.id === id ? { ...t, qty } : t))
    .filter((t) => t.qty > 0);
  set({ tray });
}
