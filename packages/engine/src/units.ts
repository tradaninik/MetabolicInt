/**
 * Glucose unit conversion (educational math, no I/O).
 * mg/dL <-> mmol/L via the standard factor 18.
 */
export const MGDL_PER_MMOL = 18;

export type GlucoseUnit = 'mg/dL' | 'mmol/L';

function roundTo(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

export function mgdlToMmol(mgdl: number): number {
  return roundTo(mgdl / MGDL_PER_MMOL, 2);
}

export function mmolToMgdl(mmol: number): number {
  return roundTo(mmol * MGDL_PER_MMOL, 1);
}

export function convertGlucose(value: number, from: GlucoseUnit, to: GlucoseUnit): number {
  if (from === to) return value;
  return from === 'mg/dL' ? mgdlToMmol(value) : mmolToMgdl(value);
}
