// Standalone seeder: demo personas + admin (demo user already exists via db:seed).
// Run: npx tsx prisma/seed-personas.ts   (requires DATABASE_URL + DATABASE_AUTH_TOKEN in shell)
import { prisma } from '../src/lib/prisma';
import { FOODS } from '@mi/food-db';
import bcrypt from 'bcryptjs';

const now = Date.now();
const DAY = 86_400_000;
const mealIds = ['idli', 'plain_dosa', 'white_rice_south', 'sambar', 'chapati', 'dal_tadka', 'curd_rice'];
const foodIndex = Object.fromEntries(FOODS.map((f) => [f.id, f]));

type HistoryOpts = {
  days: number;
  fast: [number, number];
  post: [number, number];
  weight: number;
  sleep: [number, number];
  bp: { sys: [number, number]; dia: [number, number] };
};

async function seedUserHistory(userId: string, label: string, opts: HistoryOpts) {
  if ((await prisma.foodEntry.count({ where: { userId } })) > 0) {
    console.log(`  · ${label}: history already present, skipped`);
    return;
  }
  for (let d = opts.days - 1; d >= 0; d--) {
    const dayStart = now - d * DAY;
    for (const offset of [3, 8, 13]) {
      const food = foodIndex[mealIds[Math.floor(Math.random() * mealIds.length)]];
      if (!food) continue;
      const grams = food.servingGrams;
      const k = grams / 100;
      await prisma.foodEntry.create({
        data: {
          userId, foodId: food.id, portionType: 'serving', portionValue: 1, grams,
          kcal: Math.round(food.kcalPer100g * k),
          carbsG: +(food.carbsPer100g * k).toFixed(1),
          proteinG: +(food.proteinPer100g * k).toFixed(1),
          fatG: +(food.fatPer100g * k).toFixed(1),
          loggedAt: new Date(dayStart - offset * 3600_000),
        },
      });
    }
    await prisma.glucoseReading.create({
      data: { userId, value: opts.fast[0] + Math.round(Math.random() * (opts.fast[1] - opts.fast[0])), takenAt: new Date(dayStart - 2 * 3600_000) },
    });
    await prisma.glucoseReading.create({
      data: { userId, value: opts.post[0] + Math.round(Math.random() * (opts.post[1] - opts.post[0])), takenAt: new Date(dayStart - 12 * 3600_000) },
    });
    await prisma.weightEntry.create({
      data: { userId, kg: +(opts.weight + d * 0.08).toFixed(1), takenAt: new Date(dayStart - 2 * 3600_000) },
    });
    await prisma.sleepEntry.create({
      data: { userId, hours: +(opts.sleep[0] + Math.random() * (opts.sleep[1] - opts.sleep[0])).toFixed(1), wokeAt: new Date(dayStart - 2 * 3600_000) },
    });
    await prisma.activityEntry.create({
      data: { userId, type: 'walk', durationMin: 15 + Math.round(Math.random() * 30), at: new Date(dayStart - 7 * 3600_000) },
    });
    if (d % 3 === 0) {
      await prisma.bloodPressureEntry.create({
        data: {
          userId,
          systolic: opts.bp.sys[0] + Math.round(Math.random() * (opts.bp.sys[1] - opts.bp.sys[0])),
          diastolic: opts.bp.dia[0] + Math.round(Math.random() * (opts.bp.dia[1] - opts.bp.dia[0])),
          takenAt: new Date(dayStart - 2 * 3600_000),
        },
      });
    }
  }
  console.log(`  ✓ ${opts.days}-day history seeded — ${label}`);
}

