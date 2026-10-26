import { describe, it, expect } from 'vitest';
import {
  LENS_META,
  EVIDENCE_GRADE_META,
  CATEGORY_META,
  LENS_ORDER,
  CATEGORY_ORDER,
  FOOD_AS_MEDICINE_DISCLAIMER,
  STORIES_DISCLAIMER,
  lensesOf,
  validateHealingFood,
  rankHealingFoods,
  type HealingFood,
  type HealingFoodCategory,
} from './foodAsMedicine';

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

function habitFood(overrides: Partial<HealingFood> = {}): HealingFood {
  return makeFood({
    slug: 'test-habit',
    category: 'habit',
    ayurveda: {
      pacifies: ['kapha'],
      aggravates: [],
      prakritiFit: { vata: 'good', pitta: 'good', kapha: 'good' },
      summary: 'A classical habit summary line.',
    },
    ...overrides,
  });
}

const FORBIDDEN = /\b(cure|curative|treat(?:s|ed|ment)?|revers(?:e|es|ed|ing|al)?)\b/i;

describe('meta tables', () => {
  it('lens meta covers the three lenses in canonical order', () => {
    expect(Object.keys(LENS_META)).toEqual(LENS_ORDER);
    for (const id of LENS_ORDER) {
      expect(LENS_META[id].label.length).toBeGreaterThan(0);
      expect(LENS_META[id].blurb.length).toBeGreaterThan(10);
    }
  });

  it('evidence grade meta covers A through D with honest meanings', () => {
    expect(Object.keys(EVIDENCE_GRADE_META).sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(EVIDENCE_GRADE_META.A.meaning).toMatch(/randomized/i);
    expect(EVIDENCE_GRADE_META.D.meaning).toMatch(/do not \(yet\) support/i);
  });

  it('category meta covers all eight categories', () => {
    expect(Object.keys(CATEGORY_META).sort()).toEqual(
      ['drink', 'fruit', 'grain', 'habit', 'legume', 'nut', 'spice', 'vegetable'].sort(),
    );
    expect(new Set(CATEGORY_ORDER)).toEqual(new Set(Object.keys(CATEGORY_META) as HealingFoodCategory[]));
  });

  it('disclaimers are set and stay free of cure/treatment/reverse language', () => {
    expect(FOOD_AS_MEDICINE_DISCLAIMER.length).toBeGreaterThan(80);
    expect(STORIES_DISCLAIMER.length).toBeGreaterThan(80);
    expect(FOOD_AS_MEDICINE_DISCLAIMER.match(FORBIDDEN)).toBeNull();
    expect(STORIES_DISCLAIMER.match(FORBIDDEN)).toBeNull();
  });

  it('the stories disclaimer carries the medication caution verbatim class', () => {
    expect(STORIES_DISCLAIMER).toMatch(/insulin/);
    expect(STORIES_DISCLAIMER).toMatch(/sulfonylureas/);
    expect(STORIES_DISCLAIMER).toMatch(/low blood sugar/i);
    expect(STORIES_DISCLAIMER).toMatch(/care team/i);
  });
});

describe('lensesOf', () => {
  it('lists present lenses in canonical order', () => {
    expect(lensesOf(makeFood())).toEqual(['ayurveda', 'science', 'stories']);
    const partial = makeFood({ ayurveda: undefined });
    expect(lensesOf(partial)).toEqual(['science', 'stories']);
  });

  it('returns an empty list when no lens payload is present', () => {
    expect(lensesOf(makeFood({ ayurveda: undefined, science: undefined, stories: undefined }))).toEqual([]);
  });
});

describe('validateHealingFood', () => {
  it('accepts a complete three-lens food', () => {
    expect(validateHealingFood(makeFood())).toEqual([]);
  });

  it('accepts a habit without rasa/virya, since habits carry no taste', () => {
    expect(validateHealingFood(habitFood())).toEqual([]);
  });

  it('rejects an entry with no lens payload at all', () => {
    const none = makeFood({ ayurveda: undefined, science: undefined, stories: undefined });
    expect(validateHealingFood(none).join(' ')).toMatch(/at least one lens/i);
  });

  it('rejects unknown categories and non-kebab slugs', () => {
    const badCategory = { ...makeFood(), category: 'superfood' } as unknown as HealingFood;
    expect(validateHealingFood(badCategory).length).toBeGreaterThan(0);
    expect(validateHealingFood(makeFood({ slug: 'Not Kebab' })).length).toBeGreaterThan(0);
  });

  it('requires rasa and virya on non-habit entries', () => {
    const noRasa = makeFood({ ayurveda: { ...makeFood().ayurveda!, rasa: undefined, virya: undefined } });
    expect(validateHealingFood(noRasa).join(' ')).toMatch(/rasa is required for non-habit/);
    expect(validateHealingFood(noRasa).join(' ')).toMatch(/virya must be heating or cooling for non-habit/);
  });

  it('rejects invalid grades and thin evidence summaries', () => {
    const bad = { ...makeFood(), science: { ...makeFood().science!, grade: 'E' } } as unknown as HealingFood;
    expect(validateHealingFood(bad).join(' ')).toMatch(/grade must be one of A\/B\/C\/D/);
    const thin = makeFood({
      science: { ...makeFood().science!, grade: 'C', evidenceSummary: 'Too short.' },
    });
    expect(validateHealingFood(thin).join(' ')).toMatch(/evidenceSummary must be descriptive/);
  });

  it('requires a debunk on grade D and accepts one when present', () => {
    const d = makeFood({ science: { ...makeFood().science!, grade: 'D' } });
    expect(validateHealingFood(d).join(' ')).toMatch(/debunk .* required on grade D/);
    const dOk = makeFood({
      science: { ...makeFood().science!, grade: 'D', debunk: { claim: 'Okra water works fast', verdict: 'Human trials do not support it.' } },
    });
    expect(validateHealingFood(dOk)).toEqual([]);
  });

  it('rejects invalid season ids and seasons without a seasonal note', () => {
    const badSeason = {
      ...makeFood(),
      ayurveda: { ...makeFood().ayurveda!, seasons: ['monsoon'], seasonalNote: 'A note about seasons.' },
    } as unknown as HealingFood;
    expect(validateHealingFood(badSeason).join(' ')).toMatch(/valid Ritucharya season ids/);
    const noNote = makeFood({ ayurveda: { ...makeFood().ayurveda!, seasons: ['vasant'] } });
    expect(validateHealingFood(noNote).join(' ')).toMatch(/seasonalNote is required when seasons are listed/);
  });

  it('rejects overlapping pacifies/aggravates and incomplete prakritiFit', () => {
    const both = makeFood({ ayurveda: { ...makeFood().ayurveda!, pacifies: ['kapha'], aggravates: ['kapha'] } });
    expect(validateHealingFood(both).join(' ')).toMatch(/disjoint/);
    const missingFit = {
      ...makeFood(),
      ayurveda: { ...makeFood().ayurveda!, prakritiFit: { vata: 'good', pitta: 'good' } },
    } as unknown as HealingFood;
    expect(validateHealingFood(missingFit).join(' ')).toMatch(/prakritiFit.kapha is missing/);
  });

  it('rejects invalid prevalence and empty pattern lists', () => {
    const bad = {
      ...makeFood(),
      stories: { prevalence: 'everywhere', patterns: ['One habit'], summary: 'A summary line.' },
    } as unknown as HealingFood;
    expect(validateHealingFood(bad).join(' ')).toMatch(/prevalence must be widely, commonly or scattered/);
    const empty = makeFood({ stories: { prevalence: 'widely', patterns: [], summary: 'A summary line.' } });
    expect(validateHealingFood(empty).join(' ')).toMatch(/patterns must be non-empty/);
  });
});

describe('rankHealingFoods', () => {
  it('is deterministic across runs', () => {
    const foods = [makeFood({ slug: 'b-food' }), makeFood({ slug: 'a-food' }), makeFood({ slug: 'c-food' })];
    const first = rankHealingFoods(foods).map((r) => r.food.slug);
    const second = rankHealingFoods(foods).map((r) => r.food.slug);
    expect(first).toEqual(second);
  });

  it('orders by evidence grade when all else is equal: A above B above C', () => {
    const foods = [
      makeFood({ slug: 'grade-c', science: { ...makeFood().science!, grade: 'C' } }),
      makeFood({ slug: 'grade-a', science: { ...makeFood().science!, grade: 'A' } }),
      makeFood({ slug: 'grade-b', science: { ...makeFood().science!, grade: 'B' } }),
    ];
    expect(rankHealingFoods(foods).map((r) => r.food.slug)).toEqual(['grade-a', 'grade-b', 'grade-c']);
  });

  it('rewards lens completeness: three lenses beat two', () => {
    const foods = [
      makeFood({ slug: 'two-lens', ayurveda: undefined }),
      makeFood({ slug: 'three-lens' }),
    ];
    expect(rankHealingFoods(foods).map((r) => r.food.slug)).toEqual(['three-lens', 'two-lens']);
  });

  it('orders Prakriti fit good above moderate above avoid', () => {
    const foods = [
      makeFood({ slug: 'avoid-fit', ayurveda: { ...makeFood().ayurveda!, prakritiFit: { vata: 'avoid', pitta: 'good', kapha: 'good' } } }),
      makeFood({ slug: 'good-fit', ayurveda: { ...makeFood().ayurveda!, prakritiFit: { vata: 'good', pitta: 'good', kapha: 'good' } } }),
      makeFood({ slug: 'moderate-fit', ayurveda: { ...makeFood().ayurveda!, prakritiFit: { vata: 'moderate', pitta: 'good', kapha: 'good' } } }),
    ];
    expect(rankHealingFoods(foods, { prakriti: 'vata' }).map((r) => r.food.slug)).toEqual([
      'good-fit',
      'moderate-fit',
      'avoid-fit',
    ]);
  });

  it('lens preference lifts entries that carry the lens', () => {
    const foods = [makeFood({ slug: 'no-science', science: undefined }), makeFood({ slug: 'with-science' })];
    expect(rankHealingFoods(foods, { lensPreference: 'science' }).map((r) => r.food.slug)).toEqual([
      'with-science',
      'no-science',
    ]);
  });

  it('demotes grade D below grade C under the science lens even with a better Prakriti fit', () => {
    const c = makeFood({
      slug: 'grade-c',
      science: { ...makeFood().science!, grade: 'C' },
      ayurveda: { ...makeFood().ayurveda!, prakritiFit: { vata: 'avoid', pitta: 'good', kapha: 'good' } },
    });
    const d = makeFood({
      slug: 'grade-d',
      science: { ...makeFood().science!, grade: 'D', debunk: { claim: 'Miracle drink', verdict: 'Human trials do not support it.' } },
      ayurveda: { ...makeFood().ayurveda!, prakritiFit: { vata: 'good', pitta: 'good', kapha: 'good' } },
    });
    const underScience = rankHealingFoods([c, d], { prakriti: 'vata', lensPreference: 'science' });
    expect(underScience.map((r) => r.food.slug)).toEqual(['grade-c', 'grade-d']);
    expect(underScience[1].reasons.join(' ')).toMatch(/demoted under the science lens/);

    // Without the science lens preference the demotion does NOT apply - D can outrank C
    // on its other merits. Demotion is a science-lens trust behavior, not a global one.
    const neutral = rankHealingFoods([c, d], { prakriti: 'vata' });
    expect(neutral.map((r) => r.food.slug)).toEqual(['grade-d', 'grade-c']);
  });

  it('breaks score ties by category (habits first) then slug', () => {
    const foods = [
      makeFood({ slug: 'z-grain', category: 'grain', science: undefined }),
      makeFood({ slug: 'a-grain', category: 'grain', science: undefined }),
      habitFood({ slug: 'm-habit', science: undefined }),
    ];
    expect(rankHealingFoods(foods).map((r) => r.food.slug)).toEqual(['m-habit', 'a-grain', 'z-grain']);
  });

  it('returns integer scores and at least one human-readable reason per entry', () => {
    const ranked = rankHealingFoods([makeFood(), habitFood()], { prakriti: 'kapha', lensPreference: 'stories' });
    for (const r of ranked) {
      expect(Number.isInteger(r.score)).toBe(true);
      expect(r.reasons.length).toBeGreaterThan(0);
      for (const reason of r.reasons) expect(reason.length).toBeGreaterThan(0);
    }
  });
});
