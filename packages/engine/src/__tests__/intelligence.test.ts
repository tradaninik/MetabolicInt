import { describe, it, expect } from 'vitest';
import {
  buildIntelligenceReport,
  INTELLIGENCE_DISCLAIMER,
  type IntelligenceInput,
  type LabResultLite,
} from '../intelligence';

// Fixture: the Healthians "Lakshmi" report (57F, T2DM) - 5 panels, 2023-2026.
// Same numbers as apps/web/scripts/devdata-lakshmi.ts, so the demo account and
// the test suite validate the same clinical story.
const P = '2023-06-12';
const Q = '2025-03-29';
const R = '2025-11-30';
const S = '2026-04-05';
const T = '2026-11-06';
const AS_OF = '2026-11-09';

function L(testKey: string, value: number, when: string, unit = '', lo?: number, hi?: number, flag?: string): LabResultLite {
  return { testKey, value, unit, refLow: lo ?? null, refHigh: hi ?? null, flag: flag ?? null, performedAt: when };
}

function lakshmiLabs(): LabResultLite[] {
  const rows: LabResultLite[] = [
    // HbA1c: 6.5 -> 6.3 -> 6.7 -> 7.2 -> 7.8 (the headline deterioration)
    L('hba1c', 6.5, P, '%', 4.2, 5.7, 'H'), L('hba1c', 6.3, Q, '%', 4.2, 5.7, 'H'),
    L('hba1c', 6.7, R, '%', 4.2, 5.7, 'H'), L('hba1c', 7.2, S, '%', 4.2, 5.7, 'H'),
    L('hba1c', 7.8, T, '%', 4.2, 5.7, 'H'),
    // lipids
    L('total_cholesterol', 249, P, 'mg/dl', 0, 200, 'H'), L('total_cholesterol', 227, Q, 'mg/dl', 0, 200, 'H'),
    L('total_cholesterol', 219, R, 'mg/dl', 0, 200, 'H'), L('total_cholesterol', 239.4, S, 'mg/dl', 0, 200, 'H'),
    L('total_cholesterol', 256, T, 'mg/dl', 0, 200, 'H'),
    L('hdl', 39.7, P, 'mg/dl', 40, 60, 'L'), L('hdl', 42.7, Q, 'mg/dl', 40, 60), L('hdl', 46.9, R, 'mg/dl', 40, 60),
    L('hdl', 51.1, S, 'mg/dl', 40, 60), L('hdl', 56.5, T, 'mg/dl', 40, 60),
    L('ldl', 167, P, 'mg/dl', 0, 100, 'H'), L('ldl', 175.4, S, 'mg/dl', 0, 100, 'H'), L('ldl', 189, T, 'mg/dl', 0, 100, 'H'),
    L('tg', 316, P, 'mg/dl', 0, 150, 'H'), L('tg', 113, Q, 'mg/dl', 0, 150), L('tg', 148, R, 'mg/dl', 0, 150),
    L('tg', 210.2, S, 'mg/dl', 0, 150, 'H'), L('tg', 156, T, 'mg/dl', 0, 150, 'H'),
    L('vldl', 63.2, Q, 'mg/dl', 0, 30, 'H'), L('vldl', 13, S, 'mg/dl', 0, 30), L('vldl', 11, T, 'mg/dl', 0, 30),
    L('apo_a1', 127.69, S, 'mg/dl', 105, 205), L('apo_a1', 120.88, T, 'mg/dl', 105, 205),
    L('apo_b', 152.59, S, 'mg/dl', 55, 130, 'H'), L('apo_b', 210.11, T, 'mg/dl', 55, 130, 'H'),
    // inflammation
    L('hs_crp', 4.8, P, 'mg/L', 0, 1, 'H'), L('hs_crp', 6.84, S, 'mg/L', 0, 1, 'H'), L('hs_crp', 5.5, T, 'mg/L', 0, 1, 'H'),
    // liver
    L('alt', 15, P, 'U/L', 3, 35), L('alt', 13, Q, 'U/L', 3, 35), L('alt', 17, R, 'U/L', 3, 35),
    L('alt', 47, S, 'U/L', 3, 35, 'H'), L('alt', 41, T, 'U/L', 3, 35, 'H'),
    L('ast', 16, P, 'U/L', 3, 35), L('ast', 36.1, S, 'U/L', 3, 35, 'H'), L('ast', 28, T, 'U/L', 3, 35),
    L('alp', 113, Q, 'U/L', 33, 98, 'H'), L('alp', 76, R, 'U/L', 33, 98), L('alp', 101.7, S, 'U/L', 33, 98, 'H'), L('alp', 90, T, 'U/L', 33, 98),
    L('ggt', 26, Q, 'U/L', 5, 38), L('ggt', 34.2, S, 'U/L', 5, 38), L('ggt', 26, T, 'U/L', 5, 38),
    L('nafld', -1.72, T, 'score', -1.455, 0.675),
    // nutrition
    L('vitamin_d', 28, P, 'ng/ml', 30, 100, 'L'), L('vitamin_d', 67.07, Q, 'ng/ml', 30, 100),
    L('vitamin_d', 40.3, R, 'ng/ml', 30, 100), L('vitamin_d', 27.32, S, 'ng/ml', 30, 100, 'L'),
    L('vitamin_d', 30.93, T, 'ng/ml', 30, 100),
    L('vitamin_b12', 530, T, 'pg/ml', 211, 912),
    L('homocysteine', 22.31, T, 'umol/L', 3.7, 13.9, 'H'),
    L('iron', 50, Q, 'ug/dl', 60, 180, 'L'), L('iron', 60, R, 'ug/dl', 60, 180), L('iron', 73.4, S, 'ug/dl', 60, 180), L('iron', 85, T, 'ug/dl', 60, 180),
    L('tibc', 349, T, 'ug/dl', 250, 400), L('transferrin_sat', 24.36, T, '%', 15, 50),
    // kidney + thyroid
    L('creatinine', 0.74, P, 'mg/dl', 0.6, 1.3), L('creatinine', 0.68, Q, 'mg/dl', 0.6, 1.3),
    L('creatinine', 0.54, R, 'mg/dl', 0.6, 1.3), L('creatinine', 0.52, S, 'mg/dl', 0.6, 1.3), L('creatinine', 0.62, T, 'mg/dl', 0.6, 1.3),
    L('egfr', 103.8, T, 'mL/min', 90, 120),
    L('urea', 34, P, 'mg/dl', 17, 43), L('urea', 22, T, 'mg/dl', 17, 43),
    L('uric_acid', 5.8, P, 'mg/dl', 2.6, 6), L('uric_acid', 5.4, Q, 'mg/dl', 2.6, 6),
    L('uric_acid', 4.9, R, 'mg/dl', 2.6, 6), L('uric_acid', 5.5, S, 'mg/dl', 2.6, 6), L('uric_acid', 6.0, T, 'mg/dl', 2.6, 6),
    L('tsh', 4.68, P, 'uIU/ml', 0.55, 4.78), L('tsh', 3.12, Q, 'uIU/ml', 0.55, 4.78),
    L('tsh', 3.44, R, 'uIU/ml', 0.55, 4.78), L('tsh', 4.01, S, 'uIU/ml', 0.55, 4.78), L('tsh', 2.817, T, 'uIU/ml', 0.55, 4.78),
    L('t3', 1.2, P, 'ng/ml', 0.6, 1.81), L('t3', 1.09, T, 'ng/ml', 0.6, 1.81),
    L('t4', 9.9, P, 'ug/dl', 3.2, 12.6), L('t4', 10.7, T, 'ug/dl', 3.2, 12.6),
    // hematology
    L('hemoglobin', 12.3, P, 'g/dL', 12, 15), L('hemoglobin', 12.6, Q, 'g/dL', 12, 15),
    L('hemoglobin', 13.1, R, 'g/dL', 12, 15), L('hemoglobin', 12.9, S, 'g/dL', 12, 15), L('hemoglobin', 13.4, T, 'g/dL', 12, 15),
    L('platelets', 287, P, '10^3/ul', 150, 410), L('platelets', 263, T, '10^3/ul', 150, 410),
    L('mcv', 78.7, T, 'fL', 83, 101, 'L'), L('mch', 26.7, T, 'pg', 27, 32, 'L'), L('mchc', 33.8, T, 'g/dL', 31.5, 34.5),
    L('rbc', 5.04, T, '10^6/ul', 3.8, 4.8, 'H'), L('tlc', 5.4, T, '10^3/uL', 4, 10), L('rdw_cv', 12.9, T, '%', 11.6, 14),
    // electrolytes + proteins
    L('sodium', 141, P, 'mmol/L', 136, 146), L('sodium', 141, T, 'mmol/L', 136, 146),
    L('potassium', 4.05, T, 'mmol/L', 3.5, 5.5), L('chloride', 102, T, 'mmol/L', 101, 109),
    L('calcium', 9.4, T, 'mg/dl', 8.8, 10.6), L('phosphorus', 3.6, T, 'mg/dl', 2.5, 4.5),
    L('albumin', 4.3, T, 'g/dl', 3.5, 5.2), L('total_protein', 7.36, T, 'gm/dl', 6.6, 8.3),
    L('bilirubin_total', 0.6, T, 'mg/dl', 0.3, 1.2),
    // latest-only extras
    L('fbg', 144, T, 'mg/dl', 70, 100, 'H'),
    L('non_hdl', 199.5, T, 'mg/dl', 0, 160, 'H'),
    L('chol_hdl_ratio', 4.53, T, 'ratio', 3.3, 4.4, 'H'),
    L('apo_ratio', 1.74, T, 'ratio', 0.3, 1.49, 'H'),
    // a custom lab-test row (P7.1 style) that must NOT be dropped silently
    L('custom:xyz', 7.3, T, 'U/mL', 0, 30.2),
  ];
  return rows;
}

