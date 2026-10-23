import { describe, it, expect } from 'vitest';
import { ritucharyaSeason, ritucharyaCard } from './ritucharya';

describe('ritucharyaSeason month pins', () => {
  it('pins January to shishira', () => {
    expect(ritucharyaSeason(1)).toBe('shishira');
  });

  it('pins February and March to vasant', () => {
    expect(ritucharyaSeason(2)).toBe('vasant');
    expect(ritucharyaSeason(3)).toBe('vasant');
  });

  it('pins April and May to grishma', () => {
    expect(ritucharyaSeason(4)).toBe('grishma');
    expect(ritucharyaSeason(5)).toBe('grishma');
  });

  it('pins June through August to varsha', () => {
    expect(ritucharyaSeason(6)).toBe('varsha');
    expect(ritucharyaSeason(7)).toBe('varsha');
    expect(ritucharyaSeason(8)).toBe('varsha');
  });

  it('pins September and October to sharad', () => {
    expect(ritucharyaSeason(9)).toBe('sharad');
    expect(ritucharyaSeason(10)).toBe('sharad');
  });

  it('pins November and December to hemant', () => {
    expect(ritucharyaSeason(11)).toBe('hemant');
    expect(ritucharyaSeason(12)).toBe('hemant');
  });

  it('rejects non-month values', () => {
    expect(() => ritucharyaSeason(0)).toThrow();
    expect(() => ritucharyaSeason(13)).toThrow();
    expect(() => ritucharyaSeason(2.5)).toThrow();
  });
});

describe('ritucharyaCard', () => {
  it('returns complete cards, with hemant sweets inside the U25 glucose guardrails', () => {
    const seasons = ['shishira', 'vasant', 'grishma', 'varsha', 'sharad', 'hemant'] as const;
    for (const s of seasons) {
      const card = ritucharyaCard(s);
      expect(card.season).toBe(s);
      expect(card.name.length).toBeGreaterThan(0);
      expect(card.window.length).toBeGreaterThan(0);
      expect(card.focus.length).toBeGreaterThan(10);
      expect(card.diet.length).toBeGreaterThan(0);
      expect(card.routine.length).toBeGreaterThan(0);
      expect(card.shopping.length).toBeGreaterThan(0);
    }
    expect(ritucharyaCard('hemant').diet.join(' ')).toMatch(/glucose/i);
  });
});