-- DropForeignKey
ALTER TABLE "AttendanceCorrection" DROP CONSTRAINT "AttendanceCorrection_recordId_fkey";

-- DropIndex
DROP INDEX "OvertimeRecord_otNumber_key";

-- AlterTable
ALTER TABLE "AttendanceCorrection" DROP COLUMN "after",
DROP COLUMN "before",
DROP COLUMN "byUserId",
DROP COLUMN "createdAt",
ADD COLUMN     "afterSnapshot" JSONB NOT NULL,
ADD COLUMN     "beforeSnapshot" JSONB NOT NULL,
ADD COLUMN     "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "editedByName" TEXT NOT NULL,
ADD COLUMN     "editedByUserId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "AttendancePunch" DROP COLUMN "time",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "timestamp" TEXT NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "AttendanceRecord" DROP COLUMN "workedMinutes",
ADD COLUMN     "checkIn" TEXT NOT NULL,
ADD COLUMN     "checkOut" TEXT,
ADD COLUMN     "isMissingPunch" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isOvernightShift" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leaveId" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "rawEventRef" TEXT,
ADD COLUMN     "scheduledHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
ADD COLUMN     "workedHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
ALTER COLUMN "workDate" SET DATA TYPE DATE,
DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "LeaveRecord" DROP COLUMN "cancelledBy",
DROP COLUMN "days",
DROP COLUMN "fromDate",
DROP COLUMN "toDate",
ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledByName" TEXT,
ADD COLUMN     "cancelledByUserId" TEXT,
ADD COLUMN     "createdByName" TEXT NOT NULL,
ADD COLUMN     "createdByUserId" TEXT NOT NULL,
ADD COLUMN     "endDate" DATE NOT NULL,
ADD COLUMN     "startDate" DATE NOT NULL,
ADD COLUMN     "totalDays" INTEGER NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'APPROVED';

-- AlterTable
ALTER TABLE "OvertimeRecord" DROP COLUMN "approvedBy",
DROP COLUMN "createdAt",
DROP COLUMN "createdBy",
DROP COLUMN "hourlyRateSnapshot",
DROP COLUMN "otNumber",
ADD COLUMN     "approvedByName" TEXT,
ADD COLUMN     "approvedByUserId" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledByName" TEXT,
ADD COLUMN     "cancelledByUserId" TEXT,
ADD COLUMN     "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "enteredByName" TEXT NOT NULL,
ADD COLUMN     "enteredByUserId" TEXT NOT NULL,
ADD COLUMN     "hourlyRate" DECIMAL(14,2),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "overtimeNumber" TEXT NOT NULL,
ADD COLUMN     "rateMultiplier" DECIMAL(4,2) NOT NULL DEFAULT 1,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedByName" TEXT,
ADD COLUMN     "rejectedByUserId" TEXT,
ALTER COLUMN "workDate" SET DATA TYPE DATE,
ALTER COLUMN "status" SET DEFAULT 'SUBMITTED',
ALTER COLUMN "approvedMinutes" SET NOT NULL,
ALTER COLUMN "approvedMinutes" SET DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "OvertimeRecord_overtimeNumber_key" ON "OvertimeRecord"("overtimeNumber");

-- CreateIndex
CREATE INDEX "OvertimeRecord_branchId_workDate_idx" ON "OvertimeRecord"("branchId", "workDate");

-- AddForeignKey
ALTER TABLE "AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "AttendanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

