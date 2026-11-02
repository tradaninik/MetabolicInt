"use client";

// Tray state for the meal logging flow: add/remove foods, adjust servings,
// and always know the live macro totals. Used by MealTray (and anything else
// that needs to add foods — e.g. RegionalPresets on the same screen).

import { useCallback, useMemo, useState } from "react";

import type { Food, MacroTotals, TrayItem } from "./types";

export interface UseMealTrayResult {
  items: TrayItem[];
  addFood: (food: Food, qty?: number) => void;
  /** Setting a qty to 0 (or below) removes the item. */
  setQty: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
  clear: () => void;
  totals: MacroTotals;
}

export function useMealTray(): UseMealTrayResult {
  const [items, setItems] = useState<TrayItem[]>([]);

  const addFood = useCallback((food: Food, qty = 1) => {
    setItems((prev) => {
      const i = prev.findIndex((it) => it.food.id === food.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + qty };
        return next;
      }
      return [...prev, { food, qty }];
    });
  }, []);

  const setQty = useCallback((id: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((it) => it.food.id !== id)
        : prev.map((it) => (it.food.id === id ? { ...it, qty } : it)),
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.food.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const totals = useMemo<MacroTotals>(
    () =>
      items.reduce<MacroTotals>(
        (acc, it) => ({
          kcal: acc.kcal + it.food.kcal * it.qty,
          carbs: acc.carbs + it.food.carbs * it.qty,
          protein: acc.protein + it.food.protein * it.qty,
          fat: acc.fat + it.food.fat * it.qty,
        }),
        { kcal: 0, carbs: 0, protein: 0, fat: 0 },
      ),
    [items],
  );

  return { items, addFood, setQty, removeItem, clear, totals };
}
