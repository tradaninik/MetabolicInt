// P6-d — the lab test catalog: the user's A–E master structure as data.
//
// This catalog is the product spec: category A (diabetes & metabolic),
// B (cardiovascular & lipid), C (liver & thyroid), D (nutrition &
// micronutrients), E (complication & microvascular screenings). Adding a
// test later = one entry here; every surface (entry form, trends, import
// parser, comparison, document folders, filename tokens) is data-driven.
//
// Reference ranges are DISPLAY-ONLY defaults for adults - the lab's own
// printed range always wins when captured, and nothing here interprets a
// value medically. Direction is used solely for comparison coloring
// (HDL up = green, LDL up = red, context = neutral).
//
// Derived markers (HOMA-IR, non-HDL, and the display-only eGFR estimate)
// are computed at read time and NEVER stored.

export type LabCategoryLetter = 'A' | 'B' | 'C' | 'D' | 'E';
export type LabDirection = 'lower-better' | 'higher-better' | 'context';
export type LabCalc = 'homa_ir' | 'non_hdl';

export interface LabTestDef {
  /** stable key used in LabResult.testKey, imports and links */
  key: string;
  label: string;
  /** A–E per the master folder structure */
  category: LabCategoryLetter;
  /** sub-group inside the category (e.g. "Glycemic control") */
  group: string;
  unit: string;
  /** display-only default adult range; the lab's printed range wins */
  refLow?: number;
  refHigh?: number;
  direction: LabDirection;
  /** parse aliases incl. Indian lab spellings (case/space/punct-insensitive) */
  aliases: string[];
  /** derived at read time, never stored */
  calc?: LabCalc;
  /** true for document-first entries (no numeric value expected) */
  documentOnly?: boolean;
}

export interface LabReportCategory {
  /** stable id used by ReportDocument.category */
  id: 'diabetes' | 'cardio' | 'organ' | 'nutrition' | 'screening';
  letter: LabCategoryLetter;
  title: string;
  /** filename token per the user's naming standard */
  token: string;
  description: string;
}

// ---------- The A–E master structure (the user's spec, verbatim shape) ----------

export const LAB_CATEGORIES: LabReportCategory[] = [
  {
    id: 'diabetes',
    letter: 'A',
    title: 'Diabetes & Metabolic',
    token: 'Diabetes',
    description: 'Glycemic control, insulin & resistance, kidney health.',
  },
  {
    id: 'cardio',
    letter: 'B',
    title: 'Cardiovascular & Lipid',
    token: 'Cardio',
    description: 'Lipid panel, blood pressure, ECG / echo / stress test documents.',
  },
  {
    id: 'organ',
    letter: 'C',
    title: 'Liver & Thyroid',
    token: 'LiverThyroid',
    description: 'Liver function (incl. NAFLD monitoring) and thyroid function.',
  },
  {
    id: 'nutrition',
    letter: 'D',
    title: 'Nutrition & Micronutrients',
    token: 'Nutrition',
    description: 'Vitamin D3, B12, iron profile, magnesium, zinc.',
  },
  {
    id: 'screening',
    letter: 'E',
    title: 'Complication & Microvascular Screenings',
    token: 'Screening',
    description: 'Retinopathy screening and diabetic foot / neuropathy checks.',
  },
];

export const LAB_CATEGORY_BY_LETTER: Record<LabCategoryLetter, LabReportCategory> = Object.fromEntries(
  LAB_CATEGORIES.map((c) => [c.letter, c]),
) as Record<LabCategoryLetter, LabReportCategory>;

