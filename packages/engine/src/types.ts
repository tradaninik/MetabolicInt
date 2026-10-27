// Core domain types for the Personal Metabolic Model.
// These are pure data shapes — no I/O, no framework. Used by web and mobile.

// ---- Reference data (from packages/food-db) ----

export type CuisineRegion =
  | 'south_indian'
  | 'north_indian'
  | 'bengali'
  | 'gujarati'
  | 'punjabi'
  | 'telugu'
  | 'tamil'
  | 'kerala'
  | 'maharashtrian'
  | 'rajasthani'
  | 'global';

export type FoodCategory =
  | 'cereal'
  | 'legume'
  | 'vegetable'
  | 'fruit'
  | 'dairy'
  | 'meat'
  | 'fish'
  | 'egg'
  | 'nut'
  | 'snack'
  | 'sweet'
  | 'beverage'
  | 'fat'
  | 'spice'; // P7.1: raw spices/condiments (turmeric, salt, tamarind...)

export interface Food {
  id: string;
  name: string;
  aliases?: string[];
  region: CuisineRegion;
  category: FoodCategory;
  /** grams in one standard serving */
  servingGrams: number;
  /** grams in one standard Indian katori (~150 ml) */
  katoriGrams?: number;
  kcalPer100g: number;
  carbsPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  /** glycemic index (0-100), regional */
  gi: number;
}

// ---- User profile (captured at onboarding) ----

export type Gender = 'male' | 'female' | 'other';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export interface UserProfile {
  age: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  /** HbA1c percentage, e.g. 7.2 */
  hba1c?: number;
  /** fasting glucose mg/dL */
  fastingGlucose?: number;
  /** if diabetic (type 2 by default) */
  diabetic?: boolean;
  activityLevel: ActivityLevel;
  /** average sleep hours */
  sleepHours?: number;
  /** preferred cuisine region — seeds the population prior */
  region: CuisineRegion;
}

// ---- Logged history (time-series) ----

export type PortionType = 'katori' | 'serving' | 'grams';

export interface MealEntry {
  foodId: string;
  portionType: PortionType;
  portionValue: number;
  grams: number;
  /** epoch ms */
  loggedAt: number;
}

export interface GlucosePoint {
  value: number; // mg/dL
  /** epoch ms */
  takenAt: number;
}

export interface ActivitySession {
  /** e.g. 'walk', 'yoga', 'strength' */
  type: string;
  /** minutes */
  durationMin: number;
  /** epoch ms when session (or its start) occurred */
  at: number;
}

export interface SleepRecord {
  /** hours slept */
  hours: number;
  /** epoch ms — the night ending this morning, or previous night */
  wokeAt: number;
}

export interface WeightPoint {
  kg: number;
  takenAt: number;
}

/** A paired observation: a meal and the glucose change over the next 2 hours */
export interface MealGlucosePair {
  meal: MealEntry;
  carbsG: number;
  gi: number;
  /** observed Δ mg/dL over 0-120 min after the meal */
  observedDelta: number;
  /** minutes of activity in the 2h after the meal */
  activityAfterMin: number;
}

// ---- Engine outputs ----

export interface GlucoseSpike {
  /** predicted Δ mg/dL from pre-meal baseline */
  deltaMgDl: number;
  /** minutes after meal to peak */
  timeToPeakMin: number;
  /** incremental AUC above baseline over 2h (mg·min/dL) */
  auc: number;
  /** mg/dL added by post-meal activity (negative = reduction) */
  activityAdjustment: number;
}

export type FoodScore = 'green' | 'yellow' | 'red';

export interface FoodScoreResult {
  foodId: string;
  score: FoodScore;
  /** predicted Δ mg/dL for the user's typical portion */
  predictedDeltaMgDl: number;
  reason: string;
}

export interface LearnedModel {
  /** mg/dL rise per gram of available carbohydrate, fit to the user's history */
  sensitivityMgDlPerGCarb: number;
  /** number of (meal, glucose) pairs used to fit */
  sampleSize: number;
  /** epoch ms of last update */
  updatedAt: number;
  /** whether we are still on the population prior (low confidence) */
  isPrior: boolean;
}

export interface ForecastPoint {
  /** days from anchor (0 = today) */
  day: number;
  metric: 'weight_kg' | 'hba1c' | 'glucose_mgdl';
  value: number;
  low: number;
  high: number;
}

export interface InsightCard {
  id: string;
  type: 'sleep_glucose' | 'activity_glucose' | 'weekend_weight' | 'food_response' | 'streak';
  title: string;
  body: string;
  /** signed effect magnitude, e.g. +18 means "increases by 18%" */
  effectPct: number;
  /** 0-1 confidence based on sample size & effect consistency */
  confidence: number;
  /** which facts were used */
  evidence: string[];
  createdAt: number;
}

export interface HealthScore {
  /** 0-100 composite */
  score: number;
  /** component subscores (each 0-100) */
  components: {
    glucose: number;
    weight: number;
    sleep: number;
    activity: number;
    bloodPressure: number;
    nutrition: number;
  };
}
