import { describe, it, expect } from 'vitest';
import { parseNutritionLabel } from '../label-parser';

describe('parseNutritionLabel (spec F2)', () => {
  it('rescales per-30g to per-100g across all fields', () => {
    const r = parseNutritionLabel('Per 30g - Energy 150 kcal, Carbohydrate 20g, Protein 4g, Fat 5g, Dietary Fibre 2g');
    expect(r).toMatchObject({ carbsPer100g: 66.7, proteinPer100g: 13.3, fatPer100g: 16.7, fiberPer100g: 6.7, kcalPer100g: 500 });
    expect(r.notes.join(' ')).toContain('Rescaled from per 30g');
  });

  it('converts kJ and flags an assumed basis', () => {
    const r = parseNutritionLabel('Energy 628 kJ, Protein 8.0 g, Carbohydrate 45 g, Fat 12 g');
    expect(r.kcalPer100g).toBe(150.1);
    expect(r.proteinPer100g).toBe(8);
    expect(r.notes.join(' ')).toContain('assumed');
    expect(r.notes.join(' ')).toContain('kJ');
  });

  it('per-100g labels parse with no rescale note', () => {
    const r = parseNutritionLabel('100g: Energy 450 kcal, Carbohydrate 60g, Protein 8g, Fat 15g');
    expect(r.carbsPer100g).toBe(60);
    expect(r.notes.some((n) => n.includes('Rescaled'))).toBe(false);
  });

  it('handles per serving (30g) and empty input', () => {
    const r = parseNutritionLabel('Per serving (30g): Energy 120 kcal');
    expect(r.kcalPer100g).toBe(400);
    const e = parseNutritionLabel('   ');
    expect(e.carbsPer100g).toBeUndefined();
    expect(e.notes.length).toBeGreaterThan(0);
  });
});