// devdata-lakshmi.ts - demo seed for the "Lakshmi" demo patient (57F,
// Hyderabad, Type 2 diabetes). Her lab history is a real Healthians report
// series (Jun 2023 .. Nov 2026, 5 panels, 135 results) so the dashboard
// Smart Analysis engine has rich data to analyze, on top of 14 days of
// glucose/activity/sleep/weight/BP logging and 10 days of Telugu meals.
//
// Installed at apps/web/scripts/devdata-lakshmi.ts. Run from apps\web:
//   npm run demo:lakshmi          (i.e. tsx scripts/devdata-lakshmi.ts)
// Args:
//   --json     final line is a JSON summary:
//              {"user":"...","panels":N,"results":N,"glucose":N,"entries":N}
//   --db <path>  accepted for wrapper compatibility and IGNORED - this
//              script uses DATABASE_URL from the env, like the app.
//
// Contract (mirrors devdata-60.ts): demo user only; deterministic (fixed
// arrays + fixed modular day rules, no Math.random); idempotent (deletes
// this demo user's rows in the affected tables, then writes everything in
// ONE prisma.$transaction); ASCII console output only. Markers printed for
// the wrapper: SEED-USER, SEED-FOODS, SEED-LABS, SEED-MEDS, SEED-GLUCOSE,
// SEED-MEALS, SEED-VITALS, SEED-SURVEY, COUNTS, ALL-OK. The demo password
// is printed on the PASSWORD line at the end.
import * as prismaMod from "@prisma/client";
import bcrypt from "bcryptjs";

const DEMO_EMAIL = "lakshmi@demo.metabolic.app";
const DEMO_PASSWORD = "Lakshmi@57";
const LAB_NAME = "Healthians";
const FOOD_REGION = "telugu";

const modAny: any = prismaMod;
const modDefault: any =
  modAny.default && modAny.default.PrismaClient ? modAny.default : modAny;
const PrismaClientCtor: any =
  modAny.PrismaClient || modDefault.PrismaClient;
const prisma: any = PrismaClientCtor ? new PrismaClientCtor() : null;

function ascii(v: any): string {
  const s = v === null || v === undefined ? "" : String(v);
  return s.replace(/[^\x20-\x7E]/g, "?");
}
function msg(e: any): string {
  const s = e && e.message ? String(e.message) : String(e);
  return ascii(s).replace(/\s+/g, " ").slice(0, 160);
}
function fatal(m: string): void {
  console.log("FATAL " + ascii(m));
  process.exit(1);
}
function r2(v: number): number {
  return Math.round(v * 100) / 100;
}
function isoDate(d: Date): string {
  const p = function (x: number): string {
    return x < 10 ? "0" + x : "" + x;
  };
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}
function expectCount(label: string, planned: number, actual: number): void {
  if (planned !== actual) {
    fatal("count mismatch for " + label + ": planned " + planned +
      ", verified " + actual);
  }
}

// ---- rolling 14-day window, local time (offset 0 = 13 days ago, 13 = today) ----
const TODAY = new Date();
const YY = TODAY.getFullYear();
const MM = TODAY.getMonth();
const DD = TODAY.getDate();
function dayAt(offset: number, hh: number, mm: number): Date {
  return new Date(YY, MM, DD - (13 - offset), hh, mm, 0, 0);
}

