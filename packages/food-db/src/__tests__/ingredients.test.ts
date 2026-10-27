// P7.1 — raw-ingredient catalog tests. The regional files carry cooked dishes;
// ingredients.ts carries the raw building blocks the recipe editor searches
// and the P8 recipe pipeline computes macros from. Pinned here:
//   * every ingredient id is unique across the WHOLE catalog (no FK ambiguity),
//   * ingredient search never returns a cooked dish,
//   * the staples the P8 recipes need actually exist and resolve,
//   * aliases are unique per food (no 'methi' ambiguity between leaves/seeds).
import { describe, expect, it } from 'vitest';
import {
  FOODS,
  FOOD_INDEX,
  ingredientFoods,
  INGREDIENT_IDS,
  isIngredientFoodId,
  searchIngredients,
  searchFoods,
} from '../index';

describe('raw-ingredient catalog integrity', () => {
  it('every ingredient id is unique across the whole catalog (dishes + ingredients)', () => {
    const seen = new Map<string, string>();
    for (const f of FOODS) {
      if (seen.has(f.id)) throw new Error(`duplicate food id "${f.id}" (${seen.get(f.id)} vs ${f.name})`);
      seen.set(f.id, f.name);
    }
  });

  it('every entry is well-formed with sane ranges', () => {
    expect(ingredientFoods.length).toBeGreaterThanOrEqual(80);
    for (const f of ingredientFoods) {
      expect(f.name.length, `${f.id} name`).toBeGreaterThan(0);
      expect((f.aliases ?? []).length, `${f.id} aliases`).toBeGreaterThan(0);
      expect(f.servingGrams, `${f.id} serving`).toBeGreaterThan(0);
      expect(f.kcalPer100g, `${f.id} kcal`).toBeGreaterThanOrEqual(0);
      expect(f.kcalPer100g, `${f.id} kcal sane`).toBeLessThanOrEqual(950);
      expect(f.carbsPer100g, `${f.id} carbs`).toBeGreaterThanOrEqual(0);
      expect(f.proteinPer100g, `${f.id} protein`).toBeGreaterThanOrEqual(0);
      expect(f.fatPer100g, `${f.id} fat`).toBeGreaterThanOrEqual(0);
      expect(f.gi, `${f.id} gi`).toBeGreaterThanOrEqual(0);
      expect(f.gi, `${f.id} gi sane`).toBeLessThanOrEqual(100);
    }
  });

  it('aliases are unique within each food and never duplicate the name', () => {
    for (const f of ingredientFoods) {
      const names = [f.name, ...(f.aliases ?? [])].map((n) => n.toLowerCase().trim());
      expect(new Set(names).size, `${f.id} has duplicate names/aliases`).toBe(names.length);
    }
  });

  it('INGREDIENT_IDS all resolve to real foods, and the set stays inside the catalog', () => {
    for (const id of INGREDIENT_IDS) {
      expect(FOOD_INDEX[id], `ingredient id ${id} must exist in FOODS`).toBeDefined();
      expect(isIngredientFoodId(id)).toBe(true);
    }
    expect(isIngredientFoodId('hyderabadi_biryani')).toBe(false);
    expect(isIngredientFoodId('plain_dosa')).toBe(false);
    expect(isIngredientFoodId('made-up-id')).toBe(false);
  });
});

describe('searchIngredients — the recipe editor search (Day-1 bug)', () => {
  it('finds raw staples by name', () => {
    const rice = searchIngredients('rice');
    expect(rice.map((f) => f.id)).toContain('rice_sona_masoori');
    expect(searchIngredients('toor dal').map((f) => f.id)).toContain('toor_dal');
    expect(searchIngredients('onion').map((f) => f.id)).toContain('onion');
    expect(searchIngredients('paneer').map((f) => f.id)).toContain('paneer');
  });

  it('searches regional aliases: kandi pappu, biyyam, kobbari, palak', () => {
    expect(searchIngredients('kandi pappu').map((f) => f.id)).toContain('toor_dal');
    expect(searchIngredients('biyyam').map((f) => f.id)).toContain('rice_sona_masoori');
    expect(searchIngredients('kobbari').map((f) => f.id)).toContain('fresh_coconut');
    expect(searchIngredients('palak').map((f) => f.id)).toContain('spinach_palak');
  });

  it('NEVER returns cooked dishes (the bug: dosa search showed cooked dishes)', () => {
    const dishQueries = ['dosa', 'idli', 'biryani', 'sambar', 'curry', 'pulao', 'khichdi', 'pappu charu'];
    for (const q of dishQueries) {
      const hits = searchIngredients(q);
      for (const f of hits) {
        expect(isIngredientFoodId(f.id), `${q} leaked cooked dish ${f.name}`).toBe(true);
      }
      // and nothing that IS a dish id sneaks in under an alias
      expect(hits.map((f) => f.id)).not.toContain('plain_dosa');
      expect(hits.map((f) => f.id)).not.toContain('hyderabadi_biryani');
      expect(hits.map((f) => f.id)).not.toContain('sambar');
    }
  });

  it('the plain food search still finds dishes (logging behavior unchanged)', () => {
    expect(searchFoods('dosa').map((f) => f.id)).toContain('plain_dosa');
    expect(searchFoods('biryani').map((f) => f.id)).toContain('hyderabadi_biryani');
  });

  it('the P8 seed staples exist: millets, dals, breakfast bases, oils, spices', () => {
    const need = [
      'rice_idli_raw', 'urad_whole', 'poha_flattened_rice', 'sooji_rava', 'ragi_flour', 'foxtail_millet',
      'little_millet', 'kodo_millet', 'barnyard_millet', 'jowar_flour', 'bajra_flour',
      'toor_dal', 'moong_dal_split', 'moong_whole', 'chana_dal', 'masoor_dal', 'urad_dal',
      'rajma_raw', 'chana_whole', 'horse_gram', 'buttermilk', 'curd', 'lemon',
      'onion', 'tomato', 'potato', 'gongura', 'bitter_gourd', 'tindora', 'brinjal', 'okra',
      'paneer', 'milk_toned', 'ghee', 'groundnut_oil', 'mustard_oil', 'peanuts_raw', 'sesame_seeds',
      'turmeric', 'sambar_powder', 'tamarind', 'jaggery', 'egg_raw', 'chicken_raw', 'fish_raw',
    ];
    for (const id of need) {
      expect(FOOD_INDEX[id], `P8 seed staple ${id} missing`).toBeDefined();
      expect(isIngredientFoodId(id)).toBe(true);
    }
  });
});
