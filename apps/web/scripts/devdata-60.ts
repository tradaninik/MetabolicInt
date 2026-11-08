// devdata-60.ts - 60-day demo dataset for the demo user (local dev sqlite).
// Installed and executed by MetabolicInt-2c.ps1. Supersedes the copy that
// MetabolicInt-2b.ps1 installed but never ran (tsx not found there).
// Contract: demo user only; local file: sqlite only; deterministic
// fixed-seed PRNG; idempotent (deletes demo-user rows in the 60-day window,
// then writes in one transaction); backs up the db before writing; ASCII
// output only. Markers printed for the wrapper: DETDB, ALL-OK, DRY-OK,
// COUNT, RANGE, TOPFOOD. Usage (run from apps\web):
//   tsx scripts/devdata-60.ts [--dry-run] [--db <absolute path>]
import * as prismaMod from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const DEMO_EMAIL = "demo@metabolic.dev";
const SEED = 20261102;
const modAny: any = prismaMod;
const modDefault: any =
  modAny.default && modAny.default.PrismaClient ? modAny.default : modAny;
const PrismaClientCtor: any =
  modAny.PrismaClient || modDefault.PrismaClient;
const prismaNS: any = modAny.Prisma ? modAny : modDefault;
const dmmfAny: any =
  prismaNS && prismaNS.Prisma ? prismaNS.Prisma.dmmf : modAny.dmmf;

const now = new Date();
const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 59);
const FESTIVE = [10, 27, 44];
const TS_FIELD: any = {
  FoodEntry: "loggedAt",
  GlucoseReading: "takenAt",
  ActivityEntry: "at",
  SleepEntry: "wokeAt",
  WeightEntry: "takenAt",
  BloodPressureEntry: "takenAt",
};
const planRows: any = {};
const foodNameMap = new Map<string, string>();

function ascii(v: any): string {
  const s = v === null || v === undefined ? "" : String(v);
  return s.replace(/[^\x20-\x7E]/g, "?");
}
function msg(e: any): string {
  const s = e && e.message ? String(e.message) : String(e);
  return ascii(s).replace(/\s+/g, " ").slice(0, 160);
}
function fatal(m: string): never {
  console.log("FATAL " + ascii(m));
  process.exit(1);
}
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
function ri(lo: number, hi: number): number {
  return Math.floor(rnd() * (hi - lo + 1)) + lo;
}
function rf(lo: number, hi: number): number {
  return rnd() * (hi - lo) + lo;
}
function pick(arr: string[][]): string[] {
  return arr[Math.floor(rnd() * arr.length)];
}
function chance(p: number): boolean {
  return rnd() < p;
}
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
function iso(d: Date): string {
  const p = function (x: number) { return x < 10 ? "0" + x : "" + x; };
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
    "T" + p(d.getHours()) + ":" + p(d.getMinutes());
}
function at(base: Date, minutes: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(),
    Math.floor(minutes / 60), minutes % 60, 0, 0);
}

// ---- dmmf-driven coercion (falls back to conservative rounding) ----
function modelFields(name: string): any[] {
  try {
    const m = dmmfAny && dmmfAny.modelMap ? dmmfAny.modelMap[name] : null;
    return m && m.fields ? m.fields : [];
  } catch (e) {
    return [];
  }
}
function ftype(model: string, field: string): string | undefined {
  for (const fl of modelFields(model)) {
    if (fl.name === field) return String(fl.type);
  }
  return undefined;
}
function num(model: string, field: string, v: number): number {
  const t = ftype(model, field);
  if (t === "Float") return Math.round(v * 100) / 100;
  return Math.round(v);
}
function fieldNeeds(model: string, field: string): boolean {
  for (const fl of modelFields(model)) {
    if (fl.name === field && fl.kind === "scalar") {
      return !!fl.isRequired && !fl.hasDefaultValue;
    }
  }
  return false;
}
function delegateOf(cli: any, model: string): any {
  const key = model.slice(0, 1).toLowerCase() + model.slice(1);
  const d = cli[key];
  if (!d) fatal("prisma client has no delegate for " + model);
  return d;
}
function openClient(file: string): any {
  const url = "file:" + file.replace(/\\/g, "/");
  return new PrismaClientCtor({ datasources: { db: { url: url } } });
}

