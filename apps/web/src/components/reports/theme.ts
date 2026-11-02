// Shared visual tokens for the insights kit.
// These keep the kit consistent with the existing MetabolicInt design language:
// system-ui type, white cards with neutral borders, brand green, honest stamps.

/** Brand green — the only accent color, used for emphasis and primary actions. */
export const BRAND_GREEN = "#0a8e5f";

/** Hover shade of the brand green. */
export const BRAND_GREEN_DARK = "#07724c";

export type ChartEventType = "meal" | "medication" | "activity" | "sleep";

/**
 * Muted, functional colors for timeline event markers (tiny dots + legend only —
 * they encode meaning, they are not decoration).
 */
export const EVENT_COLORS: Record<ChartEventType, string> = {
  meal: "#0a8e5f",
  medication: "#4f46e5",
  activity: "#b45309",
  sleep: "#64748b",
};

export const EVENT_LABELS: Record<ChartEventType, string> = {
  meal: "Meal",
  medication: "Medication",
  activity: "Activity",
  sleep: "Sleep",
};
