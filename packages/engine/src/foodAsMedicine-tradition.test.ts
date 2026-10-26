import { describe, it, expect } from 'vitest';
import { lensesOf, validateHealingFood, rankHealingFoods, type HealingFood, type TraditionLensData } from './foodAsMedicine';

// P5 - Ancient practice (tradition) lens: validator rules and ranking
// neutrality. The tradition layer is content-only - it must never change
// scores, only add classical-practice depth to an entry.

function makeFood(overrides: Partial<HealingFood> = {}): HealingFood {
  return {
    slug: 'test-food',
    name: 'Test food',
    category: 'grain',
    headline: 'A headline of decent length',
    ayurveda: {
      rasa: ['madhura (sweet)'],
      virya: 'heating',
      pacifies: ['kapha'],
      aggravates: ['vata'],
      prakritiFit: { vata: 'moderate', pitta: 'good', kapha: 'good' },
      summary: 'A classical summary line for testing.',
    },
    science: {
      grade: 'B',
      headline: 'A science headline',
      evidenceSummary: 'A descriptive evidence summary comfortably longer than forty characters.',
    },
    stories: {
      prevalence: 'widely',
      patterns: ['A common community practice'],
      summary: 'A community summary line.',
    },
    ...overrides,
  };
}

function makeTradition(overrides: Partial<TraditionLensData> = {}): TraditionLensData {
  return {
    headline: 'A classical framing of this food.',
    classicalTexts: ['Charaka Samhita - as commonly taught'],
    preparation: 'Soaked overnight and taken at dawn.',
    practices: [
      {
        name: 'The morning soak',
        detail:
          'The classical household form is a short soak taken at dawn, described educationally here for testing purposes.',
      },
    ],
    note: 'Tradition is tradition; evidence lives in the science lens.',
    ...overrides,
  };
}

describe('tradition lens validation (P5)', () => {
  it('accepts a well-formed tradition block', () => {
    expect(validateHealingFood(makeFood({ tradition: makeTradition() }))).toEqual([]);
  });

  it('requires a real headline', () => {
    const problems = validateHealingFood(makeFood({ tradition: makeTradition({ headline: 'thin' }) }));
    expect(problems).toContainEqual(expect.stringContaining('tradition.headline'));
  });

  it('requires 1-4 practices', () => {
    const none = validateHealingFood(makeFood({ tradition: makeTradition({ practices: [] }) }));
    expect(none).toContainEqual(expect.stringContaining('tradition.practices'));

    const tooMany = makeTradition({
      practices: [1, 2, 3, 4, 5].map((i) => ({
        name: `Practice number ${i}`,
        detail: `A descriptive detail for practice number ${i}, comfortably long enough to pass.`,
      })),
    });
    const five = validateHealingFood(makeFood({ tradition: tooMany }));
    expect(five).toContainEqual(expect.stringContaining('tradition.practices'));
  });

  it('requires a name and a descriptive detail per practice', () => {
    const thin = makeTradition({
      practices: [{ name: 'ok', detail: 'too thin' }],
    });
    const problems = validateHealingFood(makeFood({ tradition: thin }));
    expect(problems).toContainEqual(expect.stringContaining('tradition.practices'));
  });

  it('rejects empty classical-text strings and thin notes', () => {
    const bad = makeTradition({ classicalTexts: [''], note: 'thin' });
    const problems = validateHealingFood(makeFood({ tradition: bad }));
    expect(problems).toContainEqual(expect.stringContaining('tradition.classicalTexts'));
    expect(problems).toContainEqual(expect.stringContaining('tradition.note'));
  });

  it('tradition alone does not satisfy the at-least-one-lens rule', () => {
    const food = makeFood({ ayurveda: undefined, science: undefined, stories: undefined, tradition: makeTradition() });
    const problems = validateHealingFood(food);
    expect(problems).toContainEqual('at least one lens payload is required');
    expect(lensesOf(food)).toEqual([]);
  });

  it('ranking is untouched by tradition content (content-only lens)', () => {
    const plain = rankHealingFoods([makeFood()])[0];
    const withTradition = rankHealingFoods([makeFood({ tradition: makeTradition() })])[0];
    expect(withTradition.score).toBe(plain.score);
    expect(withTradition.reasons).toEqual(plain.reasons);
  });
});
