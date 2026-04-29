-- AlterTable
ALTER TABLE "Breaker" ADD COLUMN "breakingCapacity" REAL;
ALTER TABLE "Breaker" ADD COLUMN "curve" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Cable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cableId" TEXT NOT NULL,
    "name" TEXT,
    "refId" TEXT,
    "length" REAL NOT NULL,
    "cores" INTEGER NOT NULL DEFAULT 3,
    "section" REAL NOT NULL,
    "material" TEXT NOT NULL DEFAULT 'copper',
    "iDop" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Cable_refId_fkey" FOREIGN KEY ("refId") REFERENCES "CableReference" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Cable" ("cableId", "createdAt", "iDop", "id", "length", "material", "name", "refId", "section", "updatedAt") SELECT "cableId", "createdAt", "iDop", "id", "length", "material", "name", "refId", "section", "updatedAt" FROM "Cable";
DROP TABLE "Cable";
ALTER TABLE "new_Cable" RENAME TO "Cable";
CREATE UNIQUE INDEX "Cable_cableId_key" ON "Cable"("cableId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
