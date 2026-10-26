import { describe, it, expect } from 'vitest';
import { parseQuestion, answerQuestion, type CoachContext } from '../coach';
import type { Food, UserProfile } from '../types';

const foodIndex: Record<string, Food> = {
  biryani: {
    id: 'biryani',
    name: 'Chicken Biryani',
    aliases: ['biryani'],
    region: 'telugu',
    category: 'cereal',
    servingGrams: 250,
    katoriGrams: 200,
    kcalPer100g: 165,
    carbsPer100g: 18,
    proteinPer100g: 8,
    fatPer100g: 6,
    fiberPer100g: 1.0,
    gi: 60,
  },
  dal: {
    id: 'dal',
    name: 'Moong Dal',
    aliases: ['dal', 'moong'],
    region: 'north_indian',
    category: 'legume',
    servingGrams: 150,
    katoriGrams: 150,
    kcalPer100g: 105,
    carbsPer100g: 12,
    proteinPer100g: 6,
    fatPer100g: 0.4,
    fiberPer100g: 4,
    gi: 31,
  },
};

const profile: UserProfile = {
  age: 50,
  gender: 'male',
  heightCm: 170,
  weightKg: 88,
  hba1c: 8.0,
  diabetic: true,
  activityLevel: 'light',
  region: 'telugu',
};

const ctx: CoachContext = {
  profile,
  sensitivity: 2.2,
  learned: { sensitivityMgDlPerGCarb: 2.2, sampleSize: 10, updatedAt: Date.now(), isPrior: false },
  foodIndex,
  recentMeals: [
    { foodId: 'biryani', portionType: 'serving', portionValue: 1, grams: 250, loggedAt: Date.now() - 86400_000 },
  ],
  recentGlucose: [
    { value: 120, takenAt: Date.now() - 7200_000 },
    { value: 165, takenAt: Date.now() - 3600_000 },
  ],
  recentSleep: [{ hours: 5.5, wokeAt: Date.now() - 3600_000 }],
  stepsToday: 1500,
};

describe('parseQuestion', () => {
  it('detects "can i eat" intent + food', () => {
    const p = parseQuestion('can i eat biryani today?', foodIndex);
    expect(p.intent).toBe('can_i_eat');
    expect(p.foodId).toBe('biryani');
  });

  it('matches aliases', () => {
    const p = parseQuestion('is it ok to have dal?', foodIndex);
    expect(p.intent).toBe('can_i_eat');
    expect(p.foodId).toBe('dal');
  });

  it('detects "why did glucose rise"', () => {
    expect(parseQuestion('why did my glucose rise?', foodIndex).intent).toBe('why_did_glucose_rise');
  });

  it('detects "what to eat"', () => {
    expect(parseQuestion('what should I eat for dinner?', foodIndex).intent).toBe('what_to_eat');
  });

  it('falls back to general', () => {
    expect(parseQuestion('how are you?', foodIndex).intent).toBe('general');
  });
});

describe('answerQuestion', () => {
  it('answers a can-i-eat with the predicted delta and grounding', () => {
    const a = answerQuestion('Can I eat biryani today?', ctx);
    expect(a.grounded).toBe(true);
    expect(a.text).toMatch(/mg\/dL/);
    expect(a.citations.length).toBeGreaterThan(0);
  });

  it('explains why glucose rose, citing readings', () => {
    const a = answerQuestion('Why did my glucose rise?', ctx);
    expect(a.grounded).toBe(true);
    expect(a.text).toMatch(/120.*165|165.*120/);
  });

  it('suggests green-scored foods', () => {
    const a = answerQuestion('What should I eat for dinner?', ctx);
    expect(a.grounded).toBe(true);
    // Dal is green for a typical profile; biryani is not.
    expect(a.text.toLowerCase()).toContain('dal');
  });

  it('asks for a food name when none given', () => {
    const a = answerQuestion('can i eat today?', ctx);
    expect(a.grounded).toBe(false);
  });

  it('cites sensitivity + learned sample size', () => {
    const a = answerQuestion('can i eat biryani today?', ctx);
    expect(a.citations.some((c) => c.includes('sensitivity'))).toBe(true);
  });
});
