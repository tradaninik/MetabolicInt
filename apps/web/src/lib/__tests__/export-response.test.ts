import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { buildExport } from '../export-response';
import { EXPORT_TABLE_KEYS } from '../export-tables';

// Proxy stub: any model delegate answers findMany/findUnique from `rows`.
function stubPrisma(rows: Record<string, unknown[]> = {}): PrismaClient {
  return new Proxy({}, {
    get(_t, name: string) {
      return {
        findMany: () => Promise.resolve(rows[name] ?? []),
        findUnique: () => Promise.resolve((rows[name] ?? [])[0] ?? null),
      };
    },
  }) as unknown as PrismaClient;
}
const uid = 'user-1';

describe('buildExport json', () => {
  it('returns the versioned envelope with all tables and a backup filename', async () => {
    const out = await buildExport(stubPrisma({ lab: [{ id: 'l1' }], foodEntry: [{ id: 'f1' }] }), uid, 'json', null);
    if (!out.ok) throw new Error('expected ok');
    const parsed = JSON.parse(out.body);
    expect(parsed.app).toBe('MetabolicInt');
    expect(parsed.formatVersion).toBe(1);
    expect(parsed.userId).toBe(uid);
    expect(Object.keys(parsed.tables)).toEqual([...EXPORT_TABLE_KEYS]);
    expect(parsed.tables.labs).toEqual([{ id: 'l1' }]);
    expect(out.contentType).toBe('application/json');
    expect(out.filename).toMatch(/^metabolicint-backup-\d{8}-\d{4}\.json$/);
  });
});

describe('buildExport csv', () => {
  it('returns CRLF CSV for a known table with a per-table filename', async () => {
    const out = await buildExport(stubPrisma({ lab: [{ id: 'l1', hba1c: 5.4 }] }), uid, 'csv', 'labs');
    if (!out.ok) throw new Error('expected ok');
    expect(out.body).toBe('id,hba1c\r\nl1,5.4');
    expect(out.contentType).toBe('text/csv; charset=utf-8');
    expect(out.filename).toMatch(/^metabolicint-backup-\d{8}-\d{4}-labs\.csv$/);
  });
  it('returns an empty body for a zero-row table', async () => {
    const out = await buildExport(stubPrisma(), uid, 'csv', 'labs');
    if (!out.ok) throw new Error('expected ok');
    expect(out.body).toBe('');
    expect(out.filename).toMatch(/-labs\.csv$/);
  });
});

describe('buildExport csv errors', () => {
  it('400s when table param is missing', async () => {
    const out = await buildExport(stubPrisma(), uid, 'csv', null);
    expect(out).toEqual({ ok: false, status: 400, error: 'Missing ?table= for CSV export.' });
  });
  it('400s listing valid keys for an unknown table', async () => {
    const out = await buildExport(stubPrisma(), uid, 'csv', 'nope');
    if (out.ok) throw new Error('expected failure');
    expect(out.status).toBe(400);
    expect(out.error).toContain('nope');
    expect(out.error).toContain('labs');
  });
});
describe('buildExport format validation', () => {
  it('400s on missing or unsupported format', async () => {
    const bad = { ok: false, status: 400, error: 'format must be "json" or "csv".' };
    expect(await buildExport(stubPrisma(), uid, undefined, null)).toEqual(bad);
    expect(await buildExport(stubPrisma(), uid, 'xml', null)).toEqual(bad);
  });
});