// ---- lab test catalog: canonical snake_case key -> unit + Healthians ref ----
interface TestDef { unit: string; lo: number; hi: number; }
const TESTS: { [key: string]: TestDef } = {
  hba1c: { unit: "%", lo: 4.2, hi: 5.7 },
  fbg: { unit: "mg/dl", lo: 70, hi: 100 },
  total_cholesterol: { unit: "mg/dl", lo: 0, hi: 200 },
  hdl: { unit: "mg/dl", lo: 40, hi: 60 },
  ldl: { unit: "mg/dl", lo: 0, hi: 100 },
  tg: { unit: "mg/dl", lo: 0, hi: 150 },
  vldl: { unit: "mg/dl", lo: 0, hi: 30 },
  non_hdl: { unit: "mg/dl", lo: 0, hi: 160 },
  chol_hdl_ratio: { unit: "ratio", lo: 3.3, hi: 4.4 },
  ldl_hdl_ratio: { unit: "ratio", lo: 0.5, hi: 3 },
  apo_a1: { unit: "mg/dl", lo: 105, hi: 205 },
  apo_b: { unit: "mg/dl", lo: 55, hi: 130 },
  apo_ratio: { unit: "ratio", lo: 0.3, hi: 1.49 },
  hs_crp: { unit: "mg/L", lo: 0, hi: 1 },
  alt: { unit: "U/L", lo: 3, hi: 35 },
  ast: { unit: "U/L", lo: 3, hi: 35 },
  ggt: { unit: "U/L", lo: 5, hi: 38 },
  alp: { unit: "U/L", lo: 33, hi: 98 },
  nafld: { unit: "score", lo: -1.455, hi: 0.675 },
  vitamin_d: { unit: "ng/ml", lo: 30, hi: 100 },
  vitamin_b12: { unit: "pg/ml", lo: 211, hi: 912 },
  homocysteine: { unit: "umol/L", lo: 3.7, hi: 13.9 },
  iron: { unit: "ug/dl", lo: 60, hi: 180 },
  tibc: { unit: "ug/dl", lo: 250, hi: 400 },
  transferrin_sat: { unit: "%", lo: 15, hi: 50 },
  creatinine: { unit: "mg/dl", lo: 0.6, hi: 1.3 },
  egfr: { unit: "ml/min/1.73m2", lo: 90, hi: 120 },
  urea: { unit: "mg/dl", lo: 17, hi: 43 },
  uric_acid: { unit: "mg/dl", lo: 2.6, hi: 6 },
  tsh: { unit: "uIU/ml", lo: 0.55, hi: 4.78 },
  t3: { unit: "ng/ml", lo: 0.6, hi: 1.81 },
  t4: { unit: "ug/dl", lo: 3.2, hi: 12.6 },
  hemoglobin: { unit: "g/dL", lo: 12, hi: 15 },
  mcv: { unit: "fL", lo: 83, hi: 101 },
  mch: { unit: "pg", lo: 27, hi: 32 },
  mchc: { unit: "g/dL", lo: 31.5, hi: 34.5 },
  rbc: { unit: "10^6/ul", lo: 3.8, hi: 4.8 },
  tlc: { unit: "10^3/uL", lo: 4, hi: 10 },
  platelets: { unit: "10^3/ul", lo: 150, hi: 410 },
  rdw_cv: { unit: "%", lo: 11.6, hi: 14 },
  sodium: { unit: "mmol/L", lo: 136, hi: 146 },
  potassium: { unit: "mmol/L", lo: 3.5, hi: 5.5 },
  chloride: { unit: "mmol/L", lo: 101, hi: 109 },
  calcium: { unit: "mg/dl", lo: 8.8, hi: 10.6 },
  phosphorus: { unit: "mg/dl", lo: 2.5, hi: 4.5 },
  albumin: { unit: "g/dl", lo: 3.5, hi: 5.2 },
  total_protein: { unit: "gm/dl", lo: 6.6, hi: 8.3 },
  bilirubin_total: { unit: "mg/dl", lo: 0.3, hi: 1.2 },
};

