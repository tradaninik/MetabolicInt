/**
 * Adherence math (educational, display-only — never advice).
 * "Scheduled" = a medication's slots for each day it was active.
 * "Skipped" logs stay scheduled-but-not-taken; undo removes the log entirely.
 */
export interface SlotCounts { taken: number; scheduled: number }

export function adherencePct(counts: SlotCounts): number | null {
  if (counts.scheduled <= 0) return null;
  return Math.round((counts.taken / counts.scheduled) * 100);
}

export function scheduledSlots(timesPerDay: number, activeDays: number): number {
  return Math.max(0, timesPerDay) * Math.max(0, activeDays);
}

export function aggregateAdherence(counts: SlotCounts[]): SlotCounts & { pct: number | null } {
  const taken = counts.reduce((s, c) => s + c.taken, 0);
  const scheduled = counts.reduce((s, c) => s + c.scheduled, 0);
  return { taken, scheduled, pct: adherencePct({ taken, scheduled }) };
}