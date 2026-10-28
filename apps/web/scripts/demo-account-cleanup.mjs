// P8 Day 4 — demo-account cleanup: deletes a temporary boss-demo account and
// ALL of its data, child tables first, so re-running the demo (or removing it
// after the meeting) leaves zero residue. Zero app-code changes: this is an
// ops script against the same DATABASE_URL the app uses (Turso libsql:// in
// production, local SQLite file: in dev).
//
// Usage (from apps/web):
//   DEMO_EMAIL=boss-demo@metabolic.dev node scripts/demo-account-cleanup.mjs
//   node scripts/demo-account-cleanup.mjs boss-demo@metabolic.dev --yes
//
// Safety: DRY RUN by default (lists what would be deleted); --yes performs
// the deletion. Unknown email exits non-zero without touching anything.
//
// Deletion order (FK-safe, works even where SQLite FK enforcement is off):
//   grandchildren (CoachMessage, LabResult) -> children -> two-sided link
//   tables (either side) -> Food.createdByUserId -> User itself.
import { createClient } from '@libsql/client';

const args = process.argv.slice(2);
const yes = args.includes('--yes');
const emailArg = args.find((a) => !a.startsWith('--') && a.includes('@'));
const email = (emailArg || process.env.DEMO_EMAIL || '').toLowerCase().trim();

if (!email) {
  console.error('Tell me the demo account email: node scripts/demo-account-cleanup.mjs <email> [--yes]');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set (Turso libsql:// or local file:...).');
  process.exit(1);
}

const db = createClient({ url: process.env.DATABASE_URL });

// (table, where-clause) in deletion order. ? always binds the demo user id;
// two-sided tables bind it twice.
const PLAN = [
  ['CoachMessage', 'threadId IN (SELECT id FROM CoachThread WHERE userId = ?)'],
  ['LabResult', 'userId = ?'],
  ['CoachThread', 'userId = ?'],
  ['LabPanel', 'userId = ?'],
  ['Lab', 'userId = ?'],
  ['FoodEntry', 'userId = ?'],
  ['GlucoseReading', 'userId = ?'],
  ['ActivityEntry', 'userId = ?'],
  ['SleepEntry', 'userId = ?'],
  ['WeightEntry', 'userId = ?'],
  ['BloodPressureEntry', 'userId = ?'],
  ['InsightCard', 'userId = ?'],
  ['Achievement', 'userId = ?'],
  ['SavedCombo', 'userId = ?'],
  ['Recipe', 'userId = ?'],
  ['ReportDocument', 'userId = ?'],
  ['CustomLabTest', 'userId = ?'],
  ['MedicationLog', 'userId = ?'],
  ['Medication', 'userId = ?'],
  ['DayContextTag', 'userId = ?'],
  ['PrakritiProfile', 'userId = ?'],
  ['UserSettings', 'userId = ?'],
  ['UserLearnedModel', 'userId = ?'],
  ['CareRelationship', '(caregiverId = ? OR wardId = ?)'],
  ['DoctorPatientLink', '(doctorId = ? OR patientId = ?)'],
  ['Food', 'createdByUserId = ?'],
];

async function main() {
  const found = await db.execute({
    sql: 'SELECT id, email, name, role, createdAt FROM User WHERE email = ?',
    args: [email],
  });
  if (found.rows.length === 0) {
    console.error(`No user with email ${email} - nothing to clean up.`);
    process.exit(1);
  }
  const u = found.rows[0];
  console.log(`Demo account: ${u.email} (id ${u.id}, role ${u.role})`);
  console.log(yes ? 'MODE: DELETE (--yes)' : 'MODE: dry run (pass --yes to actually delete)');

  let total = 0;
  for (const [table, where] of PLAN) {
    const twoSided = (where.match(/\?/g) || []).length === 2;
    const sel = await db.execute({
      sql: `SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`,
      args: twoSided ? [u.id, u.id] : [u.id],
    });
    const n = Number(sel.rows[0].n);
    if (n > 0) console.log(`  ${table.padEnd(22)} ${n} row${n === 1 ? '' : 's'}`);
    total += n;
    if (yes && n > 0) {
      await db.execute({ sql: `DELETE FROM ${table} WHERE ${where}`, args: twoSided ? [u.id, u.id] : [u.id] });
    }
  }

  if (yes) {
    await db.execute({ sql: 'DELETE FROM User WHERE id = ?', args: [u.id] });
    console.log(`  ${'User'.padEnd(22)} 1 row`);
    total += 1;
    const recheck = await db.execute({ sql: 'SELECT id FROM User WHERE email = ?', args: [email] });
    if (recheck.rows.length > 0) {
      console.error('User still present after delete - check FK errors above.');
      process.exit(1);
    }
    console.log(`Deleted ${total} rows total. Demo account ${email} is gone.`);
  } else {
    console.log(`Dry run: would delete ${total} rows (plus the User row). Re-run with --yes to delete.`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('Cleanup failed:', e.message);
  process.exit(1);
});