export const LAB_TESTS: LabTestDef[] = [
  // ---- A. Diabetes & Metabolic ----
  {
    key: 'hba1c', label: 'HbA1c', category: 'A', group: 'Glycemic control',
    unit: '%', refLow: 4.0, refHigh: 5.6, direction: 'lower-better',
    aliases: ['hba1c', 'hb a1c', 'glycosylated haemoglobin', 'glycosylated hemoglobin', 'glycated haemoglobin', 'glycated hemoglobin', 'a1c', 'haemoglobin a1c'],
  },
  {
    key: 'fbg', label: 'Fasting blood glucose', category: 'A', group: 'Glycemic control',
    unit: 'mg/dL', refLow: 70, refHigh: 100, direction: 'lower-better',
    aliases: ['fbg', 'fbs', 'fasting blood glucose', 'fasting glucose', 'glucose fasting', 'fasting blood sugar', 's glucose fasting', 'serum glucose fasting'],
  },
  {
    key: 'ppbs', label: 'Postprandial glucose (PPBS)', category: 'A', group: 'Glycemic control',
    unit: 'mg/dL', refLow: 70, refHigh: 140, direction: 'lower-better',
    aliases: ['ppbs', 'pp blood sugar', 'postprandial glucose', 'post prandial blood sugar', 'post lunch glucose', 'post lunch blood sugar', '2hr pp', 'pp glucose'],
  },
  {
    key: 'fasting_insulin', label: 'Fasting insulin', category: 'A', group: 'Insulin & resistance',
    unit: 'uU/mL', refLow: 2.6, refHigh: 24.9, direction: 'context',
    aliases: ['fasting insulin', 'insulin fasting', 'serum insulin', 'fasting serum insulin', 'insulin fbs'],
  },
  {
    key: 'c_peptide', label: 'C-peptide', category: 'A', group: 'Insulin & resistance',
    unit: 'ng/mL', refLow: 0.9, refHigh: 7.1, direction: 'context',
    aliases: ['c peptide', 'cpeptide', 'serum c peptide'],
  },
  {
    key: 'homa_ir', label: 'HOMA-IR', category: 'A', group: 'Insulin & resistance',
    unit: '', refLow: 0, refHigh: 2.5, direction: 'lower-better', calc: 'homa_ir',
    aliases: ['homa ir', 'homa'],
  },
  {
    key: 'creatinine', label: 'Serum creatinine', category: 'A', group: 'Kidney health',
    unit: 'mg/dL', refLow: 0.7, refHigh: 1.3, direction: 'context',
    aliases: ['creatinine', 's creatinine', 'serum creatinine', 'creat'],
  },
  {
    key: 'egfr', label: 'eGFR', category: 'A', group: 'Kidney health',
    unit: 'mL/min/1.73m2', refLow: 90, direction: 'higher-better',
    aliases: ['egfr', 'gfr', 'estimated gfr', 'glomerular filtration rate'],
  },
  {
    key: 'bun', label: 'Blood urea (BUN)', category: 'A', group: 'Kidney health',
    unit: 'mg/dL', refLow: 7, refHigh: 20, direction: 'context',
    aliases: ['bun', 'blood urea', 'urea', 's urea', 'serum urea', 'blood urea nitrogen'],
  },
  {
    key: 'uacr', label: 'uACR', category: 'A', group: 'Kidney health',
    unit: 'mg/g', refLow: 0, refHigh: 30, direction: 'lower-better',
    aliases: ['uacr', 'acr', 'urine albumin creatinine ratio', 'albumin creatinine ratio', 'urine acr'],
  },

  // ---- B. Cardiovascular & Lipid ----
  {
    key: 'total_cholesterol', label: 'Total cholesterol', category: 'B', group: 'Lipid panel',
    unit: 'mg/dL', refLow: 130, refHigh: 200, direction: 'lower-better',
    aliases: ['total cholesterol', 'cholesterol total', 'cholesterol', 's cholesterol', 'serum cholesterol', 'tc', 'cholesterol serum'],
  },
  {
    key: 'hdl', label: 'HDL cholesterol', category: 'B', group: 'Lipid panel',
    unit: 'mg/dL', refLow: 40, refHigh: 60, direction: 'higher-better',
    aliases: ['hdl', 'hdl cholesterol', 's hdl', 'hdl c', 'high density lipoprotein'],
  },
  {
    key: 'ldl', label: 'LDL cholesterol', category: 'B', group: 'Lipid panel',
    unit: 'mg/dL', refLow: 60, refHigh: 100, direction: 'lower-better',
    aliases: ['ldl', 'ldl cholesterol', 's ldl', 'ldl c', 'low density lipoprotein', 'ldl direct'],
  },
  {
    key: 'triglycerides', label: 'Triglycerides', category: 'B', group: 'Lipid panel',
    unit: 'mg/dL', refLow: 50, refHigh: 150, direction: 'lower-better',
    aliases: ['triglycerides', 'tgl', 'tg', 's triglycerides', 'serum triglycerides', 'trigly'],
  },
  {
    key: 'non_hdl', label: 'Non-HDL cholesterol', category: 'B', group: 'Lipid panel',
    unit: 'mg/dL', refLow: 0, refHigh: 160, direction: 'lower-better', calc: 'non_hdl',
    aliases: ['non hdl', 'nonhdl', 'non hdl cholesterol'],
  },
  {
    key: 'apob', label: 'ApoB', category: 'B', group: 'Lipid panel',
    unit: 'mg/dL', refLow: 60, refHigh: 130, direction: 'lower-better',
    aliases: ['apob', 'apo b', 'apolipoprotein b', 'apo b100'],
  },
  {
    key: 'vldl', label: 'VLDL cholesterol', category: 'B', group: 'Lipid panel',
    unit: 'mg/dL', refLow: 5, refHigh: 40, direction: 'context',
    aliases: ['vldl', 'vldl cholesterol', 'very low density lipoprotein'],
  },
  // ECG / Echo / Stress test results are documents (category B vault) - no parseable numbers.
  {
    key: 'ecg', label: 'ECG', category: 'B', group: 'ECG / Echo / Stress test', documentOnly: true,
    unit: '', direction: 'context',
    aliases: ['ecg', 'ekg', 'electrocardiogram', 'ecg report'],
  },
  {
    key: 'echocardiogram', label: 'Echocardiogram', category: 'B', group: 'ECG / Echo / Stress test', documentOnly: true,
    unit: '', direction: 'context',
    aliases: ['echocardiogram', 'echo', '2d echo', '2decho', 'echocardiography'],
  },
  {
    key: 'stress_test', label: 'Stress test', category: 'B', group: 'ECG / Echo / Stress test', documentOnly: true,
    unit: '', direction: 'context',
    aliases: ['stress test', 'tmt', 'treadmill test', 'treadmill stress test'],
  },

  // ---- C. Organ function: Liver & Thyroid ----
  {
    key: 'alt', label: 'ALT (SGPT)', category: 'C', group: 'Liver function (LFT)',
    unit: 'U/L', refLow: 7, refHigh: 56, direction: 'lower-better',
    aliases: ['alt', 'sgpt', 'sgpt alt', 'alt sgpt', 'serum glutamate pyruvate transaminase', 'alanine aminotransferase'],
  },
  {
    key: 'ast', label: 'AST (SGOT)', category: 'C', group: 'Liver function (LFT)',
    unit: 'U/L', refLow: 10, refHigh: 40, direction: 'lower-better',
    aliases: ['ast', 'sgot', 'sgot ast', 'ast sgot', 'aspartate aminotransferase', 'serum glutamic oxaloacetic transaminase'],
  },
  {
    key: 'total_bilirubin', label: 'Total bilirubin', category: 'C', group: 'Liver function (LFT)',
    unit: 'mg/dL', refLow: 0.3, refHigh: 1.2, direction: 'context',
    aliases: ['total bilirubin', 'bilirubin total', 's bilirubin', 'bilirubin', 'serum bilirubin total'],
  },
  {
    key: 'alp', label: 'ALP (alkaline phosphatase)', category: 'C', group: 'Liver function (LFT)',
    unit: 'U/L', refLow: 40, refHigh: 129, direction: 'context',
    aliases: ['alp', 'alkaline phosphatase', 's alkaline phosphatase', 'serum alkaline phosphatase'],
  },
  {
    key: 'albumin', label: 'Albumin', category: 'C', group: 'Liver function (LFT)',
    unit: 'g/dL', refLow: 3.5, refHigh: 5.2, direction: 'context',
    aliases: ['albumin', 's albumin', 'serum albumin'],
  },
  {
    key: 'tsh', label: 'TSH', category: 'C', group: 'Thyroid',
    unit: 'uIU/mL', refLow: 0.4, refHigh: 4.0, direction: 'context',
    aliases: ['tsh', 'thyroid stimulating hormone', 's tsh', 'thyrotropin'],
  },
  {
    key: 'free_t3', label: 'Free T3', category: 'C', group: 'Thyroid',
    unit: 'pg/mL', refLow: 2.3, refHigh: 4.2, direction: 'context',
    aliases: ['free t3', 'ft3', 't3 free', 'f t3'],
  },
  {
    key: 'free_t4', label: 'Free T4', category: 'C', group: 'Thyroid',
    unit: 'ng/dL', refLow: 0.89, refHigh: 1.76, direction: 'context',
    aliases: ['free t4', 'ft4', 't4 free', 'f t4'],
  },
  {
    key: 'anti_tpo', label: 'Anti-TPO', category: 'C', group: 'Thyroid',
    unit: 'IU/mL', refLow: 0, refHigh: 34, direction: 'lower-better',
    aliases: ['anti tpo', 'anti tpo antibody', 'tpo antibody', 'anti thyroid peroxidase', 'antitpo'],
  },

  // ---- D. Nutrition & Micronutrients ----
  {
    key: 'vitamin_d', label: 'Vitamin D (25-OH)', category: 'D', group: 'Vitamins',
    unit: 'ng/mL', refLow: 30, refHigh: 100, direction: 'higher-better',
    aliases: ['vitamin d', 'vitamin d3', '25 oh vitamin d', '25 hydroxy vitamin d', '25 ohd', 'vit d', 's vitamin d'],
  },
  {
    key: 'vitamin_b12', label: 'Vitamin B12', category: 'D', group: 'Vitamins',
    unit: 'pg/mL', refLow: 200, refHigh: 900, direction: 'higher-better',
    aliases: ['vitamin b12', 'b12', 'vit b12', 'cobalamin', 's vitamin b12'],
  },
  {
    key: 'ferritin', label: 'Ferritin', category: 'D', group: 'Iron profile',
    unit: 'ng/mL', refLow: 30, refHigh: 300, direction: 'context',
    aliases: ['ferritin', 's ferritin', 'serum ferritin'],
  },
  {
    key: 'serum_iron', label: 'Serum iron', category: 'D', group: 'Iron profile',
    unit: 'ug/dL', refLow: 60, refHigh: 170, direction: 'context',
    aliases: ['serum iron', 'iron', 's iron', 'iron serum'],
  },
  {
    key: 'tibc', label: 'TIBC', category: 'D', group: 'Iron profile',
    unit: 'ug/dL', refLow: 240, refHigh: 450, direction: 'context',
    aliases: ['tibc', 'total iron binding capacity'],
  },
  {
    key: 'magnesium', label: 'Magnesium', category: 'D', group: 'Minerals',
    unit: 'mg/dL', refLow: 1.7, refHigh: 2.2, direction: 'higher-better',
    aliases: ['magnesium', 's magnesium', 'serum magnesium', 'mg'],
  },
  {
    key: 'zinc', label: 'Zinc', category: 'D', group: 'Minerals',
    unit: 'ug/dL', refLow: 70, refHigh: 120, direction: 'higher-better',
    aliases: ['zinc', 's zinc', 'serum zinc'],
  },

  // ---- E. Complication & Microvascular screenings (document-first) ----
  {
    key: 'retinopathy_screening', label: 'Retinopathy screening', category: 'E', group: 'Eye (retinopathy)', documentOnly: true,
    unit: '', direction: 'context',
    aliases: ['retinopathy screening', 'retinopathy', 'diabetic retinopathy screening', 'fundus screening'],
  },
  {
    key: 'fundus_photo', label: 'Fundus photograph', category: 'E', group: 'Eye (retinopathy)', documentOnly: true,
    unit: '', direction: 'context',
    aliases: ['fundus photo', 'fundus photograph', 'fundus photography', 'fundus camera'],
  },
  {
    key: 'oct', label: 'OCT (optical coherence tomography)', category: 'E', group: 'Eye (retinopathy)', documentOnly: true,
    unit: '', direction: 'context',
    aliases: ['oct', 'optical coherence tomography', 'oct eye'],
  },
  {
    key: 'foot_exam', label: 'Diabetic foot exam', category: 'E', group: 'Foot & neuropathy', documentOnly: true,
    unit: '', direction: 'context',
    aliases: ['diabetic foot exam', 'foot exam', 'foot examination', 'diabetic foot screening'],
  },
  {
    key: 'ncv', label: 'NCV (nerve conduction)', category: 'E', group: 'Foot & neuropathy', documentOnly: true,
    unit: '', direction: 'context',
    aliases: ['ncv', 'nerve conduction velocity', 'nerve conduction study', 'ncs'],
  },
  {
    key: 'vpt', label: 'VPT (vibration perception threshold)', category: 'E', group: 'Foot & neuropathy', documentOnly: true,
    unit: '', direction: 'context',
    aliases: ['vpt', 'vibration perception threshold', 'vibration test'],
  },
];

