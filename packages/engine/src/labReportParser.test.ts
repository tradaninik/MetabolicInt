// P6-c — parser fixtures. 3–4 realistic Indian lab report layouts
// (Thyrocare/Metropolis/Dr Lal-style, plus a CSV export) covering A–D
// categories. The parser must be tolerant (column drift, ":" separators,
// glued ranges, H/L flags, Indian spellings) and honest (unmatched lines are
// returned, never silently dropped or guessed).
import { describe, expect, it } from 'vitest';
import { parseLabReportText } from './labReportParser';

const THYROCARE_STYLE = `
THYROCARE TECHNOLOGIES LTD.
Aarogyam Comprehensive Report
Patient Name : John Doe
Age / Gender : 46 Years / Male
Reported on : 15/10/2026
----------------------------------------------------------------
Test Name            Result    Unit     Reference Range
HbA1c (Glycosylated Haemoglobin)  6.8   %        4.3 - 5.7
Fasting Blood Sugar   112       mg/dL    70 - 100
Insulin Fasting       14.2      uU/mL    2.6 - 24.9
S. Creatinine         0.9       mg/dL    0.7 - 1.3
Blood Urea            22        mg/dL    7 - 20
S. Cholesterol        212       mg/dL    130 - 200
S. HDL Cholesterol    38        mg/dL    40 - 60
S. LDL Cholesterol    138       mg/dL    < 100
TGL (Triglycerides)   168       mg/dL    < 150
SGPT (ALT)            44        U/L      9 - 50
SGOT (AST)            32        U/L      10 - 40
TSH                   3.18      uIU/mL   0.4 - 4.0
Vitamin D, 25-Hydroxy 18.4      ng/mL    30 - 100
Vitamin B12 (Cobalamin)  286    pg/mL    200 - 900
`;

const METROPOLIS_STYLE = `
Metropolis Healthcare Ltd.
 Comprehensive Health Check - Level 2
 Registered on 02-01-2027 08:14
Sr.No  Investigation                  Value       Unit        Ref. Interval
1      Fasting Blood Glucose          98          mg/dl       70 - 100
2      HbA1c                          6.2         %           <5.7
3      Glycosylated Haemoglobin       6.2         %           <5.7
4      Total Cholesterol              198         mg/dl       <200
5      HDL Cholesterol                42          mg/dl       40-60
6      LDL Cholesterol Direct         121         mg/dl       <100
7      Triglycerides                  154         mg/dl       <150
8      Non HDL Cholesterol            156         mg/dl       <130
9      S.Creatinine                   1.05        mg/dl       0.7-1.3
10     Blood Urea Nitrogen            18          mg/dl       7-20
11     SGPT                            36          U/L         9-50
12     Serum Albumin                  4.2         g/dl        3.5-5.2
13     Free T3                        3.1         pg/ml       2.3-4.2
14     Free T4                        1.12        ng/dl       0.89-1.76
15     Ferritin                       88          ng/ml       30-300
16     Hb (Haemoglobin)               13.6        g/dl        13-17
`;

const DR_LAL_STYLE = `
Dr. Lal PathLabs
S.No.	Test Parameter	Result	Unit	Reference Range
1	POSTPRANDIAL BLOOD SUGAR (PPBS)	142	mg/dL	70 - 140
2	Glycosylated Haemoglobin (HbA1c)	6.9	%	4.3 - 5.7
3	C-Peptide, Fasting	2.8	ng/mL	0.9 - 7.1
4	Urine Albumin - Creatinine Ratio (uACR)	42	mg/g	< 30
5	Alkaline Phosphatase (ALP)	86	U/L	40 - 129
6	Total Bilirubin	0.8	mg/dL	0.3 - 1.2
7	Anti TPO Antibodies	12	IU/mL	< 34
8	Serum Iron	118	ug/dL	60 - 170
9	TIBC (Total Iron Binding Capacity)	352	ug/dL	240 - 450
10	Serum Magnesium	2.1	mg/dL	1.7 - 2.2
11	Serum Zinc	84	ug/dL	70 - 120
12	Apolipoprotein - B (ApoB)	96	mg/dL	60 - 130
`;

