-- CreateTable
CREATE TABLE "PrakritiProfile" (
"id" TEXT NOT NULL PRIMARY KEY,
"userId" TEXT NOT NULL,
"answersJson" TEXT NOT NULL,
"vataScore" INTEGER NOT NULL,
"pittaScore" INTEGER NOT NULL,
"kaphaScore" INTEGER NOT NULL,
"primaryDosha" TEXT NOT NULL,
"secondaryDosha" TEXT NOT NULL,
"takenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "PrakritiProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PrakritiProfile_userId_takenAt_idx" ON "PrakritiProfile"("userId", "takenAt");