function rel(daysAgo: number, h: number, m: number): string {
  const d = new Date(Date.parse(AS_OF + 'T00:00:00Z') - daysAgo * 86_400_000);
  d.setUTCHours(h, m, 0, 0);
  return d.toISOString();
}

function lakshmiInput(): IntelligenceInput {
  const glucose: { value: number; takenAt: string }[] = [];
  const fasting = [142, 138, 145, 135, 148, 141, 137, 144, 139, 146, 134, 143, 140, 147];
  const lunch = [186, 172, 195, 168, 203, 178, 190, 175, 199, 171, 184, 207, 176, 188];
  const dinner = [165, 178, 158, 192, 171, 185, 203, 167, 174, 196, 162, 181, 189, 173];
  for (let i = 0; i < 14; i++) {
    glucose.push({ value: fasting[i], takenAt: rel(13 - i, 1, 40) });
    glucose.push({ value: lunch[i], takenAt: rel(13 - i, 9, 10) });
    glucose.push({ value: dinner[i], takenAt: rel(13 - i, 16, 10) });
  }
  const meals: IntelligenceInput['meals'] = [];
  for (let d = 0; d < 10; d++) {
    const day = 9 - d;
    meals.push({ kcal: 320, carbsG: 38, proteinG: 9, fiberG: 3, loggedAt: rel(day, 2, 30) });
    meals.push({ kcal: 620, carbsG: 72, proteinG: 22, fiberG: 9, loggedAt: rel(day, 7, 30) });
    meals.push({ kcal: 120, carbsG: 15, proteinG: 4, fiberG: 2, loggedAt: rel(day, 11, 30) });
    meals.push({ kcal: 520, carbsG: 58, proteinG: 20, fiberG: 7, loggedAt: rel(day, 15, 0) });
  }
  const activity: IntelligenceInput['activity'] = [];
  for (let d = 0; d < 14; d++) {
    if (d !== 3 && d !== 9) activity.push({ type: 'walk', durationMin: 22, at: rel(13 - d, 13, 0) });
    if (d === 2 || d === 8) activity.push({ type: 'yoga', durationMin: 30, at: rel(13 - d, 1, 45) });
  }
  const sleepHours = [6.1, 5.8, 6.5, 6.0, 7.2, 5.6, 6.3, 6.8, 5.9, 6.4, 7.0, 5.7, 6.2, 6.6];
  return {
    asOf: AS_OF,
    profile: {
      name: 'Lakshmi', age: 57, gender: 'female', heightCm: 157, weightKg: 74.2, hba1c: 7.8,
      diabetic: true, activityLevel: 'light', region: 'telugu',
      conditions: ['Type 2 Diabetes', 'Dyslipidemia', 'Hypertension'],
    },
    labs: lakshmiLabs(),
    meds: [
      { name: 'Metformin', isActive: true },
      { name: 'Telmisartan', isActive: true },
      { name: 'Vitamin D3 (weekly)', isActive: true },
    ],
    adherencePct: 92,
    glucose,
    meals,
    activity,
    sleep: sleepHours.map((h, i) => ({ hours: h, wokeAt: rel(13 - i, 1, 35) })),
    weight: [74.2, 74.0, 73.6, 73.4].map((kg, i) => ({ kg, takenAt: rel(12 - i * 4, 2, 0) })),
    bp: [[138, 84], [142, 86], [135, 82], [146, 90], [139, 85], [143, 88]].map((x, i) => ({
      systolic: x[0], diastolic: x[1], takenAt: rel(13 - i * 2, 2, 30),
    })),
    survey: {
      dietPattern: 'veg', riceFrequency: 'daily', sweetsFrequency: 'weekly', teaCoffeeSugar: 'some',
      eatingOutFrequency: 'sometimes', cookingOil: 'sunflower', walkMinutesPerDay: 15, strengthPerWeek: 0,
      sittingHours: 6, stressLevel: 4, sleepQuality: 'disturbed', menopause: 'post',
      symptoms: ['Tiredness or low energy', 'Joint pains'], familyHistory: ['Diabetes', 'High blood pressure'],
      primaryGoal: 'sugar',
    },
  };
}

