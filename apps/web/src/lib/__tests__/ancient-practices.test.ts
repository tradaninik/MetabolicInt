import { describe, it, expect } from 'vitest';
import { ANCIENT_PRACTICES, ANCIENT_PRACTICES_NOTE, sourceLabel } from '../ancientPractices';

// P5 - Ancient practices content policy, expressed as tests. Mirrors the
// healing-foods dataset integrity test: the editorial rules are the review
// checklist, in code.

const FORBIDDEN = /\b(cure|curative|treat(?:s|ed|ment)?|revers(?:e|es|ed|ing|al)?)\b/i;

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectStrings);
  return [];
}

describe('ancient practices content (P5)', () => {
  it('ships a curated set (6-10 practices)', () => {
    expect(ANCIENT_PRACTICES.length).toBeGreaterThanOrEqual(6);
    expect(ANCIENT_PRACTICES.length).toBeLessThanOrEqual(10);
  });

  it('has unique kebab-case ids', () => {
    const ids = ANCIENT_PRACTICES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('uses no cure/treatment/reverse language anywhere', () => {
    for (const p of ANCIENT_PRACTICES) {
      for (const s of collectStrings(p)) {
        expect(s.match(FORBIDDEN), `${p.id}: "${s}"`).toBeNull();
      }
    }
    expect(ANCIENT_PRACTICES_NOTE.match(FORBIDDEN)).toBeNull();
  });

  it('every practice carries a name, substantive detail and an honest source', () => {
    for (const p of ANCIENT_PRACTICES) {
      expect(p.name.length).toBeGreaterThanOrEqual(6);
      expect(p.detail.length).toBeGreaterThanOrEqual(120); // not a one-liner
      expect(['classical text', 'classical kitchen', 'household tradition']).toContain(p.source);
    }
  });

  it('distinguishes textual from household sourcing', () => {
    // The shatapavali entry is the honest case: household saying, not scripture.
    const walk = ANCIENT_PRACTICES.find((p) => p.id === 'shatapavali-walk');
    expect(walk?.source).toBe('household tradition');
  });

  it('source labels read naturally', () => {
    expect(sourceLabel('classical text')).toBe('From the classical texts');
    expect(sourceLabel('household tradition')).toBe('From household tradition');
  });

  it('the note keeps the tradition-vs-evidence framing honest', () => {
    expect(ANCIENT_PRACTICES_NOTE).toContain('not medical advice');
    expect(ANCIENT_PRACTICES_NOTE).toContain('evidence');
  });
});