// ---- demo user lookup (defensive across field naming) ----
async function findDemo(cli: any): Promise<any> {
  try {
    const u = await cli.user.findFirst({ where: { email: DEMO_EMAIL } });
    if (u) return u;
  } catch (e) { /* email column may differ; scan below */ }
  try {
    const all = await cli.user.findMany();
    for (const u of all) {
      for (const k of Object.keys(u)) {
        if (u[k] === DEMO_EMAIL) return u;
      }
    }
    for (const u of all) {
      for (const k of Object.keys(u)) {
        const v = u[k];
        if (typeof v === "string" &&
            v.toLowerCase().indexOf("demo@metabolic") >= 0) {
          return u;
        }
      }
    }
  } catch (e) { /* fall through */ }
  return null;
}

interface ProbeInfo {
  file: string;
  ok: boolean;
  users: number;
  demo: boolean;
  entries: number;
  foods: number;
  err: string;
}
async function probeFile(file: string): Promise<ProbeInfo> {
  const info: ProbeInfo = {
    file: file, ok: false, users: -1, demo: false, entries: -1, foods: -1,
    err: "",
  };
  const cli = openClient(file);
  try {
    try {
      info.users = await cli.user.count();
    } catch (e) {
      info.users = -1;
      info.err = msg(e);
    }
    if (info.users >= 0) {
      const demo = await findDemo(cli);
      info.demo = !!demo;
      if (demo) {
        try {
          info.entries =
            await cli.foodEntry.count({ where: { userId: demo.id } });
        } catch (e) {
          info.entries = -1;
        }
      }
      try {
        info.foods = await cli.food.count();
      } catch (e) {
        info.foods = -1;
      }
      info.ok = true;
    }
  } catch (e) {
    info.ok = false;
    info.err = msg(e);
  } finally {
    try { await cli.$disconnect(); } catch (e) { /* ignore */ }
  }
  return info;
}

function fileUrlToPath(u: string, base: string): string {
  let s = u.slice(5);
  const q = s.indexOf("?");
  if (q >= 0) s = s.slice(0, q);
  s = s.replace(/\\/g, "/");
  if (/^[A-Za-z]:/.test(s)) return s.replace(/\//g, "\\");
  if (s.indexOf("/") === 0) return s;
  return path.resolve(base, s);
}
function detectWebDir(): string {
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, "prisma", "schema.prisma"))) return cwd;
  try {
    const a1 = path.resolve(process.argv[1] || "");
    const guess = path.dirname(path.dirname(a1));
    if (fs.existsSync(path.join(guess, "prisma", "schema.prisma"))) {
      return guess;
    }
  } catch (e) { /* ignore */ }
  const up = path.dirname(cwd);
  if (fs.existsSync(path.join(up, "prisma", "schema.prisma"))) return up;
  return cwd;
}
function backupDb(file: string): string {
  const b1 = file + ".-bak60";
  const b2 = file + ".-bak60b";
  let dest = "";
  if (!fs.existsSync(b1)) dest = b1;
  else if (!fs.existsSync(b2)) dest = b2;
  if (dest === "") return "(kept existing .-bak60 and .-bak60b)";
  fs.copyFileSync(file, dest);
  if (fs.existsSync(file + "-wal")) {
    fs.copyFileSync(file + "-wal", dest + "-wal");
  }
  if (fs.existsSync(file + "-shm")) {
    fs.copyFileSync(file + "-shm", dest + "-shm");
  }
  return dest;
}

