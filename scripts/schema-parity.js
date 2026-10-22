// P3-3: Turso schema parity vs apps/web/prisma/schema.prisma.
// Compares each model's scalar-field set vs actual Turso columns.
// Relation fields (type = another model, or arrays) have no column -> skipped.
const fs = require('fs');
const SCALARS = ['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'Bytes', 'Decimal', 'BigInt'];
const schemaText = fs.readFileSync('prisma/schema.prisma', 'utf8').replace(/^\uFEFF/, '');
const models = {};
const re = /model\s+(\w+)\s*\{/g;
let m;
const heads = [];
while ((m = re.exec(schemaText)) !== null) heads.push({ name: m[1], after: m.index + m[0].length });
for (const h of heads) {
  let depth = 1, i = h.after;
  while (i < schemaText.length && depth > 0) {
    const ch = schemaText[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    i++;
  }
  const body = schemaText.slice(h.after, i - 1);
  const fields = [];
  for (let line of body.split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith('//') || line.startsWith('@@')) continue;
    const fm = line.match(/^([A-Za-z_]\w*)\s+([A-Za-z_]\w*)/);
    if (fm && SCALARS.includes(fm[2])) fields.push(fm[1]);
  }
  models[h.name] = fields;
}
// ---PART2---
const env = {};
for (const l of fs.readFileSync('.env.turso', 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
}
function parseColumns(sql) {
  const inner = sql.slice(sql.indexOf('(') + 1, sql.lastIndexOf(')'));
  const parts = [];
  let depth = 0, cur = '';
  for (const ch of inner) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  const cols = [];
  for (let p of parts) {
    const first = p.trim().split(/\s+/)[0].replace(/["`\[\]]/g, '');
    if (/^(PRIMARY|UNIQUE|CHECK|FOREIGN|CONSTRAINT)$/i.test(first)) continue;
    if (first) cols.push(first);
  }
  return cols;
}
const { createClient } = require('@libsql/client');
(async () => {
  const c = createClient({ url: env.DATABASE_URL, authToken: env.DATABASE_AUTH_TOKEN });
  const r = await c.execute("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_turso%'");
  const db = {};
  for (const row of r.rows) db[String(row.name)] = parseColumns(String(row.sql));
  let diffs = 0;
  for (const [name, fields] of Object.entries(models)) {
    const cols = db[name];
    if (!cols) { console.log('FAIL ' + name + ': table missing in Turso'); diffs++; continue; }
    const missing = fields.filter((f) => !cols.includes(f));
    const extra = cols.filter((f) => !fields.includes(f));
    if (missing.length || extra.length) { diffs++; console.log('FAIL ' + name + ': missing=[' + missing + '] extra=[' + extra + ']'); }
    else console.log('OK   ' + name + ' (' + fields.length + ' cols)');
  }
  for (const t of Object.keys(db)) if (!models[t]) { console.log('FAIL unexpected table: ' + t); diffs++; }
  console.log('PARITY: ' + (diffs === 0 ? 'OK' : 'FAIL (' + diffs + ' tables differ)') + '; models=' + Object.keys(models).length);
  await c.close();
  process.exit(diffs === 0 ? 0 : 1);
})().catch((e) => { console.error('PARITY ERROR:', e.message); process.exit(2); });
