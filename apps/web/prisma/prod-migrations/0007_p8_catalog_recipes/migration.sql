-- P8: catalog recipes — the seeded 300-recipe diabetic-friendly library.
-- Purely additive: one new table, no column changes anywhere else.
-- Macro columns are per-serving, computed by the seed pipeline via
-- @mi/engine recipeNutrition (ingredient grams x per-100g) — never hand-set.

-- CreateTable
CREATE TABLE "CatalogRecipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameTe" TEXT,
    "mealType" TEXT NOT NULL,
    "cuisine" TEXT NOT NULL,
    "servings" REAL NOT NULL,
    "prepMinutes" INTEGER NOT NULL,
    "items" TEXT NOT NULL,
    "steps" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "notes" TEXT,
    "kcal" REAL NOT NULL,
    "carbsG" REAL NOT NULL,
    "netCarbsG" REAL NOT NULL,
    "proteinG" REAL NOT NULL,
    "fatG" REAL NOT NULL,
    "fiberG" REAL NOT NULL,
    "gi" REAL NOT NULL,
    "carbTier" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "CatalogRecipe_mealType_idx" ON "CatalogRecipe"("mealType");

-- CreateIndex
CREATE INDEX "CatalogRecipe_carbTier_idx" ON "CatalogRecipe"("carbTier");

-- CreateIndex
CREATE INDEX "CatalogRecipe_cuisine_idx" ON "CatalogRecipe"("cuisine");