// ---- the 5 Healthians panels (real report values; only non-null tests) ----
interface PanelRow { k: string; v: number; f?: string; }
function lr(k: string, v: number, f?: string): PanelRow {
  return { k: k, v: v, f: f };
}
interface PanelDef {
  date: string;
  name: string;
  note?: string;
  rows: PanelRow[];
}
const PANELS: PanelDef[] = [
  {
    date: "2023-06-12",
    name: "Healthians Life Maximiser (Jun 2023)",
    rows: [
      lr("hba1c", 6.5, "H"),
      lr("total_cholesterol", 249, "H"),
      lr("ldl", 167, "H"),
      lr("tg", 316, "H"),
      lr("alt", 15),
      lr("ast", 16),
      lr("tsh", 4.68),
      lr("t3", 1.2),
      lr("t4", 9.9),
      lr("vitamin_d", 28, "L"),
      lr("hemoglobin", 12.3),
      lr("platelets", 287),
      lr("creatinine", 0.74),
      lr("urea", 34),
      lr("uric_acid", 5.8),
      lr("sodium", 141),
      lr("chloride", 103),
      lr("hs_crp", 4.8, "H"),
    ],
  },
  {
    date: "2025-03-29",
    name: "Healthians Life Maximiser (Mar 2025)",
    rows: [
      lr("hba1c", 6.3, "H"),
      lr("total_cholesterol", 227, "H"),
      lr("hdl", 39.7, "L"),
      lr("tg", 113),
      lr("vldl", 63.2, "H"),
      lr("alt", 13),
      lr("ast", 17),
      lr("alp", 113, "H"),
      lr("ggt", 26),
      lr("tsh", 3.12),
      lr("t3", 1.1),
      lr("t4", 11.2),
      lr("vitamin_d", 67.07),
      lr("iron", 50, "L"),
      lr("creatinine", 0.68),
      lr("urea", 18),
      lr("uric_acid", 5.4),
      lr("sodium", 144),
      lr("chloride", 104),
      lr("calcium", 9.8),
      lr("hemoglobin", 12.6),
      lr("platelets", 314),
      lr("total_protein", 7.4),
    ],
  },
  {
    date: "2025-11-30",
    name: "Healthians Life Maximiser (Nov 2025)",
    rows: [
      lr("hba1c", 6.7, "H"),
      lr("total_cholesterol", 219, "H"),
      lr("hdl", 42.7),
      lr("tg", 148),
      lr("alt", 17),
      lr("ast", 16),
      lr("alp", 76),
      lr("tsh", 3.44),
      lr("t3", 1.19),
      lr("t4", 11.1),
      lr("vitamin_d", 40.3),
      lr("iron", 60),
      lr("creatinine", 0.54),
      lr("urea", 17.4),
      lr("uric_acid", 4.9),
      lr("sodium", 142),
      lr("chloride", 103),
      lr("calcium", 8.6),
      lr("phosphorus", 3.5),
      lr("hemoglobin", 13.1),
      lr("platelets", 296),
      lr("total_protein", 7.78),
    ],
  },
  {
    date: "2026-04-05",
    name: "Healthians Life Maximiser (Apr 2026)",
    rows: [
      lr("hba1c", 7.2, "H"),
      lr("total_cholesterol", 239.4, "H"),
      lr("hdl", 46.9),
      lr("ldl", 175.4, "H"),
      lr("tg", 210.2, "H"),
      lr("vldl", 13),
      lr("alt", 47, "H"),
      lr("ast", 36.1, "H"),
      lr("alp", 101.7, "H"),
      lr("ggt", 34.2),
      lr("tsh", 4.01),
      lr("t3", 1.15),
      lr("t4", 9.3),
      lr("vitamin_d", 27.32, "L"),
      lr("apo_a1", 127.69),
      lr("apo_b", 152.59, "H"),
      lr("potassium", 4.28),
      lr("creatinine", 0.52),
      lr("urea", 21.2),
      lr("uric_acid", 5.5),
      lr("sodium", 140),
      lr("chloride", 105),
      lr("calcium", 9.1),
      lr("phosphorus", 3.8),
      lr("hemoglobin", 12.9),
      lr("platelets", 300),
      lr("total_protein", 7.6),
      lr("hs_crp", 6.84, "H"),
    ],
  },
  {
    date: "2026-11-06",
    name: "Healthians Life Maximiser (Nov 2026)",
    // \u00B7 = middle dot, as printed on the Healthians report
    note: "Booking 21122556198 \u00B7 sample 06:15 IST",
    rows: [
      lr("hba1c", 7.8, "H"),
      lr("fbg", 144, "H"),
      lr("total_cholesterol", 256, "H"),
      lr("hdl", 56.5),
      lr("ldl", 189, "H"),
      lr("tg", 156, "H"),
      lr("vldl", 11),
      lr("non_hdl", 199.5, "H"),
      lr("chol_hdl_ratio", 4.53, "H"),
      lr("ldl_hdl_ratio", 3.35, "H"),
      lr("apo_a1", 120.88),
      lr("apo_b", 210.11, "H"),
      lr("apo_ratio", 1.74, "H"),
      lr("hs_crp", 5.5, "H"),
      lr("alt", 41, "H"),
      lr("ast", 28),
      lr("ggt", 26),
      lr("alp", 90),
      lr("nafld", -1.72),
      lr("vitamin_d", 30.93),
      lr("vitamin_b12", 530),
      lr("homocysteine", 22.31, "H"),
      lr("iron", 85),
      lr("tibc", 349),
      lr("transferrin_sat", 24.36),
      lr("creatinine", 0.62),
      lr("egfr", 103.8),
      lr("urea", 22),
      lr("uric_acid", 6.0),
      lr("tsh", 2.817),
      lr("t3", 1.09),
      lr("t4", 10.7),
      lr("hemoglobin", 13.4),
      lr("mcv", 78.7, "L"),
      lr("mch", 26.7, "L"),
      lr("mchc", 33.8),
      lr("rbc", 5.04, "H"),
      lr("tlc", 5.4),
      lr("platelets", 263),
      lr("rdw_cv", 12.9),
      lr("sodium", 141),
      lr("potassium", 4.05),
      lr("chloride", 102),
      lr("calcium", 9.4),
      lr("phosphorus", 3.6),
      lr("albumin", 4.3),
      lr("total_protein", 7.36),
      lr("bilirubin_total", 0.6),
    ],
  },
];

