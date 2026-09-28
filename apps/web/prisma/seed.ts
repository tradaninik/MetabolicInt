import { prisma } from '../src/lib/prisma';
import { FOODS } from '@mi/food-db';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🌱 Seeding food catalog…');
  // Upsert the entire food catalog from @mi/food-db.
  for (const f of FOODS) {
    await prisma.food.upsert({
      where: { id: f.id },
      create: {
        id: f.id,
        name: f.name,
        aliases: f.aliases ? JSON.stringify(f.aliases) : null,
        region: f.region,
        category: f.category,
        servingGrams: f.servingGrams,
        katoriGrams: f.katoriGrams ?? null,
        kcalPer100g: f.kcalPer100g,
        carbsPer100g: f.carbsPer100g,
        proteinPer100g: f.proteinPer100g,
        fatPer100g: f.fatPer100g,
        fiberPer100g: f.fiberPer100g,
        gi: f.gi,
      },
      update: {
        name: f.name,
        aliases: f.aliases ? JSON.stringify(f.aliases) : null,
        region: f.region,
        category: f.category,
        servingGrams: f.servingGrams,
        katoriGrams: f.katoriGrams ?? null,
        kcalPer100g: f.kcalPer100g,
        carbsPer100g: f.carbsPer100g,
        proteinPer100g: f.proteinPer100g,
        fatPer100g: f.fatPer100g,
        fiberPer100g: f.fiberPer100g,
        gi: f.gi,
      },
    });
  }
  console.log(`  ✓ ${FOODS.length} foods loaded`);

  console.log('🌱 Seeding demo user…');
  // Demo user — password "demo1234". Use this to preview the dashboard.
  const passwordHash = await bcrypt.hash('demo1234', 10);
  const demo = await prisma.user.upsert({
    where: { email: 'demo@metabolic.dev' },
    create: {
      email: 'demo@metabolic.dev',
      passwordHash,
      name: 'Demo User',
      role: 'member',
      onboardingComplete: true,
      age: 52,
      gender: 'male',
      country: 'India',
      region: 'south_indian',
      ethnicity: 'South Asian',
      heightCm: 170,
      weightKg: 84,
      waistCm: 98,
      bodyFatPct: 28,
      hba1c: 7.4,
      fastingGlucose: 132,
      systolicBp: 134,
      diastolicBp: 86,
      totalCholesterol: 192,
      sleepHours: 6.5,
      activityLevel: 'light',
      occupation: 'office',
      smoking: 'never',
      alcohol: 'occasional',
      conditions: JSON.stringify(['type_2_diabetes', 'hypertension']),
      medications: JSON.stringify(['metformin_500mg']),
      familyHistory: JSON.stringify(['diabetes']),
      goals: JSON.stringify(['lower_hba1c', 'weight_loss']),
    },
    update: {},
  });

  // Seed ~14 days of history so the dashboard has real trends to show.
  console.log('🌱 Seeding 14 days of history…');
  const now = Date.now();
  const DAY = 86_400_000;
  const mealIds = ['idli', 'plain_dosa', 'white_rice_south', 'sambar', 'chapati', 'dal_tadka', 'curd_rice'];
  const foodIndex = Object.fromEntries(FOODS.map((f) => [f.id, f]));

  // Avoid duplicating if seed was already run.
  const existing = await prisma.foodEntry.count({ where: { userId: demo.id } });
  if (existing === 0) {
    for (let d = 13; d >= 0; d--) {
      const dayStart = now - d * DAY;
      const morning = new Date(dayStart - 3 * 3600_000);
      const lunch = new Date(dayStart - 8 * 3600_000);
      const dinner = new Date(dayStart - 13 * 3600_000);

      for (const at of [morning, lunch, dinner]) {
        const foodId = mealIds[Math.floor(Math.random() * mealIds.length)];
        const food = foodIndex[foodId];
        if (!food) continue;
        const grams = food.servingGrams;
        const k = grams / 100;
        await prisma.foodEntry.create({
          data: {
            userId: demo.id,
            foodId,
            portionType: 'serving',
            portionValue: 1,
            grams,
            kcal: Math.round(food.kcalPer100g * k),
            carbsG: +(food.carbsPer100g * k).toFixed(1),
            proteinG: +(food.proteinPer100g * k).toFixed(1),
            fatG: +(food.fatPer100g * k).toFixed(1),
            loggedAt: at,
          },
        });
      }

      // Glucose readings: fasting + 2h post-dinner.
      await prisma.glucoseReading.create({
        data: { userId: demo.id, value: 125 + Math.round(Math.random() * 25), takenAt: new Date(dayStart - 2 * 3600_000) },
      });
      await prisma.glucoseReading.create({
        data: { userId: demo.id, value: 150 + Math.round(Math.random() * 40), takenAt: new Date(dayStart - 12 * 3600_000) },
      });

      // Weight (slight downward drift).
      await prisma.weightEntry.create({
        data: { userId: demo.id, kg: +(84 + d * 0.08).toFixed(1), takenAt: new Date(dayStart - 2 * 3600_000) },
      });

      // Sleep (varies, some poor nights).
      await prisma.sleepEntry.create({
        data: { userId: demo.id, hours: 5.5 + Math.random() * 3, wokeAt: new Date(dayStart - 2 * 3600_000) },
      });

      // Activity.
      await prisma.activityEntry.create({
        data: { userId: demo.id, type: 'walk', durationMin: 15 + Math.round(Math.random() * 30), at: new Date(dayStart - 7 * 3600_000) },
      });

      // BP every few days.
      if (d % 3 === 0) {
        await prisma.bloodPressureEntry.create({
          data: { userId: demo.id, systolic: 128 + Math.round(Math.random() * 12), diastolic: 82 + Math.round(Math.random() * 8), takenAt: new Date(dayStart - 2 * 3600_000) },
        });
      }
    }
  }

  // Seed the learned model cache (prior, since not enough paired data yet).
  await prisma.userLearnedModel.upsert({
    where: { userId: demo.id },
    create: { userId: demo.id, sensitivityMgDlPerGCarb: 2.6, sampleSize: 0, isPrior: true },
    update: {},
  });

  console.log('  ✓ demo user + 14-day history seeded');
  console.log('');
  console.log('Login: demo@metabolic.dev / demo1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