describe('buildIntelligenceReport - the Lakshmi report', () => {
  const r = buildIntelligenceReport(lakshmiInput());

  it('produces the doctor-style skeleton with real coverage numbers', () => {
    expect(r.hasLabs).toBe(true);
    expect(r.patientLine).toBe('57-year-old woman');
    expect(r.dataCoverage.panelDates).toHaveLength(5);
    expect(r.dataCoverage.panelDates[0]).toBe('2026-11-06');
    expect(r.dataCoverage.activeMeds).toBe(3);
    expect(r.dataCoverage.glucoseLast14d).toBe(42);
    expect(r.dataCoverage.mealDaysLast14d).toBe(10);
    expect(r.dataCoverage.surveyDone).toBe(true);
    expect(r.ninetyDay).toHaveLength(3);
    expect(r.disclaimer).toBe(INTELLIGENCE_DISCLAIMER);
  });

  it('ranks blood sugar first and keeps every promised section populated', () => {
    expect(r.priorities.length).toBeGreaterThanOrEqual(8);
    expect(r.priorities[0].area).toBe('glycemic');
    expect(r.priorities[0].severity).toBe('high');
    const areas = r.priorities.map((p) => p.area);
    expect(areas).toContain('lipids');
    expect(areas).toContain('inflammation');
    expect(areas).toContain('homocysteine');
    expect(areas).toContain('hematology'); // microcytosis catch
    for (const p of r.priorities) {
      expect(p.title.length).toBeGreaterThan(5);
      expect(p.evidence.length).toBeGreaterThan(0);
      expect(p.doNow.length).toBeGreaterThan(10);
    }
  });

  it('reads the trends the way the report charts do', () => {
    const byKey = Object.fromEntries(r.trends.map((t) => [t.key, t]));
    expect(byKey.hba1c.verdict).toBe('worsening');
    expect(byKey.hba1c.series).toHaveLength(5);
    expect(byKey.hdl.verdict).toBe('improving');
    expect(byKey.hdl.series[0].value).toBeCloseTo(39.7, 1);
    expect(byKey.hdl.series.at(-1)!.value).toBeCloseTo(56.5, 1);
    expect(byKey.tg.verdict).toBe('improving');
    expect(byKey.vitamin_d.verdict).toBe('improving'); // low-is-bad test: rising = improving
    expect(r.trends.length).toBeLessThanOrEqual(8);
  });

  it('catches the subtle microcytosis picture and recommends HbA2', () => {
    const micro = r.priorities.find((p) => p.area === 'hematology')!;
    expect(micro.title).toContain('Small red blood cells');
    expect(r.followUps.some((f) => f.name.includes('electrophoresis'))).toBe(true);
  });

  it('schedules the diabetic annual care set', () => {
    const names = r.followUps.map((f) => f.name).join(' | ');
    expect(names).toContain('Retina');
    expect(names).toContain('uACR');
    expect(r.followUps.some((f) => f.priority === 'soon' && f.name.includes('HbA1c'))).toBe(true);
  });

  it('celebrates what is working', () => {
    const joined = r.positives.join(' ');
    expect(joined).toContain('HDL');
    expect(joined).toContain('eGFR');
    expect(joined).toContain('TSH');
    expect(joined).toContain('NAFLD');
  });

  it('maps medications honestly into the lifestyle-vs-medication table', () => {
    const glycemic = r.lifestyleVsMeds.find((x) => x.area === 'glycemic')!;
    expect(glycemic.medication).toContain('Metformin');
    const lipids = r.lifestyleVsMeds.find((x) => x.area === 'lipids')!;
    expect(lipids.medication).toBe('None on your list'); // no statin seeded on purpose
    expect(lipids.medicationNote).toContain('doctor');
    const bp = r.lifestyleVsMeds.find((x) => x.area === 'bp')!;
    expect(bp.medication).toContain('Telmisartan');
  });

  it('personalizes the Indian high-fibre plate for a daily-rice vegetarian', () => {
    expect(r.dietPlan.swaps.some((s) => s.to.toLowerCase().includes('millet'))).toBe(true);
    const day = JSON.stringify(r.dietPlan.sampleDay);
    expect(day).not.toContain('fish'); // vegetarian plate
    expect(r.dietPlan.dailyTargets.length).toBeGreaterThanOrEqual(5);
    expect(r.activityPlan.weekly).toHaveLength(7);
    expect(r.activityPlan.safetyNotes.join(' ')).toContain('feet');
  });

  it('keeps unmatched custom tests visible instead of dropping them', () => {
    expect(r.unmatchedTests).toHaveLength(1);
    expect(r.unmatchedTests[0].unit).toBe('U/mL');
  });

  it('scores the composite honestly', () => {
    expect(r.score.overall).toBeGreaterThanOrEqual(45);
    expect(r.score.overall).toBeLessThanOrEqual(75);
    expect(r.score.label).toBe('Needs attention');
    const comp = Object.fromEntries(r.score.components.map((c) => [c.key, c.score]));
    expect(comp.lipids).toBeLessThan(50);
    expect(comp.organs).toBeGreaterThan(60);
  });

  it('writes a headline and summary grounded in the findings', () => {
    expect(r.headline).toContain('Blood-sugar');
    expect(r.summary).toContain('Lakshmi');
    expect(r.summary).toContain('HbA1c');
    expect(r.summary.length).toBeGreaterThan(120);
  });
});

