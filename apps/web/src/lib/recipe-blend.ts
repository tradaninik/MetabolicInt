// F3: blend a tray of items into ONE custom food. GI weighting mirrors the
// /log tray preview exactly (net-carb weights, floored at 1) so the preview
// the user saw, the saved food and the model all agree. Macros are
// gram-weighted averages per 100g of the whole; kcal is deliberately left
// to the server's Atwater rule.
export interface BlendItem {
  grams: number;
  netCarbsG: number;
  gi: number;
  carbsPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
}

export interface BlendResult {
  servingGrams: number;
  carbsPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  gi: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function blendRecipe(items: BlendItem[]): BlendResult {
  const totalGrams = items.reduce((s, x) => s + x.grams, 0);
  if (totalGrams <= 0) {
    return { servingGrams: 0, carbsPer100g: 0, proteinPer100g: 0, fatPer100g: 0, fiberPer100g: 0, gi: 0 };
  }
  // item total of a macro = grams * per100g / 100; blend per100g = sum(totals) / totalGrams * 100
  const per100 = (pick: (x: BlendItem) => number) =>
    r1(items.reduce((s, x) => s + pick(x) * x.grams, 0) / totalGrams);
  let giW = 0;
  let giWt = 0;
  for (const x of items) {
    const w = Math.max(x.netCarbsG, 1);
    giW += x.gi * w;
    giWt += w;
  }
  return {
    servingGrams: Math.round(totalGrams),
    carbsPer100g: per100((x) => x.carbsPer100g),
    proteinPer100g: per100((x) => x.proteinPer100g),
    fatPer100g: per100((x) => x.fatPer100g),
    fiberPer100g: per100((x) => x.fiberPer100g),
    gi: giWt > 0 ? r1(giW / giWt) : 0,
  };
}