// Curated plate presets: one tap loads a full meal into the tray.
// Every foodId verified against the 139-food catalog (scripts/list-foods.ts).
// Catalog gaps (pickles, ghee, papad, raita) are filled by user-created custom
// foods via migration 0002 - never guessed here.
// Pure data + lookup - client-safe.
import type { Food } from '@mi/engine';
import { FOOD_INDEX } from '@mi/food-db';

export interface PlateItemSpec {
  foodId: string;
  portionType: 'serving' | 'katori' | 'grams';
  portionValue: number;
}

export interface Plate {
  id: string;
  name: string;
  description: string;
  items: PlateItemSpec[];
}

export const PLATES: Plate[] = [
  {
    id: 'idli_breakfast',
    name: 'Idli + Sambar + Chutney',
    description: '2 idli with sambar and coconut chutney',
    items: [
      { foodId: 'idli', portionType: 'serving', portionValue: 2 },
      { foodId: 'sambar', portionType: 'katori', portionValue: 1 },
      { foodId: 'coconut_chutney', portionType: 'katori', portionValue: 1 },
    ],
  },
  {
    id: 'plain_dosa_plate',
    name: 'Dosa + Sambar + Chutney',
    description: '2 plain dosa with sambar and chutney',
    items: [
      { foodId: 'plain_dosa', portionType: 'serving', portionValue: 2 },
      { foodId: 'sambar', portionType: 'katori', portionValue: 1 },
      { foodId: 'coconut_chutney', portionType: 'katori', portionValue: 1 },
    ],
  },
  {
    id: 'masala_dosa_plate',
    name: 'Masala Dosa Plate',
    description: 'Masala dosa with sambar and chutney',
    items: [
      { foodId: 'masala_dosa', portionType: 'serving', portionValue: 1 },
      { foodId: 'sambar', portionType: 'katori', portionValue: 1 },
      { foodId: 'coconut_chutney', portionType: 'katori', portionValue: 1 },
    ],
  },
  {
    id: 'upma_coffee',
    name: 'Upma + Filter Coffee',
    description: 'A katori of upma with filter coffee',
    items: [
      { foodId: 'upma', portionType: 'katori', portionValue: 1 },
      { foodId: 'filter_coffee', portionType: 'serving', portionValue: 1 },
    ],
  },
  {
    id: 'south_meals',
    name: 'South Indian Meals',
    description: 'Rice, sambar, rasam, poriyal',
    items: [
      { foodId: 'white_rice_south', portionType: 'katori', portionValue: 1.5 },
      { foodId: 'sambar', portionType: 'katori', portionValue: 1 },
      { foodId: 'rasam', portionType: 'katori', portionValue: 1 },
      { foodId: 'poriyal', portionType: 'katori', portionValue: 1 },
    ],
  },
  {
    id: 'tamil_meals',
    name: 'Tamil Meals',
    description: 'Rice, sambar, rasam, kootu, poriyal',
    items: [
      { foodId: 'white_rice_south', portionType: 'katori', portionValue: 1.5 },
      { foodId: 'sambar_tamil', portionType: 'katori', portionValue: 1 },
      { foodId: 'rasam_tamil', portionType: 'katori', portionValue: 1 },
      { foodId: 'kootu', portionType: 'katori', portionValue: 1 },
      { foodId: 'poriyal', portionType: 'katori', portionValue: 1 },
    ],
  },
  {
    id: 'andhra_meals',
    name: 'Andhra Meals',
    description: 'Rice, pappu charu, kuzhambu, pulusu',
    items: [
      { foodId: 'andhra_rice', portionType: 'katori', portionValue: 1.5 },
      { foodId: 'pappu_charu', portionType: 'katori', portionValue: 1 },
      { foodId: 'vathal_kuzhambu', portionType: 'katori', portionValue: 1 },
      { foodId: 'pulusu', portionType: 'katori', portionValue: 1 },
    ],
  },
  {
    id: 'north_veg_thali',
    name: 'North Veg Thali',
    description: '2 chapati, dal tadka, jeera rice, salad',
    items: [
      { foodId: 'chapati', portionType: 'serving', portionValue: 2 },
      { foodId: 'dal_tadka', portionType: 'katori', portionValue: 1 },
      { foodId: 'jeera_rice', portionType: 'katori', portionValue: 1 },
      { foodId: 'green_salad', portionType: 'katori', portionValue: 1 },
    ],
  },
  {
    id: 'makki_saag',
    name: 'Makki Roti + Saag',
    description: 'The classic Punjabi winter plate',
    items: [
      { foodId: 'makki_roti', portionType: 'serving', portionValue: 2 },
      { foodId: 'sarson_ka_saag', portionType: 'katori', portionValue: 1 },
    ],
  },
  {
    id: 'gujarati_thali',
    name: 'Gujarati Thali',
    description: 'Thepla, tuver dal, undhiyu, kadhi',
    items: [
      { foodId: 'thepla', portionType: 'serving', portionValue: 2 },
      { foodId: 'tuvar_dal_gujarati', portionType: 'katori', portionValue: 1 },
      { foodId: 'undhiyu', portionType: 'katori', portionValue: 1 },
      { foodId: 'gujarati_kadhi', portionType: 'katori', portionValue: 1 },
    ],
  },
  {
    id: 'kerala_sadya',
    name: 'Kerala Sadya Plate',
    description: 'Matta rice, avial, thoran, payasam',
    items: [
      { foodId: 'mattarice_kerala', portionType: 'katori', portionValue: 1.5 },
      { foodId: 'avial', portionType: 'katori', portionValue: 1 },
      { foodId: 'thoran', portionType: 'katori', portionValue: 1 },
      { foodId: 'parippu_payasam', portionType: 'katori', portionValue: 1 },
    ],
  },
  {
    id: 'khichdi_kadhi',
    name: 'Khichdi + Kadhi',
    description: 'Comfort combo',
    items: [
      { foodId: 'khichdi', portionType: 'katori', portionValue: 1.5 },
      { foodId: 'gujarati_kadhi', portionType: 'katori', portionValue: 1 },
    ],
  },
];

/** Resolve a plate's foodIds to tray-ready items; unknown ids are skipped. */
export function getPlateItems(plate: Plate): { food: Food; portionType: PlateItemSpec['portionType']; portionValue: number }[] {
  const out: { food: Food; portionType: PlateItemSpec['portionType']; portionValue: number }[] = [];
  const index = FOOD_INDEX as Record<string, Food | undefined>;
  for (const spec of plate.items) {
    const food = index[spec.foodId];
    if (food) out.push({ food, portionType: spec.portionType, portionValue: spec.portionValue });
  }
  return out;
}