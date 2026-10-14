import { createClient } from '@libsql/client';
const p = process.argv[2];
const c = createClient({ url: 'file:' + p.replace(/\\/g, '/') });
try {
  const cols = await c.execute('PRAGMA table_info(Food);');
  const names = cols.rows.map((r) => r.name);
  console.log('  Food table: ' + names.length + ' columns; createdByUserId ' + (names.includes('createdByUserId') ? 'PRESENT' : 'MISSING'));
} catch (e) {
  console.log('  no Food table');
}
try {
  const users = await c.execute('SELECT email FROM User;');
  console.log('  users: ' + (users.rows.map((r) => r.email).join(', ') || '(none)'));
} catch (e) {
  console.log('  no User table');
}
process.exit(0);