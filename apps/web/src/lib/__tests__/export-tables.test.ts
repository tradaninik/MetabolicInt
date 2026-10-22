import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { collectUserExport, collectUserTable, EXPORT_TABLE_DEFS } from '../export-tables';

// Stub PrismaClient: records every call's where clause, returns canned rows.
const DELEGATES = ['user','userSettings','userLearnedModel','foodEntry','glucoseReading','activityEntry','sleepEntry','weightEntry','bloodPressureEntry','lab','medication','medicationLog','dayContextTag','insightCard','coachThread','coachMessage','careRelationship','doctorPatientLink','achievement','savedCombo','food'];
interface Call { name: string; where: unknown; }
function makeStub(overrides: Record<string, { findMany?: unknown[]; findUnique?: unknown }> = {}) {
  const calls: Call[] = [];
  const p: Record<string, unknown> = {};
  for (const d of DELEGATES) {
    const o = overrides[d] ?? {};
    p[d] = {
      findMany: (args: { where: unknown }) => { calls.push({ name: d, where: args?.where }); return Promise.resolve(o.findMany ?? []); },
      findUnique: (args: { where: unknown }) => { calls.push({ name: d, where: args?.where }); return Promise.resolve(o.findUnique ?? null); },
    };
  }
  return { prisma: p as unknown as PrismaClient, calls };
}
const uid = 'user-1';

describe('EXPORT_TABLE_DEFS', () => {
  it('defines 21 unique tables, each with a label', () => {
    expect(EXPORT_TABLE_DEFS).toHaveLength(21);
    expect(new Set(EXPORT_TABLE_DEFS.map((d) => d.key)).size).toBe(21);
    for (const d of EXPORT_TABLE_DEFS) expect(d.label.trim().length).toBeGreaterThan(0);
  });
});
describe('collectUserExport', () => {
  it('returns every table keyed in registry order', async () => {
    const out = await collectUserExport(makeStub().prisma, uid);
    expect(Object.keys(out)).toEqual([...EXPORT_TABLE_DEFS.map((d) => d.key)]);
  });
});

describe('collectUserExport scoping', () => {
  it('redacts the profile row and passes data rows through', async () => {
    const prisma = makeStub({ user: { findUnique: { id: uid, email: 'a@b.c', passwordHash: 'x', name: 'N' } }, foodEntry: { findMany: [{ id: 'f1' }] } }).prisma;
    const out = await collectUserExport(prisma, uid);
    expect(out.user).toEqual([{ id: uid, email: 'a@b.c', name: 'N' }]);
    expect(out.foodEntries).toEqual([{ id: 'f1' }]);
  });
  it('scopes relation-owned and shared tables to the user', async () => {
    const { prisma, calls } = makeStub();
    await collectUserExport(prisma, uid);
    const where = (n: string) => calls.find((c) => c.name === n)?.where;
    expect(where('user')).toEqual({ id: uid });
    expect(where('userSettings')).toEqual({ userId: uid });
    expect(where('coachMessage')).toEqual({ thread: { userId: uid } });
    expect(where('careRelationship')).toEqual({ OR: [{ caregiverId: uid }, { wardId: uid }] });
    expect(where('doctorPatientLink')).toEqual({ OR: [{ doctorId: uid }, { patientId: uid }] });
    expect(where('food')).toEqual({ createdByUserId: uid });
    expect(where('medicationLog')).toEqual({ userId: uid });
  });
});
describe('collectUserTable', () => {
  it('returns one table rows, null for unknown keys', async () => {
    const prisma = makeStub({ lab: { findMany: [{ id: 'l1' }] } }).prisma;
    expect(await collectUserTable(prisma, uid, 'labs')).toEqual([{ id: 'l1' }]);
    expect(await collectUserTable(prisma, uid, 'nope')).toBeNull();
  });
});
