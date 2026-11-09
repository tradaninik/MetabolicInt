// intelligence.ts - P4 "Smart Analysis" engine.
//
// A deterministic, doctor-style integrated analysis over EVERYTHING the user
// has logged: labs (all panels, not just the latest), medications, glucose,
// meals, activity, sleep, weight, BP and the personalization survey.
// Pure functions only - no DB, no IO, no dates except the ones handed in
// (asOf drives every "last 14 days" window so tests stay deterministic).
//
// Output shape: IntelligenceReport (see __tests__/intelligence.test.ts for
// the executable contract). Safety posture (repo iron law): no doses, no
// diagnoses, "discuss with your doctor" framing for anything medical.

// ---------------------------------------------------------------------------
// Types (the shared contract consumed by /api/intelligence + the dashboard UI)
// ---------------------------------------------------------------------------

export type Severity = 'critical' | 'high' | 'moderate' | 'watch';
export type TrendVerdict = 'improving' | 'worsening' | 'stable' | 'new';

export interface LabResultLite {
  testKey: string;
  label?: string | null;
  value: number;
  unit: string;
  refLow?: number | null;
  refHigh?: number | null;
  flag?: string | null;
  performedAt: string; // YYYY-MM-DD
}

export interface SurveyAnswers {
  dietPattern?: 'veg' | 'egg' | 'nonveg';
  riceFrequency?: 'daily' | 'most-days' | 'occasional';
  sweetsFrequency?: 'daily' | 'weekly' | 'rarely';
  eatingOutFrequency?: 'often' | 'sometimes' | 'rarely';
  cookingOil?: 'groundnut' | 'sunflower' | 'coconut' | 'ghee-heavy' | 'mustard' | 'olive-blend' | 'mixed';
  walkMinutesPerDay?: number;
  strengthPerWeek?: number;
  sittingHours?: number;
  stressLevel?: number;
  sleepQuality?: 'good' | 'disturbed' | 'poor';
  menopause?: 'pre' | 'peri' | 'post' | 'na';
  symptoms?: string[];
  familyHistory?: string[];
  primaryGoal?: 'sugar' | 'weight' | 'cholesterol' | 'energy' | 'fitness';
  teaCoffeeSugar?: 'none' | 'some' | 'heavy';
}

export interface IntelligenceProfile {
  name?: string | null;
  age?: number | null;
  gender?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  waistCm?: number | null;
  hba1c?: number | null;
  diabetic?: boolean | null;
  activityLevel?: string | null;
  region?: string | null;
  sleepHours?: number | null;
  smoking?: string | null;
  alcohol?: string | null;
  conditions?: string[] | null;
}

export interface MedLite { name: string; isActive: boolean; }

export interface IntelligenceInput {
  asOf?: string;
  profile: IntelligenceProfile;
  labs: LabResultLite[];
  meds: MedLite[];
  adherencePct?: number | null;
  glucose?: { value: number; takenAt: string }[];
  meals?: { kcal: number; carbsG: number; proteinG?: number; fiberG?: number; loggedAt: string }[];
  activity?: { type: string; durationMin: number; at: string }[];
  sleep?: { hours: number; wokeAt: string }[];
  weight?: { kg: number; takenAt: string }[];
  bp?: { systolic: number; diastolic: number; takenAt: string }[];
  survey?: SurveyAnswers | null;
}

export interface ScoreComponent { key: string; label: string; score: number; note: string; }

export interface PriorityFinding {
  rank: number;
  severity: Severity;
  area: string;
  areaLabel: string;
  title: string;
  finding: string;
  whyItMatters: string;
  evidence: string[];
  trendNote: string;
  doNow: string;
  window: string;
}

export interface TrendPoint { date: string; value: number; }
export interface TrendCallout {
  key: string;
  label: string;
  unit: string;
  direction: 'up' | 'down' | 'flat' | 'single';
  series: TrendPoint[];
  changeNote: string;
  verdict: TrendVerdict;
  interpretation: string;
}

export interface LmRow {
  area: string;
  areaLabel: string;
  lifestyle: string;
  lifestyleEffect: string;
  medication: string;
  medicationNote: string;
}

export interface DietSwap { from: string; to: string; why: string; }
export interface DietMealSlot { slot: string; options: string[]; note: string; }
export interface DailyTarget { label: string; value: string; }

export interface DietPlan {
  philosophy: string;
  plateRule: string;
  dailyTargets: DailyTarget[];
  swaps: DietSwap[];
  sampleDay: DietMealSlot[];
}

export interface ActivityDay { day: string; focus: string; detail: string; minutes: number; }

export interface ActivityPlan {
  baseline: string;
  weekly: ActivityDay[];
  targets: string[];
  safetyNotes: string[];
}

export interface FollowUpTest { name: string; why: string; when: string; priority: 'soon' | 'routine' | 'annual'; }

export interface NinetyDayPhase {
  phase: string;
  days: string;
  focus: string;
  actions: string[];
  target: string;
}

export interface IntelligenceReport {
  asOf: string;
  patientLine: string;
  headline: string;
  summary: string;
  score: { overall: number; label: string; components: ScoreComponent[] };
  positives: string[];
  priorities: PriorityFinding[];
  trends: TrendCallout[];
  lifestyleVsMeds: LmRow[];
  dietPlan: DietPlan;
  activityPlan: ActivityPlan;
  followUps: FollowUpTest[];
  ninetyDay: NinetyDayPhase[];
  questionnaireGaps: string[];
  dataCoverage: {
    labResults: number;
    panelDates: string[];
    activeMeds: number;
    glucoseLast14d: number;
    mealDaysLast14d: number;
    surveyDone: boolean;
  };
  unmatchedTests: { label: string; value: number; unit: string; flag?: string | null }[];
  hasLabs: boolean;
  disclaimer: string;
}

export const SYMPTOM_OPTIONS = [
  'Tiredness or low energy',
  'Frequent thirst',
  'Frequent urination',
  'Tingling or numbness in feet',
  'Blurred vision',
  'Joint pains',
  'Breathlessness on exertion',
  'Slow-healing wounds',
  'Morning stiffness',
  'Digestive bloating',
] as const;

export const FAMILY_HISTORY_OPTIONS = [
  'Diabetes',
  'Heart disease',
  'High blood pressure',
  'High cholesterol',
  'Thyroid disorder',
  'Kidney disease',
  'Cancer',
] as const;

export const INTELLIGENCE_DISCLAIMER =
  'Educational analysis generated from your logged data - not a diagnosis. ' +
  'Lab values must be interpreted by your treating physician. Never start, stop or change any medication based on this report.';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : String(round1(v));
}

