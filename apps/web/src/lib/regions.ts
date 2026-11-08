// P0 (/log revamp) - region registry: the ONE place that maps the six UI
// food regions to catalog cuisine values, meal-time windows, plate order
// and household portion preferences. Pure data + lookups, client-safe,
// mirrors the catalog's 11 cuisine regions.
//
// UI groups (spec: region selector pinned ABOVE food choices, changeable
// anytime): North / South Indian, Gujarati, Bengali, Maharashtrian,
// Indo-West General. Each group:
//   - catalogRegions: the Food.region values it covers ('global' staples
//     are added automatically when searching, so no group feels thin)
//   - primaryRegion: the single catalog value persisted to User.region
//     (keeps engine priorSensitivity + /api/me/profile contracts intact)
//   - windowsLabel: display-only meal-time windows (IST). classifyMealType
//     in meal-bits.ts stays the engine contract; these windows drive the
//     hint under the selector and the Repeat-mode clustering labels.
//   - katoriCategories: categories that default to katori portions when
//     the food defines katoriGrams (rice-culture vs roti-culture).
//   - plateIds: existing curated plates (lib/plates.ts) shown first, in
//     this order; the rest follow alphabetically.

import type { Plate } from '@/lib/plates';
import { PLATES } from '@/lib/plates';

export type RegionGroupKey = 'north' | 'south' | 'gujarat' | 'bengal' | 'maharashtra' | 'general';

export interface RegionGroup {
  key: RegionGroupKey;
  label: string;
  blurb: string;
  catalogRegions: string[];
  primaryRegion: string;
  windowsLabel: string;
  katoriCategories: string[];
  plateIds: string[];
}

export const REGION_GROUPS: RegionGroup[] = [
  {
    key: 'north',
    label: 'North Indian',
    blurb: 'Roti-dal plates, Punjabi and Rajasthani classics.',
    catalogRegions: ['north_indian', 'punjabi', 'rajasthani'],
    primaryRegion: 'north_indian',
    windowsLabel: 'Breakfast 7-9:30am - Lunch 12:30-2pm - Dinner 8-9:30pm',
    katoriCategories: ['legume', 'vegetable'],
    plateIds: ['north_veg_thali', 'makki_saag', 'khichdi_kadhi'],
  },
  {
    key: 'south',
    label: 'South Indian',
    blurb: 'Rice-dal-idli plates: Tamil, Andhra, Telangana, Kerala.',
    catalogRegions: ['south_indian', 'tamil', 'telugu', 'kerala'],
    primaryRegion: 'south_indian',
    windowsLabel: 'Breakfast 7-9am - Lunch 12-1:30pm - Dinner 8-9pm',
    katoriCategories: ['cereal', 'legume', 'vegetable'],
    plateIds: [
      'idli_breakfast', 'plain_dosa_plate', 'masala_dosa_plate', 'upma_coffee',
      'south_meals', 'tamil_meals', 'andhra_meals', 'kerala_sadya',
    ],
  },
  {
    key: 'gujarat',
    label: 'Gujarati',
    blurb: 'Rotli, dal, farsan and the sweet-savory thali.',
    catalogRegions: ['gujarati'],
    primaryRegion: 'gujarati',
    windowsLabel: 'Breakfast 7-9am - Lunch 11:30am-1pm - Dinner 7:30-9pm',
    katoriCategories: ['legume', 'vegetable'],
    plateIds: ['gujarati_thali', 'khichdi_kadhi'],
  },
  {
    key: 'bengal',
    label: 'Bengali',
    blurb: 'Rice and macher jhol, dal, sweets - late dinner culture.',
    catalogRegions: ['bengali'],
    primaryRegion: 'bengali',
    windowsLabel: 'Breakfast 7-9:30am - Lunch 12:30-2pm - Dinner 9-10:30pm',
    katoriCategories: ['cereal', 'legume', 'vegetable'],
    plateIds: [],
  },
  {
    key: 'maharashtra',
    label: 'Maharashtrian',
    blurb: 'Bhakri, amti, pav dishes - Konkan to Vidarbha.',
    catalogRegions: ['maharashtrian'],
    primaryRegion: 'maharashtrian',
    windowsLabel: 'Breakfast 7-9am - Lunch 12:30-2pm - Dinner 8-9pm',
    katoriCategories: ['legume', 'vegetable'],
    plateIds: [],
  },
  {
    key: 'general',
    label: 'Indo-West General',
    blurb: 'Everything: all Indian cuisines plus oats, pasta, pizza.',
    catalogRegions: [],
    primaryRegion: 'global',
    windowsLabel: 'Breakfast 8-9:30am - Lunch 12:30-2pm - Dinner 7:30-9pm',
    katoriCategories: [],
    plateIds: [],
  },
];

export const REGION_GROUP_MAP: Record<RegionGroupKey, RegionGroup> = REGION_GROUPS.reduce(
  (acc, g) => {
    acc[g.key] = g;
    return acc;
  },
  {} as Record<RegionGroupKey, RegionGroup>,
);

/** Any catalog cuisine region (User.region, Food.region) -> UI group. */
export function resolveRegionGroup(region: string | null | undefined): RegionGroupKey {
  const r = (region ?? '').trim();
  if (!r) return 'general';
  for (const g of REGION_GROUPS) {
    if (g.catalogRegions.includes(r)) return g.key;
  }
  return 'general';
}

/** The single catalog value persisted to User.region for a group choice. */
export function primaryRegionOf(group: RegionGroupKey): string {
  return (REGION_GROUP_MAP[group] ?? REGION_GROUP_MAP.general).primaryRegion;
}

/**
 * The region filter for /api/foods: the group's cuisine regions plus the
 * shared 'global' staples, comma-separated (the API accepts csv since P0).
 * 'general' clears the filter - all foods, Indian and Western.
 */
export function regionParam(group: RegionGroupKey): string {
  const g = REGION_GROUP_MAP[group] ?? REGION_GROUP_MAP.general;
  if (g.catalogRegions.length === 0) return '';
  return [...g.catalogRegions, 'global'].join(',');
}

/** Plates for a group: the group's curated plates first, then the rest. */
export function platesForGroup(group: RegionGroupKey): Plate[] {
  const g = REGION_GROUP_MAP[group] ?? REGION_GROUP_MAP.general;
  const first = g.plateIds
    .map((id) => PLATES.find((p) => p.id === id))
    .filter((p): p is Plate => !!p);
  const rest = PLATES.filter((p) => !g.plateIds.includes(p.id));
  return [...first, ...rest];
}

/**
 * Default portion for a freshly added food in this group (before any
 * last-used memory applies): katori for rice-culture categories when the
 * food defines one, otherwise a count of servings (2 rotis, 2 idlis...).
 */
export function defaultPortionFor(
  group: RegionGroupKey,
  food: { category: string; katoriGrams?: number | null },
): { portionType: 'serving' | 'katori'; portionValue: number } {
  const g = REGION_GROUP_MAP[group] ?? REGION_GROUP_MAP.general;
  if (food.katoriGrams != null && g.katoriCategories.includes(food.category)) {
    return { portionType: 'katori', portionValue: 1 };
  }
  return { portionType: 'serving', portionValue: 1 };
}
