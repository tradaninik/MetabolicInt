const fs = require('fs');
const env = {};
for (const l of fs.readFileSync('.env.turso', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
}
const { createClient } = require('@libsql/client');
(async () => {
  const c = createClient({ url: env.DATABASE_URL, authToken: env.DATABASE_AUTH_TOKEN });
  const r = await c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  console.log('TABLES:', r.rows.map((x) => x.name).join(', '));
  await c.close();
})().catch((e) => { console.error('CONNECT FAIL:', e.message); process.exit(1); });