// ---- staple table: keyword, portion, per-portion macros, gi multiplier ----
interface Staple {
  key: string;
  kw: string;
  pt: string;
  pv: number;
  grams: number;
  carbs: number;
  kcal: number;
  protein: number;
  fat: number;
  gi: number;
  not?: string;
  foodId?: string;
}
function st(key: string, kw: string, pt: string, pv: number, grams: number,
  carbs: number, kcal: number, protein: number, fat: number, gi: number): Staple {
  return {
    key: key, kw: kw, pt: pt, pv: pv, grams: grams, carbs: carbs, kcal: kcal,
    protein: protein, fat: fat, gi: gi,
  };
}
const STAPLES: Staple[] = [
  st("poha", "poha", "katori", 1, 150, 30, 170, 3, 4, 1.0),
  st("flakes", "flakes", "katori", 1, 150, 28, 160, 3, 4, 1.0),
  st("upma", "upma", "katori", 1, 150, 28, 160, 4, 5, 0.95),
  st("idli", "idli", "serving", 3, 120, 30, 150, 5, 1, 0.95),
  st("dosa", "dosa", "serving", 2, 150, 34, 210, 5, 6, 0.9),
  st("vada", "vada", "serving", 2, 120, 28, 170, 5, 7, 1.05),
  st("uttapam", "uttapam", "serving", 2, 180, 36, 220, 6, 7, 0.95),
  st("pongal", "pongal", "katori", 1, 150, 32, 190, 5, 5, 1.05),
  st("adai", "adai", "serving", 2, 140, 30, 200, 8, 6, 0.85),
  st("appam", "appam", "serving", 2, 120, 28, 160, 4, 2, 0.95),
  st("puttu", "puttu", "katori", 1, 130, 28, 170, 4, 3, 0.95),
  st("oats", "oats", "katori", 1, 150, 22, 120, 5, 2, 0.7),
  st("porridge", "porridge", "katori", 1, 150, 22, 120, 5, 2, 0.7),
  st("vermicelli", "vermicelli", "katori", 1, 150, 26, 150, 4, 2, 0.95),
  st("ragi", "ragi", "katori", 1, 150, 26, 150, 4, 2, 0.8),
  st("chapati", "chapati", "serving", 3, 105, 36, 180, 6, 3, 0.85),
  st("roti", "roti", "serving", 3, 105, 36, 180, 6, 3, 0.85),
  st("paratha", "paratha", "serving", 2, 80, 32, 210, 6, 8, 0.95),
  st("bread", "bread", "serving", 2, 56, 26, 140, 5, 2, 1.1),
  st("biryani", "biryani", "katori", 2, 200, 55, 300, 8, 9, 1.25),
  st("pulao", "pulao", "katori", 2, 200, 50, 280, 7, 8, 1.2),
  st("rice", "rice", "katori", 2, 150, 42, 195, 4, 1, 1.15),
  st("dal", "dal", "katori", 1, 150, 17, 110, 7, 2.5, 0.7),
  st("sambar", "sambar", "katori", 1, 150, 12, 70, 4, 2, 0.75),
  st("rasam", "rasam", "katori", 1, 150, 10, 60, 3, 1.5, 0.7),
  st("curd", "curd", "katori", 1, 150, 9, 95, 5, 4.5, 0.5),
  st("yogurt", "yogurt", "katori", 1, 150, 9, 95, 5, 4.5, 0.5),
  st("buttermilk", "buttermilk", "katori", 1, 200, 6, 40, 2.5, 1, 0.4),
  st("milk", "milk", "serving", 1, 200, 12, 120, 8, 5, 0.6),
  st("paneer", "paneer", "katori", 1, 100, 6, 210, 14, 16, 0.45),
  st("egg", "egg", "serving", 2, 100, 1, 150, 13, 10, 0.2),
  st("chicken", "chicken", "serving", 1, 120, 1, 200, 28, 9, 0.15),
  st("mutton", "mutton", "serving", 1, 120, 1, 210, 26, 12, 0.15),
  st("fish", "fish", "serving", 1, 120, 1, 160, 24, 6, 0.15),
  st("veg", "vegetable", "katori", 1, 150, 12, 100, 3, 5, 0.75),
  st("sabzi", "sabzi", "katori", 1, 150, 12, 100, 3, 5, 0.75),
  st("poriyal", "poriyal", "katori", 1, 150, 10, 90, 3, 4, 0.7),
  st("thoran", "thoran", "katori", 1, 150, 10, 90, 3, 4, 0.7),
  st("beans", "beans", "katori", 1, 150, 11, 95, 3, 4, 0.75),
  st("cabbage", "cabbage", "katori", 1, 150, 10, 85, 3, 4, 0.7),
  st("okra", "okra", "katori", 1, 150, 11, 95, 3, 4, 0.75),
  st("greens", "greens", "katori", 1, 150, 9, 80, 3, 4, 0.65),
  st("spinach", "spinach", "katori", 1, 150, 9, 80, 3, 4, 0.65),
  st("salad", "salad", "serving", 1, 100, 6, 30, 1.5, 0.2, 0.3),
  st("banana", "banana", "serving", 1, 100, 21, 90, 1, 0.3, 1.0),
  st("apple", "apple", "serving", 1, 100, 14, 60, 0.5, 0.3, 0.7),
  st("guava", "guava", "serving", 1, 100, 14, 60, 0.5, 0.3, 0.7),
  st("orange", "orange", "serving", 1, 100, 12, 55, 0.5, 0.3, 0.7),
  st("papaya", "papaya", "serving", 1, 100, 12, 55, 0.5, 0.3, 0.7),
  st("tea", "tea", "serving", 1, 150, 12, 70, 2, 3, 0.8),
  st("coffee", "coffee", "serving", 1, 150, 10, 60, 2, 2, 0.8),
  st("biscuit", "biscuit", "serving", 3, 25, 15, 70, 1, 2.5, 1.05),
  st("murukku", "murukku", "serving", 1, 30, 18, 100, 2, 4, 1.05),
  st("mixture", "mixture", "serving", 1, 30, 18, 105, 2, 5, 1.05),
  st("papad", "papad", "serving", 1, 15, 8, 55, 2, 2, 1.0),
  st("pickle", "pickle", "serving", 1, 15, 2, 20, 0.3, 1.5, 0.6),
  st("chutney", "chutney", "katori", 1, 30, 4, 40, 1, 2, 0.5),
  st("kheer", "kheer", "katori", 1, 150, 24, 150, 4, 4, 1.2),
  st("payasam", "payasam", "katori", 1, 150, 24, 150, 4, 4, 1.2),
  st("ladoo", "ladoo", "serving", 1, 40, 28, 190, 2, 7, 1.3),
  st("halwa", "halwa", "serving", 1, 40, 26, 180, 2, 7, 1.3),
  st("mysore", "mysore", "serving", 1, 40, 28, 190, 2, 7, 1.3),
  st("gulab", "gulab", "serving", 1, 45, 30, 175, 2, 5, 1.3),
  st("barfi", "barfi", "serving", 1, 40, 28, 185, 2, 8, 1.3),
  st("jalebi", "jalebi", "serving", 1, 40, 29, 170, 1, 6, 1.3),
  st("sweet", "sweet", "serving", 1, 40, 28, 190, 2, 7, 1.3),
];
for (const sw of STAPLES) {
  if (sw.key === "sweet") sw.not = "potato";
}