describe('buildIntelligenceReport - graceful degradation', () => {
  it('empty input never crashes and reports no labs', () => {
    const r = buildIntelligenceReport({ profile: {}, labs: [], meds: [] });
    expect(r.hasLabs).toBe(false);
    expect(r.priorities).toEqual([]);
    expect(r.score.overall).toBeGreaterThanOrEqual(0);
    expect(r.score.overall).toBeLessThanOrEqual(100);
    expect(r.trends).toEqual([]);
    expect(r.followUps).toEqual([]);
  });

  it('flags missing personalization instead of guessing', () => {
    const r = buildIntelligenceReport({
      profile: { gender: 'female', age: 40 },
      labs: [L('hba1c', 7.1, '2026-01-01', '%', 4.2, 5.7, 'H')],
      meds: [],
    });
    expect(r.questionnaireGaps.length).toBeGreaterThan(0);
    expect(r.dataCoverage.surveyDone).toBe(false);
  });

  it('recognizes lab-printed keys with spacing and case noise', () => {
    const r = buildIntelligenceReport({
      profile: { age: 50 },
      labs: [
        { testKey: 'HbA1c (Glycosylated Hemoglobin)', value: 7.4, unit: '%', refLow: 4.2, refHigh: 5.7, flag: 'H', performedAt: '2026-01-01' },
        { testKey: 'Apolipoproteins B, Serum', value: 190, unit: 'mg/dl', refLow: 55, refHigh: 130, flag: 'H', performedAt: '2026-01-01' },
      ],
      meds: [],
    });
    expect(r.priorities.some((p) => p.area === 'glycemic')).toBe(true);
    expect(r.priorities.some((p) => p.area === 'lipids')).toBe(true);
  });
});