export const LAB_TEST_MAP: Record<string, LabTestDef> = Object.fromEntries(LAB_TESTS.map((t) => [t.key, t]));

export function findLabTest(key: string): LabTestDef | undefined {
  return LAB_TEST_MAP[key];
}

/** Numeric, enterable tests of one category (documents excluded). */
export function labTestsByCategory(letter: LabCategoryLetter): LabTestDef[] {
  return LAB_TESTS.filter((t) => t.category === letter && !t.documentOnly);
}

/** Document-first entries of one category (the vault folders). */
export function labDocumentsByCategory(letter: LabCategoryLetter): LabTestDef[] {
  return LAB_TESTS.filter((t) => t.category === letter && t.documentOnly);
}

/** Normalized alias lookup: lowercase, strip non-alphanumerics, collapse spaces. */
export function normalizeLabName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const ALIAS_INDEX: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const t of LAB_TESTS) {
    for (const a of [t.key, ...t.aliases]) {
      const n = normalizeLabName(a);
      if (!m.has(n)) m.set(n, t.key); // first definition wins; catalog order is intentional
    }
  }
  return m;
})();

/** Exact alias match after normalization -> testKey (or undefined). */
export function labKeyForAlias(name: string): string | undefined {
  return ALIAS_INDEX.get(normalizeLabName(name));
}

