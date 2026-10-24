import { describe, it, expect } from 'vitest';
import { parseAliases, viruddhaTagsForFood, viruddhaItemFor, viruddhaFindingsForFoods } from '../viruddha';

describe('parseAliases', () => {
  it('handles engine-style string arrays', () => {
    expect(parseAliases(['misti doi', 'sweet curd'])).toEqual(['misti doi', 'sweet curd']);
  });

  it('handles prisma-style JSON-encoded arrays', () => {
    expect(parseAliases(JSON.stringify(['dahi', 'doi']))).toEqual(['dahi', 'doi']);
  });

  it('degrades to CSV when the string is not valid JSON', () => {
    expect(parseAliases('dahi, doi , thayir')).toEqual(['dahi', 'doi', 'thayir']);
  });

  it('returns [] for null, undefined, empty and malformed input', () => {
    expect(parseAliases(null)).toEqual([]);
    expect(parseAliases(undefined)).toEqual([]);
    expect(parseAliases('')).toEqual([]);
    expect(parseAliases('   ')).toEqual([]);
    expect(parseAliases(JSON.stringify({ not: 'an array' }))).toEqual([]);
  });
});

describe('viruddhaTagsForFood', () => {
  it('resolves curated catalog foods by id', () => {
    expect(viruddhaTagsForFood({ id: 'kheer', name: 'Kheer' })).toEqual(['milk']);
    expect(viruddhaTagsForFood({ id: 'fish_moilee', name: 'Fish Moilee' })).toEqual(['fish']);
  });

  it('falls back to name matching for custom foods', () => {
    expect(viruddhaTagsForFood({ id: 'custom-1', name: 'Milk' })).toEqual(['milk']);
    expect(viruddhaTagsForFood({ id: 'custom-2', name: 'Honey' })).toEqual(['honey']);
  });

  it('falls back to alias matching when the name misses', () => {
    expect(viruddhaTagsForFood({ id: 'custom-3', name: 'My fish', aliases: ['rohu'] })).toEqual(['fish']);
  });

  it('resolves prisma-style JSON aliases', () => {
    expect(viruddhaTagsForFood({ id: 'custom-4', name: 'Evening bowl', aliases: JSON.stringify(['milk']) })).toEqual(['milk']);
  });

  it('returns [] when nothing matches - honest coverage, no guessing', () => {
    expect(viruddhaTagsForFood({ id: 'custom-5', name: 'Poha', aliases: ['kanda poha'] })).toEqual([]);
    expect(viruddhaTagsForFood({ id: '', name: '' })).toEqual([]);
  });

  it('id resolution wins over name resolution (curated rows never re-match by name)', () => {
    // lassi is curated and deliberately untagged; a name match on "lassi" must not invent tags.
    expect(viruddhaTagsForFood({ id: 'lassi', name: 'Sweet Lassi' })).toEqual([]);
  });
});

describe('viruddhaItemFor', () => {
  it('builds a labeled check item with resolved tags', () => {
    const it = viruddhaItemFor({ id: 'kheer', name: 'Kheer' });
    expect(it.key).toBe('kheer');
    expect(it.label).toBe('Kheer');
    expect(it.tags).toEqual(['milk']);
  });

  it('falls back to name as key and label for malformed rows', () => {
    const it = viruddhaItemFor({ id: '', name: 'Milk' });
    expect(it.key).toBe('Milk');
    expect(it.label).toBe('Milk');
    expect(it.tags).toEqual(['milk']);
  });
});

describe('viruddhaFindingsForFoods (integration with the engine checker)', () => {
  it('a known pair fires with both lenses and the item labels', () => {
    const out = viruddhaFindingsForFoods([
      { id: 'kheer', name: 'Kheer' },
      { id: 'amritsari_fish', name: 'Amritsari Fish' },
    ]);
    expect(out.length).toBe(1);
    expect(out[0].pairId).toBe('milk-fish');
    expect(out[0].severity).toBe('avoid');
    expect(out[0].items.map((i) => i.label)).toEqual(['Kheer', 'Amritsari Fish']);
    expect(out[0].classical.length).toBeGreaterThan(25);
    expect(out[0].modern.length).toBeGreaterThan(25);
  });

  it('custom foods pair via name matching', () => {
    const out = viruddhaFindingsForFoods([
      { id: 'custom-a', name: 'Doodh' },
      { id: 'custom-b', name: 'Salmon', aliases: ['fish'] },
    ]);
    expect(out.map((f) => f.pairId)).toContain('milk-fish');
  });

  it('a clean combo shows nothing', () => {
    expect(
      viruddhaFindingsForFoods([
        { id: 'chapati', name: 'Chapati' },
        { id: 'dal_tadka', name: 'Dal Tadka' },
        { id: 'idli', name: 'Idli' },
      ]),
    ).toEqual([]);
  });

  it('tolerates null input', () => {
    expect(viruddhaFindingsForFoods(null as never)).toEqual([]);
  });
});
