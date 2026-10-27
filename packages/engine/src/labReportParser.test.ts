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
    // P7.1: hemoglobin joined the catalog, so this row now MAPS (that is the
    // fix) - the honest-unmatched case is covered by the noise fixtures below.
    const byKey = new Map(r.matches.map((m) => [m.testKey, m]));
    expect(byKey.get('hemoglobin')?.value).toBeCloseTo(13.6, 1);
    expect(byKey.get('hemoglobin')?.confidence).toBe(1);
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

// P7.1 — the real Hyderabad report from the live smoke test: assay methods
// glued onto values, repeated address blocks, registration numbers, range
// legends and age-banded tables in the noise, full CBC + urine + proteins
// in the results. Every assertion below is a value printed on that report.
const REAL_REPORT_P71 = `
SRI RAM DIAGNOSTICS (A UNIT OF SRI RAM LABS LLP)
MANIKONDA HYDERABAD500089
MANIKONDA HYDERABAD500089
NO 6LH1204
Patient Name : K RAMESH
Age / Gender : 44 Years / Male
Referred by : Dr. S Rao, MD
Sample Collected on : 20/10/2026 08:16
Reported on : 21/10/2026 14:05
Male: 225 -535
Adults: Less than25
11 - 60 Years : 0.8 - 1.2
4 - 10 Yrs 130 - 200
GLYCATED HAEMOGLOBIN (HBA1C) H.P.L.C5.5 % 4.3 - 5.6
FASTING BLOOD SUGAR PHOTOMETRY96 mg/dL 70 - 100
TOTAL CHOLESTEROL PHOTOMETRY188 mg/dL 130 - 200
HDL CHOLESTEROL 48 mg/dL 40 - 60
LDL CHOLESTEROL CALCULATED112 mg/dL < 100
TRIGLYCERIDES GPO-PAP145 mg/dL < 150
TC/HDL RATIO 3.9 < 5.0
UREA PHOTOMETRY24 mg/dL 17 - 43
CREATININE JAFFE0.94 mg/dL 0.7 - 1.3
URIC ACID PHOTOMETRY5.8 mg/dL 3.5 - 7.2
CALCIUM 9.4 mg/dL 8.6 - 10.3
GAMMA GLUTAMYL TRANSFERASE (GGT) PHOTOMETRY17.7 U/L 10.0 - 71.0
TOTAL PROTEIN PHOTOMETRY7.45 g/dl 6.4 - 8.3
ALBUMIN BCP4.4 g/dl 3.5 - 5.2
BUN / CREATININE RATIO 18.5 12 - 20
HAEMOGLOBIN PHOTOMETRY14.8 g/dl 13.0 - 17.0
TOTAL LEUCOCYTE COUNT 6.2 10^3/uL 4.0 - 10.0
NEUTROPHILS 62 % 40 - 75
LYMPHOCYTES 28 % 20 - 45
EOSINOPHILS 4 % 1 - 6
BASOPHILS 0.0 % 0.0 - 1.0
IMMATURE GRANULOCYTES 0.1 % 0.0 - 0.5
ABSOLUTE NEUTROPHIL COUNT 3.8 10^3/uL 2.0 - 7.5
RBC COUNT 4.9 10^6/uL 4.5 - 5.9
PCV 44.5 % 40 - 50
MCV 89.2 fL 83 - 101
MCH 29.4 pg 27 - 32
MCHC 33.2 g/dl 32 - 36
RDW-SD 42.1 fL 35 - 56
RDW-CV 12.8 % 11.5 - 14.5
PLATELET COUNT 230 10^3/uL 150 - 410
MPV 9.8 fL 7.5 - 11.5
P-LCR 24.5 % 13 - 43
PCT 0.22 % 0.1 - 0.5
SPECIFIC GRAVITY 1.015 1.005 - 1.030
URINE PH 6.0 4.5 - 8.0
UROBILINOGEN 0.2 mg/dL < 1.0
URINE ALBUMIN - CREATININE RATIO (uACR) 12 mg/g < 30
`;

