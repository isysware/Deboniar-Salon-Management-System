-- AlterEnum
ALTER TYPE "AccountMovementType" ADD VALUE 'SALARY_ADVANCE';

-- AlterEnum
ALTER TYPE "DrawerMovementType" ADD VALUE 'SALARY_ADVANCE';

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "exitDate" DATE;

-- CreateTable
CREATE TABLE "StaffAllowance" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAllowance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAdjustment" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "payrollRunId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByUserId" TEXT,
    "cancelledByName" TEXT,

    CONSTRAINT "PayrollAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryAdvance" (
    "id" TEXT NOT NULL,
    "advanceNumber" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "staffName" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "recoveryPerMonth" DECIMAL(14,2) NOT NULL,
    "startMonth" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "cashDrawerId" TEXT,
    "onlineAccountId" TEXT,
    "onlineAccountName" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issueDate" DATE NOT NULL,
    "issuedByUserId" TEXT NOT NULL,
    "issuedByName" TEXT NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "reversedByUserId" TEXT,
    "reversedByName" TEXT,
    "reversalReason" TEXT,

    CONSTRAINT "SalaryAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvanceRecovery" (
    "id" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvanceRecovery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffAllowance_staffId_idx" ON "StaffAllowance"("staffId");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_branchId_month_idx" ON "PayrollAdjustment"("branchId", "month");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_staffId_idx" ON "PayrollAdjustment"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryAdvance_advanceNumber_key" ON "SalaryAdvance"("advanceNumber");

-- CreateIndex
CREATE INDEX "SalaryAdvance_branchId_staffId_idx" ON "SalaryAdvance"("branchId", "staffId");

-- CreateIndex
CREATE INDEX "AdvanceRecovery_advanceId_idx" ON "AdvanceRecovery"("advanceId");

-- CreateIndex
CREATE INDEX "AdvanceRecovery_payrollRunId_idx" ON "AdvanceRecovery"("payrollRunId");

-- AddForeignKey
ALTER TABLE "AdvanceRecovery" ADD CONSTRAINT "AdvanceRecovery_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "SalaryAdvance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

