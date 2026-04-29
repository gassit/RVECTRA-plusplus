-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Breaker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "refId" TEXT,
    "breakerType" TEXT NOT NULL DEFAULT 'MCB',
    "ratedCurrent" REAL NOT NULL,
    "currentSetting" REAL,
    "leakageCurrent" REAL,
    "lastTripReason" TEXT,
    "tripCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Breaker_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Breaker_refId_fkey" FOREIGN KEY ("refId") REFERENCES "BreakerReference" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Breaker" ("createdAt", "currentSetting", "deviceId", "id", "lastTripReason", "ratedCurrent", "refId", "tripCount", "updatedAt") SELECT "createdAt", "currentSetting", "deviceId", "id", "lastTripReason", "ratedCurrent", "refId", "tripCount", "updatedAt" FROM "Breaker";
DROP TABLE "Breaker";
ALTER TABLE "new_Breaker" RENAME TO "Breaker";
CREATE UNIQUE INDEX "Breaker_deviceId_key" ON "Breaker"("deviceId");
CREATE TABLE "new_BreakerReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "breakerType" TEXT NOT NULL DEFAULT 'MCB',
    "ratedCurrent" REAL NOT NULL,
    "breakingCapacity" REAL NOT NULL,
    "curve" TEXT NOT NULL,
    "poles" INTEGER NOT NULL,
    "leakageCurrent" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_BreakerReference" ("breakingCapacity", "createdAt", "curve", "id", "poles", "ratedCurrent", "type") SELECT "breakingCapacity", "createdAt", "curve", "id", "poles", "ratedCurrent", "type" FROM "BreakerReference";
DROP TABLE "BreakerReference";
ALTER TABLE "new_BreakerReference" RENAME TO "BreakerReference";
CREATE UNIQUE INDEX "BreakerReference_type_key" ON "BreakerReference"("type");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