function matchFoods(foods: { id: string; name: string }[]): number {
  const used = new Set<string>();
  let matched = 0;
  for (const s of STAPLES) {
    s.foodId = undefined;
    const kw = s.kw.toLowerCase();
    for (const fd of foods) {
      if (used.has(fd.id)) continue;
      const nm = fd.name.toLowerCase();
      if (nm.indexOf(kw) >= 0 && !(s.not && nm.indexOf(s.not) >= 0)) {
        s.foodId = fd.id;
        used.add(fd.id);
        matched = matched + 1;
        break;
      }
    }
  }
  return matched;
}

// ---- meal templates (keys reference STAPLES) ----
const BREAKFASTS: string[][] = [
  ["idli", "sambar", "tea"],
  ["dosa", "chutney", "tea"],
  ["upma", "tea"],
  ["idli", "sambar", "banana"],
  ["poha", "tea"],
  ["oats", "milk"],
  ["dosa", "sambar", "coffee"],
  ["puttu", "sambar"],
  ["adai", "chutney"],
  ["appam", "sambar"],
  ["porridge", "milk"],
  ["bread", "milk"],
];
const SNACKS: string[][] = [
  ["tea", "biscuit"],
  ["coffee", "murukku"],
  ["tea", "banana"],
  ["apple"],
  ["mixture"],
  ["tea", "papad"],
];
function lunchKeys(d: number): string[] {
  if (d % 8 === 0) return ["biryani", "veg", "curd", "papad"];
  if (d % 9 === 0) return ["pulao", "veg", "curd"];
  if (d % 7 === 3) return ["chapati", "dal", "veg", "buttermilk"];
  if (d % 11 === 5) return ["rice", "sambar", "veg", "curd"];
  return ["rice", "dal", "veg", "curd"];
}
function dinnerKeys(d: number, festive: boolean): string[] {
  if (festive) return ["rice", "dal", "veg", "sweet", "papad"];
  const r = d % 6;
  if (r === 0) return ["rice", "sambar", "veg", "buttermilk"];
  if (r === 1) return ["chapati", "veg", "dal"];
  if (r === 2) return ["dosa", "sambar", "buttermilk"];
  if (r === 3) return ["rice", "dal", "veg"];
  if (r === 4) return ["roti", "veg", "paneer"];
  return ["rice", "rasam", "veg", "curd"];
}

