// Suggestions (dashboard revamp item 6): "Today's suggestions".
//
// Replaces the old hardcoded "AI Daily Recommendations" card. Every
// suggestion is DERIVED from the user's own records, carries its evidence
// inline, and uses association wording only - the engine says "your
// readings were lower on evenings you walked", never "walking lowers
// your glucose". Suggestions without enough evidence are simply absent.
//
// Pure and deterministic.

export type SuggestionSource = 'from pattern' | 'from model' | 'reminder';

export interface SuggestionAction {
  label: string;
  /** plan = Add-to-plan (client-side plan until the Phase C planner ships); remind = link to /meds */
  kind: 'plan' | 'remind';
}

export interface Suggestion {
  id: string;
  source: SuggestionSource;
  title: string;
  /** body sentence(s) with the evidence inline */
  body: string;
  /** short evidence line: "4 of 5 evenings" + the record count behind it */
  evidence: { text: string; count: number };
  action: SuggestionAction;
}

export interface EveningRecord {
  /** IST date 'YYYY-MM-DD' */
  date: string;
  hasPostDinnerWalk: boolean;
  /** last reading at/after 20:00 IST that evening, mg/dL */
  bedtimeReading: number | null;
}

export interface DinnerRecord {
  /** IST date 'YYYY-MM-DD' */
  date: string;
  /** IST hour of that day's dinner (0-23) */
  dinnerHour: number;
  /** first fasting-range reading the NEXT morning (05:00-09:59 IST), mg/dL */
  nextMorningFasting: number | null;
}

export interface MedAdherenceInput {
  name: string;
  slotTime: string;
  missedThisWeek: number;
  scheduledThisWeek: number;
}

export interface SuggestionsInput {
  evenings: EveningRecord[];
  dinners: DinnerRecord[];
  medAdherence: MedAdherenceInput | null;
}

/** Bedtime readings must average at least this much lower on walk evenings. */
export const WALK_BENEFIT_MGDL = 8;
/** Minimum evenings with a walk before the pattern is claimable. */
export const MIN_WALK_EVENINGS = 3;
/** Later dinners must associate with at least this much higher fasting. */
export const DINNER_FASTING_MGDL = 5;
/** Minimum days with dinner + next-morning fasting before the model speaks. */
export const MIN_DINNER_DAYS = 5;
/** A "late dinner" is one at/after this IST hour. */
export const LATE_DINNER_HOUR = 20;

/**
 * Derive today's suggestions from the user's own patterns. Order is fixed:
 * pattern first (strongest evidence), then model, then reminders. At most
 * one of each - the card never pads itself with filler.
 */
export function deriveSuggestions(input: SuggestionsInput): Suggestion[] {
  const out: Suggestion[] = [];

  const walk = walkSuggestion(input.evenings);
  if (walk) out.push(walk);

  const dinner = dinnerSuggestion(input.dinners);
  if (dinner) out.push(dinner);

  const reminder = reminderSuggestion(input.medAdherence);
  if (reminder) out.push(reminder);

  return out;
}

// --- 1. post-dinner walk (from pattern) --------------------------------------

function walkSuggestion(evenings: EveningRecord[]): Suggestion | null {
  const withReadings = evenings.filter((e) => e.bedtimeReading !== null);
  const walkEve = withReadings.filter((e) => e.hasPostDinnerWalk);
  const noWalkEve = withReadings.filter((e) => !e.hasPostDinnerWalk);
  if (walkEve.length < MIN_WALK_EVENINGS || noWalkEve.length < 1) return null;

  const walkAvg = mean(walkEve.map((e) => e.bedtimeReading!));
  const noWalkAvg = mean(noWalkEve.map((e) => e.bedtimeReading!));
  if (noWalkAvg - walkAvg < WALK_BENEFIT_MGDL) return null;

  return {
    id: 'walk-after-dinner',
    source: 'from pattern',
    title: 'Walk after dinner',
    body: `Your bedtime readings averaged ${Math.round(noWalkAvg - walkAvg)} mg/dL lower on the ${walkEve.length} of ${withReadings.length} evenings with a post-dinner walk than on evenings without one.`,
    evidence: {
      text: `${walkEve.length} of ${withReadings.length} evenings`,
      count: withReadings.length,
    },
    action: { label: 'Add to plan', kind: 'plan' },
  };
}

// --- 2. dinner timing (from model) ---------------------------------------------

function dinnerSuggestion(dinners: DinnerRecord[]): Suggestion | null {
  const withFasting = dinners.filter((d) => d.nextMorningFasting !== null);
  if (withFasting.length < MIN_DINNER_DAYS) return null;

  const late = withFasting.filter((d) => d.dinnerHour >= LATE_DINNER_HOUR);
  const early = withFasting.filter((d) => d.dinnerHour < LATE_DINNER_HOUR);
  if (late.length < 2 || early.length < 2) return null;

  const lateAvg = mean(late.map((d) => d.nextMorningFasting!));
  const earlyAvg = mean(early.map((d) => d.nextMorningFasting!));
  if (lateAvg - earlyAvg < DINNER_FASTING_MGDL) return null;

  return {
    id: 'dinner-before-8',
    source: 'from model',
    title: 'Keep dinner before 8 PM',
    body: `On your ${late.length} later-dinner days, next-morning fasting readings averaged ${Math.round(lateAvg - earlyAvg)} mg/dL higher than on your ${early.length} earlier-dinner days.`,
    evidence: {
      text: `${withFasting.length} days compared`,
      count: withFasting.length,
    },
    action: { label: 'Plan dinner 7:30 PM', kind: 'plan' },
  };
}

// --- 3. evening dose reminder ----------------------------------------------------

function reminderSuggestion(adh: MedAdherenceInput | null): Suggestion | null {
  if (!adh || adh.scheduledThisWeek <= 0) return null;
  if (adh.missedThisWeek < 1) return null;
  return {
    id: `dose-${adh.slotTime.replace(':', '')}`,
    source: 'reminder',
    title: 'Evening dose',
    body: `${adh.name} ${adh.slotTime} — ${adh.missedThisWeek} of ${adh.scheduledThisWeek} scheduled doses missed this week.`,
    evidence: {
      text: `${adh.scheduledThisWeek} scheduled slots`,
      count: adh.scheduledThisWeek,
    },
    action: { label: 'Set reminder', kind: 'remind' },
  };
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
