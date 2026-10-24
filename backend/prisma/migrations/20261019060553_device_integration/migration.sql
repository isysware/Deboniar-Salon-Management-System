-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('BIOMETRIC_ATTENDANCE', 'POS_PRINTER', 'BARCODE_SCANNER', 'PAYMENT_TERMINAL', 'CASH_DRAWER');

-- CreateEnum
CREATE TYPE "DeviceConnectionType" AS ENUM ('ETHERNET_LAN', 'WIFI', 'USB', 'SERIAL_COM', 'BLUETOOTH', 'CLOUD_API');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'SYNCING', 'ERROR');

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deviceType" "DeviceType" NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serialNumber" TEXT,
    "connectionType" "DeviceConnectionType" NOT NULL DEFAULT 'ETHERNET_LAN',
    "ipAddress" TEXT,
    "port" INTEGER,
    "macAddress" TEXT,
    "baudRate" INTEGER,
    "communicationKey" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'OFFLINE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastPingAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceLog" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Device_branchId_idx" ON "Device"("branchId");

-- CreateIndex
CREATE INDEX "Device_deviceType_idx" ON "Device"("deviceType");

-- CreateIndex
CREATE INDEX "Device_status_idx" ON "Device"("status");

-- CreateIndex
CREATE INDEX "DeviceLog_deviceId_idx" ON "DeviceLog"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceLog_branchId_createdAt_idx" ON "DeviceLog"("branchId", "createdAt");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceLog" ADD CONSTRAINT "DeviceLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