const CSV_EXPORT = `Test Name,Result,Unit,Reference Range
HbA1c,6.5,%,4.3 - 5.7
Fasting Blood Glucose,105,mg/dL,70 - 100
Total Cholesterol,190,mg/dL,130 - 200
HDL Cholesterol,44,mg/dL,40 - 60
LDL Cholesterol,112,mg/dL,<100
Triglycerides,140,mg/dL,<150
SGPT (ALT),40,U/L,9 - 50
SGOT (AST),29,U/L,10 - 40
TSH,2.9,uIU/mL,0.4 - 4.0
Creatinine,0.95,mg/dL,0.7 - 1.3
Blood Urea,16,mg/dL,7 - 20
Vitamin D (25 OH),22,ng/mL,30 - 100
Vitamin B12,312,pg/mL,200 - 900
Ferritin,76,ng/mL,30 - 300
`;

describe('parseLabReportText — Thyrocare-style prose (A–D coverage)', () => {
  const r = parseLabReportText(THYROCARE_STYLE);

  it('recognizes the lab chain and the report date (dd/mm/yyyy -> ISO)', () => {
    expect(r.labName).toBe('Thyrocare');
    expect(r.performedAt).toBe('2026-10-15');
    expect(r.format).toBe('text');
  });

  it('maps every catalog test incl. Indian spellings and long names', () => {
    const byKey = new Map(r.matches.map((m) => [m.testKey, m]));
    expect(byKey.size).toBe(14);
    expect(byKey.get('hba1c')?.value).toBe(6.8);
    expect(byKey.get('hba1c')?.confidence).toBe(1);
    expect(byKey.get('hba1c')?.refHigh).toBe(5.7);
    expect(byKey.get('fbg')?.value).toBe(112);
    expect(byKey.get('fasting_insulin')?.value).toBeCloseTo(14.2, 1);
    expect(byKey.get('creatinine')?.value).toBe(0.9);
    expect(byKey.get('bun')?.value).toBe(22);
    expect(byKey.get('total_cholesterol')?.value).toBe(212);
    expect(byKey.get('hdl')?.value).toBe(38);
    expect(byKey.get('ldl')?.value).toBe(138);
    expect(byKey.get('ldl')?.refHigh).toBe(100); // "< 100"
    expect(byKey.get('triglycerides')?.value).toBe(168);
    expect(byKey.get('triglycerides')?.refHigh).toBe(150);
    expect(byKey.get('alt')?.value).toBe(44);
    expect(byKey.get('ast')?.value).toBe(32);
    expect(byKey.get('tsh')?.value).toBeCloseTo(3.18, 2);
    expect(byKey.get('vitamin_d')?.value).toBeCloseTo(18.4, 1);
    expect(byKey.get('vitamin_d')?.asPrinted).toContain('25-Hydroxy');
    expect(byKey.get('vitamin_b12')?.value).toBe(286);
  });

  it('drops non-catalog rows into unmatched instead of guessing (Hb is not a panel test)', () => {
    expect(r.unmatched.map((u) => u.name).join(' ')).not.toContain('HbA1c');
    expect(r.unmatched.length).toBe(0); // every line here maps or is header/meta
  });
});

