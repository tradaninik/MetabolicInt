// P3-1 data export: outcome builder shared by /api/export and tests.
// Route stays a thin wrapper (codebase convention: logic lives in lib).
import type { PrismaClient } from '@prisma/client';
import { backupFilename, buildJsonExport, toCsv } from './export-format';
import { collectUserExport, collectUserTable, EXPORT_TABLE_KEYS } from './export-tables';

export type ExportOutcome = { ok: true; body: string; contentType: string; filename: string } | { ok: false; status: number; error: string };

/** Builds the download body + headers for GET /api/export. */
export async function buildExport(prisma: PrismaClient, userId: string, format: string | null | undefined, table: string | null | undefined): Promise<ExportOutcome> {
  if (format === 'json') {
    const tables = await collectUserExport(prisma, userId);
    const payload = buildJsonExport(userId, new Date().toISOString(), tables);
    return { ok: true, body: JSON.stringify(payload, null, 2), contentType: 'application/json', filename: backupFilename('json') };
  }
  if (format === 'csv') {
    if (!table) return { ok: false, status: 400, error: 'Missing ?table= for CSV export.' };
    const rows = await collectUserTable(prisma, userId, table);
    if (!rows) return { ok: false, status: 400, error: `Unknown table "${table}". Valid: ${EXPORT_TABLE_KEYS.join(', ')}.` };
    return { ok: true, body: toCsv(rows as Record<string, unknown>[]), contentType: 'text/csv; charset=utf-8', filename: backupFilename('csv', table) };
  }
  return { ok: false, status: 400, error: 'format must be "json" or "csv".' };
}