function daysBetween(aDate: string, bDate: string): number {
  const a = Date.parse(aDate.length === 10 ? aDate + 'T00:00:00Z' : aDate);
  const b = Date.parse(bDate.length === 10 ? bDate + 'T00:00:00Z' : bDate);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

function monthsBetween(aDate: string, bDate: string): number {
  return Math.max(1, Math.round(daysBetween(aDate, bDate) / 30.44));
}

function normKey(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isFemale(gender?: string | null): boolean {
  const g = (gender ?? '').toLowerCase();
  return g.startsWith('f') || g.startsWith('w');
}

function eAG(a1c: number): number {
  return Math.round(28.7 * a1c - 46.7); // ADAG
}

// ---------------------------------------------------------------------------
// Lab catalog: canonical keys + generous alias matching.
// Lab-printed refLow/refHigh always WIN over these fallbacks (repo rule).
// ---------------------------------------------------------------------------

type AreaKey =
  | 'glycemic' | 'lipids' | 'inflammation' | 'liver' | 'nutrition'
  | 'kidney' | 'thyroid' | 'hematology' | 'electrolytes';

interface TestDef {
  key: string;
  label: string;
  unit: string;
  aliases: string[];
  refLow?: number;
  refHigh?: number;
  /** true when high values are the problem (default); false = low is the problem */
  higherIsWorse?: boolean;
  area: AreaKey;
  /** lower = more clinically interesting in the trend list */
  trendInterest?: number;
}

const TESTS: TestDef[] = [
  // glycemic
  { key: 'hba1c', label: 'HbA1c', unit: '%', area: 'glycemic', refLow: 4.2, refHigh: 5.7, trendInterest: 1,
    aliases: ['hba1c', 'glycatedhemoglobin', 'glycosylatedhemoglobin', 'glycatedhaemoglobin', 'a1c', 'hba1cpercent', 'hba1cglycosylatedhemoglobin', 'glycatedhemoglobinhba1c'] },
  { key: 'fbg', label: 'Fasting glucose', unit: 'mg/dl', area: 'glycemic', refLow: 70, refHigh: 100,
    aliases: ['fastingbloodsugar', 'glucosefasting', 'fastingglucose', 'fbs', 'bloodglucosefasting', 'glucosefastingplasma', 'fastingbloodglucose'] },
  // lipids
  { key: 'total_cholesterol', label: 'Total cholesterol', unit: 'mg/dl', area: 'lipids', refLow: 0, refHigh: 200, trendInterest: 4,
    aliases: ['totalcholesterol', 'cholesteroltotal', 'cholesterolserumtotal', 'tc', 'serumcholesteroltotal', 'cholesteroltotalserum'] },
  { key: 'ldl', label: 'LDL cholesterol', unit: 'mg/dl', area: 'lipids', refLow: 0, refHigh: 100, trendInterest: 3,
    aliases: ['ldlcholesteroldirect', 'ldlcholesterol', 'ldl', 'ldlc', 'ldlcholesterolserum'] },
  { key: 'hdl', label: 'HDL cholesterol', unit: 'mg/dl', area: 'lipids', refLow: 40, refHigh: 60, higherIsWorse: false, trendInterest: 5,
    aliases: ['hdlcholesteroldirect', 'hdlcholesterol', 'hdl', 'hdlc', 'hdlcholesterolserum'] },
  { key: 'tg', label: 'Triglycerides', unit: 'mg/dl', area: 'lipids', refLow: 0, refHigh: 150, trendInterest: 6,
    aliases: ['triglyceridesserum', 'triglycerides', 'tg', 'serumtriglycerides', 'triglyceridesserumserum'] },
  { key: 'vldl', label: 'VLDL cholesterol', unit: 'mg/dl', area: 'lipids', refLow: 0, refHigh: 30,
    aliases: ['vldlcholesterol', 'vldl', 'vldlcholesterolserum'] },
  { key: 'non_hdl', label: 'Non-HDL cholesterol', unit: 'mg/dl', area: 'lipids', refLow: 0, refHigh: 160,
    aliases: ['nonhdlcholesterol', 'nonhdl', 'nonhdlcholesterolcalculated'] },
  { key: 'chol_hdl_ratio', label: 'Total chol / HDL ratio', unit: 'ratio', area: 'lipids', refLow: 3.3, refHigh: 4.4,
    aliases: ['totalcholhdlcholesterolratio', 'cholhdlratio', 'tchdl', 'totalcholesterolhdlratio', 'cholhdl'] },
  { key: 'ldl_hdl_ratio', label: 'LDL / HDL ratio', unit: 'ratio', area: 'lipids', refLow: 0.5, refHigh: 3,
    aliases: ['ldlhdlcholesterolratio', 'ldlhdlratio', 'ldlchdl'] },
  { key: 'apo_b', label: 'ApoB', unit: 'mg/dl', area: 'lipids', refLow: 55, refHigh: 130, trendInterest: 2,
    aliases: ['apolipoproteinsb', 'apolipoproteinb', 'apob', 'apobserum', 'apolipoproteinsbserum'] },
  { key: 'apo_a1', label: 'ApoA1', unit: 'mg/dl', area: 'lipids', refLow: 105, refHigh: 205, higherIsWorse: false,
    aliases: ['apolipoproteinsa1', 'apolipoproteina1', 'apoa1', 'apoa1serum', 'apoa', 'serumapolipoproteina1'] },
  { key: 'apo_ratio', label: 'ApoB / ApoA1 ratio', unit: 'ratio', area: 'lipids', refLow: 0.3, refHigh: 1.49,
    aliases: ['apolipoproteinbanda1ratio', 'apobapoa1ratio', 'apoba1ratio', 'aporatio', 'apolipoproteinbratio'] },
  // inflammation
  { key: 'hs_crp', label: 'hsCRP', unit: 'mg/L', area: 'inflammation', refLow: 0, refHigh: 1, trendInterest: 7,
    aliases: ['hscrphighsensitivitycrp', 'hscrp', 'hscreactiveprotein', 'crphighsensitivity', 'highsensitivitycreactiveprotein', 'hscrpserum', 'hscrbighsensitivitycrp'] },
  // liver
  { key: 'alt', label: 'ALT (SGPT)', unit: 'U/L', area: 'liver', refLow: 3, refHigh: 35, trendInterest: 9,
    aliases: ['alanineaminotransferase', 'alt', 'sgpt', 'alat', 'alanineaminotransferasealtsgpt', 'altsgpt', 'sgptalt'] },
  { key: 'ast', label: 'AST (SGOT)', unit: 'U/L', area: 'liver', refLow: 3, refHigh: 35,
    aliases: ['aspartateaminotransferase', 'ast', 'sgot', 'asat', 'sgotast', 'astsgot'] },
  { key: 'ggt', label: 'GGT', unit: 'U/L', area: 'liver', refLow: 5, refHigh: 38,
    aliases: ['gammaglutamyltransferase', 'ggtp', 'ggt', 'gammatransferase', 'gammagtgl', 'ggpgammagt'] },
  { key: 'alp', label: 'Alkaline phosphatase', unit: 'U/L', area: 'liver', refLow: 33, refHigh: 98,
    aliases: ['alkalinephosphatase', 'alp', 'serumalkalinephosphatase', 'alkphos'] },
  { key: 'nafld', label: 'NAFLD fibrosis score', unit: 'score', area: 'liver', refLow: -1.455, refHigh: 0.675,
    aliases: ['nafldscore', 'nafldfibrosisscore', 'nafld', 'nafldfibrosis'] },
  // nutrition
  { key: 'vitamin_d', label: 'Vitamin D (25-OH)', unit: 'ng/ml', area: 'nutrition', refLow: 30, refHigh: 100, higherIsWorse: false, trendInterest: 8,
    aliases: ['vitamindtotal25hydroxy', 'vitamind25hydroxy', 'vitamind', 'vd', '25ohvitamind', 'vitamindtotal25hydroxyvitamind', 'vitamind255hydroxy'] },
  { key: 'vitamin_b12', label: 'Vitamin B12', unit: 'pg/ml', area: 'nutrition', refLow: 211, refHigh: 912, higherIsWorse: false,
    aliases: ['vitaminb12cyanocobalamin', 'vitaminb12', 'b12', 'cyanocobalamin'] },
  { key: 'homocysteine', label: 'Homocysteine', unit: 'umol/L', area: 'nutrition', refLow: 3.7, refHigh: 13.9,
    aliases: ['homocysteine', 'homocysteineserum', 'hcy', 'serumhomocysteine'] },
  { key: 'iron', label: 'Serum iron', unit: 'ug/dl', area: 'nutrition', refLow: 60, refHigh: 180,
    aliases: ['serumiron', 'iron', 'ironserrum', 'ironserum'] },
  { key: 'tibc', label: 'TIBC', unit: 'ug/dl', area: 'nutrition', refLow: 250, refHigh: 400,
    aliases: ['serumtotalironbindingcapicity', 'serumtotalironbindingcapacity', 'totalironbindingcapacity', 'tibc', 'totalironbindingcapicity'] },
  { key: 'transferrin_sat', label: 'Transferrin saturation', unit: '%', area: 'nutrition', refLow: 15, refHigh: 50,
    aliases: ['transferrinsaturation', 'transferrinsaturationpercent', 'tsat', 'transferrinsaturationmethodcalculated'] },
  { key: 'ferritin', label: 'Ferritin', unit: 'ng/ml', area: 'nutrition', refLow: 13, refHigh: 150,
    aliases: ['ferritin', 'serumferritin'] },
  // kidney
  { key: 'creatinine', label: 'Creatinine', unit: 'mg/dl', area: 'kidney', refLow: 0.6, refHigh: 1.3,
    aliases: ['serumcreatinine', 'creatinine', 'creat', 'creatinineserum'] },
  { key: 'egfr', label: 'eGFR', unit: 'mL/min', area: 'kidney', refLow: 90, refHigh: 200, higherIsWorse: false,
    aliases: ['gfreestimated', 'egfr', 'estimatedgfr', 'gfrestimated', 'egfreestimated'] },
  { key: 'urea', label: 'Urea', unit: 'mg/dl', area: 'kidney', refLow: 17, refHigh: 43,
    aliases: ['urea', 'serumurea', 'bloodurea', 'ureaserum'] },
  { key: 'uric_acid', label: 'Uric acid', unit: 'mg/dl', area: 'kidney', refLow: 2.6, refHigh: 6, trendInterest: 10,
    aliases: ['uricacid', 'uricacidserum', 'serumuricacid'] },
  // thyroid
  { key: 'tsh', label: 'TSH', unit: 'uIU/ml', area: 'thyroid', refLow: 0.55, refHigh: 4.78, trendInterest: 12,
    aliases: ['tshultrasensitive', 'tsh', 'thyroidstimulatinghormone', 'tshultrasensitiveserum', 'tshultrasensitivetsh'] },
  { key: 't3', label: 'T3 (total)', unit: 'ng/ml', area: 'thyroid', refLow: 0.6, refHigh: 1.81,
    aliases: ['t3totaltriiodothyronine', 't3', 'triiodothyronine', 't3total', 'triiodothyroninet3total'] },
  { key: 't4', label: 'T4 (total)', unit: 'ug/dl', area: 'thyroid', refLow: 3.2, refHigh: 12.6,
    aliases: ['t4totalthyroxine', 't4', 'thyroxine', 't4total', 'thyroxinet4total'] },
  // hematology
  { key: 'hemoglobin', label: 'Haemoglobin', unit: 'g/dL', area: 'hematology', refLow: 12, refHigh: 15, trendInterest: 11,
    aliases: ['haemoglobinhb', 'hemoglobin', 'hb', 'haemoglobin', 'hemoglobinhb'] },
  { key: 'mcv', label: 'MCV', unit: 'fL', area: 'hematology', refLow: 83, refHigh: 101,
    aliases: ['meancorpvolume', 'mcv', 'meancorpuscularvolume', 'meancorpuscularvolumemcv'] },
  { key: 'mch', label: 'MCH', unit: 'pg', area: 'hematology', refLow: 27, refHigh: 32,
    aliases: ['meancorpb', 'mch', 'meancorpuscularhemoglobin', 'meancorpuscularhbmch'] },
  { key: 'mchc', label: 'MCHC', unit: 'g/dL', area: 'hematology', refLow: 31.5, refHigh: 34.5,
    aliases: ['meancorpbconc', 'mchc', 'meancorpuscularhemoglobinconcentration', 'meancorpuscularhbconc'] },
  { key: 'rbc', label: 'RBC count', unit: '10^6/ul', area: 'hematology', refLow: 3.8, refHigh: 4.8,
    aliases: ['redbloodcellcount', 'rbc', 'rbcct', 'redbloodcellcountrbc'] },
  { key: 'tlc', label: 'Total leucocyte count', unit: '10^3/uL', area: 'hematology', refLow: 4, refHigh: 10,
    aliases: ['totalleucocytecount', 'tlc', 'wbc', 'wbcct', 'totalleucocytecounttlc'] },
  { key: 'platelets', label: 'Platelet count', unit: '10^3/ul', area: 'hematology', refLow: 150, refHigh: 410,
    aliases: ['plateletcount', 'platelets', 'plt', 'plateletcountthrombocytecount', 'thrombocytecount'] },
  { key: 'rdw_cv', label: 'RDW-CV', unit: '%', area: 'hematology', refLow: 11.6, refHigh: 14,
    aliases: ['rdwcv', 'rdw', 'redcelldistributionwidth', 'redcellistributionwidthcv'] },
  // electrolytes
  { key: 'sodium', label: 'Sodium', unit: 'mmol/L', area: 'electrolytes', refLow: 136, refHigh: 146,
    aliases: ['sodium', 'sodiumserum', 'serumsodium'] },
  { key: 'potassium', label: 'Potassium', unit: 'mmol/L', area: 'electrolytes', refLow: 3.5, refHigh: 5.5,
    aliases: ['potassium', 'potassiumserum', 'serumpotassium', 'potassiumserumpotassium'] },
  { key: 'chloride', label: 'Chloride', unit: 'mmol/L', area: 'electrolytes', refLow: 101, refHigh: 109,
    aliases: ['chlorides', 'chloride', 'chloridesserum', 'serumchlorides', 'chlorideserum'] },
  { key: 'calcium', label: 'Calcium (total)', unit: 'mg/dl', area: 'electrolytes', refLow: 8.8, refHigh: 10.6,
    aliases: ['calciumtotal', 'calcium', 'calciumtotalserum', 'serumcalcium', 'calciumtotalserumcalcium'] },
  { key: 'phosphorus', label: 'Phosphorus', unit: 'mg/dl', area: 'electrolytes', refLow: 2.5, refHigh: 4.5,
    aliases: ['phosphorusinorganic', 'phosphorus', 'phosphoruserum', 'inorganicphosphorus', 'phosphorusinorganicserum'] },
  { key: 'albumin', label: 'Albumin', unit: 'g/dl', area: 'hematology', refLow: 3.5, refHigh: 5.2,
    aliases: ['serumalbumin', 'albumin'] },
  { key: 'total_protein', label: 'Total protein', unit: 'gm/dl', area: 'hematology', refLow: 6.6, refHigh: 8.3,
    aliases: ['proteinsserum', 'totalprotein', 'serumtotalprotein', 'proteins'] },
  { key: 'bilirubin_total', label: 'Bilirubin (total)', unit: 'mg/dl', area: 'liver', refLow: 0.3, refHigh: 1.2,
    aliases: ['serumbilirubintotal', 'bilirubintotal', 'totalbilirubin'] },
];

const ALIAS_TO_DEF = new Map<string, TestDef>();
for (const def of TESTS) {
  ALIAS_TO_DEF.set(normKey(def.key), def);
  for (const a of def.aliases) {
    const n = normKey(a);
    if (!ALIAS_TO_DEF.has(n)) ALIAS_TO_DEF.set(n, def);
  }
}

function matchTest(testKey: string, label?: string | null): TestDef | null {
  const k = normKey(testKey ?? '');
  if (k && ALIAS_TO_DEF.has(k)) return ALIAS_TO_DEF.get(k)!;
  if (label) {
    const l = normKey(label);
    if (l && ALIAS_TO_DEF.has(l)) return ALIAS_TO_DEF.get(l)!;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Lab context assembly
// ---------------------------------------------------------------------------

type LabStatus = 'low' | 'borderline' | 'normal' | 'high' | 'very-high';

interface TestPoint {
  date: string;
  value: number;
  refLow: number | null;
  refHigh: number | null;
  flag: string | null;
}

interface LabValue {
  def: TestDef;
  latest: TestPoint;
  series: TestPoint[]; // chronological (>=1)
  status: LabStatus;
}

function statusFor(def: TestDef, point: TestPoint): LabStatus {
  const lo = point.refLow ?? def.refLow ?? null;
  const hi = point.refHigh ?? def.refHigh ?? null;
  if (lo == null && hi == null) return 'normal';
  if (lo != null && point.value < lo) {
    const span = hi != null ? hi - lo : Math.abs(lo) || 1;
    return lo - point.value <= span * 0.05 ? 'borderline' : 'low';
  }
  if (hi != null && point.value > hi) {
    const span = hi - (lo ?? 0) || Math.abs(hi) || 1;
    const over = (point.value - hi) / span;
    if (over <= 0.05) return 'borderline';
    return over > 0.5 ? 'very-high' : 'high';
  }
  return 'normal';
}

interface LabCtx {
  byKey: Map<string, LabValue>;
  unmatched: { label: string; value: number; unit: string; flag?: string | null }[];
  panelDates: string[];
  labCount: number;
}

function buildLabCtx(labs: LabResultLite[]): LabCtx {
  const byKey = new Map<string, LabValue>();
  const unmatched: LabCtx['unmatched'] = [];
  const panelDates = new Set<string>();

  for (const row of labs) {
    if (!Number.isFinite(row.value)) continue;
    if (/^\d{4}-\d{2}-\d{2}$/.test(row.performedAt ?? '')) panelDates.add(row.performedAt);
    const def = matchTest(row.testKey, row.label);
    if (!def) {
      unmatched.push({
        label: row.label?.trim() || row.testKey,
        value: row.value,
        unit: row.unit,
        flag: row.flag ?? undefined,
      });
      continue;
    }
    const point: TestPoint = {
      date: row.performedAt,
      value: row.value,
      refLow: row.refLow ?? null,
      refHigh: row.refHigh ?? null,
      flag: row.flag ?? null,
    };
    const existing = byKey.get(def.key);
    if (existing) existing.series.push(point);
    else byKey.set(def.key, { def, latest: point, series: [point], status: 'normal' });
  }

  for (const v of byKey.values()) {
    v.series.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    v.latest = v.series[v.series.length - 1];
    v.status = statusFor(v.def, v.latest);
  }

  return {
    byKey,
    unmatched,
    panelDates: Array.from(panelDates).sort().reverse(),
    labCount: labs.length,
  };
}

function lab(ctx: LabCtx, key: string): LabValue | undefined {
  return ctx.byKey.get(key);
}

function val(ctx: LabCtx, key: string): number | undefined {
  return ctx.byKey.get(key)?.latest.value;
}

/** "6.3 -> 7.8 since Mar 2025 (rising)" style trend notes for findings. */
function trendNoteFor(v: LabValue, upWord = 'rising', downWord = 'falling'): string {
  if (v.series.length < 2) return 'Single reading on file';
  const first = v.series[0];
  const last = v.series[v.series.length - 1];
  if (first.value === last.value) return `${fmt(first.value)} steady since ${shortMonthYear(first.date)}`;
  const dir = last.value > first.value ? upWord : downWord;
  const pct = Math.abs((last.value - first.value) / (first.value || 1)) * 100;
  return `${fmt(first.value)} -> ${fmt(last.value)} since ${shortMonthYear(first.date)} (${dir}, ${Math.round(pct)}%)`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function shortMonthYear(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(isoDate ?? '');
  if (!m) return isoDate;
  const mi = clamp(parseInt(m[2], 10) - 1, 0, 11);
  return `${MONTHS[mi]} ${m[1]}`;
}

// ---------------------------------------------------------------------------
// Windows: 14-day aggregates over glucose / meals / activity / sleep / bp
// ---------------------------------------------------------------------------

interface Windows {
  asOfMs: number;
  glucose14: { value: number; t: number }[];
  glucoseAvg: number | null;
  glucoseHighs: number; // >180
  glucoseIn14: number;
  mealDays: number;
  kcalAvg: number | null;
  carbsAvg: number | null;
  fiberAvg: number | null;
  proteinAvg: number | null;
  activityMinPerWeek: number | null;
  sleepAvg: number | null;
  bpAvg: { s: number; d: number } | null;
}

function tsOf(raw: string): number {
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : 0;
}

/** A date-only asOf (YYYY-MM-DD) means "end of that day" so same-day logs count. */
function asOfTs(raw: string): number {
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(raw ?? '') ? raw + 'T23:59:59Z' : raw);
  return Number.isFinite(t) ? t : Date.now();
}

function buildWindows(input: IntelligenceInput): Windows {
  const asOfMs = input.asOf != null ? asOfTs(input.asOf) : Date.now();
  const cut = asOfMs - 14 * 86_400_000;

  const glucose14 = (input.glucose ?? [])
    .map((g) => ({ value: g.value, t: tsOf(g.takenAt) }))
    .filter((g) => g.t >= cut);
  const glucoseAvg = glucose14.length ? glucose14.reduce((a, g) => a + g.value, 0) / glucose14.length : null;

  const mealDaysSet = new Set<string>();
  let kcal = 0, carbs = 0, fiber = 0, protein = 0, mealRows = 0;
  for (const m of input.meals ?? []) {
    const t = tsOf(m.loggedAt);
    if (t < cut || t > asOfMs) continue;
    mealDaysSet.add(new Date(t).toISOString().slice(0, 10));
    kcal += m.kcal; carbs += m.carbsG; fiber += m.fiberG ?? 0; protein += m.proteinG ?? 0; mealRows++;
  }
  const mealDays = mealDaysSet.size || mealRows;

  const actMin = (input.activity ?? [])
    .filter((a) => tsOf(a.at) >= cut && tsOf(a.at) <= asOfMs)
    .reduce((a, x) => a + x.durationMin, 0);

  const sleeps = (input.sleep ?? []).filter((s) => tsOf(s.wokeAt) >= cut && tsOf(s.wokeAt) <= asOfMs + 86_400_000);
  const sleepAvg = sleeps.length ? sleeps.reduce((a, s) => a + s.hours, 0) / sleeps.length : null;

  const bps = (input.bp ?? []).filter((b) => tsOf(b.takenAt) >= cut && tsOf(b.takenAt) <= asOfMs);
  const bpAvg = bps.length
    ? { s: Math.round(bps.reduce((a, b) => a + b.systolic, 0) / bps.length), d: Math.round(bps.reduce((a, b) => a + b.diastolic, 0) / bps.length) }
    : null;

  return {
    asOfMs,
    glucose14,
    glucoseAvg,
    glucoseHighs: glucose14.filter((g) => g.value > 180).length,
    glucoseIn14: glucose14.length,
    mealDays,
    kcalAvg: mealDays ? kcal / mealDays : null,
    carbsAvg: mealDays ? carbs / mealDays : null,
    fiberAvg: mealDays ? fiber / mealDays : null,
    proteinAvg: mealDays ? protein / mealDays : null,
    activityMinPerWeek: (input.activity ?? []).length ? (actMin / 14) * 7 : null,
    sleepAvg,
    bpAvg,
  };
}

// ---------------------------------------------------------------------------
// Medication classification (names only - never doses)
// ---------------------------------------------------------------------------

interface MedClasses {
  metformin: string[];
  sulfonylurea: string[];
  insulin: string[];
  statin: string[];
  bp: string[];
  vitd: string[];
  folate: string[];
  b12: string[];
  thyroid: string[];
  names: string[];
}

function classifyMeds(meds: MedLite[]): MedClasses {
  const active = meds.filter((m) => m.isActive);
  const has = (fragments: string[]) => active.filter((m) => {
    const n = m.name.toLowerCase();
    return fragments.some((f) => n.includes(f));
  }).map((m) => m.name);
  return {
    metformin: has(['metformin', 'glycomet', 'glumet', 'okamet']),
    sulfonylurea: has(['glimepiride', 'gliclazide', 'glipizide', 'glibenclamide', 'glyburide', 'ayurvedic']),
    insulin: has(['insulin', 'lantus', 'humalog', 'mixtard', 'lantus', 'glargine', 'lispro', 'regular insulin']),
    statin: has(['statin', 'atorvastatin', 'rosuvastatin', 'simvastatin', 'pravastatin', 'lovastatin', 'pitavastatin']),
    bp: has(['telmisartan', 'amlodipine', 'losartan', 'enalapril', 'ramipril', 'metoprolol', 'bisoprolol', 'olmesartan', 'valsartan', 'irbesartan']),
    vitd: has(['vitamin d', 'vit d', 'cholecalciferol', 'calcirol', 'd3']),
    folate: has(['folic', 'folate', 'folvite']),
    b12: has(['b12', 'methylcobalamin', 'cyanocobalamin', 'neurobion']),
    thyroid: has(['thyroxine', 'thyronorm', 'eltroxin', 'levothyroxine']),
    names: active.map((m) => m.name),
  };
}

// ---------------------------------------------------------------------------
// Score
// ---------------------------------------------------------------------------

function computeScore(
  ctx: LabCtx,
  w: Windows,
  input: IntelligenceInput,
  diabetic: boolean,
): { overall: number; label: string; components: ScoreComponent[] } {
  const comps: ScoreComponent[] = [];
  const push = (key: string, label: string, score: number | null, note: string) => {
    if (score != null) comps.push({ key, label, score: Math.round(clamp(score, 0, 100)), note });
  };

  // glycemic
  {
    const a1c = val(ctx, 'hba1c');
    const fbg = val(ctx, 'fbg');
    const target = diabetic ? 6.5 : 5.7;
    let s: number | null = null;
    const bits: string[] = [];
    if (a1c != null) {
      s = 100 - clamp((a1c - target) * 20, 0, 65);
      bits.push(`HbA1c ${fmt(a1c)}%${diabetic ? ' vs goal <7.0' : ' vs normal <5.7'}`);
      if (fbg != null && fbg >= 126) { s -= 8; bits.push(`fasting ${fmt(fbg)}`); }
      else if (fbg != null) bits.push(`fasting ${fmt(fbg)}`);
    } else if (fbg != null) {
      s = 100 - clamp((fbg - 100) * 0.5, 0, 60);
      bits.push(`fasting ${fmt(fbg)} mg/dl`);
    } else if (w.glucoseAvg != null) {
      s = 100 - clamp((w.glucoseAvg - 130) * 0.4, 0, 60);
      bits.push(`14-day avg ${Math.round(w.glucoseAvg)} mg/dL`);
    }
    if (w.glucoseAvg != null && a1c == null && fbg == null) bits.push('no lab HbA1c yet');
    push('glycemic', 'Blood sugar', s, bits.length ? bits.join(', ') : 'No glucose data yet');
  }

  // lipids
  {
    const ldl = val(ctx, 'ldl');
    const apoB = val(ctx, 'apo_b');
    const nonHdl = val(ctx, 'non_hdl');
    const ratio = val(ctx, 'chol_hdl_ratio');
    const tg = val(ctx, 'tg');
    const hdl = val(ctx, 'hdl');
    let s: number | null = null;
    const drivers: string[] = [];
    if (ldl != null || apoB != null || nonHdl != null || ratio != null || tg != null || hdl != null) {
      s = 100;
      if (ldl != null && ldl > 100) { const p = clamp((ldl - 100) * 0.3, 0, 45); s -= p; drivers.push(`LDL ${fmt(ldl)}`); }
      if (apoB != null && apoB > 130) { const p = clamp((apoB - 130) * 0.35, 0, 40); s -= p; drivers.push(`ApoB ${fmt(apoB)}`); }
      if (nonHdl != null && nonHdl > 160) { const p = clamp((nonHdl - 160) * 0.25, 0, 25); s -= p; drivers.push(`non-HDL ${fmt(nonHdl)}`); }
      if (ratio != null && ratio > 4.4) { const p = clamp((ratio - 4.4) * 6, 0, 15); s -= p; drivers.push(`TC/HDL ${fmt(ratio)}`); }
      if (tg != null && tg > 150) { const p = clamp((tg - 150) * 0.06, 0, 12); s -= p; drivers.push(`TG ${fmt(tg)}`); }
      if (hdl != null && hdl < 40) { s -= 10; drivers.push(`HDL ${fmt(hdl)}`); }
    }
    push('lipids', 'Cholesterol', s, drivers.length ? drivers.join(', ') : 'No lipid panel yet');
  }

  // inflammation
  {
    const crp = val(ctx, 'hs_crp');
    const s = crp != null ? 100 - clamp((crp - 1) * 9, 0, 65) : null;
    push('inflammation', 'Inflammation', s, crp != null ? `hsCRP ${fmt(crp)} mg/L (goal <1)` : 'No hsCRP yet');
  }

  // nutrition
  {
    const vitD = val(ctx, 'vitamin_d');
    const hcy = val(ctx, 'homocysteine');
    const b12 = val(ctx, 'vitamin_b12');
    const iron = val(ctx, 'iron');
    const tsat = val(ctx, 'transferrin_sat');
    let s: number | null = null;
    const notes: string[] = [];
    if (vitD != null || hcy != null || b12 != null || iron != null) {
      s = 100;
      if (vitD != null && vitD < 20) { s -= 30; notes.push(`vitamin D ${fmt(vitD)}`); }
      else if (vitD != null && vitD < 30) { s -= 15; notes.push(`vitamin D ${fmt(vitD)} (at floor)`); }
      if (hcy != null && hcy > 13.9) { s -= clamp((hcy - 13.9) * 1.2, 0, 25); notes.push(`homocysteine ${fmt(hcy)}`); }
      if (b12 != null && b12 < 211) { s -= 20; notes.push(`B12 ${fmt(b12)}`); }
      if ((iron != null && iron < 60) || (tsat != null && tsat < 15)) { s -= 10; notes.push('iron markers low'); }
    }
    push('nutrition', 'Nutrition markers', s, notes.length ? notes.join(', ') : 'No nutrition markers yet');
  }

  // organs: liver + kidney
  {
    const alt = val(ctx, 'alt');
    const egfr = val(ctx, 'egfr');
    const creat = val(ctx, 'creatinine');
    const ua = val(ctx, 'uric_acid');
    let s: number | null = null;
    const notes: string[] = [];
    if (alt != null || egfr != null || creat != null || ua != null) {
      s = 100;
      if (alt != null && alt > 35) { s -= clamp((alt - 35) * 1.0, 0, 30); notes.push(`ALT ${fmt(alt)}`); }
      if (egfr != null && egfr < 90) { s -= egfr < 60 ? clamp((60 - egfr) * 1.5, 0, 30) : 5; notes.push(`eGFR ${fmt(egfr)}`); }
      if (creat != null && (creat > 1.3 || creat < 0.6)) { s -= 8; notes.push(`creatinine ${fmt(creat)}`); }
      if (ua != null && ua > 6) { s -= clamp((ua - 6) * 20, 0, 15); notes.push(`uric acid ${fmt(ua)}`); }
    }
    push('organs', 'Liver & kidneys', s, notes.length ? notes.join(', ') : 'No organ markers yet');
  }

  // lifestyle
  {
    const survey = input.survey ?? null;
    let s: number | null = null;
    const notes: string[] = [];
    const hasAny =
      w.activityMinPerWeek != null ||
      w.sleepAvg != null ||
      (survey && (survey.walkMinutesPerDay != null || survey.sleepQuality != null || survey.stressLevel != null)) != null ||
      input.adherencePct != null ||
      (input.profile.smoking ?? '') !== '';
    if (hasAny) {
      s = 100;
      let moved = false;
      const walkSurvey = survey?.walkMinutesPerDay;
      const weekly = w.activityMinPerWeek ?? (walkSurvey != null ? walkSurvey * 7 : null);
      if (weekly != null) {
        s -= clamp(((150 - weekly) / 150) * 40, 0, 40);
        notes.push(`~${Math.round(weekly)} min activity/wk`);
        moved = true;
      }
      const sleep = w.sleepAvg ?? input.profile.sleepHours ?? null;
      if (sleep != null && sleep < 7) {
        s -= clamp((7 - sleep) * 10, 0, 25);
        notes.push(`sleep ${fmt(round1(sleep))}h`);
        moved = true;
      }
      if (survey?.sleepQuality === 'disturbed') { s -= 5; moved = true; }
      if (survey?.sleepQuality === 'poor') { s -= 10; moved = true; }
      if (survey?.stressLevel != null && survey.stressLevel >= 4) { s -= 5; notes.push('high stress'); moved = true; }
      if (input.adherencePct != null && input.adherencePct < 80) {
        s -= clamp((80 - input.adherencePct) * 0.5, 0, 15);
        notes.push(`med adherence ${Math.round(input.adherencePct)}%`);
        moved = true;
      }
      const sm = (input.profile.smoking ?? '').toLowerCase();
      if (sm && sm !== 'never' && sm !== 'no' && sm !== 'non-smoker') { s -= 15; notes.push('smoking'); moved = true; }
      if (!moved) notes.push('habits look steady');
    }
    push('lifestyle', 'Lifestyle', s, notes.length ? notes.join(', ') : 'Log activity/sleep to score this');
  }

  const weights: Record<string, number> = {
    glycemic: 0.25, lipids: 0.22, inflammation: 0.1, nutrition: 0.08, organs: 0.1, lifestyle: 0.25,
  };
  let wsum = 0;
  let acc = 0;
  for (const c of comps) {
    const wt = weights[c.key] ?? 0.1;
    acc += c.score * wt;
    wsum += wt;
  }
  const overall = wsum > 0 ? Math.round(acc / wsum) : 50;
  const label =
    overall >= 85 ? 'Thriving' :
    overall >= 70 ? 'Stable - room to grow' :
    overall >= 55 ? 'Needs attention' :
    'Act now';
  return { overall, label, components: comps };
}

// ---------------------------------------------------------------------------
// Findings (ordered rules; final rank = severity order)
// ---------------------------------------------------------------------------

function buildFindings(
  ctx: LabCtx,
  w: Windows,
  input: IntelligenceInput,
  diabetic: boolean,
  meds: MedClasses,
): { findings: Omit<PriorityFinding, 'rank'>[]; positives: string[] } {
  const out: Omit<PriorityFinding, 'rank'>[] = [];
  const positives: string[] = [];
  const female = isFemale(input.profile.gender);
  const age = input.profile.age ?? null;

  const latestPanel = ctx.panelDates[0] ?? null;

  // ---- 1. Glycemic ----
  {
    const a1c = lab(ctx, 'hba1c');
    const fbg = lab(ctx, 'fbg');
    if (a1c != null) {
      const v = a1c.latest.value;
      const worsening = a1c.series.length >= 2 && a1c.latest.value > a1c.series[0].value;
      let severity: Severity = 'watch';
      if (v >= 9) severity = 'critical';
      else if (v >= 7.5) severity = 'high';
      else if (v >= 6.5) severity = worsening ? 'high' : 'moderate';
      else if (v >= 5.7) severity = 'watch';
      if (severity !== 'watch' || v >= 5.7) {
        const evidence = [
          `HbA1c ${fmt(v)}% (lab ref ${fmt(a1c.latest.refLow ?? a1c.def.refLow ?? 4.2)}-${fmt(a1c.latest.refHigh ?? a1c.def.refHigh ?? 5.7)}%)`,
          `Estimated average glucose ~${eAG(v)} mg/dL`,
        ];
        if (fbg != null) evidence.push(`Fasting glucose ${fmt(fbg.latest.value)} mg/dl (ref 70-100)`);
        if (w.glucoseAvg != null) evidence.push(`Your logged 14-day average: ${Math.round(w.glucoseAvg)} mg/dL, ${w.glucoseHighs} reading${w.glucoseHighs === 1 ? '' : 's'} above 180`);
        out.push({
          severity,
          area: 'glycemic',
          areaLabel: 'Blood sugar',
          title: v >= 6.5 ? 'Blood-sugar control has slipped past the diabetes line' : 'Blood sugar is drifting into the pre-diabetes zone',
          finding:
            v >= 6.5
              ? `HbA1c is ${fmt(v)}%${worsening ? ' and the trend is upward' : ''}. Diabetes is defined at 6.5%, and most adults with diabetes aim below 7% - ${diabetic ? 'you are above your usual target' : 'this range needs a doctor confirmed diagnosis and plan'}.`
              : `HbA1c is ${fmt(v)}% - above the normal ceiling of 5.7%, the band doctors call pre-diabetes.`,
          whyItMatters:
            'HbA1c reflects roughly 3 months of average glucose. Every 0.5-point drop measurably lowers the risk of eye, kidney, nerve and heart complications - and the food + post-meal walking levers below are exactly the ones that move it.',
          evidence,
          trendNote: trendNoteFor(a1c),
          doNow: 'Walk 10-15 minutes after your two biggest meals, starting today - it visibly flattens the glucose curve in this app.',
          window: 'Start today; retest HbA1c in 90 days',
        });
      }
    } else if (w.glucoseAvg != null && w.glucoseAvg >= 140) {
      out.push({
        severity: 'moderate',
        area: 'glycemic',
        areaLabel: 'Blood sugar',
        title: 'Logged glucose is running high',
        finding: `Your 14-day logged average is ${Math.round(w.glucoseAvg)} mg/dL with ${w.glucoseHighs} reading${w.glucoseHighs === 1 ? '' : 's'} above 180.`,
        whyItMatters: 'Averages above ~140 mg/dL over months translate into a rising HbA1c. Import a lab panel to anchor this against HbA1c.',
        evidence: [`${w.glucoseIn14} readings in 14 days`],
        trendNote: 'No lab HbA1c on file yet',
        doNow: 'Add a 10-minute walk after lunch and dinner and watch the post-meal numbers drop.',
        window: 'Start today',
      });
    }
  }

  // ---- 2. Lipids / ASCVD ----
  {
    const apoB = lab(ctx, 'apo_b');
    const ldl = lab(ctx, 'ldl');
    const nonHdl = lab(ctx, 'non_hdl');
    const ratio = lab(ctx, 'chol_hdl_ratio');
    const apoRatio = lab(ctx, 'apo_ratio');
    const tc = lab(ctx, 'total_cholesterol');
    const hdl = lab(ctx, 'hdl');
    const tg = lab(ctx, 'tg');
    const apoBHigh = apoB != null && (apoB.latest.value > (apoB.latest.refHigh ?? 130));
    const ldlHigh = ldl != null && ldl.latest.value > 100;
    if (apoBHigh || ldlHigh || (nonHdl != null && nonHdl.latest.value > 160)) {
      const evidence: string[] = [];
      if (apoB != null) evidence.push(`ApoB ${fmt(apoB.latest.value)} mg/dl (ref up to ${fmt(apoB.latest.refHigh ?? 130)}) - counts the actual atherogenic particles`);
      if (ldl != null) evidence.push(`LDL ${fmt(ldl.latest.value)} mg/dl (optimal <100)`);
      if (tc != null) evidence.push(`Total cholesterol ${fmt(tc.latest.value)} mg/dl (desirable <200)`);
      if (nonHdl != null) evidence.push(`Non-HDL ${fmt(nonHdl.latest.value)} mg/dl (goal <160)`);
      if (ratio != null) evidence.push(`Total-chol/HDL ${fmt(ratio.latest.value)} (ref ${fmt(ratio.latest.refLow ?? 3.3)}-${fmt(ratio.latest.refHigh ?? 4.4)})`);
      if (apoRatio != null && apoRatio.latest.value > 1.49) {
        evidence.push(`ApoB/ApoA1 ratio ${fmt(apoRatio.latest.value)} - for women, above ~1.5 is roughly twice-average cardiovascular risk (Wallach's framing)`);
      }
      if (tg != null && tg.latest.value > 150) evidence.push(`Triglycerides ${fmt(tg.latest.value)} mg/dl (desirable <150)`);
      const severity: Severity = apoB != null && apoB.latest.value > 195 ? 'high' : 'moderate';
      out.push({
        severity,
        area: 'lipids',
        areaLabel: 'Cholesterol & heart risk',
        title: apoBHigh ? 'ApoB is the number to watch - cholesterol particles are running high' : 'Cholesterol is elevated',
        finding: `${
          apoBHigh ? `ApoB ${fmt(apoB!.latest.value)} is well above the 130 ceiling` : `LDL ${fmt(ldl?.latest.value ?? 0)} is above optimal`
        }${ldlHigh && apoBHigh ? ', and LDL is high too' : ''}. ${
          meds.statin.length ? 'You are already on a statin - these levels while treated are worth a medication review.' : 'No cholesterol medication is on your list, so this is a conversation to have with your doctor.'
        }`,
        whyItMatters:
          'ApoB counts the LDL-family particles that actually bury in artery walls. With high blood sugar and hsCRP in the same report, this triad (diabetes + ApoB + inflammation) is the classic pattern cardiologists treat most aggressively - and also the one that responds fastest to the food changes below.',
        evidence,
        trendNote: ldl ? trendNoteFor(ldl) : tc ? trendNoteFor(tc) : 'Single reading on file',
        doNow: meds.statin.length
          ? 'Book a medication review with your doctor and carry this report.'
          : 'Two swaps today: millet instead of white rice at lunch, and no deep-fried snack this week - then ask your doctor about therapy at the next visit.',
        window: 'Doctor conversation this month; retest in 90 days',
      });
    }
    if (hdl != null && hdl.latest.value < 40) {
      out.push({
        severity: 'watch',
        area: 'lipids',
        areaLabel: 'Cholesterol & heart risk',
        title: 'HDL (protective cholesterol) is low',
        finding: `HDL is ${fmt(hdl.latest.value)} mg/dl; the lab floor is ${fmt(hdl.latest.refLow ?? 40)}.`,
        whyItMatters: 'HDL is the clean-up crew for cholesterol. It rises most reliably with daily movement, quitting smoking and losing a little weight.',
        evidence: [`HDL ${fmt(hdl.latest.value)} mg/dl (ref ${fmt(hdl.latest.refLow ?? 40)}-${fmt(hdl.latest.refHigh ?? 60)})`],
        trendNote: trendNoteFor(hdl, 'rising', 'falling'),
        doNow: 'A 30-minute brisk walk most days is the single best HDL raiser.',
        window: 'Recheck with the next panel',
      });
    }
  }

  // ---- 3. Inflammation ----
  {
    const crp = lab(ctx, 'hs_crp');
    if (crp != null && crp.latest.value > 1) {
      const v = crp.latest.value;
      const chronic = crp.series.filter((p) => p.value > 1).length >= 2;
      const severity: Severity = v >= 5 ? 'moderate' : 'watch';
      out.push({
        severity,
        area: 'inflammation',
        areaLabel: 'Inflammation',
        title: v >= 5 ? 'hsCRP is moderately high - a slow-burning fire' : 'hsCRP is above the ideal',
        finding: `High-sensitivity CRP is ${fmt(v)} mg/L against a goal under 1${chronic ? ', and it has been above 1 on more than one panel - this is a pattern, not a one-off' : ''}.`,
        whyItMatters:
          'Persistent low-grade inflammation stiffens arteries and amplifies every other risk in this report. The usual Indian-diet culprits: deep-fried snacks, sugary drinks, and missing vegetables; gum disease and poor sleep also feed it.',
        evidence: [
          `hsCRP ${fmt(v)} mg/L (goal <1)`,
          ...(chronic ? [`${crp.series.length} readings on file, all above 1`] : []),
        ],
        trendNote: trendNoteFor(crp),
        doNow: 'This week: zero deep-fried snacks, add one extra vegetable to lunch and dinner, and book a dental check-up (gum inflammation is a classic hidden driver).',
        window: 'Recheck with the next panel',
      });
    }
  }

  // ---- 4. Homocysteine ----
  {
    const hcy = lab(ctx, 'homocysteine');
    if (hcy != null && hcy.latest.value > 13.9) {
      const v = hcy.latest.value;
      const b12 = lab(ctx, 'vitamin_b12');
      const onFolate = meds.folate.length > 0;
      out.push({
        severity: v > 20 ? 'moderate' : 'watch',
        area: 'homocysteine',
        areaLabel: 'Homocysteine',
        title: 'Homocysteine is elevated',
        finding: `Homocysteine is ${fmt(v)} umol/L (ref up to ${fmt(hcy.latest.refHigh ?? 13.9)}). ${
          b12 != null && b12.latest.value >= 211 ? 'Your B12 is comfortably normal, so the gap is more likely folate or B6.' : ''
        }${onFolate ? ' You already take folate - levels this high despite it deserve a doctor review.' : ''}`,
        whyItMatters:
          'High homocysteine roughens the blood-vessel lining and raises clot risk - it multiplies the cardiovascular risk from the cholesterol findings above. It is also one of the most fixable numbers on this page.',
        evidence: [
          `Homocysteine ${fmt(v)} umol/L (ref ${fmt(hcy.latest.refLow ?? 3.7)}-${fmt(hcy.latest.refHigh ?? 13.9)})`,
          ...(b12 ? [`B12 ${fmt(b12.latest.value)} pg/ml (${b12.latest.value >= 211 ? 'normal' : 'low'})`] : []),
        ],
        trendNote: trendNoteFor(hcy),
        doNow: 'Put one leafy green on the plate daily - palak, methi, gongura - and ask your doctor about a B-complex at the next visit.',
        window: 'Retest in 8-12 weeks',
      });
    }
  }

  // ---- 5. Liver ----
  {
    const alt = lab(ctx, 'alt');
    const nafld = lab(ctx, 'nafld');
    const altHigh = alt != null && alt.latest.value > (alt.latest.refHigh ?? 35);
    const altDropping = alt != null && alt.series.length >= 2 && alt.latest.value < alt.series[0].value;
    if (altHigh) {
      const v = alt.latest.value;
      const ratioOver = v / (alt.latest.refHigh ?? 35);
      out.push({
        severity: ratioOver >= 2 ? 'moderate' : 'watch',
        area: 'liver',
        areaLabel: 'Liver',
        title: 'Liver enzyme (ALT) is mildly elevated',
        finding: `ALT is ${fmt(v)} U/L against a ceiling of ${fmt(alt!.latest.refHigh ?? 35)}${altDropping ? ' - and it is coming down compared with your previous panel, which is good' : ''}. ${
          nafld != null && nafld.latest.value < -1.455
            ? 'The NAFLD fibrosis score is reassuringly low (-1.72), so advanced scarring is unlikely.'
            : ''
        }`,
        whyItMatters:
          'A mildly raised ALT in this context is usually fatty-liver strain - the metabolic twin of high sugars and cholesterol. It recovers well when the sugar, oil and weight levers move; persistent rises need a doctor look.',
        evidence: [
          `ALT ${fmt(v)} U/L (ref ${fmt(alt!.latest.refLow ?? 3)}-${fmt(alt!.latest.refHigh ?? 35)})`,
          ...(nafld ? [`NAFLD fibrosis score ${fmt(nafld.latest.value)} (${nafld.latest.value < -1.455 ? 'low likelihood of advanced fibrosis' : nafld.latest.value > 0.675 ? 'high likelihood - needs hepatology' : 'indeterminate'})`] : []),
        ],
        trendNote: trendNoteFor(alt),
        doNow: 'Cut sugary drinks and deep-fried snacks completely this month - the liver is the first organ to thank you.',
        window: 'Repeat LFT in 12 weeks',
      });
    } else if (nafld != null && nafld.latest.value > 0.675) {
      out.push({
        severity: 'high',
        area: 'liver',
        areaLabel: 'Liver',
        title: 'NAFLD score suggests possible advanced fibrosis',
        finding: `The NAFLD fibrosis score is ${fmt(nafld.latest.value)}, in the band associated with advanced fibrosis.`,
        whyItMatters: 'This is a screening score, not a diagnosis, but it crosses the threshold where a liver specialist (hepatology) review is the standard next step.',
        evidence: [`NAFLD fibrosis score ${fmt(nafld.latest.value)} (>0.675 = high likelihood band)`],
        trendNote: trendNoteFor(nafld),
        doNow: 'Ask your physician for a liver evaluation (fibroscan/elastography is the usual next test).',
        window: 'Book within 2-4 weeks',
      });
    }
  }

  // ---- 6. Hematology: anemia / microcytosis ----
  {
    const hb = lab(ctx, 'hemoglobin');
    const mcv = lab(ctx, 'mcv');
    const mch = lab(ctx, 'mch');
    const rbc = lab(ctx, 'rbc');
    const iron = lab(ctx, 'iron');
    const tsat = lab(ctx, 'transferrin_sat');
    const ferritin = lab(ctx, 'ferritin');
    const hbLow = hb != null && hb.latest.value < (hb.latest.refLow ?? (female ? 12 : 13));
    const microcytic = (mcv != null && mcv.latest.value < (mcv.latest.refLow ?? 83)) || (mch != null && mch.latest.value < (mch.latest.refLow ?? 27));
    const ironLow = (iron != null && iron.latest.value < (iron.latest.refLow ?? 60)) || (tsat != null && tsat.latest.value < (tsat.latest.refLow ?? 15)) || (ferritin != null && ferritin.latest.value < (ferritin.latest.refLow ?? 13));
    if (hbLow) {
      out.push({
        severity: 'moderate',
        area: 'hematology',
        areaLabel: 'Blood',
        title: microcytic ? 'Anaemia with small red cells' : 'Haemoglobin is low',
        finding: `Haemoglobin is ${fmt(hb!.latest.value)} g/dL${microcytic ? ' with small, pale red cells (low MCV/MCH)' : ''}. ${
          microcytic && !ironLow ? 'Iron studies look normal, which points away from simple iron deficiency.' : ''
        }`,
        whyItMatters: microcytic && !ironLow
          ? 'Small cells with normal iron in our population often carry beta-thalassaemia trait - harmless for you, important to know before any future surgery or family planning, and it explains why iron tablets will not fix it.'
          : 'Anaemia starves energy and breathlessness tolerance. The cause needs a doctor visit - iron is only one of several.',
        evidence: [
          `Haemoglobin ${fmt(hb!.latest.value)} g/dL (ref floor ${fmt(hb!.latest.refLow ?? (female ? 12 : 13))})`,
          ...(mcv ? [`MCV ${fmt(mcv.latest.value)} fL (ref floor ${fmt(mcv.latest.refLow ?? 83)})`] : []),
          ...(mch ? [`MCH ${fmt(mch.latest.value)} pg (ref floor ${fmt(mch.latest.refLow ?? 27)})`] : []),
          ...(iron ? [`Serum iron ${fmt(iron.latest.value)} ug/dl`] : []),
        ],
        trendNote: trendNoteFor(hb!),
        doNow: 'Ask your doctor about a haemoglobin electrophoresis (HbA2) if iron studies are normal - one test settles it.',
        window: 'At your next doctor visit',
      });
    } else if (microcytic) {
      // Lakshmi case: no anaemia, small cells, iron normal -> thal trait pattern
      out.push({
        severity: 'watch',
        area: 'hematology',
        areaLabel: 'Blood',
        title: 'Small red blood cells without anaemia',
        finding: `MCV ${fmt(mcv!.latest.value)} fL${mch ? ` and MCH ${fmt(mch.latest.value)} pg` : ''} are below range, but haemoglobin ${
          hb != null ? `${fmt(hb.latest.value)} g/dL is fine` : 'is not low'
        }${ironLow ? '' : ' and iron studies are normal'}.`,
        whyItMatters: ironLow
          ? 'Small cells usually mean early iron deficiency - worth a ferritin check and a diet pass on iron sources.'
          : 'Normal iron plus small, numerous red cells (RBC ' + (rbc ? fmt(rbc.latest.value) : '-') + ') is the classic quiet carrier pattern of beta-thalassaemia trait. It is harmless day-to-day but important for family planning and before surgery - and iron tablets do not change it.',
        evidence: [
          ...(mcv ? [`MCV ${fmt(mcv.latest.value)} fL (ref ${fmt(mcv.latest.refLow ?? 83)}-${fmt(mcv.latest.refHigh ?? 101)})`] : []),
          ...(mch ? [`MCH ${fmt(mch.latest.value)} pg (ref ${fmt(mch.latest.refLow ?? 27)}-${fmt(mch.latest.refHigh ?? 32)})`] : []),
          ...(rbc ? [`RBC count ${fmt(rbc.latest.value)} 10^6/ul (ref up to ${fmt(rbc.latest.refHigh ?? 4.8)})`] : []),
          ...(iron ? [`Serum iron ${fmt(iron.latest.value)} ug/dl (normal)`] : []),
          ...(tsat ? [`Transferrin saturation ${fmt(tsat.latest.value)}% (normal)`] : []),
        ],
        trendNote: mcv ? trendNoteFor(mcv) : 'Single reading on file',
        doNow: ironLow
          ? 'Add one iron-rich food daily (dates + lemon-aided palak) and ask for a ferritin test.'
          : 'Mention a one-time HbA2 electrophoresis to your doctor - it settles the thalassaemia-trait question for life.',
        window: 'At your next doctor visit',
      });
    }
  }

  // ---- 7. Uric acid ----
  {
    const ua = lab(ctx, 'uric_acid');
    if (ua != null && ua.latest.value >= (ua.latest.refHigh ?? 6)) {
      const v = ua.latest.value;
      out.push({
        severity: 'watch',
        area: 'kidney',
        areaLabel: 'Uric acid',
        title: 'Uric acid is at the ceiling',
        finding: `Uric acid ${fmt(v)} mg/dl is sitting at the top of the range${ua.series.length >= 2 && ua.latest.value > ua.series[0].value ? ' and has been creeping up' : ''}.`,
        whyItMatters: 'Above the ceiling, crystal risk (gout, kidney stones) starts rising - especially alongside the metabolic pattern in this report. Sugary drinks and beer are the biggest dietary pushes.',
        evidence: [`Uric acid ${fmt(v)} mg/dl (ref ${fmt(ua.latest.refLow ?? 2.6)}-${fmt(ua.latest.refHigh ?? 6)})`],
        trendNote: trendNoteFor(ua),
        doNow: 'Swap any soft drink or packaged juice for water or buttermilk this week; keep 2.5-3 L fluids daily.',
        window: 'Recheck with the next panel',
      });
    }
  }

  // ---- 8. Vitamin D ----
  {
    const vd = lab(ctx, 'vitamin_d');
    if (vd != null) {
      const v = vd.latest.value;
      const postMenopause = female && (input.survey?.menopause === 'post' || (age ?? 0) >= 55);
      const atFloor = v >= 30 && v < 33 && postMenopause;
      if (v < 30 || atFloor) {
        out.push({
          severity: v < 20 ? 'moderate' : 'watch',
          area: 'nutrition',
          areaLabel: 'Vitamin D',
          title: v < 20 ? 'Vitamin D is deficient' : atFloor ? 'Vitamin D is sitting at the floor' : 'Vitamin D is just under the floor',
          finding: `Vitamin D 25-OH is ${fmt(v)} ng/ml${postMenopause ? ' - worth taking seriously after menopause' : ''}.`,
          whyItMatters: 'Vitamin D partners with calcium for bone (the post-menopause years lose bone fastest), and low D drags muscle strength and mood. Levels in the 40s are where most doctors aim.',
          evidence: [`Vitamin D ${fmt(v)} ng/ml (sufficiency >=30)`],
          trendNote: trendNoteFor(vd),
          doNow: '15-20 minutes of morning sun on arms most days, and ask your doctor for a dosed supplement (weekly doses are the Indian convention).',
          window: 'Recheck in 6 months',
        });
      }
    }
  }

  // ---- 9. Thyroid ----
  {
    const tsh = lab(ctx, 'tsh');
    const t4 = lab(ctx, 't4');
    if (tsh != null) {
      const v = tsh.latest.value;
      const hi = v > (tsh.latest.refHigh ?? 4.78);
      const lo = v < (tsh.latest.refLow ?? 0.55);
      if (hi || lo) {
        out.push({
          severity: 'moderate',
          area: 'thyroid',
          areaLabel: 'Thyroid',
          title: hi ? 'TSH is high - thyroid running slow' : 'TSH is low - thyroid running hot',
          finding: `TSH ${fmt(v)} uIU/ml is outside ${fmt(tsh.latest.refLow ?? 0.55)}-${fmt(tsh.latest.refHigh ?? 4.78)}${t4 != null ? ` (T4 ${fmt(t4.latest.value)} ug/dl)` : ''}.`,
          whyItMatters: hi
            ? 'An underactive thyroid quietly raises weight, cholesterol and tiredness - and it amplifies the cholesterol findings above. Very treatable once confirmed.'
            : 'An overactive thyroid drives palpitations, weight loss and glucose swings. Needs prompt doctor review.',
          evidence: [`TSH ${fmt(v)} uIU/ml`, ...(t4 ? [`T4 ${fmt(t4.latest.value)} ug/dl`] : [])],
          trendNote: trendNoteFor(tsh),
          doNow: 'See your physician for a repeat TSH with free T4 - one visit settles whether treatment is needed.',
          window: 'Book within 2 weeks',
        });
      }
    }
  }

  // ---- 10. Kidney ----
  {
    const egfr = lab(ctx, 'egfr');
    const creat = lab(ctx, 'creatinine');
    if (egfr != null && egfr.latest.value < 60) {
      out.push({
        severity: 'high',
        area: 'kidney',
        areaLabel: 'Kidneys',
        title: 'Kidney filtration is reduced',
        finding: `eGFR ${fmt(egfr.latest.value)} mL/min (below 60 for 3+ months is the chronic-kidney-disease threshold).`,
        whyItMatters: 'Kidney filtration below 60 changes medication dosing and blood-pressure targets. With diabetes in the picture, kidneys are checked at least twice a year.',
        evidence: [`eGFR ${fmt(egfr.latest.value)}`, ...(creat ? [`Creatinine ${fmt(creat.latest.value)} mg/dl`] : [])],
        trendNote: trendNoteFor(egfr, 'rising', 'falling'),
        doNow: 'Book a doctor visit; ask for urine albumin-creatinine ratio (uACR) alongside the next panel.',
        window: 'Book within 2 weeks',
      });
    }
  }

  // ---- 11. Blood pressure (logged data) ----
  if (w.bpAvg != null) {
    const { s, d } = w.bpAvg;
    if (s >= 140 || d >= 90) {
      out.push({
        severity: s >= 160 || d >= 100 ? 'high' : 'moderate',
        area: 'bp',
        areaLabel: 'Blood pressure',
        title: 'Home readings are running high',
        finding: `Your logged average is ${s}/${d} mmHg over the last 14 days.`,
        whyItMatters: 'Sustained readings at this level strain the same arteries the cholesterol findings are already loading. A 7-day diary makes the doctor conversation decisive.',
        evidence: [`14-day average ${s}/${d} mmHg`, 'Clinic threshold 140/90'],
        trendNote: 'Home-logged average',
        doNow: 'Measure mornings and evenings seated for 7 days and note them (this app logs BP) - then review with your doctor.',
        window: 'Doctor review after 7 days of readings',
      });
    } else if (s >= 130 || d >= 85) {
      out.push({
        severity: 'watch',
        area: 'bp',
        areaLabel: 'Blood pressure',
        title: 'Blood pressure is borderline',
        finding: `Your logged average is ${s}/${d} mmHg - under the clinic line, but above the comfortable zone (120/80).`,
        whyItMatters: 'Borderline numbers respond well to salt trimming, walking and sleep - the same levers as the rest of this report.',
        evidence: [`14-day average ${s}/${d} mmHg`],
        trendNote: 'Home-logged average',
        doNow: 'Trim added salt (pickles, papad, packaged snacks) for two weeks and keep logging.',
        window: 'Keep watching',
      });
    }
  }

  // ---- 12. Weight / BMI (Asian-Indian thresholds) ----
  {
    const h = input.profile.heightCm;
    const kg = input.profile.weightKg ?? (input.weight && input.weight.length ? input.weight[input.weight.length - 1].kg : null);
    if (h != null && kg != null && h > 80) {
      const bmi = kg / Math.pow(h / 100, 2);
      const waist = input.profile.waistCm ?? null;
      const waistHigh = waist != null && waist > (female ? 80 : 90);
      if (bmi >= 23) {
        const band = bmi >= 27.5 ? 'the obese band for Indians (BMI >= 27.5)' : 'the overweight band for Indians (BMI 23-27.5)';
        out.push({
          severity: bmi >= 27.5 ? 'moderate' : 'watch',
          area: 'weight',
          areaLabel: 'Weight',
          title: 'Weight is the master lever',
          finding: `BMI is ${fmt(round1(bmi))} - ${band}${waistHigh ? `, and waist ${fmt(waist!)} cm is above the ${female ? '80' : '90'} cm Indian cutoff` : ''}.`,
          whyItMatters: 'Losing just 5-10% of body weight typically pulls HbA1c down 0.5-1 point, triglycerides 20-30%, and eases blood pressure and the liver - it multiplies every other fix in this report.',
          evidence: [`Weight ${fmt(kg)} kg, height ${fmt(h)} cm, BMI ${fmt(round1(bmi))}`, ...(waist ? [`Waist ${fmt(waist)} cm (Indian cutoff ${female ? 80 : 90} cm)`] : [])],
          trendNote: 'Current profile',
          doNow: 'Start with the plate rule below and 30-minute walks - a 4-5 kg change in 90 days is a realistic, meaningful target.',
          window: 'Weigh weekly, same day, same time',
        });
      }
    }
  }

  // ---- 13. Lifestyle gaps ----
  {
    const survey = input.survey ?? null;
    const walk = survey?.walkMinutesPerDay;
    const weekly = w.activityMinPerWeek ?? (walk != null ? walk * 7 : null);
    if (weekly != null && weekly < 90) {
      out.push({
        severity: 'moderate',
        area: 'activity',
        areaLabel: 'Movement',
        title: 'Movement is the missing medicine',
        finding: `You are averaging about ${Math.round(weekly)} minutes of activity a week - under an hour and a half.`,
        whyItMatters: 'Below ~90 min/week, insulin sensitivity, HDL and inflammation all stall. The plan below builds to 150+ without a gym.',
        evidence: [`~${Math.round(weekly)} min/week logged or reported (target 150+)`],
        trendNote: 'Last 14 days',
        doNow: 'Two 10-minute walks tomorrow - after lunch and after dinner. That is the whole ask.',
        window: 'Start today',
      });
    }
    const sleep = w.sleepAvg ?? input.profile.sleepHours ?? null;
    if (sleep != null && sleep < 6.5) {
      out.push({
        severity: 'watch',
        area: 'sleep',
        areaLabel: 'Sleep',
        title: 'Sleep is too short for recovery',
        finding: `Average sleep is ${fmt(round1(sleep))} hours - under the 7-8 hour recovery zone.`,
        whyItMatters: 'Short sleep raises next-morning fasting glucose and inflames hsCRP - it quietly works against everything else in this report.',
        evidence: [`Average ${fmt(round1(sleep))} h vs 7-8 h goal`],
        trendNote: 'Last 14 days',
        doNow: 'Fix a bedtime alarm 8.5 hours before you must wake; screens off 30 minutes before it.',
        window: 'Two weeks to reset',
      });
    }
    if (input.adherencePct != null && input.adherencePct < 80) {
      out.push({
        severity: 'moderate',
        area: 'adherence',
        areaLabel: 'Medication routine',
        title: 'Medication timing is slipping',
        finding: `Adherence over the window is ${Math.round(input.adherencePct)}% - some doses are being missed or not logged.`,
        whyItMatters: 'For metformin and BP tablets, steady levels are the whole point - missed doses show up as glucose and BP swings within days.',
        evidence: [`Adherence ${Math.round(input.adherencePct)}% (goal >90%)`],
        trendNote: 'Logged window',
        doNow: 'Anchor tablets to a habit you never miss - right after brushing, or with the first sip of morning tea.',
        window: 'This week',
      });
    }
  }

  // ---- Positives ----
  {
    const hdl = lab(ctx, 'hdl');
    if (hdl != null && hdl.series.length >= 2 && hdl.latest.value > hdl.series[0].value) {
      positives.push(`HDL (good cholesterol) climbed from ${fmt(hdl.series[0].value)} to ${fmt(hdl.latest.value)} mg/dl - keep doing whatever is driving this`);
    }
    const tg = lab(ctx, 'tg');
    if (tg != null && tg.series.length >= 2 && tg.latest.value < tg.series[0].value && tg.series[0].value > 150) {
      positives.push(`Triglycerides came down from ${fmt(tg.series[0].value)} to ${fmt(tg.latest.value)} mg/dl`);
    }
    const egfr = lab(ctx, 'egfr');
    if (egfr != null && egfr.latest.value >= 90) positives.push(`Kidney filtration is healthy (eGFR ${fmt(egfr.latest.value)})`);
    const creat = lab(ctx, 'creatinine');
    if (egfr == null && creat != null && creat.latest.value >= (creat.latest.refLow ?? 0.6) && creat.latest.value <= (creat.latest.refHigh ?? 1.3)) {
      positives.push(`Kidney markers are in range (creatinine ${fmt(creat.latest.value)})`);
    }
    const tsh = lab(ctx, 'tsh');
    if (tsh != null && tsh.latest.value >= (tsh.latest.refLow ?? 0.55) && tsh.latest.value <= (tsh.latest.refHigh ?? 4.78)) {
      positives.push(`Thyroid is balanced (TSH ${fmt(tsh.latest.value)})`);
    }
    const b12 = lab(ctx, 'vitamin_b12');
    if (b12 != null && b12.latest.value >= (b12.latest.refLow ?? 211)) positives.push(`Vitamin B12 is healthy (${fmt(b12.latest.value)} pg/ml)`);
    const hb = lab(ctx, 'hemoglobin');
    if (hb != null && hb.latest.value >= (hb.latest.refLow ?? 12)) positives.push(`Haemoglobin is healthy (${fmt(hb.latest.value)} g/dL) - no anaemia`);
    const alt = lab(ctx, 'alt');
    if (alt != null && alt.series.length >= 2 && alt.latest.value < alt.series[0].value) {
      positives.push(`Liver enzyme ALT is coming down (${fmt(alt.series[0].value)} -> ${fmt(alt.latest.value)} U/L)`);
    } else if (alt != null && alt.latest.value <= (alt.latest.refHigh ?? 35)) {
      positives.push(`Liver enzymes are in range (ALT ${fmt(alt.latest.value)} U/L)`);
    }
    const nafld = lab(ctx, 'nafld');
    if (nafld != null && nafld.latest.value < -1.455) positives.push(`NAFLD fibrosis score ${fmt(nafld.latest.value)} - low likelihood of advanced liver scarring`);
    const platelets = lab(ctx, 'platelets');
    if (platelets != null && platelets.latest.value >= 150 && platelets.latest.value <= 410) positives.push(`Platelets normal (${fmt(platelets.latest.value)})`);
    if (w.bpAvg != null && w.bpAvg.s < 130 && w.bpAvg.d < 85) positives.push(`Home BP average is comfortable (${w.bpAvg.s}/${w.bpAvg.d})`);
    if (input.adherencePct != null && input.adherencePct >= 90) positives.push(`Medication adherence ${Math.round(input.adherencePct)}% - excellent routine`);
    if (latestPanel) positives.push(`${ctx.labCount} results across ${ctx.panelDates.length} dated panels - a proper trend story, not a snapshot`);
  }

  // severity ordering (stable within same severity)
  const order: Record<Severity, number> = { critical: 0, high: 1, moderate: 2, watch: 3 };
  out.sort((a, b) => order[a.severity] - order[b.severity]);
  return { findings: out, positives };
}
// ---------------------------------------------------------------------------
// Trends
// ---------------------------------------------------------------------------

const TREND_INTERPRETATION: Record<string, (up: boolean, label: string) => string> = {
  hba1c: (up) =>
    up
      ? 'A rising HbA1c means average sugar has been creeping up for months. Post-meal walks and the plate rule are the fastest brakes.'
      : 'A falling HbA1c is the headline win - it compounds into lower complication risk. Guard the habits that did it.',
  total_cholesterol: (up) =>
    up ? 'Total cholesterol is drifting up - the swaps below target this directly.' : 'Total cholesterol is coming down - the direction matters more than any single value.',
  ldl: (up) =>
    up ? 'LDL is trending away from the safe zone; fibre (dal, millets, greens) and oil changes are the food-side levers.' : 'LDL is moving the right way - keep the routine that did it and retest at 90 days.',
  hdl: (up) =>
    up ? 'HDL rising is genuinely hard to do - movement and better fats are working.' : 'HDL drifting down usually means less movement; the walking plan protects it.',
  tg: (up) =>
    up ? 'Triglycerides track sugar, alcohol and refined carbs closely - this trend follows the plate.' : 'Falling triglycerides show the sugar/refined-carb load is easing.',
  apo_b: (up) =>
    up ? 'ApoB trending up is the particle count rising - the number cardiologists watch hardest.' : 'ApoB easing down means fewer atherogenic particles in circulation.',
  hs_crp: (up) =>
    up ? 'Inflammation is climbing - check sleep, gums and fried-food frequency.' : 'Inflammation is cooling - recovery is showing up in the blood.',
  vitamin_d: (up) =>
    up ? 'Vitamin D is recovering - sun and supplements are doing their job.' : 'Vitamin D is slipping - protect the morning-sun habit and ask about a dosed supplement.',
  alt: (up) =>
    up ? 'Liver enzyme rising usually means fatty-liver strain is increasing; sugar and oil are the levers.' : 'Liver enzyme easing down - the liver is forgiving when you let it be.',
  uric_acid: (up) =>
    up ? 'Uric acid creeping up raises crystal risk - watch sugary drinks and keep fluids high.' : 'Uric acid is settling - hydration and fewer sweet drinks are working.',
  hemoglobin: (up) =>
    up ? 'Haemoglobin improving means better oxygen-carrying capacity.' : 'Haemoglobin drifting down - worth a doctor look with the next panel.',
  tsh: (up) =>
    up ? 'TSH rising suggests the thyroid is slowing - retest with free T4 before concluding anything.' : 'TSH easing toward mid-range - reassuring.',
  mcv: (up) =>
    up ? 'Red cells are getting larger - B12/folate worth watching.' : 'Red cells are small - the iron/thalassaemia question in the findings covers this.',
};

function buildTrends(ctx: LabCtx): TrendCallout[] {
  const out: TrendCallout[] = [];
  for (const v of ctx.byKey.values()) {
    if (v.series.length < 2) continue;
    const first = v.series[0];
    const last = v.series[v.series.length - 1];
    const pct = first.value !== 0 ? ((last.value - first.value) / Math.abs(first.value)) * 100 : 0;
    const direction: TrendCallout['direction'] = Math.abs(pct) < 2 ? 'flat' : pct > 0 ? 'up' : 'down';
    const higherIsWorse = v.def.higherIsWorse !== false;
    let verdict: TrendVerdict;
    if (direction === 'flat') verdict = 'stable';
    else if (higherIsWorse) verdict = direction === 'up' ? 'worsening' : 'improving';
    else verdict = direction === 'up' ? 'improving' : 'worsening';
    const months = monthsBetween(first.date, last.date);
    const changeNote =
      `${fmt(first.value)} -> ${fmt(last.value)} ${v.def.unit} over ${months} mo (${pct > 0 ? '+' : ''}${Math.round(pct)}%)`;
    const interp =
      TREND_INTERPRETATION[v.def.key]?.(pct > 0, v.def.label) ??
      (pct > 0
        ? `${v.def.label} has risen since ${shortMonthYear(first.date)} - watch it against the reference range.`
        : `${v.def.label} has eased since ${shortMonthYear(first.date)}.`);
    out.push({
      key: v.def.key,
      label: v.def.label,
      unit: v.def.unit,
      direction,
      series: v.series.map((p) => ({ date: p.date, value: p.value })),
      changeNote,
      verdict,
      interpretation: interp,
    });
  }
  out.sort((a, b) => {
    const ia = TESTS.find((t) => t.key === a.key)?.trendInterest ?? 20;
    const ib = TESTS.find((t) => t.key === b.key)?.trendInterest ?? 20;
    return ia - ib;
  });
  return out.slice(0, 8);
}

// ---------------------------------------------------------------------------
// Lifestyle vs medication table
// ---------------------------------------------------------------------------

function buildLmRows(
  ctx: LabCtx,
  w: Windows,
  input: IntelligenceInput,
  diabetic: boolean,
  meds: MedClasses,
): LmRow[] {
  const rows: LmRow[] = [];
  const a1c = val(ctx, 'hba1c');
  const apoB = val(ctx, 'apo_b');
  const ldl = val(ctx, 'ldl');
  const crp = val(ctx, 'hs_crp');
  const hcy = val(ctx, 'homocysteine');
  const alt = val(ctx, 'alt');

  const list = (names: string[]) => (names.length ? names.join(', ') : 'None on your list');

  // Glycemic
  if (diabetic || a1c != null) {
    rows.push({
      area: 'glycemic',
      areaLabel: 'Blood sugar',
      lifestyle: 'Millet-first plates, dal-curd protein, and a 10-15 min walk after your two biggest meals',
      lifestyleEffect: 'Post-meal walking alone blunts glucose spikes ~15-30%; combined food changes typically move HbA1c 0.5-1.0 point over 3 months',
      medication: list(meds.metformin.length ? meds.metformin : meds.sulfonylurea.length ? meds.sulfonylurea : meds.insulin.length ? meds.insulin : []),
      medicationNote: meds.metformin.length
        ? 'Metformin works best on top of these habits; take it as prescribed and report persistent bloating or nausea to your doctor.'
        : meds.sulfonylurea.length
          ? 'Glimepiride/gliclazide can cause lows - never skip meals on them; carry a glucose candy.'
          : meds.insulin.length
            ? 'Insulin + walking: check glucose before unusual activity; lows need treating immediately.'
            : `With HbA1c ${a1c != null ? fmt(a1c) + '% ' : ''}above target, guidelines support reviewing medication options with your doctor - carry this report.`,
    });
  }

  // Lipids
  if (apoB != null || ldl != null) {
    rows.push({
      area: 'lipids',
      areaLabel: 'Cholesterol',
      lifestyle: 'Cut deep-fried to near zero, swap to mustard/olive oil, 30 g+ fibre daily (2 dal servings, millets, greens), fatty fish or flaxseed if non-veg',
      lifestyleEffect: 'This food pattern typically lowers LDL 10-15% and ApoB proportionally - meaningful, though usually not enough alone when ApoB is very high',
      medication: list(meds.statin),
      medicationNote: meds.statin.length
        ? 'You are on a statin - levels still this high on treatment deserve a review (dose or add-on) with your doctor.'
        : 'No cholesterol tablet on your list. With ApoB ' + (apoB != null ? fmt(apoB) : 'high') + ', statin therapy is the standard guideline conversation - a doctor decides, not this app.',
    });
  }

  // Inflammation
  if (crp != null) {
    rows.push({
      area: 'inflammation',
      areaLabel: 'Inflammation (hsCRP)',
      lifestyle: 'Zero fried snacks, 2 extra vegetable servings a day, 7-8 h sleep, dental check-up',
      lifestyleEffect: 'Each of these quietly lowers hsCRP over 6-12 weeks; sleep and gums are the most under-rated',
      medication: list(meds.names.filter((n) => /omega|fish oil/i.test(n))),
      medicationNote: 'No anti-inflammatory medication is appropriate here - this number belongs to food, sleep and teeth.',
    });
  }

  // Homocysteine
  if (hcy != null && hcy > 13.9) {
    rows.push({
      area: 'homocysteine',
      areaLabel: 'Homocysteine',
      lifestyle: 'One leafy green daily (palak, methi, gongura) plus dals and curd - folate-rich, everyday Telugu food',
      lifestyleEffect: 'Folate-rich plates can normalise mild elevations in 8-12 weeks; B12 is already normal for you',
      medication: list(meds.folate.length ? meds.folate : meds.b12.length ? meds.b12 : []),
      medicationNote: meds.folate.length
        ? 'You already take folate - persistently high values despite it warrant a doctor review.'
        : 'A simple B-complex is the usual doctor suggestion here; ask at the next visit rather than self-dosing.',
    });
  }

  // Liver
  if (alt != null && alt > 35) {
    rows.push({
      area: 'liver',
      areaLabel: 'Liver (ALT)',
      lifestyle: 'Zero sugary drinks, no fried food, 4-5% weight drift down, evening meal 3 h before bed',
      lifestyleEffect: 'Fatty-liver enzymes often normalise within 8-12 weeks of exactly these four changes',
      medication: 'None needed',
      medicationNote: 'No liver medication applies - this is a food-and-weight job (and your doctor confirms the trend).',
    });
  }

  // BP
  if (w.bpAvg != null || meds.bp.length > 0) {
    rows.push({
      area: 'bp',
      areaLabel: 'Blood pressure',
      lifestyle: 'Trim pickles/papad/packaged snacks (salt), 30-min walks, 7-8 h sleep',
      lifestyleEffect: 'Salt trimming plus walking commonly drops systolic 5-8 mmHg over a month or two',
      medication: list(meds.bp),
      medicationNote: meds.bp.length
        ? 'Keep the tablet schedule fixed to a daily habit; log BP in this app so the next review uses real data.'
        : 'If home averages stay >=140/90 over 7 days, that is the doctor-visit trigger.',
    });
  }

  // Weight
  const h = input.profile.heightCm;
  const kg = input.profile.weightKg ?? null;
  if (h != null && kg != null && kg / Math.pow(h / 100, 2) >= 23) {
    rows.push({
      area: 'weight',
      areaLabel: 'Weight',
      lifestyle: 'The plate rule below + 150 min/week walking + weekly weigh-in',
      lifestyleEffect: '4-5% loss in 90 days (about 3-4 kg) typically pulls HbA1c, triglycerides, ALT and BP down together',
      medication: 'None needed',
      medicationNote: 'Weight medication is a specialist conversation for later, only if lifestyle plateaus for 6+ months.',
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Diet plan - Indian plate, Mediterranean evidence
// ---------------------------------------------------------------------------

function buildDietPlan(
  ctx: LabCtx,
  input: IntelligenceInput,
): DietPlan {
  const survey = input.survey ?? null;
  const veg = survey?.dietPattern === 'veg';
  const egg = survey?.dietPattern === 'egg';
  const region = (input.profile.region ?? '').toLowerCase();
  const telugu = region.includes('telugu') || region.includes('hyderabadi') || region.includes('south');
  const riceDaily = survey?.riceFrequency === 'daily';
  const sweetsDaily = survey?.sweetsFrequency === 'daily';
  const sunflowerOil = survey?.cookingOil === 'sunflower';
  const teaHeavy = survey?.teaCoffeeSugar === 'heavy';
  const eatOutOften = survey?.eatingOutFrequency === 'often';

  const swaps: DietSwap[] = [];

  swaps.push(
    riceDaily
      ? {
          from: 'White rice at both meals',
          to: 'Millet (foxtail/little/barnyard/jowar) at lunch, rice only at dinner - start 5 days a week',
          why: 'Same plate, 3-6x the fibre and a far gentler glucose curve; millets are the single highest-ROI swap for Indian plates',
        }
      : {
          from: 'White rice / polished grains daily',
          to: 'Millet or whole-wheat base on most days',
          why: 'Lower glycemic load plus fibre - helps HbA1c, triglycerides and cholesterol together',
        },
  );

  swaps.push({
    from: sunflowerOil ? 'Sunflower oil as the only cooking oil' : 'One cooking oil for everything',
    to: 'Mustard or olive oil as the base, ghee capped at 1 tsp/day',
    why: 'A better fat mix lowers ApoB and inflammation markers over weeks - no oil needs to be "zero", just rotated',
  });

  swaps.push({
    from: 'Deep-fried snacks (punugulu, bajji, mixture, chips)',
    to: 'Roasted chana, makhana, peanuts-in-shell, buttermilk',
    why: 'Fried food is the fastest hsCRP and triglyceride raiser in Indian diets - the swap is like-for-like crunchy',
  });

  swaps.push(
    sweetsDaily
      ? {
          from: 'Sweets/mithai almost daily',
          to: 'Fruit + 5 nuts bowl daily; sweets become a festival-only food',
          why: 'Daily sweets are the quietest HbA1c driver; the weekday sweet-free challenge usually shows in fasting glucose within 2 weeks',
        }
      : {
          from: 'Sweets a few times a week',
          to: 'Fruit + nut bowl as the default sweet; mithai for occasions',
          why: 'Cuts added sugar under the 25 g/day line without feeling like punishment',
        },
  );

  if (teaHeavy) {
    swaps.push({
      from: 'Tea/coffee with sugar, several cups',
      to: 'Elaichi or cinnamon tea, sugar halved this week and halved again next',
      why: '3 sweetened cups a day is roughly 30-40 g hidden sugar - halving twice gets you to near-zero without withdrawal',
    });
  }

  swaps.push({
    from: eatOutOften ? 'Ordered-in / restaurant meals weekly+' : 'Restaurant meals as they come',
    to: eatOutOften ? 'One eat-out day a week; order tandoori/grilled/steam dishes, share the fried plate' : 'Tandoori, grilled or steamed picks when out',
    why: 'Restaurant gravies and fries carry the month\'s worth of bad fat and salt - choosing the grill keeps the habit without the load',
  });

  if (!veg) {
    swaps.push({
      from: 'Red meat / organ meat curries frequently',
      to: 'Fish twice a week (sardine, mackerel, rohu - light curry), chicken rest, red meat rare',
      why: 'Omega-3 from fish directly targets triglycerides and hsCRP - the two numbers this report flags',
    });
  } else {
    swaps.push({
      from: 'Relying on dairy alone for protein',
      to: 'Rotate dal-rajma-chana-soya-paneer-curd across the day (one at every meal)',
      why: 'Plant protein anchors keep the plate filling while fibre does the cholesterol work - key for a vegetarian plate with high ApoB',
    });
  }

  swaps.push({
    from: 'Grain first on the plate',
    to: 'Salad + dal/curd first, grain eaten last',
    why: 'Eating vegetables and protein before the grain cuts the same meal\'s glucose spike by 30-40% in published trials - a free win',
  });

  const proteinAnchor = veg ? 'paneer, soya, rajma, chana, curd' : egg ? 'egg, paneer, dal, curd, fish twice a week' : 'egg, fish twice a week, chicken, paneer, dal';
  const dinnerAnchor = veg ? '2 phulka + paneer bhurji + lauki-moong light' : egg ? 'phulka + egg bhurji + lauki-moong light' : 'phulka + grilled fish/egg bhurji + lauki-moong light';

  const sampleDay: DietMealSlot[] = [
    {
      slot: 'Early morning (7:00)',
      options: ['Warm water', '5 soaked almonds', '1 amla or half a guava'],
      note: 'Fluids first - it trims the breakfast overshoot',
    },
    {
      slot: 'Breakfast (8:30)',
      options: telugu
        ? ['Vegetable millet upma + buttermilk', '2 pesarattu with allam-ginger chutney', '2 idli + sambar (no chutney oil)']
        : ['Vegetable daliya / millet upma + curd', '2 moong-dal chilla + green chutney', 'Oats + curd bowl with guava'],
      note: 'Protein within the first meal steadies the whole day',
    },
    {
      slot: 'Mid-morning (11:00)',
      options: ['Buttermilk (no salt trim needed)', 'Green tea, no sugar'],
      note: 'The gap that protects lunch from overeating',
    },
    {
      slot: 'Lunch (13:00)',
      options: telugu
        ? ['1 katori foxtail/little millet', 'Tomato pappu', 'Palakura or beerakaya koora', 'Salad + perugu', '10-min walk after']
        : ['1 katori millet or 2 phulka', 'Dal + seasonal sabzi', 'Salad + curd', '10-min walk after'],
      note: 'This is the plate the whole plan hangs on - half veg, quarter dal, quarter grain',
    },
    {
      slot: 'Evening (17:00)',
      options: ['Papaya or guava + roasted chana', 'Majjiga/chaas', 'Light stretch or walk'],
      note: 'A planned snack kills the 8pm snack attack',
    },
    {
      slot: 'Dinner (20:00, 3 h before bed)',
      options: telugu
        ? ['2 jonna rotte + ' + (veg ? 'paneer or soya curry' : egg ? 'egg curry (light)' : 'egg curry (light) or grilled fish'), 'Lauki/moong light', 'Salad', '10-min walk after']
        : [dinnerAnchor, 'Salad', '10-min walk after'],
      note: `Protein anchors: ${proteinAnchor}`,
    },
  ];

  return {
    philosophy:
      'An Indian plate with Mediterranean evidence: fibre first, dal-curd-nut protein, good fats, nothing deep-fried. ' +
      (telugu ? 'Everything is regular Telugu kitchen food - only the proportions and order change.' : 'Everything is regular home food - only the proportions and order change.'),
    plateRule: 'Half the plate vegetables or greens - quarter protein (dal/curd/paneer/egg/fish) - quarter millet or whole grain. Plus 1 katori curd and raw salad. Eat the veg and dal before the grain.',
    dailyTargets: [
      { label: 'Fibre', value: '30-35 g (2 dal servings + 3 veg + millet + fruit + nuts)' },
      { label: 'Protein', value: '55-70 g (an anchor at every meal)' },
      { label: 'Added sugar', value: 'Under 25 g (~6 tsp)' },
      { label: 'Cooking oil', value: '3-4 tsp/person/day, rotated' },
      { label: 'Fluids', value: '2.5-3 L (water, buttermilk)' },
      { label: 'Movement', value: '30 min walk + 10-15 min after the two biggest meals' },
    ],
    swaps,
    sampleDay,
  };
}

// ---------------------------------------------------------------------------
// Activity plan
// ---------------------------------------------------------------------------

function buildActivityPlan(
  w: Windows,
  input: IntelligenceInput,
  meds: MedClasses,
): ActivityPlan {
  const survey = input.survey ?? null;
  const walkReported = survey?.walkMinutesPerDay ?? null;
  const weekly = w.activityMinPerWeek ?? (walkReported != null ? walkReported * 7 : null);
  const baseline =
    weekly != null
      ? `Right now: about ${Math.round(weekly)} min/week of logged activity${walkReported != null ? ` (you reported ~${walkReported} min/day of routine walking)` : ''}. The build below adds ~${Math.max(30, 150 - Math.round(weekly))} min/week gently.`
      : 'No activity logged yet - the plan below starts from wherever you are.';

  const strength = 'Sit-to-stand x10 - wall push-ups x10 - heel raises x12 - 2 rounds';

  const weekly2: ActivityDay[] = [
    { day: 'Mon', focus: 'Brisk walk 30', detail: 'After breakfast or lunch; 10 min after dinner', minutes: 40 },
    { day: 'Tue', focus: 'Walk 20 + strength 15', detail: strength, minutes: 35 },
    { day: 'Wed', focus: 'Brisk walk 30', detail: '10-15 min right after lunch', minutes: 40 },
    { day: 'Thu', focus: 'Walk 20 + strength 15', detail: strength, minutes: 35 },
    { day: 'Fri', focus: 'Brisk walk 30', detail: 'Comfortable pace, arms swinging', minutes: 30 },
    { day: 'Sat', focus: 'Long walk 45', detail: 'Or cycling / swimming / temple walk', minutes: 45 },
    { day: 'Sun', focus: 'Yoga / stretch 20', detail: 'Plus 10 min after dinner', minutes: 30 },
  ];

  const safety: string[] = [
    'Check your feet daily and wear cushioned shoes - the diabetes basics',
  ];
  if (meds.sulfonylurea.length || meds.insulin.length) {
    safety.push('You are on a medicine that can cause lows - carry glucose candy and check sugar before unusual activity');
  }
  safety.push(
    'Chest pain, dizziness or unusual breathlessness: stop and call your doctor',
    'Aching knees? Swap a walk day for cycling or swimming',
    'Summer heat: walk before 8 am or after 6 pm; keep 2.5-3 L fluids',
  );

  return {
    baseline,
    weekly: weekly2,
    targets: [
      '150+ min of moderate walking a week',
      '2 strength sessions (the Tue/Thu circuit)',
      '10-15 min walk after your two biggest meals - the highest-ROI habit in this whole report',
      'Break sitting every hour: 2-3 min stroll',
      'Steps: build gradually toward 7,000-8,000/day',
    ],
    safetyNotes: safety,
  };
}

// ---------------------------------------------------------------------------
// Follow-up tests
// ---------------------------------------------------------------------------

function buildFollowUps(
  ctx: LabCtx,
  w: Windows,
  input: IntelligenceInput,
  diabetic: boolean,
): FollowUpTest[] {
  const out: FollowUpTest[] = [];
  const a1c = val(ctx, 'hba1c');
  const apoB = val(ctx, 'apo_b');
  const ldl = val(ctx, 'ldl');
  const crp = val(ctx, 'hs_crp');
  const hcy = val(ctx, 'homocysteine');
  const alt = val(ctx, 'alt');
  const mcv = lab(ctx, 'mcv');
  const mch = lab(ctx, 'mch');
  const iron = val(ctx, 'iron');
  const tsat = val(ctx, 'transferrin_sat');
  const vitD = val(ctx, 'vitamin_d');
  const female = isFemale(input.profile.gender);

  if (a1c != null && a1c >= 6.5) {
    out.push({
      name: 'HbA1c + fasting glucose',
      why: 'The 90-day scoreboard for everything in the plan - food, walks, medication review',
      when: 'Day 85-90 of the plan',
      priority: 'soon',
    });
  }
  if (apoB != null && apoB > 130) {
    out.push({
      name: 'Lipid profile + ApoB',
      why: 'ApoB is the particle count behind the cholesterol story - retest tells whether food + any therapy moved it',
      when: 'With the 90-day panel',
      priority: 'soon',
    });
  } else if (ldl != null && ldl > 130) {
    out.push({
      name: 'Lipid profile',
      why: 'Track the LDL response to the food changes (and any therapy your doctor starts)',
      when: 'With the 90-day panel',
      priority: 'soon',
    });
  }
  if (mcv != null && mcv.latest.value < (mcv.latest.refLow ?? 83) && (mch == null || mch.latest.value < (mch.latest.refLow ?? 27)) && !(iron != null && iron < 60) && !(tsat != null && tsat < 15)) {
    out.push({
      name: 'Haemoglobin electrophoresis (HbA2)',
      why: 'Small red cells with normal iron studies raise the beta-thalassaemia-trait question - one test settles it for life',
      when: 'Any time - one-time test',
      priority: 'soon',
    });
  }
  if (hcy != null && hcy > 15) {
    out.push({
      name: 'Homocysteine retest',
      why: 'Checks whether the folate-rich plate (or a doctor-started B-complex) normalised it',
      when: '8-12 weeks',
      priority: 'routine',
    });
  }
  if (alt != null && alt > 35) {
    out.push({
      name: 'Liver function test (LFT)',
      why: 'Confirms the ALT downtrend after the sugar/oil changes',
      when: '12 weeks',
      priority: 'routine',
    });
  }
  if (crp != null && crp > 1) {
    out.push({
      name: 'hsCRP (with next panel) + dental check-up',
      why: 'Gum disease is the classic hidden hsCRP driver; the retest tells the story',
      when: 'Next panel / this month',
      priority: 'routine',
    });
  }
  if (diabetic) {
    out.push(
      {
        name: 'Retina (eye) exam',
        why: 'Annual diabetes standard - catches silent changes early',
        when: 'Yearly',
        priority: 'annual',
      },
      {
        name: 'Foot exam (doctor) + daily self-check',
        why: 'Diabetes quietens the feet - a yearly professional check plus daily home glance',
        when: 'Yearly',
        priority: 'annual',
      },
      {
        name: 'Urine albumin-creatinine ratio (uACR)',
        why: 'The kidney check that a basic panel misses - diabetes standards include it yearly',
        when: 'Yearly',
        priority: 'annual',
      },
    );
  }
  if (vitD != null && vitD < 30) {
    out.push({
      name: 'Vitamin D recheck',
      why: 'Confirms sun + supplement are actually lifting the level',
      when: '6 months',
      priority: 'routine',
    });
  }
  if (w.bpAvg != null && (w.bpAvg.s >= 130 || w.bpAvg.d >= 85)) {
    out.push({
      name: '7-day home BP diary + review',
      why: 'Morning + evening seated readings for a week make the doctor decision easy',
      when: 'Start tomorrow; review after 7 days',
      priority: 'soon',
    });
  }
  if (female && input.survey?.menopause === 'post') {
    out.push({
      name: 'Bone health discussion (DEXA)',
      why: 'Post-menopause + borderline vitamin D is the classic bone-density conversation',
      when: 'At the next visit',
      priority: 'routine',
    });
  }
  const symptoms = input.survey?.symptoms ?? [];
  if (symptoms.includes('Tingling or numbness in feet') || symptoms.includes('Slow-healing wounds') || symptoms.includes('Blurred vision')) {
    out.push({
      name: 'Symptom check with your doctor',
      why: `You reported: ${symptoms.join(', ').toLowerCase()} - worth naming explicitly at the visit`,
      when: 'At the next visit',
      priority: 'soon',
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 90-day plan
// ---------------------------------------------------------------------------

function buildNinetyDay(
  ctx: LabCtx,
  input: IntelligenceInput,
  diabetic: boolean,
): NinetyDayPhase[] {
  const goal = input.survey?.primaryGoal ?? null;
  const targetLine =
    goal === 'weight'
      ? '4-5% weight loss (about 3-4 kg) with a weekly weigh-in'
      : goal === 'cholesterol'
        ? 'LDL/ApoB moving down on the 90-day retest'
        : goal === 'energy'
          ? 'Sleep 7+ h, zero mid-afternoon crashes, walking habit automatic'
          : goal === 'fitness'
            ? '150 min/week feels easy; strength circuit x2 weekly is routine'
            : 'Fasting glucose mostly 110-130, post-meal under 180, HbA1c trending down';
  return [
    {
      phase: 'Phase 1 - Foundation',
      days: 'Days 1-14',
      focus: 'See clearly, move a little',
      actions: [
        'Log every meal in the app (photo + one line is enough) - the plan sharpens with every log',
        '10-min walk after dinner, daily - the single highest-return habit',
        'Millet (or 2 phulka) instead of rice at lunch, 5 days a week',
        'Fix a bedtime alarm; screens off 30 min before',
        diabetic ? 'Take medicines exactly on schedule (log ticks in the app)' : 'Note any symptoms in the survey so the next report reflects them',
      ],
      target: '90% of days logged; 7 dinner walks done',
    },
    {
      phase: 'Phase 2 - Momentum',
      days: 'Days 15-45',
      focus: 'Build the full stack',
      actions: [
        '30-min brisk walk 5 days a week + the Tue/Thu strength circuit',
        'Fibre to 30 g/day (the plate rule makes this automatic)',
        'Sweets down to occasions only; sugary drinks zero',
        '15-min walk after lunch too - both big meals now covered',
        'Weekly weigh-in, same day and time',
      ],
      target: '150 min/week for 3 straight weeks; fasting glucose trending toward 110-130',
    },
    {
      phase: 'Phase 3 - Consolidate & retest',
      days: 'Days 46-90',
      focus: 'Make it boring (in the best way)',
      actions: [
        'Hold the routine; review your Trends tab - your own data is the motivation',
        'Book the 90-day panel: HbA1c, lipids + ApoB, LFT, hsCRP',
        'Prepare the doctor visit: export this report, list questions, review medicines',
        'Pick ONE habit from this report that changed your numbers - protect it at all costs',
      ],
      target: targetLine + (diabetic ? '; HbA1c goal set together with your doctor' : ''),
    },
  ];
}

// ---------------------------------------------------------------------------
// Gaps + headline + summary
// ---------------------------------------------------------------------------

function buildGaps(input: IntelligenceInput): string[] {
  const s = input.survey ?? null;
  const gaps: string[] = [];
  const female = isFemale(input.profile.gender);
  if (!s?.dietPattern) gaps.push('What your plate looks like (veg / egg / non-veg) - it changes the meal options');
  if (!s?.sweetsFrequency) gaps.push('How often sweets appear - it sharpens the sugar advice');
  if (!s?.walkMinutesPerDay) gaps.push('Your usual daily walking minutes - it calibrates the activity build');
  if (!s?.primaryGoal) gaps.push('Your #1 goal right now - the 90-day plan emphasizes it');
  if (female && !s?.menopause) gaps.push('Menopause stage - it shapes the bone-health and cholesterol framing');
  if (!s?.symptoms) gaps.push('Any symptoms this past month - several findings key off them');
  if (!s?.familyHistory) gaps.push('Family history - it weights the heart-risk picture');
  return gaps.slice(0, 5);
}

function pickHeadline(findings: Omit<PriorityFinding, 'rank'>[]): string {
  const top = findings[0];
  if (!top) return 'Strong foundations - now build 90-day momentum';
  switch (top.area) {
    case 'glycemic':
      return 'Blood-sugar control is slipping - the next 90 days matter most';
    case 'lipids':
      return 'Cholesterol is the big lever now - and ApoB is doing the damage';
    case 'inflammation':
      return 'A smouldering fire: inflammation needs food, movement and sleep';
    case 'bp':
      return 'Blood pressure needs a routine, not a scramble';
    case 'weight':
      return 'Weight is the master lever - everything else follows';
    case 'thyroid':
      return 'The thyroid needs a doctor look before anything else';
    case 'kidney':
      return 'Kidney numbers need prompt attention';
    case 'sleep':
      return 'Better sleep would improve every other number here';
    case 'activity':
      return 'Movement is your missing medicine';
    default:
      return 'A clear, fixable picture - start with the top action';
  }
}

function buildSummary(
  input: IntelligenceInput,
  ctx: LabCtx,
  findings: Omit<PriorityFinding, 'rank'>[],
  positives: string[],
): string {
  const name = (input.profile.name ?? '').trim();
  const hello = name ? `Hello ${name}. ` : '';
  const panelBit = ctx.panelDates.length
    ? `Your latest panel (${shortMonthYear(ctx.panelDates[0])}) and ${ctx.labCount} logged results across ${ctx.panelDates.length} panels tell a clear story. `
    : 'Here is what your logged data says so far. ';
  const top = findings.slice(0, 2);
  const bits: string[] = [];
  for (const f of top) {
    bits.push(f.finding.split('. ')[0]);
  }
  const positiveBit = positives.length
    ? ` The good news: ${positives[0].toLowerCase()}${positives[1] ? `, and ${positives[1].toLowerCase()}` : ''}.`
    : '';
  const planBit = ' The 90-day plan below targets exactly these levers - food swaps, post-meal walks, and one focused doctor conversation.';
  return (
    hello +
    panelBit +
    (bits.length ? bits.join('. ') + '.' : 'No red flags are firing - the job now is momentum, not rescue.') +
    positiveBit +
    planBit
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function buildIntelligenceReport(input: IntelligenceInput): IntelligenceReport {
  const asOf = input.asOf ?? new Date().toISOString().slice(0, 10);
  const ctx = buildLabCtx(input.labs ?? []);
  const w = buildWindows(input);

  const a1c = val(ctx, 'hba1c');
  const conditions = input.profile.conditions ?? [];
  const diabetic =
    input.profile.diabetic === true ||
    (a1c != null && a1c >= 6.5) ||
    conditions.some((c) => /diabet/i.test(c));

  const meds = classifyMeds(input.meds ?? []);
  const { findings: rawFindings, positives } = buildFindings(ctx, w, input, diabetic, meds);
  const findings = rawFindings.map((f, i) => ({ ...f, rank: i + 1 }));
  const score = computeScore(ctx, w, input, diabetic);
  const trends = buildTrends(ctx);
  const lifestyleVsMeds = buildLmRows(ctx, w, input, diabetic, meds);
  const dietPlan = buildDietPlan(ctx, input);
  const activityPlan = buildActivityPlan(w, input, meds);
  const followUps = buildFollowUps(ctx, w, input, diabetic);
  const ninetyDay = buildNinetyDay(ctx, input, diabetic);
  const questionnaireGaps = buildGaps(input);

  const age = input.profile.age ?? null;
  const female = isFemale(input.profile.gender);
  const patientLine = age != null ? `${age}-year-old ${female ? 'woman' : input.profile.gender ? 'man' : 'adult'}` : 'Member';

  const survey = input.survey ?? null;
  const surveyDone = survey != null && Object.keys(survey).length >= 3;

  return {
    asOf,
    patientLine,
    headline: pickHeadline(rawFindings),
    summary: buildSummary(input, ctx, rawFindings, positives),
    score,
    positives,
    priorities: findings,
    trends,
    lifestyleVsMeds,
    dietPlan,
    activityPlan,
    followUps,
    ninetyDay,
    questionnaireGaps,
    dataCoverage: {
      labResults: ctx.labCount,
      panelDates: ctx.panelDates,
      activeMeds: meds.names.length,
      glucoseLast14d: w.glucoseIn14,
      mealDaysLast14d: w.mealDays,
      surveyDone,
    },
    unmatchedTests: ctx.unmatched,
    hasLabs: ctx.labCount > 0,
    disclaimer: INTELLIGENCE_DISCLAIMER,
  };
}