// ---- demo foods (Telugu kitchen; create-if-missing, never overwritten) ----
interface FoodDef {
  id: string;
  name: string;
  category: string;
  serving: number;       // servingGrams
  katori: number | null; // katoriGrams (null = portion by serving only)
  kcal: number;          // kcalPer100g
  carbs: number;         // carbsPer100g
  protein: number;       // proteinPer100g
  fat: number;           // fatPer100g
  fiber: number;         // fiberPer100g
  gi: number;
}
function foodDef(id: string, name: string, category: string, serving: number,
  katori: number | null, kcal: number, carbs: number, protein: number,
  fat: number, fiber: number, gi: number): FoodDef {
  return {
    id: id, name: name, category: category, serving: serving, katori: katori,
    kcal: kcal, carbs: carbs, protein: protein, fat: fat, fiber: fiber,
    gi: gi,
  };
}
const FOODS: FoodDef[] = [
  foodDef("lkd_sona_rice", "Sona Masoori Rice (cooked)", "cereal", 160, 150, 130, 28, 2.7, 0.3, 0.4, 73),
  foodDef("lkd_foxtail_millet", "Foxtail Millet (cooked)", "cereal", 150, 150, 119, 23, 3.5, 0.7, 2.8, 54),
  foodDef("lkd_tomato_pappu", "Tomato Pappu (dal)", "legume", 150, 150, 92, 12, 5.5, 2.6, 3.8, 32),
  foodDef("lkd_palakura_koora", "Palakura Koora (spinach)", "vegetable", 120, 120, 58, 6, 3.0, 2.8, 3.2, 20),
  foodDef("lkd_perugu", "Curd (homemade)", "dairy", 150, 150, 62, 4.7, 3.5, 3.3, 0, 36),
  foodDef("lkd_jonna_rotte", "Jonna Rotti (jowar)", "cereal", 90, null, 220, 42, 6.5, 2.5, 4.5, 55),
  foodDef("lkd_egg_curry", "Egg Curry (light)", "egg", 150, 150, 148, 6, 11, 9.5, 1.5, 25),
  foodDef("lkd_veg_upma", "Vegetable Upma", "cereal", 200, 200, 131, 21, 3.2, 4.0, 2.2, 62),
  foodDef("lkd_sambar", "Sambar (mixed veg)", "legume", 180, 180, 55, 8, 2.8, 1.5, 2.6, 30),
  foodDef("lkd_papaya", "Papaya (1 cup)", "fruit", 140, null, 43, 10.7, 0.6, 0.3, 1.7, 42),
  foodDef("lkd_buttermilk", "Majjiga (buttermilk)", "dairy", 200, null, 38, 3.4, 2.0, 1.8, 0, 15),
  foodDef("lkd_badam", "Almonds (10)", "nut", 12, null, 579, 21.6, 21.2, 49.9, 12.5, 15),
];
const FOOD_BY_ID: { [id: string]: FoodDef } = {};
for (const fd of FOODS) FOOD_BY_ID[fd.id] = fd;

// ---- medications (names + schedule times only; the app stores no doses) ----
const MEDS: { name: string; times: string }[] = [
  { name: "Metformin", times: '["08:00","20:30"]' },
  { name: "Telmisartan", times: '["09:00"]' },
  { name: "Vitamin D3 (weekly)", times: '["10:00"]' },
];
// Deliberately no statin on the list - it drives a "discuss with your
// doctor" insight in the Smart Analysis engine.

