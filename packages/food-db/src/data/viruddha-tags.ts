import type { ViruddhaTag } from '@mi/engine';

// P4c / U19 - Viruddha Ahara food-class tags for the curated catalog.
//
// Editorial policy (reviewed like code, per spec section 6):
//   - The ENGINE knows food classes (milk, fish, sourFruit...); this file maps curated
//     catalog ids to those classes. Dish-level honesty: a dish is tagged when the class
//     food is its principal character (kheer IS milk-forward; a spoon of ghee in pongal
//     is NOT a ghee item for pairing purposes).
//   - The buttermilk family (lassi, mor kuzhambu) is deliberately NOT tagged curd -
//     classical sources treat churned buttermilk as a different substance from fresh curd.
//   - Ripe sweet mango (aamras) is deliberately NOT tagged sourFruit - the classical
//     milk + sour-fruit pair targets acid fruits, not ripe sweet mango.
//   - A second, name-matched map below covers custom foods (users log plain "milk",
//     "honey", "dahi", "fish fry"): exact name or alias match, lowercased and trimmed -
//     the same honest-coverage pattern as findTasteByName. No match, no finding.
//   - Catalog-id coverage is enforced by the dataset integrity test
//     (packages/food-db/src/__tests__/viruddha-tags.test.ts); a stale id fails CI.

/** Curated catalog foods -> viruddha food classes. */
export const viruddhaTags: Record<string, ViruddhaTag[]> = {
  // ---- Milk-forward dishes ----
  kheer: ['milk'],
  payesh: ['milk'],
  basundi: ['milk'],

  // ---- Fresh-curd dishes ----
  curd_rice: ['curd'],
  thayir_sadam_tamil: ['curd'],
  misti_doi: ['curd'],
  greek_yogurt: ['curd'],
  shrikhand: ['curd'],
  gujarati_kadhi: ['curd'],
  kadhi_pakora: ['curd'],

  // ---- Fish & seafood dishes ----
  amritsari_fish: ['fish'],
  macher_jhol: ['fish'],
  shorshe_chingri: ['fish'],
  fish_moilee: ['fish'],
  meen_pollichathu: ['fish'],

  // ---- Fruits ----
  banana: ['banana'],
};

/**
 * Name -> classes for custom foods. Keys are lowercase and trimmed; values are the
 * same engine food classes. A few compound names (banana milkshake) map to BOTH
 * classes they visibly combine, so a single logged item can carry a pair honestly.
 */
export const viruddhaTagNames: Record<string, ViruddhaTag[]> = {
  // Milk
  milk: ['milk'],
  doodh: ['milk'],
  'cow milk': ['milk'],
  'buffalo milk': ['milk'],
  'hot milk': ['milk'],
  'milk powder': ['milk'],

  // Fresh curd / yogurt
  curd: ['curd'],
  dahi: ['curd'],
  doi: ['curd'],
  thayir: ['curd'],
  yogurt: ['curd'],
  yoghurt: ['curd'],
  'plain yogurt': ['curd'],
  'greek yogurt': ['curd'],
  'sour curd': ['curd'],

  // Fish & seafood
  fish: ['fish'],
  'fish fry': ['fish'],
  'fish curry': ['fish'],
  hilsa: ['fish'],
  rohu: ['fish'],
  rui: ['fish'],
  katla: ['fish'],
  salmon: ['fish'],
  tuna: ['fish'],
  sardine: ['fish'],
  sardines: ['fish'],
  pomfret: ['fish'],
  mackerel: ['fish'],
  prawns: ['fish'],
  prawn: ['fish'],
  shrimp: ['fish'],

  // Sour fruits
  orange: ['sourFruit'],
  'sweet lime': ['sourFruit'],
  mosambi: ['sourFruit'],
  santra: ['sourFruit'],
  pineapple: ['sourFruit'],
  strawberry: ['sourFruit'],
  strawberries: ['sourFruit'],
  grapes: ['sourFruit'],
  lemon: ['sourFruit'],
  lime: ['sourFruit'],
  grapefruit: ['sourFruit'],
  kiwi: ['sourFruit'],
  cranberry: ['sourFruit'],
  blueberry: ['sourFruit'],
  raspberry: ['sourFruit'],
  amla: ['sourFruit'],
  'indian gooseberry': ['sourFruit'],

  // Banana
  banana: ['banana'],
  kela: ['banana'],
  'ripe banana': ['banana'],

  // Honey
  honey: ['honey'],
  shahad: ['honey'],
  madhu: ['honey'],
  'raw honey': ['honey'],

  // Ghee
  ghee: ['ghee'],
  'clarified butter': ['ghee'],

  // Radish
  radish: ['radish'],
  mooli: ['radish'],
  muli: ['radish'],
  daikon: ['radish'],
  'white radish': ['radish'],

  // Garlic
  garlic: ['garlic'],
  lehsun: ['garlic'],
  lasun: ['garlic'],

  // Compounds: one item that visibly combines two classes
  'banana milkshake': ['milk', 'banana'],
  'banana shake': ['milk', 'banana'],
  'milkshake': ['milk'],
};