/** Containment match (alias appears inside the string or vice versa) -> candidates ranked by length. */
export function labKeysContaining(name: string): string[] {
  const n = normalizeLabName(name);
  if (!n) return [];
  const hits: { key: string; len: number }[] = [];
  for (const [alias, key] of ALIAS_INDEX) {
    if (alias.length >= 3 && (alias.includes(n) || n.includes(alias))) {
      hits.push({ key, len: alias.length });
    }
  }
  hits.sort((a, b) => b.len - a.len);
  return [...new Set(hits.map((h) => h.key))];
}

// ---------- Derived markers (read-time only, never stored) ----------

/** HOMA-IR = fasting insulin (uU/mL) x fasting glucose (mg/dL) / 405. */
export function homaIr(fastingInsulinUiuMl: number, fastingGlucoseMgDl: number): number {
  return Math.round(((fastingInsulinUiuMl * fastingGlucoseMgDl) / 405) * 100) / 100;
}

/** Non-HDL cholesterol = total cholesterol - HDL (mg/dL). */
export function nonHdl(totalCholesterolMgDl: number, hdlMgDl: number): number {
  return Math.round((totalCholesterolMgDl - hdlMgDl) * 10) / 10;
}

/**
 * CKD-EPI 2021 eGFR estimate - DISPLAY ONLY, educational. Never replaces the
 * lab-printed eGFR; shown only when a panel has creatinine but no lab eGFR.
 * Equation (Inker et al., NEJM 2021), serum creatinine in mg/dL:
 *   142 x min(Scr/k,1)^a x max(Scr/k,1)^-1.2 x 0.9938^age x (1.012 if female)
 *   k = 0.7 (female) | 0.9 (male); a = -0.241 (female) | -0.302 (male)
 */