// ---- fixed 14-day series (index = window offset, 13 = today) ----
const FASTING_MGDL = [142, 138, 145, 135, 148, 141, 137, 144, 139, 146, 134, 143, 140, 147];
const POST_LUNCH_MGDL = [186, 172, 195, 168, 203, 178, 190, 175, 199, 171, 184, 207, 176, 188];
const POST_DINNER_MGDL = [165, 178, 158, 192, 171, 185, 203, 167, 174, 196, 162, 181, 189, 173];
const SLEEP_HOURS = [6.1, 5.8, 6.5, 6.0, 7.2, 5.6, 6.3, 6.8, 5.9, 6.4, 7.0, 5.7, 6.2, 6.6];
const WALK_DAYS = [0, 1, 2, 3, 5, 6, 8, 9, 11, 12]; // 10 x 22-min walks, 18:30
const YOGA_DAYS = [4, 10];                           // 2 x 30-min yoga, 07:15
// days 7 and 13 stay empty (sedentary gaps)
const WEIGHT_ROWS: { d: number; kg: number }[] = [
  { d: 1, kg: 74.2 }, { d: 5, kg: 74.0 }, { d: 9, kg: 73.6 }, { d: 13, kg: 73.4 },
];
const BP_ROWS: { d: number; sys: number; dia: number }[] = [
  { d: 0, sys: 138, dia: 84 }, { d: 2, sys: 142, dia: 86 },
  { d: 4, sys: 135, dia: 82 }, { d: 6, sys: 146, dia: 90 },
  { d: 8, sys: 139, dia: 85 }, { d: 10, sys: 143, dia: 88 },
];

// ---- profile + survey payloads ----
const CONDITIONS_JSON = '["Type 2 Diabetes","Dyslipidemia","Hypertension"]';
const SURVEY_JSON = '{"dietPattern":"veg","riceFrequency":"daily","sweetsFrequency":"weekly","teaCoffeeSugar":"some","eatingOutFrequency":"sometimes","cookingOil":"sunflower","walkMinutesPerDay":15,"strengthPerWeek":0,"sittingHours":6,"stressLevel":4,"sleepQuality":"disturbed","menopause":"post","symptoms":["Tiredness or low energy","Joint pains"],"familyHistory":["Diabetes","High blood pressure"],"primaryGoal":"sugar"}';

// ---- op builders (validate before anything is written) ----
function foodUpsertOp(fd: FoodDef, userId: string): any {
  return prisma.food.upsert({
    where: { id: fd.id },
    create: {
      id: fd.id,
      name: fd.name,
      region: FOOD_REGION,
      category: fd.category,
      servingGrams: fd.serving,
      katoriGrams: fd.katori,
      createdByUserId: userId,
      kcalPer100g: fd.kcal,
      carbsPer100g: fd.carbs,
      proteinPer100g: fd.protein,
      fatPer100g: fd.fat,
      fiberPer100g: fd.fiber,
      gi: fd.gi,
    },
    update: {}, // create-if-missing; never overwrite an existing row
  });
}

function panelCreateOp(userId: string, panel: PanelDef): any {
  const results: any[] = [];
  for (const row of panel.rows) {
    const def: TestDef = TESTS[row.k]; // guard below is a runtime safety net
    if (!def) {
      fatal("unknown testKey '" + row.k + "' in panel " + panel.date);
    }
    results.push({
      userId: userId,
      testKey: row.k,
      value: row.v,
      unit: def.unit,
      refLow: def.lo,
      refHigh: def.hi,
      flag: row.f ? row.f : null,
      performedAt: panel.date,
    });
  }
  const data: any = {
    userId: userId,
    name: panel.name,
    labName: LAB_NAME,
    performedAt: panel.date,
    results: { create: results },
  };
  if (panel.note) data.sourceNote = panel.note;
  return prisma.labPanel.create({ data: data });
}

