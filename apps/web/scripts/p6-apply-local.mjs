// P6: apply a prod migration file to the LOCAL dev DB, mirroring the
// statement-splitting logic of scripts/turso-migrate.mjs (comments stripped,
// 'already exists' tolerated, journaled). Verifies the exact shipped SQL.
// Usage: DATABASE_URL=file:/abs/path.db node scripts/p6-apply-local.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@libsql/client';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL to a local file: DB.');
  process.exit(1);
}
const migPath = process.argv[2] ?? 'prisma/prod-migrations/0005_p6_recipes_labs_documents/migration.sql';
const client = createClient({ url });

await client.execute('CREATE TABLE IF NOT EXISTS _turso_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
const applied = new Set((await client.execute('SELECT name FROM _turso_migrations')).rows.map((r) => String(r.name)));
const name = migPath.split('/').slice(-2, -1)[0];
if (applied.has(name)) {
  console.log(`Already applied: ${name}`);
} else {
  const sql = readFileSync(migPath, 'utf8');
  const statements = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  let tolerated = 0;
  for (const stmt of statements) {
    try {
      await client.execute(stmt);
    } catch (err) {
      const msg = String((err && err.message) || err);
      if (/already exists|duplicate column/i.test(msg)) {
        tolerated += 1;
      } else {
        console.error('FAILED: ' + msg + '\n  Statement: ' + stmt.slice(0, 200));
        process.exit(1);
      }
    }
  }
  await client.execute({ sql: 'INSERT OR REPLACE INTO _turso_migrations (name, applied_at) VALUES (?, ?)', args: [name, new Date().toISOString()] });
  console.log(`Applied ${name} (${statements.length} statements${tolerated ? ', ' + tolerated + ' tolerated' : ''})`);
}

const tables = (await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")).rows.map((r) => String(r.name));
console.log('Tables (' + tables.length + '): ' + tables.join(', '));
client.close();
