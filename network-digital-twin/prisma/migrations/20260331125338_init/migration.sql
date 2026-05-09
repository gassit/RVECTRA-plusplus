-- CreateTable
CREATE TABLE "CableReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mark" TEXT NOT NULL,
    "section" REAL NOT NULL,
    "material" TEXT NOT NULL,
    "voltage" REAL NOT NULL,
    "iDop" REAL NOT NULL,
    "r0" REAL NOT NULL,
    "x0" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "BreakerReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "ratedCurrent" REAL NOT NULL,
    "breakingCapacity" REAL NOT NULL,
    "curve" TEXT NOT NULL,
    "poles" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TransformerReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "power" REAL NOT NULL,
    "primaryKV" REAL NOT NULL,
    "secondaryKV" REAL NOT NULL,
    "ukz" REAL NOT NULL,
    "pkz" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Element" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "elementId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parentId" TEXT,
    "voltageLevel" REAL,
    "posX" REAL,
    "posY" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Element_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Element" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeviceSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slotId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "slotType" TEXT NOT NULL,
    "position" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeviceSlot_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Device_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "DeviceSlot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Breaker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "refId" TEXT,
    "ratedCurrent" REAL NOT NULL,
    "currentSetting" REAL,
    "status" TEXT NOT NULL DEFAULT 'on',
    "lastTripReason" TEXT,
    "tripCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Breaker_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Breaker_refId_fkey" FOREIGN KEY ("refId") REFERENCES "BreakerReference" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Meter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "meterType" TEXT NOT NULL,
    "serialNumber" TEXT,
    "accuracy" REAL,
    "tariff" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Meter_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MeterReading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meterId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "activeEnergy" REAL NOT NULL,
    "reactiveEnergy" REAL,
    "powerP" REAL,
    "powerQ" REAL,
    "voltage" REAL,
    "current" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeterReading_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "Meter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transformer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "refId" TEXT,
    "power" REAL NOT NULL,
    "primaryKV" REAL NOT NULL,
    "secondaryKV" REAL NOT NULL,
    "loadPercent" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transformer_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transformer_refId_fkey" FOREIGN KEY ("refId") REFERENCES "TransformerReference" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Load" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "powerP" REAL NOT NULL,
    "powerQ" REAL,
    "cosPhi" REAL NOT NULL DEFAULT 0.9,
    "category" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Load_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cableId" TEXT NOT NULL,
    "name" TEXT,
    "refId" TEXT,
    "length" REAL NOT NULL,
    "section" REAL NOT NULL,
    "material" TEXT NOT NULL DEFAULT 'copper',
    "iDop" REAL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Cable_refId_fkey" FOREIGN KEY ("refId") REFERENCES "CableReference" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "cableId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Connection_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Element" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Connection_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Element" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Connection_cableId_fkey" FOREIGN KEY ("cableId") REFERENCES "Cable" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValidationRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "formula" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'error',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ValidationResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleId" TEXT NOT NULL,
    "elementId" TEXT,
    "connectionId" TEXT,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "value" REAL,
    "limit" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ValidationResult_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ValidationRule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CalculatedParams" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "elementId" TEXT NOT NULL,
    "current" REAL,
    "voltage" REAL,
    "power" REAL,
    "voltageDrop" REAL,
    "shortCircuitCurrent" REAL,
    "loadFactor" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Alarm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "elementId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "CableReference_mark_key" ON "CableReference"("mark");

-- CreateIndex
CREATE UNIQUE INDEX "BreakerReference_type_key" ON "BreakerReference"("type");

-- CreateIndex
CREATE UNIQUE INDEX "TransformerReference_type_key" ON "TransformerReference"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Element_elementId_key" ON "Element"("elementId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceSlot_slotId_key" ON "DeviceSlot"("slotId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_deviceId_key" ON "Device"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Breaker_deviceId_key" ON "Breaker"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Meter_deviceId_key" ON "Meter"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Transformer_deviceId_key" ON "Transformer"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Load_deviceId_key" ON "Load"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Cable_cableId_key" ON "Cable"("cableId");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationRule_name_key" ON "ValidationRule"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CalculatedParams_elementId_key" ON "CalculatedParams"("elementId");