// 10 meal days (the last 10 days of the window), 9 FoodEntry rows per day:
// breakfast 08:00, lunch 13:00, snack 17:00, dinner 20:30. Day rules are
// modular (j % 5 / j % 2) so the pattern is identical on every re-run.
function buildMealRows(userId: string): any[] {
  const rows: any[] = [];
  const add = function (foodId: string, portionType: string,
    portionValue: number, at: Date): void {
    const fd: FoodDef = FOOD_BY_ID[foodId]; // guard below is a runtime safety net
    if (!fd) fatal("meal plan references unknown food id " + foodId);
    const base = portionType === "katori" && fd.katori !== null
      ? fd.katori : fd.serving;
    const grams = r2(base * portionValue);
    rows.push({
      userId: userId,
      foodId: foodId,
      portionType: portionType,
      portionValue: portionValue,
      grams: grams,
      kcal: r2((grams * fd.kcal) / 100),
      carbsG: r2((grams * fd.carbs) / 100),
      proteinG: r2((grams * fd.protein) / 100),
      fatG: r2((grams * fd.fat) / 100),
      loggedAt: at,
      notes: null,
    });
  };
  for (let j = 0; j < 10; j++) {
    const off = 4 + j; // meal days = offsets 4..13 (last 10 days)
    const breakfastAt = dayAt(off, 8, 0);
    const lunchAt = dayAt(off, 13, 0);
    const snackAt = dayAt(off, 17, 0);
    const dinnerAt = dayAt(off, 20, 30);
    // breakfast: veg upma + majjiga on 6 days; jonna rotte + palakura koora on 4
    if (j % 5 < 3) {
      add("lkd_veg_upma", "katori", 1, breakfastAt);
      add("lkd_buttermilk", "serving", 1, breakfastAt);
    } else {
      add("lkd_jonna_rotte", "serving", 1, breakfastAt);
      add("lkd_palakura_koora", "katori", 1, breakfastAt);
    }
    // lunch: 1.5 katori sona rice (5 days) / foxtail millet (5 days),
    // always + tomato pappu + palakura koora + curd
    add(j % 2 === 0 ? "lkd_sona_rice" : "lkd_foxtail_millet", "katori", 1.5, lunchAt);
    add("lkd_tomato_pappu", "katori", 1, lunchAt);
    add("lkd_palakura_koora", "katori", 1, lunchAt);
    add("lkd_perugu", "katori", 1, lunchAt);
    // snack: papaya on 6 days; 10 almonds on 4 days
    if (j % 5 === 2 || j % 5 === 4) {
      add("lkd_badam", "serving", 1, snackAt);
    } else {
      add("lkd_papaya", "serving", 1, snackAt);
    }
    // dinner: 2 jonna rotte + sambar on 6 days; egg curry + koora on 4 days
    if (j % 5 === 1 || j % 5 === 3) {
      add("lkd_egg_curry", "katori", 1, dinnerAt);
      add("lkd_palakura_koora", "katori", 1, dinnerAt);
    } else {
      add("lkd_jonna_rotte", "serving", 2, dinnerAt);
      add("lkd_sambar", "katori", 1, dinnerAt);
    }
  }
  return rows;
}

// ---- arguments ----
const argv = process.argv.slice(2);
const jsonMode = argv.indexOf("--json") >= 0;
let dbArgSeen = false;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--db" || argv[i].indexOf("--db=") === 0) dbArgSeen = true;
}