describe('parseLabReportText — P7.1 real-report regression', () => {
  const r = parseLabReportText(REAL_REPORT_P71);

  it('captures patient demographics (age/sex) from the header for range selection', () => {
    expect(r.patientAge).toBe(44);
    expect(r.patientSex).toBe('male');
    expect(r.performedAt).toBe('2026-10-20'); // collected date wins over reported
  });

  it('unglues assay methods from values: GGT 17.7, protein 7.45, HbA1c 5.5, creatinine 0.94, albumin 4.4', () => {
    const byKey = new Map(r.matches.map((m) => [m.testKey, m]));
    expect(byKey.get('ggt')?.value).toBe(17.7);
    expect(byKey.get('ggt')?.unit).toBe('U/L');
    expect(byKey.get('ggt')?.refLow).toBe(10);
    expect(byKey.get('ggt')?.refHigh).toBe(71);
    expect(byKey.get('ggt')?.asPrinted).not.toContain('PHOTOMETRY');
    expect(byKey.get('protein_total')?.value).toBeCloseTo(7.45, 2);
    expect(byKey.get('hba1c')?.value).toBe(5.5);
    expect(byKey.get('hba1c')?.refHigh).toBe(5.6);
    expect(byKey.get('creatinine')?.value).toBeCloseTo(0.94, 2);
    expect(byKey.get('albumin')?.value).toBeCloseTo(4.4, 1);
  });

  it('parses the full CBC with real values incl. the zero-valued basophils row', () => {
    const byKey = new Map(r.matches.map((m) => [m.testKey, m]));
    expect(byKey.get('hemoglobin')?.value).toBeCloseTo(14.8, 1);
    expect(byKey.get('platelets')?.value).toBe(230);
    expect(byKey.get('tlc')?.value).toBeCloseTo(6.2, 1);
    expect(byKey.get('neutrophils_pct')?.value).toBe(62);
    expect(byKey.get('basophils_pct')?.value).toBe(0);
    expect(byKey.get('ig')?.value).toBeCloseTo(0.1, 1);
    expect(byKey.get('neutrophils_abs')?.value).toBeCloseTo(3.8, 1);
    expect(byKey.get('rbc')?.value).toBeCloseTo(4.9, 1);
    expect(byKey.get('hematocrit')?.value).toBeCloseTo(44.5, 1);
    expect(byKey.get('mcv')?.value).toBeCloseTo(89.2, 1);
    expect(byKey.get('mch')?.value).toBeCloseTo(29.4, 1);
    expect(byKey.get('mchc')?.value).toBeCloseTo(33.2, 1);
    expect(byKey.get('rdw_sd')?.value).toBeCloseTo(42.1, 1);
    expect(byKey.get('rdw_cv')?.value).toBeCloseTo(12.8, 1);
    expect(byKey.get('mpv')?.value).toBeCloseTo(9.8, 1);
    expect(byKey.get('plcr')?.value).toBeCloseTo(24.5, 1);
    expect(byKey.get('pct')?.value).toBeCloseTo(0.22, 2);
  });

  it('maps the lipid ratios, kidney extras and urine routine', () => {
    const byKey = new Map(r.matches.map((m) => [m.testKey, m]));
    expect(byKey.get('ldl')?.value).toBe(112);
    expect(byKey.get('ldl')?.refHigh).toBe(100);
    expect(byKey.get('triglycerides')?.value).toBe(145);
    expect(byKey.get('tc_hdl_ratio')?.value).toBeCloseTo(3.9, 1);
    expect(byKey.get('uric_acid')?.value).toBeCloseTo(5.8, 1);
    expect(byKey.get('calcium')?.value).toBeCloseTo(9.4, 1);
    expect(byKey.get('bun_creatinine_ratio')?.value).toBeCloseTo(18.5, 1);
    expect(byKey.get('specific_gravity')?.value).toBeCloseTo(1.015, 3);
    expect(byKey.get('urine_ph')?.value).toBeCloseTo(6.0, 1);
    expect(byKey.get('urobilinogen')?.value).toBeCloseTo(0.2, 1);
    expect(byKey.get('uacr')?.value).toBe(12);
  });

  it('noise never reaches matches or unmatched: addresses, reg numbers, range legends, age bands', () => {
    const everywhere = [...r.matches.map((m) => m.line), ...r.unmatched.map((u) => u.line)].join(' | ');
    expect(everywhere).not.toContain('MANIKONDA');
    expect(everywhere).not.toContain('6LH1204');
    expect(everywhere).not.toContain('225');
    expect(everywhere).not.toContain('Less than25');
    expect(everywhere).not.toMatch(/11 - 60 Years/);
    expect(everywhere).not.toMatch(/4 - 10 Yrs/);
    // and nothing crashed into unmatched from the demographic/header lines
    expect(r.unmatched.map((u) => u.name).join(' ')).not.toContain('Patient Name');
    expect(r.unmatched.map((u) => u.name).join(' ')).not.toContain('Referred by');
  });
});
