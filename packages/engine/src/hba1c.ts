/**
 * HbA1c conversions (educational math, no I/O).
 * eAG (mg/dL) = 28.7 x A1c% - 46.7            (ADAG study)
 * IFCC mmol/mol = 10.929 x (A1c% - 2.15)
 */
import { MGDL_PER_MMOL } from './units';

export type A1cUnit = '%' | 'mmol/mol';

function eagRaw(a1cPercent: number): number {
  return 28.7 * a1cPercent - 46.7;
}

export function a1cPercentToEagMgdl(a1cPercent: number): number {
  return Math.round(eagRaw(a1cPercent));
}

export function a1cPercentToEagMmol(a1cPercent: number): number {
  return Math.round((eagRaw(a1cPercent) / MGDL_PER_MMOL) * 10) / 10;
}

export function a1cPercentToMmolMol(a1cPercent: number): number {
  return Math.round(10.929 * (a1cPercent - 2.15));
}

export function mmolMolToA1cPercent(mmolMol: number): number {
  return Math.round((mmolMol / 10.929 + 2.15) * 10) / 10;
}

export function toA1cPercent(value: number, unit: A1cUnit): number {
  return unit === '%' ? value : mmolMolToA1cPercent(value);
}