// ---- main ----
async function main(): Promise<void> {
  console.log("MODE lakshmi-demo write");
  if (!prisma) fatal("@prisma/client does not export PrismaClient");
  const dbUrl = process.env.DATABASE_URL || "";
  if (dbUrl === "") {
    fatal("DATABASE_URL is not set; export it (app .env) before seeding");
  }
  console.log("DBSCHEME " + (dbUrl.indexOf(":") >= 0
    ? ascii(dbUrl.slice(0, dbUrl.indexOf(":"))) : "unknown"));
  if (dbArgSeen) {
    console.log("DBARG ignored - DATABASE_URL from env is authoritative");
  }
  const DELEGATES = [
    "user", "labPanel", "labResult", "medication", "medicationLog",
    "glucoseReading", "activityEntry", "sleepEntry", "weightEntry",
    "bloodPressureEntry", "foodEntry", "food", "intelligenceSurvey",
  ];
  for (const d of DELEGATES) {
    if (!prisma[d]) {
      fatal("prisma client has no delegate: " + d +
        " (run npm run db:generate)");
    }
  }

  // 1. ensure the demo user (upsert by email; bcrypt hash so demo login works)
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const profile: any = {
    name: "Lakshmi",
    role: "member",
    onboardingComplete: true,
    age: 57,
    gender: "female",
    heightCm: 157,
    weightKg: 74.2,
    hba1c: 7.8,
    activityLevel: "light",
    region: "telugu",
    sleepHours: 6.5,
    conditions: CONDITIONS_JSON,
  };
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    create: Object.assign({ email: DEMO_EMAIL, passwordHash: passwordHash },
      profile),
    update: Object.assign({ passwordHash: passwordHash }, profile),
  });
  const userId: string = String(user.id);
  console.log("SEED-USER " + ascii(userId));

  // 2. build every write, then run all deletes + writes in ONE transaction
  const ops: any[] = [];
  // -- idempotency: clear this demo user's rows in the affected tables.
  //    labResult/medicationLog pre-deletes are belt-and-braces: the panel
  //    and medication deletes normally cascade.
  ops.push(prisma.labResult.deleteMany({ where: { userId: userId } }));
  ops.push(prisma.labPanel.deleteMany({ where: { userId: userId } }));
  ops.push(prisma.medicationLog.deleteMany({ where: { userId: userId } }));
  ops.push(prisma.medication.deleteMany({ where: { userId: userId } }));
  ops.push(prisma.glucoseReading.deleteMany({ where: { userId: userId } }));
  ops.push(prisma.activityEntry.deleteMany({ where: { userId: userId } }));
  ops.push(prisma.sleepEntry.deleteMany({ where: { userId: userId } }));
  ops.push(prisma.weightEntry.deleteMany({ where: { userId: userId } }));
  ops.push(prisma.bloodPressureEntry.deleteMany({ where: { userId: userId } }));
  ops.push(prisma.foodEntry.deleteMany({ where: { userId: userId } })); // FK: before food
  ops.push(prisma.food.deleteMany({ where: { createdByUserId: userId } }));
  ops.push(prisma.intelligenceSurvey.deleteMany({ where: { userId: userId } }));
  // -- foods (create-if-missing, never overwrite)
  for (const fd of FOODS) ops.push(foodUpsertOp(fd, userId));
  // -- 5 lab panels with nested results
  for (const panel of PANELS) ops.push(panelCreateOp(userId, panel));
  // -- medications
  ops.push(prisma.medication.createMany({
    data: MEDS.map(function (m) {
      return {
        userId: userId,
        name: m.name,
        scheduleTimes: m.times,
        isActive: true,
      };
    }),
  }));
  // -- glucose: 14 days x 3 readings (fasting 07:10, post-lunch 14:40, post-dinner 21:40)
  const glucoseRows: any[] = [];
  for (let i = 0; i < 14; i++) {
    glucoseRows.push({ userId: userId, value: FASTING_MGDL[i], takenAt: dayAt(i, 7, 10) });
    glucoseRows.push({ userId: userId, value: POST_LUNCH_MGDL[i], takenAt: dayAt(i, 14, 40) });
    glucoseRows.push({ userId: userId, value: POST_DINNER_MGDL[i], takenAt: dayAt(i, 21, 40) });
  }
  ops.push(prisma.glucoseReading.createMany({ data: glucoseRows }));
  // -- meals: last 10 days (90 entries)
  const mealRows = buildMealRows(userId);
  ops.push(prisma.foodEntry.createMany({ data: mealRows }));
  // -- vitals over the same 14-day window
  const activityRows: any[] = [];
  for (const d of WALK_DAYS) {
    activityRows.push({ userId: userId, type: "walk", durationMin: 22, at: dayAt(d, 18, 30) });
  }
  for (const d of YOGA_DAYS) {
    activityRows.push({ userId: userId, type: "yoga", durationMin: 30, at: dayAt(d, 7, 15) });
  }
  ops.push(prisma.activityEntry.createMany({ data: activityRows }));
  const sleepRows: any[] = [];
  for (let i = 0; i < 14; i++) {
    sleepRows.push({ userId: userId, hours: SLEEP_HOURS[i], wokeAt: dayAt(i, 7, 5) });
  }
  ops.push(prisma.sleepEntry.createMany({ data: sleepRows }));
  const weightRows: any[] = [];
  for (const w of WEIGHT_ROWS) {
    weightRows.push({ userId: userId, kg: w.kg, takenAt: dayAt(w.d, 7, 30) });
  }
  ops.push(prisma.weightEntry.createMany({ data: weightRows }));
  const bpRows: any[] = [];
  for (const b of BP_ROWS) {
    bpRows.push({
      userId: userId,
      systolic: b.sys,
      diastolic: b.dia,
      takenAt: dayAt(b.d, 8, 0),
    });
  }
  ops.push(prisma.bloodPressureEntry.createMany({ data: bpRows }));
  // -- intelligence survey (userId is unique)
  ops.push(prisma.intelligenceSurvey.upsert({
    where: { userId: userId },
    create: { userId: userId, answersJson: SURVEY_JSON, updatedAt: new Date() },
    update: { answersJson: SURVEY_JSON, updatedAt: new Date() },
  }));

  await prisma.$transaction(ops);

  // 3. read-back verification + markers
  const cPanels = await prisma.labPanel.count({ where: { userId: userId } });
  const cResults = await prisma.labResult.count({ where: { userId: userId } });
  const cMeds = await prisma.medication.count({ where: { userId: userId } });
  const cGlucose = await prisma.glucoseReading.count({ where: { userId: userId } });
  const cActivity = await prisma.activityEntry.count({ where: { userId: userId } });
  const cSleep = await prisma.sleepEntry.count({ where: { userId: userId } });
  const cWeight = await prisma.weightEntry.count({ where: { userId: userId } });
  const cBp = await prisma.bloodPressureEntry.count({ where: { userId: userId } });
  const cEntries = await prisma.foodEntry.count({ where: { userId: userId } });
  const cFoods = await prisma.food.count({ where: { createdByUserId: userId } });
  const cSurvey = await prisma.intelligenceSurvey.count({ where: { userId: userId } });

  const planResults = PANELS.reduce(function (n: number, p: PanelDef) {
    return n + p.rows.length;
  }, 0);
  expectCount("LabPanel", PANELS.length, cPanels);
  expectCount("LabResult", planResults, cResults);
  expectCount("Medication", MEDS.length, cMeds);
  expectCount("GlucoseReading", glucoseRows.length, cGlucose);
  expectCount("ActivityEntry", activityRows.length, cActivity);
  expectCount("SleepEntry", sleepRows.length, cSleep);
  expectCount("WeightEntry", weightRows.length, cWeight);
  expectCount("BloodPressureEntry", bpRows.length, cBp);
  expectCount("FoodEntry", mealRows.length, cEntries);
  expectCount("IntelligenceSurvey", 1, cSurvey);
  if (cFoods !== FOODS.length) {
    // Not fatal: an lkd_ row pre-existing under another creator is left
    // untouched by design (create-if-missing, never overwrite).
    console.log("WARN Food count " + cFoods + " != " + FOODS.length +
      " (pre-existing lkd_ rows owned by another user were not touched)");
  }

  console.log("SEED-FOODS " + cFoods);
  console.log("SEED-LABS " + cPanels + " panels " + cResults + " results");
  console.log("SEED-MEDS " + cMeds);
  console.log("SEED-GLUCOSE " + cGlucose);
  console.log("SEED-MEALS " + cEntries);
  console.log("SEED-VITALS activity=" + cActivity + " sleep=" + cSleep +
    " weight=" + cWeight + " bp=" + cBp);
  console.log("SEED-SURVEY " + cSurvey);
  console.log("COUNTS");
  console.log("COUNT LabPanel " + cPanels);
  console.log("COUNT LabResult " + cResults);
  console.log("COUNT Medication " + cMeds);
  console.log("COUNT GlucoseReading " + cGlucose);
  console.log("COUNT ActivityEntry " + cActivity);
  console.log("COUNT SleepEntry " + cSleep);
  console.log("COUNT WeightEntry " + cWeight);
  console.log("COUNT BloodPressureEntry " + cBp);
  console.log("COUNT FoodEntry " + cEntries);
  console.log("COUNT Food " + cFoods);
  console.log("COUNT IntelligenceSurvey " + cSurvey);
  console.log("LABSPAN " + PANELS[0].date + " .. " +
    PANELS[PANELS.length - 1].date);
  console.log("WINDOW " + isoDate(dayAt(0, 0, 0)) + " .. " +
    isoDate(dayAt(13, 0, 0)));
  console.log("EMAIL " + DEMO_EMAIL);
  console.log("PASSWORD " + DEMO_PASSWORD);
  console.log("ALL-OK");
  if (jsonMode) {
    console.log('{"user":"' + DEMO_EMAIL + '","panels":' + cPanels +
      ',"results":' + cResults + ',"glucose":' + cGlucose +
      ',"entries":' + cEntries + "}");
  }
  await prisma.$disconnect();
}

main().catch(async function (e: any) {
  console.log("FATAL " + msg(e));
  try {
    if (prisma) await prisma.$disconnect();
  } catch (e2) { /* ignore */ }
  process.exit(1);
});