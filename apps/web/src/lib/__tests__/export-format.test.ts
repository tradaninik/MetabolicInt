import { describe, expect, it } from 'vitest';
import {
  backupFilename,
  backupTimestamp,
  buildJsonExport,
  csvCell,
  kebabCase,
  redactSecrets,
  toCsv,
} from '../export-format';
describe('csvCell', () => {
  it('passes plain scalars through', () => {
    expect(csvCell('rice')).toBe('rice');
    expect(csvCell(42)).toBe('42');
    expect(csvCell(1.5)).toBe('1.5');
    expect(csvCell(true)).toBe('true');
    expect(csvCell(false)).toBe('false');
  });
  it('renders nullish and empty-string cells as empty', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell('')).toBe('');
  });
  it('ISO-serializes Dates', () => {
    expect(csvCell(new Date('2026-10-20T14:05:00.000Z'))).toBe('2026-10-20T14:05:00.000Z');
  });
  it('JSON-serializes objects, then applies CSV quoting', () => {
    expect(csvCell({ a: 1 })).toBe('"{""a"":1}"');
    expect(csvCell([1, 2])).toBe('"[1,2]"');
  });
  it('quotes comma/quote/CR/LF cells and doubles inner quotes', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
    expect(csvCell('cr\rbreak')).toBe('"cr\rbreak"');
  });
});
describe('toCsv', () => {
  it('emits header row then data rows with CRLF endings', () => {
    expect(toCsv([{ id: '1', name: 'dal' }, { id: '2', name: 'rice' }])).toBe('id,name\r\n1,dal\r\n2,rice');
  });
  it('returns empty string when there are no rows', () => {
    expect(toCsv([])).toBe('');
  });
  it('emits an empty cell for keys missing from later rows', () => {
    expect(toCsv([{ a: 1, b: 2 }, { a: 3 }])).toBe('a,b\r\n1,2\r\n3,');
  });
  it('keeps per-cell quoting intact inside rows', () => {
    expect(toCsv([{ note: 'x,y' }])).toBe('note\r\n"x,y"');
  });
});

describe('backupTimestamp and backupFilename', () => {
  it('formats local time as YYYYMMDD-HHmm with zero padding', () => {
    expect(backupTimestamp(new Date(2026, 9, 20, 14, 5))).toBe('20261020-1405');
    expect(backupTimestamp(new Date(2027, 0, 3, 9, 0))).toBe('20270103-0900');
  });
  it('builds the full-backup JSON filename', () => {
    const d = new Date(2026, 9, 20, 14, 5);
    expect(backupFilename('json', undefined, d)).toBe('metabolicint-backup-20261020-1405.json');
  });
  it('builds per-table CSV filenames', () => {
    const d = new Date(2026, 9, 20, 14, 5);
    expect(backupFilename('csv', 'food-entries', d)).toBe('metabolicint-backup-20261020-1405-food-entries.csv');
    expect(backupFilename('csv', 'labs', d)).toBe('metabolicint-backup-20261020-1405-labs.csv');
  });
});

describe('kebabCase', () => {
  it('converts camelCase table keys to filename slugs', () => {
    expect(kebabCase('foodEntries')).toBe('food-entries');
    expect(kebabCase('userLearnedModel')).toBe('user-learned-model');
    expect(kebabCase('labs')).toBe('labs');
    expect(kebabCase('bpReadings12')).toBe('bp-readings12');
  });
});

describe('redactSecrets', () => {
  it('drops credential-shaped keys case-insensitively without mutating input', () => {
    const row = { id: 'u1', email: 'a@b.c', passwordHash: 'x', apiToken: 'y', Secrets: 'z' };
    const out = redactSecrets(row);
    expect(out).toEqual({ id: 'u1', email: 'a@b.c' });
    expect(row.passwordHash).toBe('x');
    expect(row.apiToken).toBe('y');
  });
});

describe('buildJsonExport', () => {
  it('wraps table data in the versioned envelope', () => {
    const out = buildJsonExport('u1', '2026-10-20T14:05:00.000Z', { labs: [{ id: 'l1' }] });
    expect(out).toEqual({
      app: 'MetabolicInt',
      formatVersion: 1,
      userId: 'u1',
      exportedAt: '2026-10-20T14:05:00.000Z',
      tables: { labs: [{ id: 'l1' }] },
    });
  });
});
