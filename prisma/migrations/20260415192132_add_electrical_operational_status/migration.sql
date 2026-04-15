/*
  Warnings:

  - You are about to drop the column `status` on the `Breaker` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Cable` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Device` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Load` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Meter` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Transformer` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Breaker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "refId" TEXT,
    "ratedCurrent" REAL NOT NULL,
    "currentSetting" REAL,
    "lastTripReason" TEXT,
    "tripCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Breaker_refId_fkey" FOREIGN KEY ("refId") REFERENCES "BreakerReference" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Breaker_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Breaker" ("createdAt", "currentSetting", "deviceId", "id", "lastTripReason", "ratedCurrent", "refId", "tripCount", "updatedAt") SELECT "createdAt", "currentSetting", "deviceId", "id", "lastTripReason", "ratedCurrent", "refId", "tripCount", "updatedAt" FROM "Breaker";
DROP TABLE "Breaker";
ALTER TABLE "new_Breaker" RENAME TO "Breaker";
CREATE UNIQUE INDEX "Breaker_deviceId_key" ON "Breaker"("deviceId");
CREATE TABLE "new_Cable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cableId" TEXT NOT NULL,
    "name" TEXT,
    "refId" TEXT,
    "length" REAL NOT NULL,
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
CREATE TABLE "new_Connection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "cableId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "electricalStatus" TEXT NOT NULL DEFAULT 'DEAD',
    "operationalStatus" TEXT NOT NULL DEFAULT 'ON',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Connection_cableId_fkey" FOREIGN KEY ("cableId") REFERENCES "Cable" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Connection_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Element" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Connection_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Element" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Connection" ("cableId", "createdAt", "id", "order", "sourceId", "targetId") SELECT "cableId", "createdAt", "id", "order", "sourceId", "targetId" FROM "Connection";
DROP TABLE "Connection";
ALTER TABLE "new_Connection" RENAME TO "Connection";
CREATE TABLE "new_Device" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Device_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "DeviceSlot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Device" ("createdAt", "deviceId", "deviceType", "id", "slotId", "updatedAt") SELECT "createdAt", "deviceId", "deviceType", "id", "slotId", "updatedAt" FROM "Device";
DROP TABLE "Device";
ALTER TABLE "new_Device" RENAME TO "Device";
CREATE UNIQUE INDEX "Device_deviceId_key" ON "Device"("deviceId");
CREATE TABLE "new_Element" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "elementId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parentId" TEXT,
    "voltageLevel" REAL,
    "posX" REAL,
    "posY" REAL,
    "electricalStatus" TEXT NOT NULL DEFAULT 'DEAD',
    "operationalStatus" TEXT NOT NULL DEFAULT 'ON',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Element_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Element" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Element" ("createdAt", "elementId", "id", "name", "parentId", "posX", "posY", "type", "updatedAt", "voltageLevel") SELECT "createdAt", "elementId", "id", "name", "parentId", "posX", "posY", "type", "updatedAt", "voltageLevel" FROM "Element";
DROP TABLE "Element";
ALTER TABLE "new_Element" RENAME TO "Element";
CREATE UNIQUE INDEX "Element_elementId_key" ON "Element"("elementId");
CREATE TABLE "new_Load" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "powerP" REAL NOT NULL,
    "powerQ" REAL,
    "cosPhi" REAL NOT NULL DEFAULT 0.9,
    "category" INTEGER NOT NULL DEFAULT 3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Load_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Load" ("category", "cosPhi", "createdAt", "deviceId", "id", "name", "powerP", "powerQ", "updatedAt") SELECT "category", "cosPhi", "createdAt", "deviceId", "id", "name", "powerP", "powerQ", "updatedAt" FROM "Load";
DROP TABLE "Load";
ALTER TABLE "new_Load" RENAME TO "Load";
CREATE UNIQUE INDEX "Load_deviceId_key" ON "Load"("deviceId");
CREATE TABLE "new_Meter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "meterType" TEXT NOT NULL,
    "serialNumber" TEXT,
    "accuracy" REAL,
    "tariff" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Meter_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Meter" ("accuracy", "createdAt", "deviceId", "id", "meterType", "serialNumber", "tariff", "updatedAt") SELECT "accuracy", "createdAt", "deviceId", "id", "meterType", "serialNumber", "tariff", "updatedAt" FROM "Meter";
DROP TABLE "Meter";
ALTER TABLE "new_Meter" RENAME TO "Meter";
CREATE UNIQUE INDEX "Meter_deviceId_key" ON "Meter"("deviceId");
CREATE TABLE "new_Transformer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "refId" TEXT,
    "power" REAL NOT NULL,
    "primaryKV" REAL NOT NULL,
    "secondaryKV" REAL NOT NULL,
    "loadPercent" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transformer_refId_fkey" FOREIGN KEY ("refId") REFERENCES "TransformerReference" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transformer_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Transformer" ("createdAt", "deviceId", "id", "loadPercent", "power", "primaryKV", "refId", "secondaryKV", "updatedAt") SELECT "createdAt", "deviceId", "id", "loadPercent", "power", "primaryKV", "refId", "secondaryKV", "updatedAt" FROM "Transformer";
DROP TABLE "Transformer";
ALTER TABLE "new_Transformer" RENAME TO "Transformer";
CREATE UNIQUE INDEX "Transformer_deviceId_key" ON "Transformer"("deviceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
