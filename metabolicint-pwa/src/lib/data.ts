import { DAYS90 } from "@/components/mi/days90.generated";

/* ================================================================
   MetabolicInt dummy data - persona "Priya", Type 2 diabetes,
   glucometer. All numbers match the delivered mockups.
   ================================================================ */

export type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack";

export interface Food {
  id: string;
  name: string;
  regional?: string;
  serving: string;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
  fiber: number;
  gi?: "low" | "medium" | "high";
}

export interface TrayItem {
  food: Food;
  qty: number; // servings
}

export interface LoggedMeal {
  id: string;
  type: MealType;
  items: TrayItem[];
  time: string;
  photo?: string;
  homeCooked?: boolean;
}

export const FOODS: Food[] = [
  { id: "idli", name: "Idli", serving: "2 pieces", kcal: 116, carbs: 24, protein: 4, fat: 0.5, fiber: 2, gi: "medium" },
  { id: "sambar", name: "Sambar", serving: "1 katori", kcal: 85, carbs: 13, protein: 4, fat: 3, fiber: 3, gi: "low" },
  { id: "coconut-chutney", name: "Coconut chutney", serving: "2 tbsp", kcal: 104, carbs: 4, protein: 2, fat: 9, fiber: 2, gi: "low" },
  { id: "pongal", name: "Ven pongal", serving: "1 bowl", kcal: 385, carbs: 58, protein: 11, fat: 12, fiber: 3, gi: "high" },
  { id: "pesarattu", name: "Pesarattu (green gram dosa)", regional: "Andhra", serving: "2 pieces", kcal: 290, carbs: 40, protein: 14, fat: 7, fiber: 6, gi: "low" },
  { id: "upma", name: "Vegetable upma", serving: "1 bowl", kcal: 260, carbs: 42, protein: 6, fat: 8, fiber: 4, gi: "medium" },
  { id: "dosa", name: "Plain dosa", serving: "2 pieces", kcal: 250, carbs: 40, protein: 5, fat: 7, fiber: 2, gi: "medium" },
  { id: "poha", name: "Poha", serving: "1 plate", kcal: 270, carbs: 48, protein: 5, fat: 7, fiber: 3, gi: "medium" },
  { id: "thali", name: "Andhra thali", regional: "Andhra", serving: "1 thali", kcal: 640, carbs: 82, protein: 18, fat: 22, fiber: 12, gi: "medium" },
  { id: "khichdi", name: "Vegetable khichdi", serving: "1 bowl", kcal: 280, carbs: 46, protein: 10, fat: 7, fiber: 6, gi: "low" },
  { id: "curd", name: "Curd (fresh)", serving: "1 katori", kcal: 90, carbs: 7, protein: 5, fat: 4, fiber: 0, gi: "low" },
  { id: "oats", name: "Oats bowl with milk", serving: "1 bowl", kcal: 210, carbs: 32, protein: 8, fat: 5, fiber: 4, gi: "low" },
  { id: "roti", name: "Phulka roti (wheat)", serving: "2 pieces", kcal: 200, carbs: 38, protein: 6, fat: 3, fiber: 4, gi: "low" },
  { id: "dal", name: "Toor dal", serving: "1 katori", kcal: 130, carbs: 18, protein: 8, fat: 3, fiber: 4, gi: "low" },
  { id: "paneer-bhurji", name: "Paneer bhurji", serving: "1 katori", kcal: 265, carbs: 8, protein: 16, fat: 19, fiber: 2, gi: "low" },
  { id: "rajma", name: "Rajma curry", serving: "1 katori", kcal: 190, carbs: 28, protein: 9, fat: 4, fiber: 8, gi: "low" },
  { id: "biryani", name: "Veg biryani", serving: "1 plate", kcal: 480, carbs: 68, protein: 10, fat: 16, fiber: 5, gi: "high" },
  { id: "salad", name: "Kachumber salad", serving: "1 bowl", kcal: 45, carbs: 8, protein: 2, fat: 0.5, fiber: 3, gi: "low" },
  { id: "buttermilk", name: "Spiced buttermilk", serving: "1 glass", kcal: 60, carbs: 6, protein: 3, fat: 2, fiber: 0, gi: "low" },
  { id: "methi-water", name: "Methi (fenugreek) water", serving: "1 glass", kcal: 5, carbs: 1, protein: 0, fat: 0, fiber: 1, gi: "low" },
];

export const foodById = (id: string) => FOODS.find((f) => f.id === id)!;

/* ---------- Presets & recent meals (one-tap re-log) ---------- */
export interface Preset {
  id: string;
  name: string;
  sub: string;
  photo: string;
  items: { food: Food; qty: number }[];
}

export const PRESETS: Preset[] = [
  {
    id: "andhra-thali",
    name: "Andhra thali",
    sub: "Rice, dal, sambar, poriyal, curd, pickle",
    photo: "/photos/thali.jpg",
    items: [
      { food: foodById("thali"), qty: 1 },
      { food: foodById("buttermilk"), qty: 1 },
    ],
  },
  {
    id: "pesarattu",
    name: "Pesarattu",
    sub: "Green gram dosa with ginger chutney",
    photo: "/photos/pesarattu.jpg",
    items: [
      { food: foodById("pesarattu"), qty: 1 },
      { food: foodById("sambar"), qty: 1 },
    ],
  },
  {
    id: "pongal",
    name: "Ven pongal",
    sub: "With sambar and coconut chutney",
    photo: "/photos/pongal.jpg",
    items: [
      { food: foodById("pongal"), qty: 1 },
      { food: foodById("sambar"), qty: 1 },
      { food: foodById("coconut-chutney"), qty: 1 },
    ],
  },
];