const personas = [
  {
    email: 'priya@metabolic.dev', name: 'Priya Sharma', age: 45, gender: 'female',
    region: 'north_indian', ethnicity: 'North Indian',
    heightCm: 158, weightKg: 71, waistCm: 92, bodyFatPct: 34,
    hba1c: 7.8, fastingGlucose: 141, systolicBp: 138, diastolicBp: 86,
    totalCholesterol: 205, sleepHours: 6.5, activityLevel: 'sedentary', occupation: 'homemaker',
    smoking: 'never', alcohol: 'never',
    conditions: ['type_2_diabetes'], medications: ['metformin_500mg'],
    familyHistory: ['diabetes'], goals: ['lower_hba1c'], sensitivity: 3.1,
    history: { days: 7, fast: [140, 168], post: [172, 215], weight: 71, sleep: [5.5, 8], bp: { sys: [130, 145], dia: [85, 92] } },
  },
  {
    email: 'ramesh@metabolic.dev', name: 'Ramesh Iyer', age: 58, gender: 'male',
    region: 'south_indian', ethnicity: 'South Indian',
    heightCm: 169, weightKg: 78, waistCm: 95, bodyFatPct: 27,
    hba1c: 8.2, fastingGlucose: 152, systolicBp: 142, diastolicBp: 90,
    totalCholesterol: 198, sleepHours: 7, activityLevel: 'moderate', occupation: 'retired',
    smoking: 'never', alcohol: 'occasional',
    conditions: ['type_2_diabetes', 'hypertension'], medications: ['metformin_500mg'],
    familyHistory: ['diabetes'], goals: ['lower_hba1c'], sensitivity: 2.8,
    history: { days: 7, fast: [132, 158], post: [160, 200], weight: 78, sleep: [6, 8.5], bp: { sys: [134, 148], dia: [86, 94] } },
  },
  {
    email: 'arjun@metabolic.dev', name: 'Arjun Patel', age: 31, gender: 'male',
    region: 'gujarati', ethnicity: 'Gujarati',
    heightCm: 176, weightKg: 88, waistCm: 102, bodyFatPct: 26,
    hba1c: 6.1, fastingGlucose: 112, systolicBp: 122, diastolicBp: 78,
    totalCholesterol: 185, sleepHours: 5.5, activityLevel: 'light', occupation: 'software',
    smoking: 'never', alcohol: 'occasional',
    conditions: [], medications: [],
    familyHistory: ['diabetes'], goals: ['weight_loss'], sensitivity: 2.2,
    history: { days: 7, fast: [98, 120], post: [118, 152], weight: 88, sleep: [4.5, 6.5], bp: { sys: [118, 128], dia: [76, 84] } },
  },
];

async function main() {
  console.log('🌱 Seeding demo personas…');
  const passwordHash = await bcrypt.hash('demo1234', 10);
  for (const p of personas) {
    const u = await prisma.user.upsert({
      where: { email: p.email },
      create: {
        email: p.email, passwordHash, name: p.name,
        role: 'member', onboardingComplete: true,
        age: p.age, gender: p.gender, country: 'India', region: p.region, ethnicity: p.ethnicity,
        heightCm: p.heightCm, weightKg: p.weightKg, waistCm: p.waistCm, bodyFatPct: p.bodyFatPct,
        hba1c: p.hba1c, fastingGlucose: p.fastingGlucose, systolicBp: p.systolicBp, diastolicBp: p.diastolicBp,
        totalCholesterol: p.totalCholesterol, sleepHours: p.sleepHours, activityLevel: p.activityLevel,
        occupation: p.occupation, smoking: p.smoking, alcohol: p.alcohol,
        conditions: JSON.stringify(p.conditions), medications: JSON.stringify(p.medications),
        familyHistory: JSON.stringify(p.familyHistory), goals: JSON.stringify(p.goals),
      },
      update: {},
    });
    await seedUserHistory(u.id, p.name, p.history);
    await prisma.userLearnedModel.upsert({
      where: { userId: u.id },
      create: { userId: u.id, sensitivityMgDlPerGCarb: p.sensitivity, sampleSize: 0, isPrior: true },
      update: {},
    });
  }

  console.log('🌱 Seeding admin…');
  const adminHash = await bcrypt.hash('admin1234', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@metabolic.dev' },
    create: {
      email: 'admin@metabolic.dev', passwordHash: adminHash,
      name: 'Site Admin', role: 'admin', onboardingComplete: true,
    },
    update: {},
  });
  await prisma.userLearnedModel.upsert({
    where: { userId: admin.id },
    create: { userId: admin.id, sensitivityMgDlPerGCarb: 2.6, sampleSize: 0, isPrior: true },
    update: {},
  });

  console.log('');
  console.log('✓ Seeded: 3 personas + admin (demo user already existed)');
  console.log('');
  console.log('Logins (demo data — may be reset anytime):');
  console.log('  demo@metabolic.dev   / demo1234   (member)');
  console.log('  priya@metabolic.dev  / demo1234   (member — T2, North Indian, sedentary)');
  console.log('  ramesh@metabolic.dev / demo1234   (member — T2 + hypertension, South Indian)');
  console.log('  arjun@metabolic.dev  / demo1234   (member — prediabetic, Gujarati, poor sleep)');
  console.log('  admin@metabolic.dev  / admin1234  (ADMIN)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });