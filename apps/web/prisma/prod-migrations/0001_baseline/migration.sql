-- CreateTable
CREATE TABLE "Food" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "aliases" TEXT,
    "region" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "servingGrams" REAL NOT NULL,
    "katoriGrams" REAL,
    "kcalPer100g" REAL NOT NULL,
    "carbsPer100g" REAL NOT NULL,
    "proteinPer100g" REAL NOT NULL,
    "fatPer100g" REAL NOT NULL,
    "fiberPer100g" REAL NOT NULL,
    "gi" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "emailVerified" DATETIME,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "age" INTEGER,
    "gender" TEXT,
    "ethnicity" TEXT,
    "country" TEXT,
    "region" TEXT,
    "heightCm" REAL,
    "weightKg" REAL,
    "waistCm" REAL,
    "bodyFatPct" REAL,
    "hba1c" REAL,
    "fastingGlucose" REAL,
    "systolicBp" INTEGER,
    "diastolicBp" INTEGER,
    "totalCholesterol" REAL,
    "sleepHours" REAL,
    "activityLevel" TEXT,
    "occupation" TEXT,
    "smoking" TEXT,
    "alcohol" TEXT,
    "conditions" TEXT,
    "medications" TEXT,
    "familyHistory" TEXT,
    "goals" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserLearnedModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sensitivityMgDlPerGCarb" REAL NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "isPrior" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserLearnedModel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FoodEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "portionType" TEXT NOT NULL,
    "portionValue" REAL NOT NULL,
    "grams" REAL NOT NULL,
    "kcal" REAL NOT NULL,
    "carbsG" REAL NOT NULL,
    "proteinG" REAL NOT NULL,
    "fatG" REAL NOT NULL,
    "photoPath" TEXT,
    "notes" TEXT,
    "loggedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FoodEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FoodEntry_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GlucoseReading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "takenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GlucoseReading_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "durationMin" REAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SleepEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "hours" REAL NOT NULL,
    "wokeAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SleepEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeightEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kg" REAL NOT NULL,
    "takenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeightEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BloodPressureEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "systolic" INTEGER NOT NULL,
    "diastolic" INTEGER NOT NULL,
    "takenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BloodPressureEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InsightCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "effectPct" REAL NOT NULL,
    "confidence" REAL NOT NULL,
    "evidence" TEXT NOT NULL,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InsightCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CoachThread" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CoachThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CoachMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "citations" TEXT,
    "grounded" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoachMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "CoachThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CareRelationship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caregiverId" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "relation" TEXT,
    "alertGlucoseHigh" BOOLEAN NOT NULL DEFAULT true,
    "alertGlucoseLow" BOOLEAN NOT NULL DEFAULT true,
    "alertMissedMeds" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CareRelationship_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CareRelationship_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DoctorPatientLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "adherenceScore" REAL,
    "riskFlags" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DoctorPatientLink_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DoctorPatientLink_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" REAL,
    "unlockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Achievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Food_region_idx" ON "Food"("region");

-- CreateIndex
CREATE INDEX "Food_name_idx" ON "Food"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserLearnedModel_userId_key" ON "UserLearnedModel"("userId");

-- CreateIndex
CREATE INDEX "FoodEntry_userId_loggedAt_idx" ON "FoodEntry"("userId", "loggedAt");

-- CreateIndex
CREATE INDEX "GlucoseReading_userId_takenAt_idx" ON "GlucoseReading"("userId", "takenAt");

-- CreateIndex
CREATE INDEX "ActivityEntry_userId_at_idx" ON "ActivityEntry"("userId", "at");

-- CreateIndex
CREATE INDEX "SleepEntry_userId_wokeAt_idx" ON "SleepEntry"("userId", "wokeAt");

-- CreateIndex
CREATE INDEX "WeightEntry_userId_takenAt_idx" ON "WeightEntry"("userId", "takenAt");

-- CreateIndex
CREATE INDEX "BloodPressureEntry_userId_takenAt_idx" ON "BloodPressureEntry"("userId", "takenAt");

-- CreateIndex
CREATE INDEX "InsightCard_userId_dismissed_idx" ON "InsightCard"("userId", "dismissed");

-- CreateIndex
CREATE INDEX "CoachMessage_threadId_idx" ON "CoachMessage"("threadId");

-- CreateIndex
CREATE UNIQUE INDEX "CareRelationship_caregiverId_wardId_key" ON "CareRelationship"("caregiverId", "wardId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorPatientLink_doctorId_patientId_key" ON "DoctorPatientLink"("doctorId", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_userId_type_key_key" ON "Achievement"("userId", "type", "key");