export function ckdEpiEgfr(
  creatinineMgDl: number,
  age: number,
  sex: 'male' | 'female' | 'other',
): number | null {
  if (!(creatinineMgDl > 0) || !(age > 0)) return null;
  const female = sex === 'female';
  const k = female ? 0.7 : 0.9;
  const alpha = female ? -0.241 : -0.302;
  const ratio = creatinineMgDl / k;
  const v =
    142 *
    Math.pow(Math.min(ratio, 1), alpha) *
    Math.pow(Math.max(ratio, 1), -1.2) *
    Math.pow(0.9938, age) *
    (female ? 1.012 : 1);
  return Math.round(v);
}

/** Display-only L/H flag from a range (lab-printed range wins over catalog default). */
export function labFlagFor(value: number, refLow?: number, refHigh?: number): 'L' | 'H' | null {
  if (refLow != null && value < refLow) return 'L';
  if (refHigh != null && value > refHigh) return 'H';
  return null;
}

// ---------- Panel payload validation (pure; the API route stays thin) ----------

export interface LabResultInput {
  testKey: string;
  value: number;
  unit?: string;
  refLow?: number;
  refHigh?: number;
}

/** A validated result row: unit always resolved (catalog default fills blanks). */
export interface ValidatedLabResult {
  testKey: string;
  value: number;
  unit: string;
  refLow?: number;
  refHigh?: number;
}

export interface LabPanelInput {
  name?: string;
  labName?: string;
  performedAt: string; // YYYY-MM-DD
  sourceNote?: string;
  results: LabResultInput[];
}

/**
 * Validate a panel payload. Plain-language errors; hba1c values entered in
 * mmol/mol are canonicalized to % (callers pass a converter because the
 * engine has no app units coupling).
 */
