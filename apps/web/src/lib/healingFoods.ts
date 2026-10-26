// R-1a - View-model types for /api/food-as-medicine (moved out of the component
// so both the explorer and the profile share one contract) plus pure,
// testable selection helpers. No fetching, no IO.

export type LensChoice = 'all' | 'ayurveda' | 'science' | 'stories';
export type EvidenceGrade = 'A' | 'B' | 'C' | 'D';

export interface AyurvedaLens {
  rasa?: string[];
  virya?: 'heating' | 'cooling';
  pacifies: string[];
  aggravates: string[];
  prakritiFit: Record<string, string>;
  seasons?: string[];
  seasonalNote?: string;
  classicalRef?: string;
  summary: string;
}

export interface ScienceLens {
  grade: EvidenceGrade;
  headline: string;
  evidenceSummary: string;
  giNote?: string;
  fiberNote?: string;
  nutrientNote?: string;
  mechanism?: string;
  debunk?: { claim: string; verdict: string };
}

export interface StoriesLens {
  prevalence: 'widely' | 'commonly' | 'scattered';
  patterns: string[];
  summary: string;
}

/** P5 tradition lens - mirrors the engine's TraditionLensData shape. */
export interface TraditionLens {
  headline: string;
  classicalTexts?: string[];
  preparation?: string;
  practices: { name: string; detail: string }[];
  note?: string;
}

export interface HealingFoodView {
  slug: string;
  name: string;
  alsoKnownAs?: string[];
  category: string;
  headline: string;
  cautions?: string[];
  ayurveda?: AyurvedaLens;
  science?: ScienceLens;
  stories?: StoriesLens;
  tradition?: TraditionLens;
}

export interface RankedFood {
  food: HealingFoodView;
  score: number;
  reasons: string[];
  lenses: string[];
}

export interface FoodAsMedicineData {
  foods: RankedFood[];
  lenses: Record<string, { id: string; label: string; blurb: string }>;
  grades: Record<string, { grade: string; label: string; meaning: string }>;
  categories: Record<string, { id: string; label: string }>;
  disclaimer: string;
  storiesDisclaimer: string;
  prakriti: string | null;
  season: { id: string; name: string };
}

/** Entries visible under a lens: 'all' keeps everything, otherwise only
 *  entries that carry the selected lens (same semantics as the old filter). */
export function lensPool(foods: RankedFood[], lens: LensChoice): RankedFood[] {
  return lens === 'all' ? foods : foods.filter((r) => r.lenses.includes(lens));
}

/** Split the ranked list into the "For you today" shortlist and the library. */
export function pickForYou(
  foods: RankedFood[],
  count = 3
): { shortlist: RankedFood[]; library: RankedFood[] } {
  return { shortlist: foods.slice(0, count), library: foods.slice(count) };
}

/** Group ranked entries by dataset category, preserving ranked order inside
 *  each group; groups appear in order of their highest-ranked entry. */
export function groupFoodsByCategory(foods: RankedFood[]): {
  categoryId: string;
  entries: RankedFood[];
}[] {
  const groups: { categoryId: string; entries: RankedFood[] }[] = [];
  const byId = new Map<string, { categoryId: string; entries: RankedFood[] }>();
  for (const ranked of foods) {
    const categoryId = ranked.food.category;
    let group = byId.get(categoryId);
    if (!group) {
      group = { categoryId, entries: [] };
      byId.set(categoryId, group);
      groups.push(group);
    }
    group.entries.push(ranked);
  }
  return groups;
}