import { describe, it, expect } from 'vitest';
import {
  a1cToEagMgDl, eagMgDlToMmolL, percentToMmolMol, mmolMolToPercent,
  canonicalA1cPercent, validateHba1cLab, hba1cTrend,
} from '../clinical-db';

describe('HbA1c <-> eAG (ADAG)', () => {
  it('maps 6.5% to the textbook eAG of 140 mg/dL', () => {
    expect(a1cToEagMgDl(6.5)).toBe(140);
  });

  it('maps 7.0% to 154 mg/dL', () => {
    expect(a1cToEagMgDl(7)).toBe(154);
  });

  it('converts eAG 140 mg/dL to 7.8 mmol/L', () => {
    expect(eagMgDlToMmolL(140)).toBe(7.8);
  });

  it('converts 6.5% to 48 mmol/mol (IFCC table value)', () => {
    expect(percentToMmolMol(6.5)).toBe(48);
  });

  it('converts 48 mmol/mol back to 6.54%', () => {
    expect(mmolMolToPercent(48)).toBe(6.54);
  });

  it('canonicalizes by entry unit', () => {
    expect(canonicalA1cPercent(6.5, '%')).toBe(6.5);
    expect(canonicalA1cPercent(48, 'mmol/mol')).toBe(6.54);
  });
});

describe('validateHba1cLab', () => {
  it('accepts valid rows in both units; rejects bad unit, bad date, implausible value', () => {
    expect(validateHba1cLab({ value: 6.5, unit: '%', performedAt: '2026-01-15' })).toBeNull();
    expect(validateHba1cLab({ value: 48, unit: 'mmol/mol', performedAt: '2026-01-15' })).toBeNull();
    expect(validateHba1cLab({ value: 6.5, unit: 'g%', performedAt: '2026-01-15' })).toBe("Unit must be '%' or 'mmol/mol'.");
    expect(validateHba1cLab({ value: 6.5, unit: '%', performedAt: '15/01/2026' })).toBe('Date must be YYYY-MM-DD.');
    expect(validateHba1cLab({ value: 25, unit: '%', performedAt: '2026-01-15' })).toBe('HbA1c looks outside a plausible range (3-20%).');
  });
});

describe('hba1cTrend', () => {
  it('sorts chronologically, drops unknown units, fills A1c + eAG in both units', () => {
    const pts = hba1cTrend([
      { value: 48, unit: 'mmol/mol', performedAt: '2026-03-20' },
      { value: 7, unit: '%', performedAt: '2026-01-15' },
      { value: 6.1, unit: 'g%', performedAt: '2026-02-01' },
    ]);
    expect(pts).toHaveLength(2);
    expect(pts[0]).toEqual({ date: '2026-01-15', a1cPercent: 7, eagMgDl: 154, eagMmolL: 8.6 });
    expect(pts[1]).toEqual({ date: '2026-03-20', a1cPercent: 6.54, eagMgDl: 141, eagMmolL: 7.8 });
  });

  it('returns [] for no labs', () => {
    expect(hba1cTrend([])).toEqual([]);
  });
});