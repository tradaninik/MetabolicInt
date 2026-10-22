import { describe, it, expect } from 'vitest';
import { computeAdherence, eachDate, type MedScheduleLike, type MedLogLike } from '../clinical-db';

const M1: MedScheduleLike = { id: 'm1', scheduleTimes: '["08:00","20:00"]', isActive: true };
const M2: MedScheduleLike = { id: 'm2', scheduleTimes: '["09:00"]', isActive: true };

const log = (medId: string, date: string, slot: string, status: string): MedLogLike =>
  ({ medicationId: medId, logDate: date, slotTime: slot, status });

describe('eachDate', () => {
  it('iterates inclusive, crosses month boundaries, returns [] when from > to', () => {
    expect(eachDate('2026-02-27', '2026-03-01')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
    expect(eachDate('2026-03-01', '2026-02-01')).toEqual([]);
  });
});

describe('computeAdherence', () => {
  it('scores 100% when every past slot is taken', () => {
    const r = computeAdherence([M1], [log('m1', '2026-03-01', '08:00', 'taken'), log('m1', '2026-03-01', '20:00', 'taken')],
      { from: '2026-03-01', to: '2026-03-01', asOf: '2026-03-02T00:00' });
    expect(r).toEqual({ expected: 2, taken: 2, skipped: 0, pending: 0, pct: 100 });
  });

  it('counts an explicit skip against adherence', () => {
    const r = computeAdherence([M1], [log('m1', '2026-03-01', '08:00', 'taken'), log('m1', '2026-03-01', '20:00', 'skipped')],
      { from: '2026-03-01', to: '2026-03-01', asOf: '2026-03-02T00:00' });
    expect(r).toEqual({ expected: 2, taken: 1, skipped: 1, pending: 0, pct: 50 });
  });

  it('treats past slots without rows as pending (scheduled-but-untaken)', () => {
    const r = computeAdherence([M1], [], { from: '2026-03-01', to: '2026-03-01', asOf: '2026-03-02T00:00' });
    expect(r).toEqual({ expected: 2, taken: 0, skipped: 0, pending: 2, pct: 0 });
  });

  it('excludes today slots not yet past (asOf 12:00)', () => {
    const r = computeAdherence([M1], [log('m1', '2026-03-01', '08:00', 'taken')],
      { from: '2026-03-01', to: '2026-03-01', asOf: '2026-03-01T12:00' });
    expect(r).toEqual({ expected: 1, taken: 1, skipped: 0, pending: 0, pct: 100 });
  });

  it('includes a today slot exactly at asOf time (boundary inclusive)', () => {
    const r = computeAdherence([M1], [log('m1', '2026-03-01', '08:00', 'taken'), log('m1', '2026-03-01', '20:00', 'taken')],
      { from: '2026-03-01', to: '2026-03-01', asOf: '2026-03-01T20:00' });
    expect(r).toEqual({ expected: 2, taken: 2, skipped: 0, pending: 0, pct: 100 });
  });

  it('ignores logs outside the window', () => {
    const r = computeAdherence([M1], [log('m1', '2026-02-28', '08:00', 'taken'), log('m1', '2026-02-28', '20:00', 'taken')],
      { from: '2026-03-01', to: '2026-03-01', asOf: '2026-03-02T00:00' });
    expect(r).toEqual({ expected: 2, taken: 0, skipped: 0, pending: 2, pct: 0 });
  });

  it('excludes inactive medications entirely', () => {
    const inactive: MedScheduleLike = { id: 'm3', scheduleTimes: '["10:00"]', isActive: false };
    const r = computeAdherence([inactive], [log('m3', '2026-03-01', '10:00', 'taken')],
      { from: '2026-03-01', to: '2026-03-01', asOf: '2026-03-02T00:00' });
    expect(r).toEqual({ expected: 0, taken: 0, skipped: 0, pending: 0, pct: null });
  });

  it('survives invalid scheduleTimes JSON (med contributes no slots)', () => {
    const bad: MedScheduleLike = { id: 'm4', scheduleTimes: 'not json', isActive: true };
    const r = computeAdherence([bad], [], { from: '2026-03-01', to: '2026-03-01', asOf: '2026-03-02T00:00' });
    expect(r).toEqual({ expected: 0, taken: 0, skipped: 0, pending: 0, pct: null });
  });

  it('aggregates a multi-day window per slot', () => {
    const logs = [
      log('m2', '2026-03-01', '09:00', 'taken'),
      log('m2', '2026-03-02', '09:00', 'skipped'),
      // 2026-03-03 09:00 left without a row -> pending
    ];
    const r = computeAdherence([M2], logs, { from: '2026-03-01', to: '2026-03-03', asOf: '2026-03-03T23:59' });
    expect(r).toEqual({ expected: 3, taken: 1, skipped: 1, pending: 1, pct: 33 });
  });

  it('returns pct null when no meds given (nothing to score)', () => {
    const r = computeAdherence([], [], { from: '2026-03-01', to: '2026-03-01', asOf: '2026-03-02T00:00' });
    expect(r).toEqual({ expected: 0, taken: 0, skipped: 0, pending: 0, pct: null });
  });

  it('returns pct null when the window is entirely in the future', () => {
    const r = computeAdherence([M1], [], { from: '2026-03-01', to: '2026-03-01', asOf: '2026-03-01T07:00' });
    expect(r).toEqual({ expected: 0, taken: 0, skipped: 0, pending: 0, pct: null });
  });
});