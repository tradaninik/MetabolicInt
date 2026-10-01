// CLI: inspect (and optionally apply) the learned-sensitivity derivation for one user.
//
// Read-only by default - prints meal groups, derived pairs, and the model the
// engine would produce. --apply additionally writes UserLearnedModel.
//
// Run from apps/web with DATABASE_URL (+ DATABASE_AUTH_TOKEN for Turso) set in
// the shell (tsx does not read .env):
//   npx tsx scripts/learned-model.ts demo@metabolic.dev
//   npx tsx scripts/learned-model.ts demo@metabolic.dev --apply
import { prisma } from '../src/lib/prisma';
import { toUserProfile } from '../src/lib/engine-service';
import { learnSensitivity, type UserProfile } from '@mi/engine';
import {
  groupMeals,
  derivePairs,
  updateLearnedModel,
  personalizationProgress,
} from '../src/lib/pairing';

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? '';
  const dbTarget = dbUrl.startsWith('file:') ? dbUrl : ((dbUrl.split('://')[1] ?? '').split('/')[0] || 'unset');
  const dbToken = process.env.DATABASE_AUTH_TOKEN ?? '';
  console.log('DB target:', dbTarget, '| auth token:', dbToken ? dbToken.length + ' chars' : 'unset');
  const email = process.argv[2] ?? '';
  const apply = process.argv.includes('--apply');
  if (!email) {
    console.log('Usage: npx tsx scripts/learned-model.ts <email> [--apply]');
    return;
  }

  const since = new Date(Date.now() - 60 * 86_400_000);
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      learnedModel: true,
      foodEntries: {
        where: { loggedAt: { gte: since } },
        include: { food: { select: { name: true, gi: true, fiberPer100g: true } } },
        orderBy: { loggedAt: 'asc' },
      },
      glucoseReadings: { where: { takenAt: { gte: since } }, orderBy: { takenAt: 'asc' } },
      activityEntries: { where: { at: { gte: since } }, orderBy: { at: 'asc' } },
    },
  });
  if (!user) {
    console.log('No user found for email:', email);
    return;
  }

  const groups = groupMeals(user.foodEntries);
  const pairs = derivePairs(groups, user.glucoseReadings, user.activityEntries);

  const profile: UserProfile = toUserProfile(user);
  let conditions: string[] = [];
  try {
    const v = JSON.parse(user.conditions ?? '[]');
    if (Array.isArray(v)) conditions = v;
  } catch {
    // ignore malformed JSON
  }
  if (conditions.some((c) => c.toLowerCase().includes('diabetes'))) profile.diabetic = true;

  console.log('User:', user.email);
  console.log(
    'Rows (60d): entries', user.foodEntries.length,
    '| readings', user.glucoseReadings.length,
    '| activities', user.activityEntries.length,
  );
  console.log('Meal groups:', groups.length);
  for (const g of groups.slice(-10)) {
    console.log(
      '  ' + new Date(g.startedAt).toISOString(),
      g.mealType.padEnd(9),
      'carbs ' + g.netCarbsG + 'g',
      'GI ' + g.gi,
      '[' + g.label + ']',
    );
  }
  console.log('Derived pairs:', pairs.length);
  for (const p of pairs) {
    console.log(
      '  ' + new Date(p.meal.loggedAt).toISOString(),
      'carbs ' + p.carbsG.toFixed(0) + 'g',
      'GI ' + p.gi.toFixed(0),
      'delta ' + p.observedDelta.toFixed(0) + ' mg/dL',
      'activity ' + p.activityAfterMin.toFixed(0) + 'min',
    );
  }
  const proposed = learnSensitivity(pairs, profile);
  console.log(
    'Proposed model:',
    JSON.stringify({
      sensitivity: proposed.sensitivityMgDlPerGCarb,
      sampleSize: proposed.sampleSize,
      isPrior: proposed.isPrior,
    }),
  );
  console.log(
    'Current  model:',
    user.learnedModel
      ? JSON.stringify({
          sensitivity: user.learnedModel.sensitivityMgDlPerGCarb,
          sampleSize: user.learnedModel.sampleSize,
          isPrior: user.learnedModel.isPrior,
        })
      : 'none',
  );
  console.log('Progress:', JSON.stringify(personalizationProgress(proposed)));

  if (apply) {
    const applied = await updateLearnedModel(user.id);
    console.log(
      'APPLIED:',
      JSON.stringify(
        applied && {
          sensitivity: applied.sensitivityMgDlPerGCarb,
          sampleSize: applied.sampleSize,
          isPrior: applied.isPrior,
          pairsConsidered: applied.pairsConsidered,
          mealsConsidered: applied.mealsConsidered,
        },
      ),
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    prisma.$disconnect();
  });
