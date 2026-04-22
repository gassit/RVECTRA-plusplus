-- CreateTable
CREATE TABLE "avr" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'AUTO',
    "status" TEXT NOT NULL DEFAULT 'OK',
    "switchoverDelay" REAL NOT NULL DEFAULT 0.5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "avr_input" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "avrId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "signalType" TEXT NOT NULL DEFAULT 'ELECTRICAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "avr_input_avrId_fkey" FOREIGN KEY ("avrId") REFERENCES "avr" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "avr_input_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "avr_output" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "avrId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "actionOn" TEXT NOT NULL DEFAULT 'CLOSE',
    "actionOff" TEXT NOT NULL DEFAULT 'OPEN',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "avr_output_avrId_fkey" FOREIGN KEY ("avrId") REFERENCES "avr" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "avr_output_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "avr_switchover" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "avrId" TEXT NOT NULL,
    "triggerElement" TEXT,
    "triggerReason" TEXT NOT NULL,
    "actions" TEXT NOT NULL,
    "delay" REAL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "avr_switchover_avrId_fkey" FOREIGN KEY ("avrId") REFERENCES "avr" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "avr_input_avrId_idx" ON "avr_input"("avrId");

-- CreateIndex
CREATE INDEX "avr_output_avrId_idx" ON "avr_output"("avrId");