describe('parseLabReportText — Metropolis-style with numbering and duplicates', () => {
  const r = parseLabReportText(METROPOLIS_STYLE);

  it('finds the date in dd-mm-yyyy and keeps first-wins on duplicate keys', () => {
    expect(r.performedAt).toBe('2027-01-02');
    expect(r.labName).toBe('Metropolis');
    const keys = r.matches.map((m) => m.testKey);
    expect(keys.filter((k) => k === 'hba1c')).toHaveLength(1); // HbA1c + Glycosylated Haemoglobin dedupe
  });

  it('parses values despite leading row numbers and glued ranges', () => {
    const byKey = new Map(r.matches.map((m) => [m.testKey, m]));
    expect(byKey.get('fbg')?.value).toBe(98); // not the row number 1
    expect(byKey.get('hba1c')?.value).toBe(6.2);
    expect(byKey.get('hdl')?.value).toBe(42); // row 5
    expect(byKey.get('ldl')?.value).toBe(121); // row 6, not 6 = LDL row number trap
    expect(byKey.get('ldl')?.refHigh).toBe(100);
    expect(byKey.get('non_hdl')?.value).toBe(156);
    expect(byKey.get('creatinine')?.value).toBeCloseTo(1.05, 2);
    expect(byKey.get('bun')?.value).toBe(18);
    expect(byKey.get('free_t3')?.value).toBeCloseTo(3.1, 1);
    expect(byKey.get('free_t4')?.value).toBeCloseTo(1.12, 2);
    expect(byKey.get('ferritin')?.value).toBe(88);
    expect(byKey.get('albumin')?.value).toBeCloseTo(4.2, 1);
  });

  it('reports non-catalog analytes as unmatched with suggestions available', () => {
    const hb = r.unmatched.find((u) => /Hb \(Haemoglobin\)/i.test(u.name));
    expect(hb).toBeDefined();
    expect(hb?.value).toBe(13.6);
  });
});

describe('parseLabReportText — Dr Lal-style tabs with verbose names', () => {
  const r = parseLabReportText(DR_LAL_STYLE);

  it('maps PPBS, C-peptide, uACR, ALP, bilirubin, anti-TPO, iron panel, minerals, ApoB', () => {
    const byKey = new Map(r.matches.map((m) => [m.testKey, m]));
    expect(byKey.size).toBe(12);
    expect(byKey.get('ppbs')?.value).toBe(142);
    expect(byKey.get('c_peptide')?.value).toBeCloseTo(2.8, 1);
    expect(byKey.get('uacr')?.value).toBe(42);
    expect(byKey.get('uacr')?.refHigh).toBe(30);
    expect(byKey.get('alp')?.value).toBe(86);
    expect(byKey.get('total_bilirubin')?.value).toBeCloseTo(0.8, 1);
    expect(byKey.get('anti_tpo')?.value).toBe(12);
    expect(byKey.get('serum_iron')?.value).toBe(118);
    expect(byKey.get('tibc')?.value).toBe(352);
    expect(byKey.get('magnesium')?.value).toBeCloseTo(2.1, 1);
    expect(byKey.get('zinc')?.value).toBe(84);
    expect(byKey.get('apob')?.value).toBe(96);
  });

  it('tab-separated file is treated as CSV format', () => {
    expect(r.format).toBe('csv');
  });
});

describe('parseLabReportText — CSV export', () => {
  const r = parseLabReportText(CSV_EXPORT);

  it('parses the header, all rows, and both glued and < forms of ranges', () => {
    expect(r.format).toBe('csv');
    const byKey = new Map(r.matches.map((m) => [m.testKey, m]));
    expect(byKey.size).toBe(14);
    expect(byKey.get('hba1c')?.value).toBe(6.5);
    expect(byKey.get('fbg')?.value).toBe(105);
    expect(byKey.get('hdl')?.refLow).toBe(40);
    expect(byKey.get('hdl')?.refHigh).toBe(60);
    expect(byKey.get('ldl')?.refHigh).toBe(100);
    expect(byKey.get('vitamin_d')?.value).toBe(22);
    expect(byKey.get('vitamin_b12')?.value).toBe(312);
  });
});

describe('parseLabReportText — honesty guards', () => {
  it('empty and garbage input return empty results, never throw', () => {
    expect(parseLabReportText('')).toEqual({ matches: [], unmatched: [], format: 'text' });
    const r = parseLabReportText(',,,\n!!!\n\n');
    expect(r.matches).toEqual([]);
    expect(r.unmatched).toEqual([]);
  });

  it('a value-less prose paragraph produces no matches and no unmatched rows', () => {
    const r = parseLabReportText('This report was generated automatically and is valid only with the signature of a registered medical practitioner.');
    expect(r.matches).toEqual([]);
    expect(r.unmatched).toEqual([]);
  });

  it('dates are never mistaken for values (year tokens skipped in last-resort)', () => {
    const r = parseLabReportText('Report generated 2026 total tests run');
    expect(r.matches).toEqual([]);
    expect(r.unmatched).toEqual([]);
  });
});