export function validateLabPanelInput(
  input: LabPanelInput,
  opts: { canonicalA1c?: (value: number, unit: string) => number } = {},
): { ok: true; data: { name: string; labName: string; sourceNote: string; performedAt: string; results: ValidatedLabResult[] } } | { ok: false; error: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.performedAt ?? '')) {
    return { ok: false, error: 'Test date must be YYYY-MM-DD.' };
  }
  if (!Array.isArray(input.results) || input.results.length === 0) {
    return { ok: false, error: 'A panel needs at least one result.' };
  }
  if (input.results.length > 60) {
    return { ok: false, error: 'A panel can hold at most 60 results.' };
  }

  const seen = new Set<string>();
  const results: ValidatedLabResult[] = [];
  for (const r of input.results) {
    if (!r || typeof r.testKey !== 'string') continue;
    const def = LAB_TEST_MAP[r.testKey];
    if (!def) return { ok: false, error: `Unknown test "${r.testKey}".` };
    if (def.documentOnly) return { ok: false, error: `"${def.label}" is a document category - upload it under Documents.` };
    const value = Number(r.value);
    if (!Number.isFinite(value) || value <= 0) return { ok: false, error: `${def.label}: value must be a positive number.` };
    if (value > 100000) return { ok: false, error: `${def.label}: value looks implausibly large.` };
    if (seen.has(r.testKey)) return { ok: false, error: `${def.label} appears twice - keep one value per test.` };
    seen.add(r.testKey);

    let unit = typeof r.unit === 'string' && r.unit.trim() ? r.unit.trim() : def.unit;
    let finalValue = value;
    // Canonicalize HbA1c to % so per-test trends compare like with like.
    if (r.testKey === 'hba1c' && unit === 'mmol/mol' && opts.canonicalA1c) {
      finalValue = opts.canonicalA1c(value, unit);
      unit = '%';
      if (!Number.isFinite(finalValue) || finalValue <= 0) {
        return { ok: false, error: 'HbA1c in mmol/mol could not be converted.' };
      }
    }

    results.push({
      testKey: r.testKey,
      value: finalValue,
      unit,
      ...(Number.isFinite(Number(r.refLow)) && Number(r.refLow) >= 0 ? { refLow: Number(r.refLow) } : {}),
      ...(Number.isFinite(Number(r.refHigh)) && Number(r.refHigh) >= 0 ? { refHigh: Number(r.refHigh) } : {}),
    });
  }
  if (results.length === 0) return { ok: false, error: 'No usable results.' };

  return {
    ok: true,
    data: {
      name: typeof input.name === 'string' ? input.name.trim().slice(0, 60) : '',
      labName: typeof input.labName === 'string' ? input.labName.trim().slice(0, 80) : '',
      sourceNote: typeof input.sourceNote === 'string' ? input.sourceNote.trim().slice(0, 200) : '',
      performedAt: input.performedAt,
      results,
    },
  };
}

// ---------- Filename standard (the user's spec) ----------
// YYYY-MM-DD_[Category]_[TestName]_[PatientName].ext
// e.g. 2026-10-15_Diabetes_HbA1c_JohnDoe.pdf
// Tokens keep word casing and drop everything else: "John Doe" -> "JohnDoe",
// "Total cholesterol" -> "TotalCholesterol", "HbA1c" -> "HbA1c".

/** Keep letters/digits only - everything else collapses away. */
export function sanitizeFileNameToken(raw: string): string {
  return String(raw ?? '')
    .replace(/[^A-Za-z0-9]+/g, '')
    .slice(0, 40);
}

/** Word-split, title-case each word, join - "john doe" -> "JohnDoe". */
export function nameToken(raw: string): string {
  const words = String(raw ?? '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1));
  return words.join('').slice(0, 40);
}

export function reportFileName(parts: {
  date: string; // YYYY-MM-DD (validated; falls back to 'undated' when malformed)
  category: string; // ReportDocument.category id
  testKey?: string | null; // catalog key for the TestName token
  patientName: string;
  ext: string; // without dot, e.g. 'pdf'
}): string {
  const cat = LAB_CATEGORIES.find((c) => c.id === parts.category);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(parts.date) ? parts.date : 'undated';
  const def = parts.testKey ? LAB_TEST_MAP[parts.testKey] : undefined;
  const testName = nameToken(def ? def.label : parts.testKey ?? 'Report') || 'Report';
  const patient = nameToken(parts.patientName) || 'Patient';
  const ext = parts.ext.replace(/[^A-Za-z0-9]/g, '').toLowerCase() || 'bin';
  return `${date}_${cat ? cat.token : sanitizeFileNameToken(parts.category) || 'Report'}_${testName}_${patient}.${ext}`;
}
