/**
 * Metabolic Rhythm — shared data contract (Phase A)
 * Additive kit: nothing here is imported by production screens.
 * Every field maps to a real derivation — see README.md wiring table.
 */

export interface RhythmPoint {
  /** Hour of day 0–23 */
  hour: number;
  /** Median glucose for this hour, mg/dL */
  mgdl: number;
}

export interface CarbFriendlyWindow {
  startHour: number;
  endHour: number;
  /** 0–100, from sample size + spread — never shown above 85 for observational data */
  confidence: number;
}

export interface EveningRise {
  startHour: number;
  endHour: number;
  /** Median rise vs afternoon baseline, mg/dL */
  deltaMgDl: number;
}

export interface AgniPhase {
  id: string;
  emoji: string;
  name: string;
  description: string;
  /** Human-readable time range, e.g. "6–10 AM" */
  range: string;
}

export interface EatingWindow {
  /** 8.5 = 8:30 AM */
  openHour: number;
  /** 19.5 = 7:30 PM */
  closeHour: number;
  /** Median window length in hours, e.g. 11 */
  hours: number;
  closeLabel: string;
  daysObserved: number;
}

export interface TonightNudge {
  headline: string;
  body: string;
  /** Traceable evidence line — shown verbatim under the nudge */
  evidence: string;
  confidence: number;
}

export interface RhythmData {
  status: 'ready';
  /** Current hour as decimal, e.g. 7.67 = 7:40 AM */
  nowHour: number;
  nowLabel: string;
  nowPhaseLabel: string;
  /** How many days of data the medians are built on */
  windowDays: number;
  /** Overall rhythm confidence */
  confidence: number;
  /** 24 hourly median points, hours 0–23 */
  curve: RhythmPoint[];
  carbFriendlyWindow: CarbFriendlyWindow;
  eveningRise: EveningRise;
  eatingWindow: EatingWindow;
  phases: AgniPhase[];
  phaseBridge: { text: string; confidence: number };
  tonight: TonightNudge;
  /** Honest stamp, e.g. "re-computed nightly at 3 AM · your CGM, meals, sleep, steps" */
  computedAt: string;
}

export interface RhythmFormingCheck {
  id: 'cgm' | 'meals' | 'sleep' | 'steps';
  label: string;
  hint: string;
  done: number;
  required: number;
}

export interface RhythmForming {
  daysCollected: number;
  daysRequired: number;
  /** e.g. "~Nov 4" */
  unlocksOn: string;
  checks: RhythmFormingCheck[];
  /** Faint dashed preview curve shown in "what you'll get" */
  previewCurve: RhythmPoint[];
}

/** Convenience union for card-style consumers */
export type RhythmState = { status: 'ready'; data: RhythmData } | { status: 'forming'; forming: RhythmForming };