// ---- planning ----
interface PlannedItem {
  foodId: string;
  pt: string;
  pv: number;
  grams: number;
  carbs: number;
  kcal: number;
  protein: number;
  fat: number;
  gi: number;
}
function planItems(keys: string[], mult: number): PlannedItem[] {
  const out: PlannedItem[] = [];
  for (const k of keys) {
    const s = STAPLES.find(function (x) { return x.key === k; });
    if (!s || !s.foodId) continue;
    const pv = Math.max(1, num("FoodEntry", "portionValue", s.pv * mult));
    const scale = pv / s.pv;
    out.push({
      foodId: s.foodId,
      pt: s.pt,
      pv: pv,
      grams: num("FoodEntry", "grams", s.grams * scale),
      carbs: num("FoodEntry", "carbsG", s.carbs * scale),
      kcal: num("FoodEntry", "kcal", s.kcal * scale),
      protein: num("FoodEntry", "proteinG", s.protein * scale),
      fat: num("FoodEntry", "fatG", s.fat * scale),
      gi: s.gi,
    });
  }
  return out;
}
function effCarbs(items: PlannedItem[]): number {
  let e = 0;
  for (const it of items) e = e + it.carbs * it.gi;
  return e;
}
function postMeal(pre: number, eff: number, timeMult: number,
  walk: boolean): number {
  let v = pre + eff * 0.55 * timeMult + ri(-6, 6);
  if (walk) v = v - 12 - eff * 0.05;
  return clamp(Math.round(v), pre + 8, 265);
}
function emitMeal(items: PlannedItem[], dayBase: Date, minute: number,
  notes: string | null, userId: string): void {
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const ts = at(dayBase, minute + i * 2);
    if (ts > now) return;
    const row: any = {
      userId: userId,
      foodId: it.foodId,
      portionType: it.pt,
      portionValue: it.pv,
      grams: it.grams,
      kcal: it.kcal,
      carbsG: it.carbs,
      proteinG: it.protein,
      fatG: it.fat,
      loggedAt: ts,
    };
    if (notes) row.notes = notes;
    planRows.FoodEntry.push(row);
  }
}
function glu(dayBase: Date, minute: number, value: number,
  userId: string): void {
  const ts = at(dayBase, minute);
  if (ts > now) return;
  const row: any = { userId: userId, value: Math.round(value), takenAt: ts };
  if (fieldNeeds("GlucoseReading", "source")) row.source = "manual";
  planRows.GlucoseReading.push(row);
}
function actRow(dayBase: Date, minute: number, typ: string, dur: number,
  userId: string): void {
  const ts = at(dayBase, minute);
  if (ts > now) return;
  const row: any = {
    userId: userId,
    type: typ,
    durationMin: num("ActivityEntry", "durationMin", dur),
    at: ts,
  };
  if (fieldNeeds("ActivityEntry", "source")) row.source = "manual";
  planRows.ActivityEntry.push(row);
}
function planDay(d: number, userId: string, walkType: string,
  yogaType: string): void {
  const dayBase =
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + d);
  const dow = dayBase.getDay();
  const weekend = dow === 0 || dow === 6;
  const festive = FESTIVE.indexOf(d) >= 0;
  const mult = festive ? 1.45 : weekend ? 1.1 : 1.0;
  const wakeMin = 6 * 60 + ri(10, 50);
  const bfastMin = 7 * 60 + ri(30, 90);
  const lunchMin = 12 * 60 + ri(20, 70);
  const snackMin = 16 * 60 + ri(0, 60);
  const dinnerMin = (weekend ? 20 : 19) * 60 + ri(20, 70);
  const lastNight =
    num("SleepEntry", "hours", (weekend ? ri(24, 32) : ri(22, 31)) / 4);
  const fasting = clamp(
    Math.round(121 - 0.065 * d + ri(-5, 5) + (lastNight < 6 ? 5 : 0)),
    95, 140);
  const sleepTs = at(dayBase, wakeMin);
  if (sleepTs <= now) {
    planRows.SleepEntry.push({ userId: userId, hours: lastNight, wokeAt: sleepTs });
  }
  const bfItems =
    planItems(BREAKFASTS[(d * 5 + 3) % BREAKFASTS.length], weekend ? 1.1 : 1.0);
  const luItems = planItems(lunchKeys(d), mult);
  const snItems = chance(0.6) ? planItems(pick(SNACKS), 1.0) : [];
  const diItems = planItems(dinnerKeys(d, festive), mult);
  const eveningWalk = chance(weekend ? 0.35 : 0.55);
  emitMeal(bfItems, dayBase, bfastMin, null, userId);
  emitMeal(luItems, dayBase, lunchMin, null, userId);
  emitMeal(snItems, dayBase, snackMin, null, userId);
  emitMeal(diItems, dayBase, dinnerMin, festive ? "festival dinner" : null,
    userId);
  glu(dayBase, wakeMin + 5, fasting, userId);
  const preB = fasting + ri(0, 7);
  glu(dayBase, bfastMin - 10, preB, userId);
  glu(dayBase, bfastMin + 90, postMeal(preB, effCarbs(bfItems), 1.0, false),
    userId);
  const preL = fasting + ri(0, 7);
  glu(dayBase, lunchMin - 10, preL, userId);
  glu(dayBase, lunchMin + 90, postMeal(preL, effCarbs(luItems), 1.05, false),
    userId);
  const preD = fasting + ri(0, 7);
  glu(dayBase, dinnerMin - 10, preD, userId);
  glu(dayBase, dinnerMin + 90,
    postMeal(preD, effCarbs(diItems), 1.45, eveningWalk), userId);
  if (!weekend && chance(0.25)) {
    actRow(dayBase, wakeMin + 20, walkType, ri(20, 35), userId);
  }
  if (eveningWalk) {
    actRow(dayBase, dinnerMin + 40, walkType, ri(22, 40), userId);
  }
  if (dow === 0) {
    actRow(dayBase, wakeMin + 30, yogaType, 20, userId);
  }
  if (d % 3 === 0) {
    const wts = at(dayBase, wakeMin + 10);
    if (wts <= now) {
      const kg = Math.round((78.6 - (d / 59) * 1.4 + rf(-0.25, 0.25)) * 10) / 10;
      planRows.WeightEntry.push({
        userId: userId, kg: num("WeightEntry", "kg", kg), takenAt: wts,
      });
    }
  }
  if (dow === 1 || dow === 4) {
    const bts = at(dayBase, wakeMin + 15);
    if (bts <= now) {
      planRows.BloodPressureEntry.push({
        userId: userId,
        systolic: num("BloodPressureEntry", "systolic",
          Math.round(138 - (d / 59) * 6 + ri(-5, 5))),
        diastolic: num("BloodPressureEntry", "diastolic",
          Math.round(85 - (d / 59) * 4 + ri(-3, 3))),
        takenAt: bts,
      });
    }
  }
}
function planAll(userId: string, walkType: string, yogaType: string): void {
  for (const mname of Object.keys(TS_FIELD)) planRows[mname] = [];
  for (let d = 0; d < 60; d++) planDay(d, userId, walkType, yogaType);
}

