import { describe, it, expect } from 'vitest';
import {
  FOODS,
  VIRUDDHA_TAGS,
  VIRUDDHA_TAG_NAMES,
  viruddhaTagsOf,
  findViruddhaTagsByName,
} from '../index';
import { checkViruddha, type ViruddhaTag } from '@mi/engine';

const VALID_TAGS: ViruddhaTag[] = [
  'milk', 'curd', 'fish', 'sourFruit', 'banana', 'honey', 'ghee', 'radish', 'garlic',
];

describe('viruddha tags dataset (P4c-c / U19)', () => {
  it('every catalog id in the tag map exists in FOODS (no stale ids)', () => {
    const ids = new Set(FOODS.map((f) => f.id));
    for (const [id, tags] of Object.entries(VIRUDDHA_TAGS)) {
      expect(ids.has(id), `unknown food id: ${id}`).toBe(true);
      expect(Array.isArray(tags), id).toBe(true);
      expect(tags.length, id).toBeGreaterThan(0);
    }
  });

  it('every tag value is a valid engine food class, with no repeats per food', () => {
    for (const [id, tags] of Object.entries(VIRUDDHA_TAGS)) {
      for (const t of tags) {
        expect(VALID_TAGS, `${id}: ${t}`).toContain(t);
      }
      expect(new Set(tags).size, id).toBe(tags.length);
    }
  });

  it('milk dishes carry milk; fish dishes carry fish; curd dishes carry curd; banana carries banana', () => {
    expect(VIRUDDHA_TAGS['kheer']).toEqual(['milk']);
    expect(VIRUDDHA_TAGS['payesh']).toEqual(['milk']);
    expect(VIRUDDHA_TAGS['basundi']).toEqual(['milk']);
    for (const id of ['amritsari_fish', 'macher_jhol', 'shorshe_chingri', 'fish_moilee', 'meen_pollichathu']) {
      expect(VIRUDDHA_TAGS[id], id).toEqual(['fish']);
    }
    for (const id of ['curd_rice', 'thayir_sadam_tamil', 'misti_doi', 'greek_yogurt', 'shrikhand', 'gujarati_kadhi', 'kadhi_pakora']) {
      expect(VIRUDDHA_TAGS[id], id).toEqual(['curd']);
    }
    expect(VIRUDDHA_TAGS['banana']).toEqual(['banana']);
  });

  it('the buttermilk family and ripe aamras are deliberately untagged (honest coverage)', () => {
    expect(VIRUDDHA_TAGS['lassi']).toBeUndefined();
    expect(VIRUDDHA_TAGS['mor_kuzhambu']).toBeUndefined();
    expect(VIRUDDHA_TAGS['aamras_puri']).toBeUndefined();
  });

  it('every name-map key is lowercase, trimmed and non-empty; values are valid classes', () => {
    for (const [key, tags] of Object.entries(VIRUDDHA_TAG_NAMES)) {
      expect(key, JSON.stringify(key)).toBe(key.toLowerCase().trim());
      expect(key.length).toBeGreaterThan(0);
      expect(Array.isArray(tags), key).toBe(true);
      expect(tags.length, key).toBeGreaterThan(0);
      for (const t of tags) {
        expect(VALID_TAGS, `${key}: ${t}`).toContain(t);
      }
      expect(new Set(tags).size, key).toBe(tags.length);
    }
  });

  it('compound names carry both classes they visibly combine', () => {
    expect(VIRUDDHA_TAG_NAMES['banana milkshake']).toEqual(['milk', 'banana']);
  });

  it('viruddhaTagsOf resolves curated ids and returns undefined for the rest', () => {
    expect(viruddhaTagsOf('kheer')).toEqual(['milk']);
    expect(viruddhaTagsOf('banana')).toEqual(['banana']);
    expect(viruddhaTagsOf('chapati')).toBeUndefined();
    expect(viruddhaTagsOf('')).toBeUndefined();
  });

  it('findViruddhaTagsByName matches names and aliases, case-insensitively', () => {
    expect(findViruddhaTagsByName('milk')).toEqual(['milk']);
    expect(findViruddhaTagsByName('Doodh')).toEqual(['milk']);
    expect(findViruddhaTagsByName('  HONEY ')).toEqual(['honey']);
    expect(findViruddhaTagsByName('Roti', ['dahi', 'curd'])).toEqual(['curd']);
    expect(findViruddhaTagsByName('My Special Sabzi')).toBeUndefined();
    expect(findViruddhaTagsByName('')).toBeUndefined();
  });

  it('integration: catalog foods resolve to tags and fire the engine checker', () => {
    const items = [
      { key: 'kheer', label: 'Kheer', tags: viruddhaTagsOf('kheer') ?? [] },
      { key: 'amritsari_fish', label: 'Amritsari Fish', tags: viruddhaTagsOf('amritsari_fish') ?? [] },
    ];
    const out = checkViruddha(items);
    expect(out.length).toBe(1);
    expect(out[0].pairId).toBe('milk-fish');
    expect(out[0].severity).toBe('avoid');
    expect(out[0].classical.length).toBeGreaterThan(25);
    expect(out[0].modern.length).toBeGreaterThan(25);
  });

  it('integration: a realistic clean thali fires nothing', () => {
    // Real catalog ids: chapati + dal tadka + idli + sambar - a classic clean plate.
    const items = ['chapati', 'dal_tadka', 'idli', 'sambar']
      .map((id) => ({ key: id, label: id, tags: viruddhaTagsOf(id) ?? [] }));
    expect(items.length).toBe(4);
    expect(checkViruddha(items)).toEqual([]);
  });
});
