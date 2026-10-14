import { describe, it, expect } from 'vitest';
import { blendRecipe, type BlendItem } from '../recipe-blend';

const A: BlendItem = { grams: 300, netCarbsG: 180, gi: 70, carbsPer100g: 60, proteinPer100g: 10, fatPer100g: 5, fiberPer100g: 4 };
const B: BlendItem = { grams: 100, netCarbsG: 20, gi: 30, carbsPer100g: 20, proteinPer100g: 2, fatPer100g: 1, fiberPer100g: 2 };

describe('blendRecipe (F3)', () => {
  it('single item passes through unchanged (per 100g)', () => {
    const r = blendRecipe([{ grams: 200, netCarbsG: 50, gi: 60, carbsPer100g: 50, proteinPer100g: 8, fatPer100g: 2, fiberPer100g: 5 }]);
    expect(r).toEqual({ servingGrams: 200, carbsPer100g: 50, proteinPer100g: 8, fatPer100g: 2, fiberPer100g: 5, gi: 60 });
  });

  it('gram-weighted macro averages across two items', () => {
    const r = blendRecipe([A, B]);
    expect(r.servingGrams).toBe(400);
    expect(r.carbsPer100g).toBe(50);    // (60*300 + 20*100)/400
    expect(r.proteinPer100g).toBe(8);   // (10*300 + 2*100)/400
    expect(r.fatPer100g).toBe(4);       // (5*300 + 1*100)/400
    expect(r.fiberPer100g).toBe(3.5);   // (4*300 + 2*100)/400
  });

  it('GI is net-carb weighted - mirroring the tray preview', () => {
    // weights 180 and 20: (70*180 + 30*20)/200 = 66
    expect(blendRecipe([A, B]).gi).toBe(66);
  });

  it('zero-carb items still weigh 1, never zero (GI stays representable)', () => {
    const r = blendRecipe([
      { grams: 100, netCarbsG: 0, gi: 60, carbsPer100g: 0, proteinPer100g: 0, fatPer100g: 100, fiberPer100g: 0 },
      { grams: 100, netCarbsG: 0, gi: 80, carbsPer100g: 0, proteinPer100g: 0, fatPer100g: 100, fiberPer100g: 0 },
    ]);
    expect(r.gi).toBe(70);
  });

  it('empty tray returns zeros, never NaN', () => {
    expect(blendRecipe([])).toEqual({ servingGrams: 0, carbsPer100g: 0, proteinPer100g: 0, fatPer100g: 0, fiberPer100g: 0, gi: 0 });
  });
});