// Turso (libSQL) migration runner for MetabolicInt.
//
// Workflow (see docs/DB-MIGRATIONS.md):
//   1. Edit apps/web/prisma/schema.prisma.
//   2. node scripts/turso-migrate.mjs diff --name short_name
//      -> creates prisma/prod-migrations/<NNNN_name>/ (migration.sql + schema snapshot).
//      -> REVIEW the SQL before applying.
//   3. node scripts/turso-migrate.mjs apply
//      -> applies pending migrations to Turso, tracked in _turso_migrations.
//      -> idempotent: safe to re-run.
//   4. node scripts/turso-migrate.mjs status
//
// "diff" needs no DB connection. "apply"/"status" need DATABASE_URL and
// DATABASE_AUTH_TOKEN set in this shell (they are NOT read from .env).

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, '..');
const schemaPath = join(webRoot, 'prisma', 'schema.prisma');
const migRoot = join(webRoot, 'prisma', 'prod-migrations');
const JOURNAL = '_turso_migrations';

const cmd = process.argv[2];

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function listMigrations() {
  if (!existsSync(migRoot)) return [];
  return readdirSync(migRoot).filter((d) => /^\d{4}_/.test(d)).sort();
}

function sanitizeName(raw) {
  return String(raw)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

// ---------- diff ----------
function runDiff(nameArg) {
  if (!existsSync(schemaPath)) fail('Schema not found: ' + schemaPath);
  mkdirSync(migRoot, { recursive: true });

  const existing = listMigrations();
  const isBaseline = existing.length === 0;
  const name = isBaseline ? 'baseline' : sanitizeName(nameArg || '');
  if (!isBaseline && !name) fail('Usage: node scripts/turso-migrate.mjs diff --name <short_name>');

  const from = isBaseline
    ? '--from-empty'
    : '--from-schema-datamodel "' + join(migRoot, existing[existing.length - 1], 'schema.prisma') + '"';

  const sql = execSync(
    'npx prisma migrate diff ' + from + ' --to-schema-datamodel "' + schemaPath + '" --script',
    {
      cwd: webRoot,
      encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || 'file:./prisma/diff-local.db' },
    },
  );

  const folder = String(existing.length + 1).padStart(4, '0') + '_' + name;
  const dir = join(migRoot, folder);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'migration.sql'), sql, 'utf8');
  copyFileSync(schemaPath, join(dir, 'schema.prisma'));

  console.log('Created prisma/prod-migrations/' + folder + (isBaseline ? ' (baseline, from empty DB)' : ' (from ' + existing[existing.length - 1] + ')'));
  console.log('Review the SQL, then run apply.');
}

// ---------- apply ----------
async function runApply() {
  const url = process.env.DATABASE_URL;
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  if (!url || !authToken) {
    fail('Set DATABASE_URL and DATABASE_AUTH_TOKEN in this shell first (node does not read apps/web/.env).');
  }

  const migrations = listMigrations();
  if (migrations.length === 0) {
    console.log('No migrations in prisma/prod-migrations. Run the diff command first.');
    return;
  }

  if (authToken && (/PASTE|PLACEHOLDER/i.test(authToken) || authToken.startsWith('<') || authToken.length < 200)) {
    fail('DATABASE_AUTH_TOKEN looks like a placeholder or is truncated. A working Turso DB token is ~348 chars. Re-set DATABASE_AUTH_TOKEN in this shell.');
  }
  const client = createClient({ url, authToken });

  await client.execute(
    'CREATE TABLE IF NOT EXISTS ' + JOURNAL + ' (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)',
  );
  const applied = new Set(
    (await client.execute('SELECT name FROM ' + JOURNAL)).rows.map((r) => String(r.name)),
  );

  // Auto-baseline: journal empty but core tables already exist (DB predates this workflow).
  if (applied.size === 0) {
    const probe = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='FoodEntry'");
    if (probe.rows.length > 0) {
      await client.execute({
        sql: 'INSERT INTO ' + JOURNAL + ' (name, applied_at) VALUES (?, ?)',
        args: [migrations[0], new Date().toISOString()],
      });
      applied.add(migrations[0]);
      console.log('Baselined ' + migrations[0] + ': tables already exist in Turso, its SQL was not re-run.');
    }
  }

  for (const name of migrations) {
    if (applied.has(name)) {
      console.log('Already applied: ' + name);
      continue;
    }
    const sql = readFileSync(join(migRoot, name, 'migration.sql'), 'utf8');
    // Statement-by-statement so "already exists" noise is tolerated and an
    // interrupted run converges when re-run. Comment lines are stripped first
    // (prisma diff output contains "-- CreateTable" style comments).
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
          console.log('  (already in DB, skipped): ' + msg.split('\n')[0]);
        } else {
          fail('FAILED in ' + name + ': ' + msg + '\n  Statement: ' + stmt.slice(0, 200));
        }
      }
    }
    await client.execute({
      sql: 'INSERT OR REPLACE INTO ' + JOURNAL + ' (name, applied_at) VALUES (?, ?)',
      args: [name, new Date().toISOString()],
    });
    console.log('Applied ' + name + ' (' + statements.length + ' statements' + (tolerated ? ', ' + tolerated + ' skipped as already present' : '') + ')');
  }

  await printState(client);
  client.close();
}

// ---------- status ----------
async function runStatus() {
  const url = process.env.DATABASE_URL;
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  if (!url || !authToken) {
    fail('Set DATABASE_URL and DATABASE_AUTH_TOKEN in this shell first.');
  }
  if (authToken && (/PASTE|PLACEHOLDER/i.test(authToken) || authToken.startsWith('<') || authToken.length < 200)) {
    fail('DATABASE_AUTH_TOKEN looks like a placeholder or is truncated. A working Turso DB token is ~348 chars. Re-set DATABASE_AUTH_TOKEN in this shell.');
  }
  const client = createClient({ url, authToken });
  await printState(client);
  client.close();
}

async function printState(client) {
  const tables = (await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")).rows.map((r) => String(r.name));
  console.log('');
  console.log('Tables in Turso (' + tables.length + '): ' + tables.join(', '));
  const migrations = listMigrations();
  if (migrations.length === 0) {
    console.log('No local migrations yet (run diff).');
    return;
  }
  const appliedRows = tables.includes(JOURNAL)
    ? (await client.execute('SELECT name, applied_at FROM ' + JOURNAL + ' ORDER BY name')).rows
    : [];
  const applied = new Set(appliedRows.map((r) => String(r.name)));
  console.log('Migrations:');
  for (const m of migrations) {
    console.log('  ' + (applied.has(m) ? '[applied]  ' : '[PENDING] ') + m);
  }
}

if (cmd === 'diff') {
  runDiff(process.argv[3] === '--name' ? process.argv[4] : undefined);
} else if (cmd === 'apply') {
  await runApply();
} else if (cmd === 'status') {
  await runStatus();
} else {
  console.log('Usage: node scripts/turso-migrate.mjs <diff --name X | apply | status>');
}