// ---- pre-flight schema validation via dmmf (before anything is written) ----
function validateModel(model: string, rows: any[]): string[] {
  const fields = modelFields(model);
  if (fields.length === 0 || rows.length === 0) return [];
  const names = new Set<string>();
  for (const fl of fields) names.add(String(fl.name));
  const keys = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r)) keys.add(k);
  }
  const out: string[] = [];
  for (const k of keys) {
    if (!names.has(k)) out.push(model + ": unknown field " + k);
  }
  for (const fl of fields) {
    const scalar = fl.kind === "scalar";
    const rel = !!fl.relationName;
    if (fl.isRequired && !fl.hasDefaultValue && !fl.isId && scalar && !rel) {
      if (!keys.has(String(fl.name))) {
        out.push(model + ": missing required " + fl.name);
      }
    }
  }
  return out;
}

// ---- reporting ----
function topFoodLines(cnt: Map<string, number>): void {
  const arr = Array.from(cnt.entries()).sort(function (a, b) {
    return b[1] - a[1];
  }).slice(0, 10);
  let rank = 1;
  for (const pair of arr) {
    const nm = foodNameMap.get(pair[0]) || pair[0];
    console.log("TOPFOOD " + rank + " " + ascii(nm) + " x" + pair[1]);
    rank = rank + 1;
  }
}
function reportFromRows(): void {
  for (const mname of Object.keys(TS_FIELD)) {
    const rows = planRows[mname] || [];
    console.log("COUNT " + mname + " " + rows.length);
    let lo: Date | null = null;
    let hi: Date | null = null;
    for (const r of rows) {
      const t = r[TS_FIELD[mname]];
      if (t instanceof Date) {
        if (lo === null || t < lo) lo = t;
        if (hi === null || t > hi) hi = t;
      }
    }
    if (lo !== null && hi !== null) {
      console.log("RANGE " + mname + " " + iso(lo) + " .. " + iso(hi));
    }
  }
  const cnt = new Map<string, number>();
  for (const r of planRows.FoodEntry || []) {
    const k = String(r.foodId);
    cnt.set(k, (cnt.get(k) || 0) + 1);
  }
  topFoodLines(cnt);
}
async function reportVerified(cli: any, userId: string): Promise<void> {
  for (const mname of Object.keys(TS_FIELD)) {
    const del = delegateOf(cli, mname);
    const where: any = { userId: userId };
    where[TS_FIELD[mname]] = { gte: start };
    const n = await del.count({ where: where });
    console.log("COUNT " + mname + " " + n);
    try {
      const obA: any = {};
      obA[TS_FIELD[mname]] = "asc";
      const obD: any = {};
      obD[TS_FIELD[mname]] = "desc";
      const a = await del.findFirst({ where: where, orderBy: obA });
      const b = await del.findFirst({ where: where, orderBy: obD });
      if (a && b && a[TS_FIELD[mname]] && b[TS_FIELD[mname]]) {
        console.log("RANGE " + mname + " " + iso(a[TS_FIELD[mname]]) +
          " .. " + iso(b[TS_FIELD[mname]]));
      }
    } catch (e) { /* range reporting is optional */ }
  }
  try {
    const wf: any = { userId: userId };
    wf[TS_FIELD.FoodEntry] = { gte: start };
    const fes =
      await cli.foodEntry.findMany({ where: wf, select: { foodId: true } });
    const cnt = new Map<string, number>();
    for (const fe of fes) {
      const k = String(fe.foodId);
      cnt.set(k, (cnt.get(k) || 0) + 1);
    }
    topFoodLines(cnt);
  } catch (e) {
    console.log("TOPFOOD-SKIP " + msg(e));
  }
}

