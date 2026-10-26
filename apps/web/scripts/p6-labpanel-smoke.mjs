// P6-d schema smoke: LabPanel/LabResult CRUD + Lab dual-write mirror + cascade.
// Run from apps/web with DATABASE_URL set to the local dev DB (absolute path).
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

const libsql = createClient({ url: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaLibSQL(libsql) });

async function main() {
  const user = await prisma.user.create({
    data: { email: `p6d-${Date.now()}@example.com`, name: 'Panel Smoke', onboardingComplete: true, age: 45, gender: 'female' },
  });

  // 1. Create a panel with results (nested create, denormalized fields).
  const panel = await prisma.labPanel.create({
    data: {
      userId: user.id,
      name: 'Quarterly',
      labName: 'Thyrocare',
      performedAt: '2026-10-15',
      results: {
        create: [
          { userId: user.id, testKey: 'hba1c', value: 6.8, unit: '%', refLow: 4, refHigh: 5.6, performedAt: '2026-10-15' },
          { userId: user.id, testKey: 'fbg', value: 112, unit: 'mg/dL', performedAt: '2026-10-15' },
          { userId: user.id, testKey: 'fasting_insulin', value: 12, unit: 'uU/mL', performedAt: '2026-10-15' },
        ],
      },
    },
    include: { results: true },
  });
  if (panel.results.length !== 3) throw new Error('panel results count wrong');

  // 2. Dual-write mirror into legacy Lab.
  const mirror = await prisma.lab.create({
    data: {
      userId: user.id, testType: 'hba1c', value: 6.8, unit: '%', a1cPercent: 6.8,
      performedAt: '2026-10-15', labName: 'Thyrocare', panelId: panel.id,
    },
  });

  // 3. Second panel (3 months later) for a per-test trend.
  await prisma.labPanel.create({
    data: {
      userId: user.id,
      performedAt: '2027-01-15',
      results: {
        create: [
          { userId: user.id, testKey: 'hba1c', value: 6.2, unit: '%', performedAt: '2027-01-15' },
          { userId: user.id, testKey: 'fbg', value: 98, unit: 'mg/dL', performedAt: '2027-01-15' },
        ],
      },
    },
  });

  // 4. Trend query shape: single-table per-test series.
  const hba1cSeries = await prisma.labResult.findMany({
    where: { userId: user.id, testKey: 'hba1c' },
    orderBy: { performedAt: 'asc' },
  });
  if (hba1cSeries.length !== 2 || hba1cSeries[0].value !== 6.8) throw new Error('trend series wrong');

  // 5. Unique (panelId, testKey) is enforced.
  let uniqueBlocked = false;
  try {
    await prisma.labResult.create({
      data: { panelId: panel.id, userId: user.id, testKey: 'hba1c', value: 7.0, unit: '%', performedAt: '2026-10-15' },
    });
  } catch {
    uniqueBlocked = true;
  }
  if (!uniqueBlocked) throw new Error('unique(panelId,testKey) not enforced');

  // 6. DELETE flow: mirrored Lab rows first, then the panel (results cascade).
  await prisma.lab.deleteMany({ where: { panelId: panel.id, userId: user.id } });
  await prisma.labPanel.delete({ where: { id: panel.id } });
  const labLeft = await prisma.lab.count({ where: { panelId: panel.id } });
  const resultsLeft = await prisma.labResult.count({ where: { panelId: panel.id } });
  if (labLeft !== 0 || resultsLeft !== 0) throw new Error('panel delete did not cascade');

  // 7. User cascade removes panels + results + labs.
  await prisma.user.delete({ where: { id: user.id } });
  if (mirror) { /* mirror row was deleted in step 6; nothing more to check */ }
  const panelsLeft = await prisma.labPanel.count({ where: { userId: user.id } });
  if (panelsLeft !== 0) throw new Error('user cascade did not remove panels');

  console.log('P6-d LAB PANEL SMOKE: OK');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
