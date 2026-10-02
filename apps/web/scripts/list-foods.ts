// List the food catalog: id | name | category | region | katoriGrams
// Read-only. Used to curate plate presets (combo meals) against REAL food IDs
// - never hardcoded guesses. Run from apps/web: npx tsx scripts/list-foods.ts
import { FOODS } from '@mi/food-db';

for (const f of FOODS) {
  console.log([f.id, f.name, f.category, f.region, f.katoriGrams ?? '-'].join(' | '));
}
console.log('total:', FOODS.length);