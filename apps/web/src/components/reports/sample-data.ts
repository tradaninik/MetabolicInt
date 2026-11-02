// SAMPLE DATA — everything in this file is illustrative, adapted from the
// mockup scenario (24 Apr 2025), and exists only so the preview route renders.
// Replace each export with your real data sources; see README.md → "Wiring real data".

import type {
  ChartEvent,
  DetectedFood,
  Dish,
  GlucosePoint,
  Insight,
  Metric,
  Prediction,
} from "./types";

// ── Reports ────────────────────────────────────────────────────────────────

export const TARGET_RANGE: [number, number] = [70, 140];

export const GLUCOSE_POINTS: GlucosePoint[] = [
  { t: "00:00", v: 96 }, { t: "01:00", v: 90 }, { t: "02:00", v: 85 },
  { t: "03:00", v: 82 }, { t: "04:00", v: 84 }, { t: "05:00", v: 87 },
  { t: "06:00", v: 89 }, { t: "06:30", v: 91 }, { t: "07:00", v: 93 },
  { t: "07:30", v: 95 }, { t: "08:00", v: 97 }, { t: "08:30", v: 112 },
  { t: "09:00", v: 124 }, { t: "09:30", v: 121 }, { t: "10:00", v: 110 },
  { t: "10:30", v: 103 }, { t: "11:00", v: 100 }, { t: "11:30", v: 101 },
  { t: "12:00", v: 102 }, { t: "12:30", v: 104 }, { t: "13:00", v: 108 },
  { t: "13:15", v: 112 }, { t: "13:45", v: 138 }, { t: "14:00", v: 142 },
  { t: "14:30", v: 136 }, { t: "15:00", v: 122 }, { t: "15:30", v: 112 },
  { t: "16:00", v: 106 }, { t: "17:30", v: 88 }, { t: "18:00", v: 86 },
  { t: "18:30", v: 90 }, { t: "19:00", v: 94 }, { t: "19:45", v: 97 },
  { t: "20:30", v: 112 }, { t: "21:00", v: 118 }, { t: "21:30", v: 112 },
  { t: "22:00", v: 104 }, { t: "23:00", v: 98 },
];

/** Shaded sleep window shown on the chart. */
export const SLEEP_WINDOW: [string, string] = ["00:00", "06:30"];

export const GLUCOSE_EVENTS: ChartEvent[] = [
  { t: "08:00", type: "meal", label: "Breakfast" },
  { t: "08:10", type: "medication", label: "Metformin 500 mg" },
  { t: "13:15", type: "meal", label: "Lunch" },
  { t: "17:30", type: "activity", label: "Evening walk" },
  { t: "19:45", type: "meal", label: "Dinner (planned)", planned: true },
];

// Mirrors the PRODUCTION metric set (glucose latest, time in range, sleep last
// night, weight — plus steps) with exactly ONE addition: blood pressure.
// At integration time, production's metric row stays as-is and gains only the
// BP card. `isNew` flags that card so reviewers can spot the addition.
export const METRICS: Metric[] = [
  {
    id: "glucose",
    label: "Glucose",
    value: "105",
    unit: "mg/dL",
    timestamp: "9:12 AM",
    source: "CGM",
    status: "good",
    statusLabel: "In range",
  },
  {
    id: "time-in-range",
    label: "Time in range",
    value: "57%",
    timestamp: "today",
    source: "CGM",
    status: "watch",
    statusLabel: "Target ≥ 70%",
  },
  {
    id: "bp",
    label: "Blood pressure",
    value: "118/76",
    unit: "mm Hg",
    timestamp: "8:20 AM",
    source: "Home cuff",
    trend: { direction: "down", display: "3 systolic", note: "vs 7-day avg", tone: "positive" },
    status: "good",
    statusLabel: "Normal",
    isNew: true,
  },
  {
    id: "sleep",
    label: "Sleep",
    value: "8.0",
    unit: "h",
    timestamp: "last night",
    source: "Phone",
    status: "good",
    statusLabel: "Good",
  },
  {
    id: "weight",
    label: "Weight",
    value: "70.0",
    unit: "kg",
    timestamp: "Yesterday 7:10 AM",
    source: "Smart scale",
    trend: { direction: "down", display: "5.0 kg", note: "vs 30 days", tone: "positive" },
    status: "good",
    statusLabel: "On track",
  },
  {
    id: "steps",
    label: "Steps",
    value: "0",
    timestamp: "so far today",
    source: "Phone",
  },
];

/** Powers the "log again" tile in QuickLog. */
export const LAST_MEAL = "Coconut chutney";

export const INSIGHTS: Insight[] = [
  {
    id: "lunch-rise",
    confidence: "moderate",
    title: "Lunch is your sharpest glucose rise",
    body: "On 3 of the last 5 similar days, glucose rose about 35–45 mg/dL above baseline within an hour of lunch — your steepest meal of the day.",
    evidence: "Based on 12 comparable meals over the last 3 months",
    missingData: "Missing: stress data — tag your days to sharpen this.",
  },
  {
    id: "walks",
    confidence: "high",
    title: "Morning walks are paying off",
    body: "On days with a 30-minute walk, your average glucose ran about 7 mg/dL lower than on days without one.",
    evidence: "Based on 14 walks over the last 2 months",
  },
  {
    id: "late-dinner",
    confidence: "low",
    title: "Late dinners may nudge your mornings",
    body: "Your two highest next-morning readings this month both followed dinners after 9 PM.",
    evidence: "Based on 2 late dinners this month",
  },
];

// ── Logging ────────────────────────────────────────────────────────────────

/**
 * The regional preset catalog. The searchable food list is the same data —
 * one source of truth for the tray, search and presets.
 * Macros are per-serving ESTIMATES for preview purposes only.
 */
export const DISHES: Dish[] = [
  // South India — Andhra & Telangana
  { id: "andhra-thali", name: "Andhra veg thali", serving: "1 plate", kcal: 550, carbs: 72, protein: 16, fat: 22, region: "South India", subregion: "Andhra & Telangana" },
  { id: "pesarattu", name: "Pesarattu", serving: "1 piece", kcal: 180, carbs: 26, protein: 9, fat: 5, region: "South India", subregion: "Andhra & Telangana" },
  { id: "pongal", name: "Ven pongal", serving: "1 katori (~150 g)", kcal: 250, carbs: 38, protein: 7, fat: 8, region: "South India", subregion: "Andhra & Telangana" },
  // South India — Tamil Nadu
  { id: "idli", name: "Idli", serving: "2 pieces", kcal: 110, carbs: 22, protein: 6, fat: 1, region: "South India", subregion: "Tamil Nadu" },
  { id: "dosa", name: "Plain dosa", serving: "1 dosa", kcal: 170, carbs: 28, protein: 5, fat: 5, region: "South India", subregion: "Tamil Nadu" },
  { id: "curd-rice", name: "Curd rice", serving: "1 katori (~150 g)", kcal: 210, carbs: 32, protein: 7, fat: 6, region: "South India", subregion: "Tamil Nadu" },
  { id: "upma", name: "Rava upma", serving: "1 katori (~150 g)", kcal: 220, carbs: 32, protein: 5, fat: 8, region: "South India", subregion: "Tamil Nadu" },
  { id: "filter-coffee", name: "Filter coffee", serving: "1 glass, with sugar", kcal: 90, carbs: 14, protein: 3, fat: 3, region: "South India", subregion: "Tamil Nadu" },
  { id: "coconut-chutney", name: "Coconut chutney", serving: "1 katori (~45 g)", kcal: 100, carbs: 9, protein: 2, fat: 7, region: "South India", subregion: "Tamil Nadu" },
  { id: "sambar", name: "Sambar", serving: "1 katori (~150 ml)", kcal: 130, carbs: 18, protein: 6, fat: 4, region: "South India", subregion: "Tamil Nadu" },
  // North India — Punjab
  { id: "rajma-chawal", name: "Rajma chawal", serving: "1 bowl", kcal: 380, carbs: 58, protein: 14, fat: 10, region: "North India", subregion: "Punjab" },
  { id: "aloo-paratha", name: "Aloo paratha", serving: "1 piece", kcal: 290, carbs: 42, protein: 7, fat: 11, region: "North India", subregion: "Punjab" },
  { id: "paneer-bhurji", name: "Paneer bhurji", serving: "1 katori (~120 g)", kcal: 240, carbs: 8, protein: 16, fat: 17, region: "North India", subregion: "Punjab" },
  { id: "chole", name: "Chole", serving: "1 katori (~150 g)", kcal: 210, carbs: 28, protein: 9, fat: 8, region: "North India", subregion: "Punjab" },
  // North India — Uttar Pradesh
  { id: "phulka", name: "Phulka", serving: "2 pieces", kcal: 160, carbs: 32, protein: 6, fat: 1, region: "North India", subregion: "Uttar Pradesh" },
  { id: "dal-tadka", name: "Dal tadka", serving: "1 katori (~150 g)", kcal: 180, carbs: 24, protein: 9, fat: 6, region: "North India", subregion: "Uttar Pradesh" },
  // West India — Maharashtra
  { id: "poha", name: "Poha", serving: "1 plate", kcal: 270, carbs: 44, protein: 5, fat: 9, region: "West India", subregion: "Maharashtra" },
  { id: "misal-pav", name: "Misal pav", serving: "1 plate", kcal: 330, carbs: 40, protein: 12, fat: 14, region: "West India", subregion: "Maharashtra" },
  { id: "sabudana-khichdi", name: "Sabudana khichdi", serving: "1 katori (~150 g)", kcal: 280, carbs: 44, protein: 6, fat: 9, region: "West India", subregion: "Maharashtra" },
];

/** The searchable catalog is the same list. */
export const FOODS = DISHES;

function dishById(id: string): Dish {
  const d = DISHES.find((x) => x.id === id);
  if (!d) throw new Error(`No dish with id "${id}"`);
  return d;
}

/**
 * Simulated photo-scan result for the preview — a classic South Indian
 * breakfast plate. At integration, replace the demo scanner in the screen
 * with your vision API (see README → "Wiring real data").
 */
export const PHOTO_DEMO_DETECTION: DetectedFood[] = [
  { food: dishById("idli"), qty: 1, confidence: "high", note: "2 pieces detected on plate" },
  { food: dishById("coconut-chutney"), qty: 1, confidence: "moderate", note: "katori size estimated from plate" },
  { food: dishById("sambar"), qty: 1, confidence: "moderate", note: "1 katori — partly visible" },
];

export const CONTEXT_TAGS = [
  { id: "stress", label: "Stressful day" },
  { id: "poor-sleep", label: "Poor sleep" },
  { id: "travel", label: "Travel" },
  { id: "period", label: "Period" },
  { id: "fasting", label: "Fasting" },
];

export const PREDICTION: Prediction = {
  low: 135,
  high: 150,
  minutesAfter: 60,
  comparable: 12,
  confidence: "moderate",
  period: "last 3 months",
};
