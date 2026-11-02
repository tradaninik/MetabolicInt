/**
 * Sample data for the Rhythm kit (Phase A).
 * Mirrors the numbers in mockups R1 / R5 so design and code stay in sync.
 * Replace via props — see README.md "Real-data wiring table".
 */
import type { RhythmData, RhythmForming, RhythmPoint } from './types';

const curve = (values: number[]): RhythmPoint[] =>
  values.map((mgdl, hour) => ({ hour, mgdl }));

/** 24 hourly medians, mg/dL — midday-low, evening-rise shape */
const SAMPLE_CURVE = curve([
  104, 103, 102, 102, 103, 105, 107, 110, 112, 111, 109, 108,
  106, 104, 103, 102, 102, 103, 105, 108, 112, 116, 115, 110,
]);

export const sampleRhythm: RhythmData = {
  status: 'ready',
  nowHour: 7.67,
  nowLabel: '7:40 AM',
  nowPhaseLabel: 'kindling',
  windowDays: 30,
  confidence: 68,
  curve: SAMPLE_CURVE,
  carbFriendlyWindow: { startHour: 12, endHour: 14, confidence: 68 },
  eveningRise: { startHour: 20, endHour: 22, deltaMgDl: 18 },
  eatingWindow: {
    openHour: 8.5,
    closeHour: 19.5,
    hours: 11,
    closeLabel: '7:30 PM',
    daysObserved: 26,
  },
  phases: [
    {
      id: 'kindling',
      emoji: '🌅',
      name: 'Morning kindling',
      description: 'digestion warming up — lighter food lands easier',
      range: '6–10 AM',
    },
    {
      id: 'peak',
      emoji: '☀️',
      name: 'Midday peak',
      description: 'your strongest digestion — biggest meal fits here',
      range: '12–2 PM',
    },
    {
      id: 'low',
      emoji: '🌙',
      name: 'Evening low',
      description: 'winding down — kitchen closes early',
      range: '7 PM →',
    },
  ],
  phaseBridge: {
    text: 'Your measured carb-friendly window (12–2 PM) overlaps the classic midday Agni peak. Your data agrees with the tradition here.',
    confidence: 71,
  },
  tonight: {
    headline: 'Close the kitchen by 7:30 PM',
    body: 'On your 9 early dinners, next-morning glucose ran ~6 mg/dL lower than after late ones.',
    evidence: 'Your data: 9 early vs 11 late dinners · 71% conf',
    confidence: 71,
  },
  computedAt: 'tonight at 3 AM · your CGM, meals, sleep, steps',
};

export const sampleRhythmForming: RhythmForming = {
  daysCollected: 12,
  daysRequired: 15,
  unlocksOn: '~Nov 4',
  checks: [
    { id: 'cgm', label: 'CGM days', hint: '15-min readings, nights included', done: 12, required: 15 },
    { id: 'meals', label: 'Meal logs', hint: 'photo or quick log, any 31 meals', done: 31, required: 31 },
    { id: 'sleep', label: 'Sleep nights', hint: 'needed to separate sleep effects', done: 4, required: 7 },
    { id: 'steps', label: 'Steps', hint: 'daily totals from your phone', done: 15, required: 15 },
  ],
  previewCurve: SAMPLE_CURVE,
};
