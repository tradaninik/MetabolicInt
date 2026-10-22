-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "glucoseUnit" TEXT NOT NULL DEFAULT 'mg/dL',
    "tFastingLow" REAL,
    "tFastingHigh" REAL,
    "tPremealLow" REAL,
    "tPremealHigh" REAL,
    "tPostprandialLow" REAL,
    "tPostprandialHigh" REAL,
    "tBedtimeLow" REAL,
    "tBedtimeHigh" REAL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lab" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "testType" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "a1cPercent" REAL NOT NULL,
    "performedAt" TEXT NOT NULL,
    "labName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lab_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scheduleTimes" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Medication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MedicationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "medicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "logDate" TEXT NOT NULL,
    "slotTime" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MedicationLog_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DayContextTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tagDate" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DayContextTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE INDEX "Lab_userId_testType_performedAt_idx" ON "Lab"("userId", "testType", "performedAt");

-- CreateIndex
CREATE INDEX "Medication_userId_idx" ON "Medication"("userId");

-- CreateIndex
CREATE INDEX "MedicationLog_userId_logDate_idx" ON "MedicationLog"("userId", "logDate");

-- CreateIndex
CREATE UNIQUE INDEX "MedicationLog_medicationId_logDate_slotTime_key" ON "MedicationLog"("medicationId", "logDate", "slotTime");

-- CreateIndex
CREATE INDEX "DayContextTag_userId_tagDate_idx" ON "DayContextTag"("userId", "tagDate");

-- CreateIndex
CREATE UNIQUE INDEX "DayContextTag_userId_tagDate_tag_key" ON "DayContextTag"("userId", "tagDate", "tag");

