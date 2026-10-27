-- CreateTable
CREATE TABLE "CustomLabTest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '',
    "refLow" REAL,
    "refHigh" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomLabTest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CustomLabTest_userId_idx" ON "CustomLabTest"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomLabTest_userId_name_key" ON "CustomLabTest"("userId", "name");

