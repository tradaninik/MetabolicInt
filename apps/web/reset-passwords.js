// reset-passwords.js - targeted password reset for known accounts (WRITE)
// Usage:
//   node reset-passwords.js "email=newPassword" ["email=newPassword" ...]
// Safety: never prints hashes. Verifies every write by re-reading + bcrypt compare.
// Env: reads .env.turso / .env.local / .env from the current directory.
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
let bcryptjs = null;
try {
  bcryptjs = require('bcryptjs');
} catch (e) {
  console.log('ERROR: bcryptjs not found. Run from apps\\web (it is a dependency of the app).');
  process.exit(1);
}
const argvPairs = process.argv.slice(2);
console.log('reset-passwords.js - targeted password reset (WRITE)');
console.log('DB url : ' + maskUrl(rawUrl));
console.log('');
if (!rawUrl) {
  console.log('ERROR: no TURSO_DATABASE_URL / DATABASE_URL found (.env.turso / .env.local / .env).');
  process.exit(1);
}
if (argvPairs.length === 0) {
  console.log('Usage:');
  console.log('  node reset-passwords.js "email=newPassword" ["email=newPassword" ...]');
  console.log('Example:');
  console.log("  node reset-passwords.js 'edulaksy@gmail.com=ChangeMe-2026!'");
  process.exit(1);
}
const wanted = [];
let argError = false;
for (const pair of argvPairs) {
  const i = pair.indexOf('=');
  if (i <= 0 || i === pair.length - 1) {
    console.log('BAD ARG: ' + JSON.stringify(pair) + '  (expected email=newPassword)');
    argError = true;
    continue;
  }
  const email = pair.slice(0, i).toLowerCase().trim();
  const pwd = pair.slice(i + 1);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.log('BAD EMAIL: ' + JSON.stringify(pair.slice(0, i)));
    argError = true;
    continue;
  }
  if (pwd.length < 8) {
    console.log('SKIP ' + email + ' - password must be at least 8 characters (matches signup rule).');
    continue;
  }
  wanted.push({ email, pwd });
}
if (argError || wanted.length === 0) process.exit(1);
async function libsqlStore() {
  const { createClient } = require('@libsql/client');
  let authToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN || undefined;
  if (!authToken) {
    try {
      const q = new URL(rawUrl.replace(/^libsql:\/\//i, 'https://')).searchParams;
      const t = q.get('authToken');
      if (t) authToken = t;
    } catch (e) { /* keep undefined */ }
  }
  const client = createClient({ url: rawUrl, authToken });
  return {
    listUsers: async () => {
      const r = await client.execute('SELECT "id", "email" FROM "User"');
      return r.rows;
    },
    setHash: async (id, hash) => {
      await client.execute({ sql: 'UPDATE "User" SET "passwordHash" = ? WHERE "id" = ?', args: [hash, id] });
    },
    getHash: async (id) => {
      const r = await client.execute({ sql: 'SELECT "passwordHash" FROM "User" WHERE "id" = ?', args: [id] });
      return r.rows.length ? r.rows[0].passwordHash : null;
    },
    close: async () => {},
  };
}
async function prismaStore() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  return {
    listUsers: async () => prisma.user.findMany({ select: { id: true, email: true } }),
    setHash: async (id, hash) => {
      await prisma.user.update({ where: { id }, data: { passwordHash: hash } });
    },
    getHash: async (id) => {
      const u = await prisma.user.findUnique({ where: { id }, select: { passwordHash: true } });
      return u ? u.passwordHash : null;
    },
    close: async () => { await prisma.$disconnect().catch(() => {}); },
  };
}
(async function main() {
  let store = null;
  try {
    if (rawUrl.startsWith('prisma://')) throw new Error('accelerate-url');
    store = await libsqlStore();
    console.log('writer : @libsql/client (direct)');
  } catch (e1) {
    try {
      store = await prismaStore();
      console.log('writer : @prisma/client');
    } catch (e2) {
      console.log('ERROR: could not open the database with either writer.');
      console.log('  libsql : ' + (e1 && e1.message ? e1.message : String(e1)));
      console.log('  prisma : ' + (e2 && e2.message ? e2.message : String(e2)));
      process.exit(2);
    }
  }
  const users = await store.listUsers();
  const byLower = {};
  for (const u of users) byLower[String(u.email || '').toLowerCase()] = u;
  let ok = 0;
  let failed = 0;
  for (const w of wanted) {
    const u = byLower[w.email];
    if (!u) {
      console.log('[' + w.email + '] NOT FOUND in this database - nothing changed.');
      failed++;
      continue;
    }
    const newHash = bcryptjs.hashSync(w.pwd, 10); // same scheme+cost as the signup route
    try {
      await store.setHash(u.id, newHash);
      const check = await store.getHash(u.id);
      const verified = check ? bcryptjs.compareSync(w.pwd, String(check)) : false;
      if (verified) {
        console.log('[' + w.email + '] RESET + VERIFIED (hash re-read from DB and compared OK).');
        ok++;
      } else {
        console.log('[' + w.email + '] WRITE DONE but VERIFY FAILED - re-run this script for this account.');
        failed++;
      }
    } catch (e) {
      console.log('[' + w.email + '] UPDATE FAILED: ' + (e && e.message ? e.message : String(e)));
      failed++;
    }
  }
  await store.close().catch(() => {});
  console.log('');
  console.log('Done. reset+verified: ' + ok + '   failed/skipped: ' + failed);
  console.log('Now log in on the app with the NEW passwords.');
  console.log('If a VERIFIED account still shows "Incorrect email or password" on the');
  console.log('deployed site, the deployed build is stale -> redeploy from the repo root:');
  console.log('  cd C:\\Users\\nikan\\metabolicint; vercel deploy --prod --yes');
})().catch((e) => {
  console.log('UNEXPECTED ERROR: ' + (e && e.stack ? e.stack : String(e)));
  process.exit(3);
});
