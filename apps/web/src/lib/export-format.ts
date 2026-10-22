// P3-1 data export: pure helpers shared by /api/export (next unit) and tests.
// No Prisma / next-auth imports - the route supplies rows, these stay pure.
/** RFC 4180 cell: nullish -> empty, Date -> ISO, object -> JSON text;
 *  quote iff it contains comma, double quote, CR or LF (quotes doubled). */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s: string;
  if (value instanceof Date) s = value.toISOString();
  else if (typeof value === 'object') s = JSON.stringify(value);
  else s = String(value);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
/** Rows -> CSV: CRLF endings, header from the first row (Prisma findMany
 *  returns a uniform shape). Zero rows -> '' (no column list to emit). */
export function toCsv(rows: ReadonlyArray<Record<string, unknown>>): string {
  const first = rows[0];
  if (!first) return '';
  const headers = Object.keys(first);
  const line = (cells: unknown[]) => cells.map(csvCell).join(',');
  const lines = [line(headers)];
  for (const row of rows) lines.push(line(headers.map((h) => row[h])));
  return lines.join('\r\n');
}
/** Local-time YYYYMMDD-HHmm stamp used in backup filenames. */
export function backupTimestamp(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
}
/** camelCase table key -> kebab-case filename slug. */
export function kebabCase(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
/** Full backup: metabolicint-backup-YYYYMMDD-HHmm.json; table: ...-<table>.csv */
export function backupFilename(ext: 'json' | 'csv', table?: string, now: Date = new Date()): string {
  const base = `metabolicint-backup-${backupTimestamp(now)}`;
  return ext === 'csv' && table ? `${base}-${table}.csv` : `${base}.${ext}`;
}
/** Credential-shaped columns (password/hash/token/secret, any case) never
 *  leave the server. Shallow copy; the input row is not mutated. */
export function redactSecrets<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!/password|hash|token|secret/i.test(k)) out[k] = v;
  }
  return out;
}
export const EXPORT_FORMAT_VERSION = 1;
/** Stable envelope shape for the full JSON backup. */
export function buildJsonExport(userId: string, exportedAt: string, tables: Record<string, unknown[]>): Record<string, unknown> {
  return { app: 'MetabolicInt', formatVersion: EXPORT_FORMAT_VERSION, userId, exportedAt, tables };
}
