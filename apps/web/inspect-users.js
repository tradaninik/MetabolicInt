// inspect-users.js - Block B forensic reader (READ-ONLY, safe)
// Usage:
//   node inspect-users.js
//   node inspect-users.js "ThePasswordYouUsedAtSignup"   (optional bcrypt verify)
// Safety: prints hash LENGTH + 7-char prefix only - never the full hash.
'use strict';
const fs = require('fs');
const path = require('path');
function loadEnvFile(file) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) return false;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
  return true;
}
loadEnvFile('.env.turso');
loadEnvFile('.env.local');
loadEnvFile('.env');
const rawUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || '';
function maskUrl(u) {
  if (!u) return '(none)';
  const clean = u.split('?')[0];
  return clean.length > 60 ? clean.slice(0, 57) + '...' : clean;
}
function classifyHash(h) {
  if (h === null || h === undefined) return { kind: 'NULL', valid: false, detail: 'no hash stored' };
  const s = String(h);
  if (/^\$2[aby]\$\d{2}\$/.test(s)) {
    const valid = s.length === 60;
    return { kind: 'bcrypt', valid, detail: 'prefix ' + s.slice(0, 7) + '  len ' + s.length };
  }
  if (/^[0-9a-f]{64}$/i.test(s)) return { kind: 'sha256-hex', valid: false, detail: 'len 64 hex - NOT bcryptjs' };
  if (/^[A-Za-z0-9+/]{42,43}={0,2}$/.test(s)) return { kind: 'base64-44', valid: false, detail: 'len 44 base64 - NOT bcryptjs' };
  if (/^[0-9a-f]{32}$/i.test(s)) return { kind: 'md5-hex', valid: false, detail: 'len 32 hex - NOT bcryptjs' };
  return { kind: 'unknown', valid: false, detail: 'len ' + s.length + '  prefix ' + JSON.stringify(s.slice(0, 7)) };
}
function verdictFor(c, compareResult) {
  switch (c.kind) {
    case 'NULL':
      return 'BROKEN - authorize() always returns null for this row => exact KI-1 symptom. Root cause confirmed at data level.';
    case 'bcrypt':
      if (compareResult === true) return 'OK - hash verifies the test password. If the app still 401s, the app is reading a DIFFERENT database/env than this script (check Vercel env vs local).';
      if (compareResult === false) return 'SCHEME FINE, PASSWORD MISMATCH - this password does not verify against the stored hash. Either a different password was typed at signup, or the row was overwritten later.';
      return 'Scheme is correct bcryptjs ($2a/$2b, len 60). Run with the signup password as argument to verify it: node inspect-users.js "YourPassword"';
    default:
      return 'STALE SCHEME - hash was NOT written by the current signup code (which always writes bcryptjs $2a$, len 60). Row predates current code or was written by another path. Fix = rewrite the hash (password reset script).';
  }
}
async function fetchViaLibsql(url) {
  const { createClient } = require('@libsql/client');
  let authToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN || undefined;
  if (!authToken) {
    try {
      const q = new URL(url.replace(/^libsql:\/\//i, 'https://')).searchParams;
      const t = q.get('authToken');
      if (t) authToken = t;
    } catch (e) { /* keep undefined */ }
  }
  const client = createClient({ url, authToken });
  const r = await client.execute('SELECT "id", "email", "passwordHash", "createdAt" FROM "User" ORDER BY "createdAt"');
  return r.rows.map((row) => ({
    id: row.id, email: row.email, passwordHash: row.passwordHash, createdAt: String(row.createdAt),
  }));
}
async function fetchViaPrisma() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    return await prisma.user.findMany({
      select: { id: true, email: true, passwordHash: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}
(async function main() {
  const testPassword = process.argv[2] || null;
  console.log('inspect-users.js - Block B (read-only forensic)');
  console.log('cwd        : ' + process.cwd());
  console.log('DB url     : ' + maskUrl(rawUrl));
  console.log('url source : ' + (process.env.TURSO_DATABASE_URL ? 'TURSO_DATABASE_URL' : 'DATABASE_URL'));
  console.log('compare    : ' + (testPassword ? '(password argument provided)' : '(no password argument - scheme check only)'));
  console.log('');
  if (!rawUrl) {
    console.log('ERROR: no TURSO_DATABASE_URL / DATABASE_URL found.');
    console.log('Expected in .env.turso or .env.local inside apps\\web (or set in the shell).');
    process.exit(1);
  }
  let rows = null;
  let via = null;
  try {
    if (rawUrl.startsWith('prisma://')) throw new Error('accelerate-url');
    rows = await fetchViaLibsql(rawUrl);
    via = '@libsql/client (direct)';
  } catch (e1) {
    try {
      rows = await fetchViaPrisma();
      via = '@prisma/client';
    } catch (e2) {
      console.log('ERROR: could not read the database with either reader.');
      console.log('  libsql  : ' + (e1 && e1.message ? e1.message : String(e1)));
      console.log('  prisma  : ' + (e2 && e2.message ? e2.message : String(e2)));
      console.log('');
      console.log('If the libsql error is "module not found", install the reader WITHOUT');
      console.log('touching package.json:   npm i --no-save @libsql/client');
      console.log('Then re-run:             node inspect-users.js');
      process.exit(2);
    }
  }
  console.log('reader     : ' + via);
  console.log('users found: ' + rows.length);
  console.log('');
  if (rows.length === 0) {
    console.log('No rows returned. The URL above may point to a different database than');
    console.log('the one the app uses. Compare with the Turso URL used by Vercel env vars.');
    process.exit(0);
  }
  const byLower = {};
  for (const r of rows) {
    const k = String(r.email || '').toLowerCase();
    (byLower[k] = byLower[k] || []).push(r.email);
  }
  let bcryptjs = null;
  try { bcryptjs = require('bcryptjs'); } catch (e) { /* compare unavailable */ }
  rows.forEach((r, i) => {
    const c = classifyHash(r.passwordHash);
    let cmp = null;
    if (testPassword && bcryptjs && r.passwordHash) {
      try { cmp = bcryptjs.compareSync(testPassword, String(r.passwordHash)); } catch (e) { cmp = null; }
    }
    console.log('[' + (i + 1) + '] email(exact): ' + JSON.stringify(r.email));
    console.log('    id       : ' + r.id);
    console.log('    hash     : ' + c.kind + '  ' + c.detail);
    console.log('    created  : ' + r.createdAt);
    console.log('    verdict  : ' + verdictFor(c, cmp));
    const variants = byLower[String(r.email || '').toLowerCase()] || [];
    if (variants.length > 1) {
      console.log('    WARNING  : case-variant duplicate emails exist: ' + JSON.stringify(variants));
      console.log('               login normalizes to lowercase -> only the lowercase row is ever reachable.');
    }
    console.log('');
  });
  console.log('Reading guide:');
  console.log('  bcrypt   $2a$10$  len 60  -> correct for the current code (bcryptjs).');
  console.log('  NULL                       -> authorize always fails => KI-1 root cause for that row.');
  console.log('  sha256 / base64 / md5      -> row written by an older or different code path.');
  console.log('  compare=false with bcrypt  -> different password string at signup, or row overwritten.');
  console.log('Full hashes are intentionally never printed.');
})().catch((e) => {
  console.log('UNEXPECTED ERROR: ' + (e && e.stack ? e.stack : String(e)));
  process.exit(3);
});
