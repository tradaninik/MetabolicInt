// Shared type contracts for the insights kit.
// Each component documents its props inline; these are the domain shapes that
// cross component boundaries (and the shapes your real data should map onto).

// ── Reports ────────────────────────────────────────────────────────────────

/** A glucose sample. `t` is 24h "HH:MM"; `v` is mg/dL. */
export interface GlucosePoint {
  t: string;
  v: number;
}

/** Something that happened at a point in time and belongs on the timeline. */
export interface ChartEvent {
  t: string;
  type: "meal" | "medication" | "activity" | "sleep";
  label: string;
  /** Planned (future) events render as hollow markers. */
  planned?: boolean;
}

export type TrendDirection = "up" | "down" | "flat";
export type TrendTone = "positive" | "negative" | "neutral";
export type MetricStatus = "good" | "watch" | "alert" | "neutral";

/** One card in the metric strip: latest value + freshness + baseline + status. */
export interface Metric {
  id: string;
  label: string;
  value: string;
  unit?: string;
  /** Freshness stamp, e.g. "8:32 AM". */
  timestamp: string;
  /** Where the number came from, e.g. "CGM" or "Home cuff". */
  source: string;
  trend?: {
    direction: TrendDirection;
    /** Just the magnitude, e.g. "12%" or "0.6 kg" — the arrow comes from `direction`. */
    display: string;
    /** Baseline it is compared against, e.g. "vs yesterday". */
    note?: string;
    /** Whether this movement is good for the user. */
    tone: TrendTone;
  };
  status?: MetricStatus;
  statusLabel?: string;
  /** Marks the card as a new addition vs the production set (renders a small NEW tag). */
  isNew?: boolean;
}

export type InsightConfidence = "high" | "moderate" | "low";

/** A plain-language finding with its confidence and evidence made visible. */
export interface Insight {
  id: string;
  title: string;
  body: string;
  confidence: InsightConfidence;
  /** e.g. "Based on 12 comparable meals over the last 3 months". */
  evidence?: string;
  /** e.g. "Missing: stress data — tag your days to sharpen this." */
  missingData?: string;
}

// ── Logging ────────────────────────────────────────────────────────────────

/** A food as the tray sees it: macros are per `serving` and are estimates. */
export interface Food {
  id: string;
  name: string;
  serving: string;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
}

/** A food plus where it lives in the regional preset drill-down. */
export interface Dish extends Food {
  region: string;
  subregion: string;
}

/** A food identified in a meal photo, with its estimated portion. */
export interface DetectedFood {
  food: Food;
  /** Estimated portion in servings — the user confirms or adjusts before logging. */
  qty: number;
  confidence: InsightConfidence;
  /** How the portion was estimated, e.g. "2 pieces detected on plate". */
  note?: string;
}

export interface TrayItem {
  food: Food;
  /** Number of servings, in steps of 0.5. */
  qty: number;
}

export interface MacroTotals {
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
}

/** The "what to expect" prediction shown after a meal is logged. */
export interface Prediction {
  low: number;
  high: number;
  minutesAfter: number;
  /** How many comparable past meals this is based on. */
  comparable: number;
  confidence: InsightConfidence;
  /** e.g. "last 3 months". */
  period: string;
}
