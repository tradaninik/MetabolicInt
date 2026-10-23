// Personal Metabolic Model — pure TypeScript engine.
// Shared by apps/web and apps/mobile. No I/O, no external deps, fully unit-tested.
//
// Every prediction produced by this engine is educational / heuristic and is NOT a
// substitute for professional medical advice.

export * from './types';
export * from './nutrition';
export * from './prior';
export * from './glucose';
export * from './scoring';
export * from './healthScore';
export * from './forecast';
export * from './insights';
export * from './coach';
export * from './units';
export * from './hba1c';
export * from './adherence';
export * from './prakriti';
export * from './ritucharya';

export const ENGINE_VERSION = '0.1.0';
export * from './glucoseGuard';