export const RECENTS: Preset[] = [
  {
    id: "khichdi",
    name: "Vegetable khichdi & curd",
    sub: "Yesterday · Lunch · 280 kcal",
    photo: "/photos/khichdi.jpg",
    items: [
      { food: foodById("khichdi"), qty: 1 },
      { food: foodById("curd"), qty: 1 },
    ],
  },
  {
    id: "oats",
    name: "Oats bowl",
    sub: "2 days ago · Breakfast · 210 kcal",
    photo: "/photos/oats.jpg",
    items: [{ food: foodById("oats"), qty: 1 }],
  },
];

/* ---------- Glucose data (matches mockups) ---------- */
// last 7 days, 4 checks a day: fasting, after breakfast, after lunch, after dinner
export const WEEK: { label: string; date: string; readings: number[] }[] = [
  { label: "Thu", date: "23 Oct", readings: [116, 148, 186, 172] },
  { label: "Fri", date: "24 Oct", readings: [120, 146, 158, 176] },
  { label: "Sat", date: "25 Oct", readings: [118, 152, 170, 192] },
  { label: "Sun", date: "26 Oct", readings: [114, 198, 176, 186] }, // pongal
  { label: "Mon", date: "27 Oct", readings: [112, 146, 158, 184] },
  { label: "Tue", date: "28 Oct", readings: [110, 142, 148, 160] },
  { label: "Wed", date: "29 Oct", readings: [112, 150, 178, 132] }, // 132 = now
];

// Sunday detail: 6 readings incl. extra checks after the spike
export const SUNDAY_READINGS: { t: string; label: string; value: number }[] = [
  { t: "7:30 AM", label: "Fasting", value: 114 },
  { t: "11:05 AM", label: "After breakfast", value: 198 },
  { t: "1:00 PM", label: "Before lunch", value: 152 },
  { t: "3:10 PM", label: "After lunch", value: 176 },
  { t: "5:20 PM", label: "After evening walk", value: 146 },
  { t: "10:30 PM", label: "After dinner", value: 186 },
];

export const DAY_MARKERS = [
  { label: "Breakfast 8:15", t: 8.25, kind: "meal" as const },
  { label: "Lunch 1:30", t: 13.5, kind: "meal" as const },
  { label: "Walk 4:45", t: 16.75, kind: "walk" as const },
  { label: "Dinner 8:00", t: 20.0, kind: "meal" as const },
];

// today's sparkline (matches dashboard mockup)
export const TODAY_CURVE = [112, 154, 138, 126, 132, 178, 158, 155, 142, 132];

export const MONTHS = [
  { label: "AUG", name: "August 2025", days: 31, avg: 152, tir: 64, a1c: 6.9 },
  { label: "SEP", name: "September 2025", days: 30, avg: 146, tir: 73, a1c: 6.7 },
  { label: "OCT", name: "October 2025", days: 29, avg: 140, tir: 81, a1c: 6.5 },
];

export const DAYS90_LIST = DAYS90;
export const DIWALI_INDICES = [80, 81]; // 20-21 Oct

export const monthSeries = (m: number) =>
  DAYS90.slice([0, 31, 61][m], [31, 61, 90][m]);

export const round1 = (v: number) => Math.round(v * 10) / 10;
export const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;

export const weekAvg = Math.round(mean(WEEK.flatMap((d) => d.readings)));
export const weekTir = Math.round(
  (100 * WEEK.flatMap((d) => d.readings).filter((v) => v >= 70 && v <= 180).length) / 28
);
export const fastingAvg = Math.round(mean(WEEK.map((d) => d.readings[0])));
export const weekPeak = Math.max(...WEEK.flatMap((d) => d.readings));
export const dayTir = (r: number[]) =>
  Math.round((100 * r.filter((v) => v >= 70 && v <= 180).length) / r.length);
export const timeOfDayAvg = [
  { label: "Fasting", value: fastingAvg },
  { label: "After breakfast", value: Math.round(mean(WEEK.map((d) => d.readings[1]))) },
  { label: "After lunch", value: Math.round(mean(WEEK.map((d) => d.readings[2]))) },
  { label: "After dinner", value: Math.round(mean(WEEK.slice(0, 6).map((d) => d.readings[3]))) },
];

export const octSeries = monthSeries(2);
export const weekBuckets = [61, 68, 75, 82].map((a, i) => ({
  label: ["Week 1 · 1–7", "Week 2 · 8–14", "Week 3 · 15–21 · Diwali", "Week 4 · 22–28"][i],
  value: Math.round(mean(DAYS90.slice(a, a + 7))),
}));

/* ---------- nutrition helpers ---------- */
export const totals = (items: TrayItem[]) => {
  const t = { kcal: 0, carbs: 0, protein: 0, fat: 0, fiber: 0 };
  for (const { food, qty } of items)
    (["kcal", "carbs", "protein", "fat", "fiber"] as const).forEach(
      (k) => (t[k] += food[k] * qty)
    );
  return {
    kcal: Math.round(t.kcal),
    carbs: Math.round(t.carbs),
    protein: Math.round(t.protein),
    fat: Math.round(t.fat),
    fiber: Math.round(t.fiber),
  };
};

export const TEXT_STEPS = [
  { label: "Standard", pct: "100%", px: 16 },
  { label: "Large", pct: "~112%", px: 17.92 },
  { label: "Larger", pct: "~125%", px: 20 },
  { label: "Largest", pct: "~140%", px: 22.4 },
];