// ---- arguments ----
const argv = process.argv.slice(2);
const dryRun = argv.indexOf("--dry-run") >= 0 || argv.indexOf("--dry") >= 0;
let dbOverride: string | undefined;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--db" && i + 1 < argv.length) dbOverride = argv[i + 1];
  if (argv[i].indexOf("--db=") === 0) dbOverride = argv[i].slice(5);
}

// ---- main ----
async function main(): Promise<void> {
  console.log("MODE " + (dryRun ? "dry" : "write"));
  if (!PrismaClientCtor) {
    fatal("@prisma/client does not export PrismaClient");
  }
  const webDir = detectWebDir();
  const prismaDir = path.join(webDir, "prisma");
  const cand: string[] = [];
  if (dbOverride) cand.push(path.resolve(dbOverride));
  const envUrl = process.env.DATABASE_URL || "";
  if (envUrl === "") {
    console.log("ENVURL not set in this process (normal under tsx)");
  } else if (envUrl.indexOf("file:") === 0) {
    cand.push(fileUrlToPath(envUrl, prismaDir));
    console.log("ENVURL file: url added as candidate");
  } else {
    console.log("ENVURL non-file scheme ignored (local file: only)");
  }
  try {
    const sch = fs.readFileSync(path.join(prismaDir, "schema.prisma"), "utf8");
    const m = sch.match(/url\s*=\s*"([^"]*)"/);
    if (m && m[1].indexOf("file:") === 0) {
      cand.push(fileUrlToPath(m[1], prismaDir));
      console.log("SCHEMA literal file: url added as candidate");
    } else {
      console.log("SCHEMA url is not a literal file: path");
    }
  } catch (e) {
    console.log("SCHEMA unreadable; no literal url candidate");
  }
  cand.push(path.join(prismaDir, "dev.db"));
  cand.push(path.join(webDir, "dev.db"));
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const c of cand) {
    const k = c.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      uniq.push(c);
    }
  }
  for (const c of uniq) {
    console.log("CAND " + c + (fs.existsSync(c) ? " exists" : " missing"));
  }
  const existing = uniq.filter(function (c) { return fs.existsSync(c); });
  if (existing.length === 0) {
    fatal("no dev.db candidate exists; pass --db <path> or run db:seed");
  }
  const probes: ProbeInfo[] = [];
  for (const c of existing) {
    probes.push(await probeFile(c));
  }
  for (const pb of probes) {
    console.log("PROBE " + pb.file + " users=" + pb.users + " demo=" +
      (pb.demo ? "yes" : "no") + " entries=" + pb.entries + " foods=" +
      pb.foods + (pb.ok ? "" : " err=" + pb.err));
  }
  let target: ProbeInfo | undefined;
  if (dbOverride) {
    const want = path.resolve(dbOverride).toLowerCase();
    for (const pb of probes) {
      if (pb.file.toLowerCase() === want) target = pb;
    }
    if (!target || !target.ok || !target.demo) {
      fatal("--db target unreadable or lacks the demo user");
    }
  } else {
    const live = probes.filter(function (x) {
      return x.ok && x.demo && x.entries > 0;
    });
    if (live.length === 1) {
      target = live[0];
    } else if (live.length > 1) {
      fatal("ambiguous: multiple candidates hold demo data; pass --db");
    } else {
      const demoOnly = probes.filter(function (x) { return x.ok && x.demo; });
      if (demoOnly.length === 1) {
        target = demoOnly[0];
      } else if (demoOnly.length > 1) {
        const pref = path.join(prismaDir, "dev.db").toLowerCase();
        target = demoOnly.find(function (x) {
          return x.file.toLowerCase() === pref;
        }) || demoOnly[0];
        console.log("TIEBREAK using schema-default " + target.file);
      } else {
        fatal("demo user not found anywhere; run npm run db:seed first");
      }
    }
  }
  console.log("DETDB " + target.file);
  const cli = openClient(target.file);
  try {
    try {
      const dbs = await cli.$queryRawUnsafe("PRAGMA database_list");
      if (Array.isArray(dbs)) {
        const mainRow =
          dbs.find(function (x: any) { return x && x.name === "main"; });
        if (mainRow && mainRow.file) {
          const norm = function (s: string) {
            return String(s).replace(/[\\/]/g, "").toLowerCase();
          };
          if (norm(mainRow.file) !== norm(target.file)) {
            fatal("engine points at a different file than DETDB");
          }
        }
      }
    } catch (e) { /* pragma unavailable; trusting datasource override */ }
    const demo = await findDemo(cli);
    if (!demo) fatal("demo user vanished on the chosen database");
    const userId = demo.id;
    console.log("DEMO id=" + ascii(userId));
    const foods: { id: string; name: string }[] = [];
    try {
      const rawFoods = await cli.food.findMany();
      for (const f of rawFoods) {
        const nm = f.name || f.displayName || f.title || f.id;
        foods.push({ id: String(f.id), name: String(nm) });
        foodNameMap.set(String(f.id), String(nm));
      }
    } catch (e) {
      fatal("cannot read the Food table: " + msg(e));
    }
    const matched = matchFoods(foods);
    console.log("FOODS catalog=" + foods.length + " matched=" + matched);
    if (matched < 8) fatal("too few catalog keyword matches (need 8+)");
    let walkType = "walk";
    let yogaType = "yoga";
    try {
      const ex = await cli.activityEntry.findMany({ select: { type: true } });
      const types = new Set<string>();
      for (const e of ex) {
        if (e && e.type) types.add(String(e.type));
      }
      if (types.size > 0) {
        if (!types.has("walk")) walkType = Array.from(types)[0];
        if (!types.has("yoga")) yogaType = walkType;
      }
    } catch (e) { /* defaults stand */ }
    planAll(userId, walkType, yogaType);
    if (dryRun) {
      reportFromRows();
      console.log("DRY-OK");
      await cli.$disconnect();
      return;
    }
    const models = Object.keys(TS_FIELD);
    const problems: string[] = [];
    for (const mname of models) {
      const probs = validateModel(mname, planRows[mname]);
      for (const pr of probs) problems.push(pr);
    }
    if (problems.length > 0) {
      for (const pr of problems) console.log("PROBLEM " + pr);
      fatal("schema validation failed; nothing was written");
    }
    try {
      await cli.$executeRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE)");
    } catch (e) { /* best effort checkpoint */ }
    console.log("BACKUP " + backupDb(target.file));
    const ops: any[] = [];
    for (const mname of models) {
      const dw: any = { userId: userId };
      dw[TS_FIELD[mname]] = { gte: start };
      ops.push(delegateOf(cli, mname).deleteMany({ where: dw }));
    }
    for (const mname of models) {
      ops.push(delegateOf(cli, mname).createMany({ data: planRows[mname] }));
    }
    const results = await cli.$transaction(ops);
    for (let i = 0; i < models.length; i++) {
      console.log("WROTE " + models[i] + " " + results[models.length + i].count);
    }
    await reportVerified(cli, userId);
    console.log("ALL-OK");
    await cli.$disconnect();
  } catch (e) {
    console.log("FATAL " + msg(e));
    process.exit(1);
  }
}
main().catch(function (e: any) {
  console.log("FATAL " + msg(e));
  process.exit(1);
});