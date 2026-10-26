// P6-a schema smoke: Recipe CRUD + engine nutrition against the local dev DB.
// Run: node scripts/p6-recipe-smoke.mjs (from apps/web, with DATABASE_URL set)
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

const libsql = createClient({ url: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaLibSQL(libsql) });

async function main() {
  // Seed a minimal user + one catalog food.
  const user = await prisma.user.create({
    data: { email: `smoke-${Date.now()}@example.com`, name: 'Smoke User', onboardingComplete: true },
  });
  const food = await prisma.food.create({
    data: {
      id: 'smoke-chapati', name: 'Smoke Chapati', region: 'global', category: 'cereal',
      servingGrams: 40, kcalPer100g: 260, carbsPer100g: 50, proteinPer100g: 9,
      fatPer100g: 4, fiberPer100g: 5, gi: 62,
    },
  });

  // Create a recipe (lean items JSON, SavedCombo precedent).
  const recipe = await prisma.recipe.create({
    data: {
      userId: user.id,
      name: 'Smoke recipe',
      servings: 2,
      items: JSON.stringify([
        { foodId: food.id, portionType: 'serving', portionValue: 2 },
      ]),
    },
  });
  console.log('created recipe:', recipe.id);

  const rows = await prisma.recipe.findMany({ where: { userId: user.id } });
  if (rows.length !== 1 || rows[0].servings !== 2) throw new Error('recipe read-back failed');
  const items = JSON.parse(rows[0].items);
  if (items[0].foodId !== food.id) throw new Error('items JSON roundtrip failed');

  // Update + delete.
  await prisma.recipe.update({ where: { id: recipe.id }, data: { name: 'Smoke recipe v2' } });
  await prisma.recipe.delete({ where: { id: recipe.id } });
  const after = await prisma.recipe.count({ where: { userId: user.id } });
  if (after !== 0) throw new Error('recipe delete failed');

  // Cascade: deleting the user removes recipes.
  const r2 = await prisma.recipe.create({
    data: { userId: user.id, name: 'cascade', servings: 1, items: JSON.stringify([{ foodId: food.id, portionType: 'serving', portionValue: 1 }]) },
  });
  await prisma.user.delete({ where: { id: user.id } });
  const cascaded = await prisma.recipe.findUnique({ where: { id: r2.id } });
  if (cascaded !== null) throw new Error('user cascade did not remove recipe');

  console.log('P6-a RECIPE SMOKE: OK');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
