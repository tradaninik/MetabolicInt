// P6-d — lab catalog tests. The catalog IS the product spec (the user's A–E
// master structure), so structure invariants get pinned: unique keys, unique
// aliases, every test carrying category/group/unit/direction, derived math
// exact, filename standard sanitized.
import { describe, expect, it } from 'vitest';
import {
  LAB_CATEGORIES,
  LAB_TESTS,
  LAB_TEST_MAP,
  labTestsByCategory,
  labDocumentsByCategory,
  labKeyForAlias,
  labKeysContaining,
  homaIr,
  nonHdl,
  ckdEpiEgfr,
  labFlagFor,
  validateLabPanelInput,
  sanitizeFileNameToken,
  reportFileName,
} from './labs';

describe('catalog structure (the A–E master spec)', () => {
  it('has the five categories A–E with the user’s titles and filename tokens', () => {
    expect(LAB_CATEGORIES.map((c) => c.letter)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(LAB_CATEGORIES.map((c) => c.id)).toEqual(['diabetes', 'cardio', 'organ', 'nutrition', 'screening']);
    expect(LAB_CATEGORIES.map((c) => c.token)).toEqual(['Diabetes', 'Cardio', 'LiverThyroid', 'Nutrition', 'Screening']);
  });

  it('every test key is unique and every entry is well-formed', () => {
    const keys = LAB_TESTS.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const t of LAB_TESTS) {
      expect(t.label.trim().length, `${t.key} label`).toBeGreaterThan(0);
      expect(['A', 'B', 'C', 'D', 'E']).toContain(t.category);
      expect(t.group.trim().length, `${t.key} group`).toBeGreaterThan(0);
      expect(['lower-better', 'higher-better', 'context']).toContain(t.direction);
      if (!t.documentOnly && !t.calc) {
        // unitless by design: calculated markers (HOMA-IR, non-HDL-free)
        expect(t.unit.length, `${t.key} unit`).toBeGreaterThan(0);
      }
      if (!t.documentOnly) {
        expect(t.aliases.length, `${t.key} aliases`).toBeGreaterThan(0);
      }
    }
  });

  it('aliases normalize uniquely across the catalog (no alias maps to two tests)', () => {
    const seen = new Map<string, string>();
    for (const t of LAB_TESTS) {
      const norms = new Set(
        [t.key, ...t.aliases].map((a) => a.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()),
      );
      for (const norm of norms) {
        if (seen.has(norm)) {
          throw new Error(`normalized alias "${norm}" of ${t.key} collides with ${seen.get(norm)}`);
        }
        seen.set(norm, t.key);
      }
    }
  });

  it('numeric coverage matches the spec’s named panels', () => {
    const numeric = (k: string) => LAB_TEST_MAP[k] && !LAB_TEST_MAP[k].documentOnly;
    for (const k of [
      'hba1c', 'fbg', 'ppbs', 'fasting_insulin', 'c_peptide', 'homa_ir', 'creatinine', 'egfr', 'bun', 'uacr',
      'total_cholesterol', 'hdl', 'ldl', 'triglycerides', 'non_hdl', 'apob', 'vldl',
      'alt', 'ast', 'total_bilirubin', 'alp', 'albumin', 'tsh', 'free_t3', 'free_t4', 'anti_tpo',
      'vitamin_d', 'vitamin_b12', 'ferritin', 'serum_iron', 'tibc', 'magnesium', 'zinc',
    ]) {
      expect(numeric(k), `missing numeric test ${k}`).toBe(true);
    }
    for (const k of ['ecg', 'echocardiogram', 'stress_test', 'retinopathy_screening', 'fundus_photo', 'oct', 'foot_exam', 'ncv', 'vpt']) {
      expect(LAB_TEST_MAP[k]?.documentOnly, `${k} should be document-first`).toBe(true);
    }
  });

  it('Indian lab spellings resolve through the alias table', () => {
    expect(labKeyForAlias('HbA1c')).toBe('hba1c');
    expect(labKeyForAlias('Glycosylated Haemoglobin')).toBe('hba1c');
    expect(labKeyForAlias('S. Cholesterol')).toBe('total_cholesterol');
    expect(labKeyForAlias('TGL')).toBe('triglycerides');
    expect(labKeyForAlias('S.Creatinine')).toBe('creatinine');
    expect(labKeyForAlias('SGPT')).toBe('alt');
    expect(labKeyForAlias('SGOT')).toBe('ast');
    expect(labKeyForAlias('Blood Urea')).toBe('bun');
    expect(labKeyForAlias('FBS')).toBe('fbg');
    expect(labKeyForAlias('Vitamin D3')).toBe('vitamin_d');
    expect(labKeyForAlias('25-OH Vitamin D')).toBe('vitamin_d');
    expect(labKeyForAlias('2D Echo')).toBe('echocardiogram');
    expect(labKeyForAlias('TMT')).toBe('stress_test');
    expect(labKeyForAlias('Vit B12')).toBe('vitamin_b12');
  });

  it('containment search ranks the tighter alias first', () => {
    const keys = labKeysContaining('Serum Glucose Fasting');
    expect(keys[0]).toBe('fbg');
    expect(keys).toContain('fbg');
    expect(labKeysContaining('')).toEqual([]);
  });

  it('category browsers split numeric vs document entries', () => {
    expect(labTestsByCategory('A').every((t) => !t.documentOnly)).toBe(true);
    // E is document-first: no numeric entries, every E test is a document entry.
    expect(labTestsByCategory('E')).toEqual([]);
    expect(labDocumentsByCategory('E').length).toBe(6);
    expect(labDocumentsByCategory('A')).toEqual([]);
    expect(labDocumentsByCategory('B').map((t) => t.key).sort()).toEqual(['ecg', 'echocardiogram', 'stress_test']);
  });
});

describe('derived markers (read-time only)', () => {
  it('HOMA-IR = insulin x glucose / 405 (the canonical example: 12 x 108 / 405 = 3.2)', () => {
    expect(homaIr(12, 108)).toBe(3.2);
    expect(homaIr(8, 90)).toBeCloseTo(1.78, 2);
  });

  it('non-HDL = TC - HDL', () => {
    expect(nonHdl(200, 45)).toBe(155);
    expect(nonHdl(180.5, 50.2)).toBeCloseTo(130.3, 1);
  });

  it('CKD-EPI 2021 eGFR: matches the published equation, guards bad input', () => {
    // Hand-computed references (Inker et al. 2021):
    //   male, 40y, Scr 1.0: 142 x (1/0.9)^-1.2 x 0.9938^40 = 97.6 -> 98
    //   female, 40y, Scr 1.0: 142 x (1/0.7)^-1.2 x 0.9938^40 x 1.012 = 73.0 -> 73
    //   female, 45y, Scr 1.0: = 70.8 -> 71
    // At the SAME creatinine a female scores lower (1.0 is further above her
    // k=0.7); the 1.012 sex factor shows up when each sex sits at its own
    // neutral point (Scr = k -> both power terms are 1).
    expect(ckdEpiEgfr(1.0, 40, 'male')).toBe(98);
    expect(ckdEpiEgfr(1.0, 40, 'female')).toBe(73);
    expect(ckdEpiEgfr(1.0, 45, 'female')).toBe(71);

    const maleNeutral = ckdEpiEgfr(0.9, 50, 'male'); // Scr = k(male)
    const femaleNeutral = ckdEpiEgfr(0.7, 50, 'female'); // Scr = k(female)
    expect(femaleNeutral! / maleNeutral!).toBeCloseTo(1.012, 2);

    // Reduced kidney function -> lower eGFR.
    expect(ckdEpiEgfr(2.0, 60, 'male')!).toBeLessThan(50);
    expect(ckdEpiEgfr(2.0, 60, 'male')!).toBeGreaterThan(30);
    expect(ckdEpiEgfr(0, 40, 'male')).toBeNull();
    expect(ckdEpiEgfr(1.0, 0, 'male')).toBeNull();
    expect(ckdEpiEgfr(1.0, 40, 'other')).not.toBeNull(); // 'other' uses the male coefficients
  });

  it('L/H flag uses the given range only (display, never diagnosis)', () => {
    expect(labFlagFor(3.5, 4.0, 5.6)).toBe('L');
    expect(labFlagFor(6.9, 4.0, 5.6)).toBe('H');
    expect(labFlagFor(5.0, 4.0, 5.6)).toBeNull();
    expect(labFlagFor(5.0, undefined, undefined)).toBeNull();
  });
});

describe('validateLabPanelInput', () => {
  const ok = (results: { testKey: string; value: number; unit?: string; refLow?: number; refHigh?: number }[]) =>
    validateLabPanelInput({ performedAt: '2026-10-15', results });

  it('accepts a mixed panel and trims the strings', () => {
    const r = validateLabPanelInput({
      performedAt: '2026-10-15',
      name: '  Quarterly ',
      labName: ' Thyrocare ',
      results: [
        { testKey: 'hba1c', value: 6.8, refLow: 4, refHigh: 5.6 },
        { testKey: 'fbg', value: 112 },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.name).toBe('Quarterly');
      expect(r.data.labName).toBe('Thyrocare');
      expect(r.data.results[0].unit).toBe('%');
      expect(r.data.results[1].unit).toBe('mg/dL');
    }
  });

  it('rejects bad dates, empty results, unknown keys, duplicates, non-positive values', () => {
    expect(validateLabPanelInput({ performedAt: '15/10/2026', results: [{ testKey: 'hba1c', value: 6 }] }).ok).toBe(false);
    expect(validateLabPanelInput({ performedAt: '2026-10-15', results: [] }).ok).toBe(false);
    expect(ok([{ testKey: 'nope', value: 1 }]).ok).toBe(false);
    expect(ok([{ testKey: 'hba1c', value: 6 }, { testKey: 'hba1c', value: 6.1 }]).ok).toBe(false);
    expect(ok([{ testKey: 'hba1c', value: 0 }]).ok).toBe(false);
    expect(ok([{ testKey: 'hba1c', value: -1 }]).ok).toBe(false);
    expect(ok([{ testKey: 'hba1c', value: 1e9 }]).ok).toBe(false);
  });

  it('document-only keys are rejected with a pointer to Documents', () => {
    const r = ok([{ testKey: 'ecg', value: 1 }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('Documents');
  });

  it('canonicalizes hba1c entered in mmol/mol to % via the injected converter', () => {
    const r = validateLabPanelInput(
      { performedAt: '2026-10-15', results: [{ testKey: 'hba1c', value: 48, unit: 'mmol/mol' }] },
      { canonicalA1c: (v) => Math.round((v / 10.929 + 2.152) * 100) / 100 },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.results[0].unit).toBe('%');
      expect(r.data.results[0].value).toBeCloseTo(6.54, 2);
    }
  });
});

describe('filename standard (user spec: YYYY-MM-DD_[Category]_[TestName]_[PatientName].ext)', () => {
  it('builds the exact example: 2026-10-15 Diabetes HbA1c JohnDoe pdf', () => {
    expect(reportFileName({ date: '2026-10-15', category: 'diabetes', testKey: 'hba1c', patientName: 'John Doe', ext: 'pdf' }))
      .toBe('2026-10-15_Diabetes_HbA1c_JohnDoe.pdf');
  });

  it('uses the category tokens and collapses multiword labels safely', () => {
    expect(reportFileName({ date: '2026-01-02', category: 'cardio', testKey: 'total_cholesterol', patientName: 'Lakshmi', ext: 'PDF' }))
      .toBe('2026-01-02_Cardio_TotalCholesterol_Lakshmi.pdf');
    expect(reportFileName({ date: '2026-01-02', category: 'organ', testKey: 'tsh', patientName: 'Ramesh K.', ext: 'jpg' }))
      .toBe('2026-01-02_LiverThyroid_TSH_RameshK.jpg');
    expect(reportFileName({ date: '2026-01-02', category: 'screening', testKey: 'foot_exam', patientName: '', ext: 'png' }))
      .toBe('2026-01-02_Screening_DiabeticFootExam_Patient.png');
  });

  it('falls back gracefully on malformed dates / unknown categories / hostile names', () => {
    const name = reportFileName({ date: 'not-a-date', category: 'nutrition', testKey: 'vitamin_d', patientName: '../../etc/passwd', ext: 'pdf' });
    expect(name).toBe('undated_Nutrition_VitaminD25OH_EtcPasswd.pdf');
    expect(sanitizeFileNameToken('!@#$%')).toBe('');
    expect(reportFileName({ date: '2026-01-02', category: 'bogus', testKey: null, patientName: 'X', ext: 'pdf' }))
      .toBe('2026-01-02_bogus_Report_X.pdf');
  });
});
