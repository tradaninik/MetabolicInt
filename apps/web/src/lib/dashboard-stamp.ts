// Dashboard header helpers (dashboard revamp item 1 + 7).
// Pure date/label math - no I/O, no React. IST (Asia/Kolkata, UTC+5:30) is the
// app-wide timezone convention (QuickAdd, agni windows, seeds all use IST).
//
// The "Updated" stamp answers one honest question: when did the user's own
// data last change, and through what? It is recomputed from their records on
// every render (QuickAdd saves already trigger router.refresh()) - never a
// fake live stream.

export const IST_OFFSET_MS = 5.5 * 3_600_000;
const DAY_MS = 86_400_000;

/** Record streams that can mark the dashboard's "Updated" stamp. */
export type UpdateKind = 'glucose' | 'meal' | 'activity' | 'sleep' | 'weight' | 'bp' | 'med';

export interface UpdateCandidate {
  /** epoch ms the record was taken / logged */
  t: number;
  kind: UpdateKind;
  /** provenance straight from the record (e.g. GlucoseReading.source 'manual' | 'cgm') */
  source?: string;
}

export interface UpdateStamp {
  t: number;
  kind: UpdateKind;
  source?: string;
}

/** Hour of day (0-23, floored) in IST for a given epoch ms. */
export function istHour(epochMs: number): number {
  const shifted = (epochMs + IST_OFFSET_MS) % DAY_MS;
  return Math.floor(shifted / 3_600_000);
}

/** Time-of-day greeting by IST hour: 5-11 morning, 12-16 afternoon, 17-20 evening, else night. */
export function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Good night';
}

/** Most recent valid candidate (max t); null when there is nothing to show. */
export function latestUpdate(candidates: UpdateCandidate[]): UpdateStamp | null {
  let best: UpdateStamp | null = null;
  for (const c of candidates) {
    if (typeof c.t !== 'number' || !Number.isFinite(c.t)) continue;
    if (!best || c.t > best.t) best = { t: c.t, kind: c.kind, source: c.source };
  }
  return best;
}

/**
 * Short relative time: "just now" | "Nm ago" | "Nh ago" | "Nd ago".
 * Pure - `now` is a parameter so tests are deterministic. Future-dated
 * entries (clock skew) render as "just now" rather than a confusing "-5m ago".
 */
export function relativeTime(t: number, now: number): string {
  const deltaMs = now - t;
  if (deltaMs < 60_000) return 'just now';
  const min = Math.floor(deltaMs / 60_000);
  if (min < 60) return `${min}m ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Human provenance label for the stamp, e.g. "CGM reading", "meal log". */
export function sourceLabel(kind: UpdateKind, source?: string): string {
  if (kind === 'glucose') {
    if (source === 'cgm') return 'CGM reading';
    if (source === 'manual') return 'manual reading';
    return 'glucose reading';
  }
  const labels: Record<UpdateKind, string> = {
    glucose: 'glucose reading',
    meal: 'meal log',
    activity: 'activity log',
    sleep: 'sleep log',
    weight: 'weight log',
    bp: 'BP log',
    med: 'med log',
  };
  return labels[kind];
}
