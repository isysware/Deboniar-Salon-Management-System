-- DropForeignKey
ALTER TABLE "CommissionStatement" DROP CONSTRAINT "CommissionStatement_runId_fkey";

-- DropForeignKey
ALTER TABLE "Payslip" DROP CONSTRAINT "Payslip_runId_fkey";

-- DropIndex
DROP INDEX "CommissionPayment_idempotencyKey_key";

-- DropIndex
DROP INDEX "CommissionRun_runNumber_key";

-- DropIndex
DROP INDEX "CommissionStatement_runId_idx";

-- DropIndex
DROP INDEX "PayrollPayment_idempotencyKey_key";

-- DropIndex
DROP INDEX "PayrollRun_branchId_idx";

-- DropIndex
DROP INDEX "PayrollRun_branchId_periodYear_periodMonth_key";

-- DropIndex
DROP INDEX "PayrollRun_runNumber_key";

-- DropIndex
DROP INDEX "Payslip_runId_idx";

-- DropIndex
DROP INDEX "TipPayout_branchId_idx";

-- DropIndex
DROP INDEX "TipPayout_idempotencyKey_key";

-- AlterTable
ALTER TABLE "CommissionPayment" DROP COLUMN "accountId",
DROP COLUMN "byUserId",
DROP COLUMN "createdAt",
DROP COLUMN "drawerId",
DROP COLUMN "idempotencyKey",
DROP COLUMN "reverseReason",
ADD COLUMN     "branchId" TEXT NOT NULL,
ADD COLUMN     "cashDrawerId" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "onlineAccountId" TEXT,
ADD COLUMN     "onlineAccountName" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "paidByName" TEXT NOT NULL,
ADD COLUMN     "paidByUserId" TEXT NOT NULL,
ADD COLUMN     "paymentNumber" TEXT NOT NULL,
ADD COLUMN     "reference" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "reversalReason" TEXT,
ADD COLUMN     "reversedAt" TIMESTAMP(3),
ADD COLUMN     "reversedByName" TEXT,
ADD COLUMN     "reversedByUserId" TEXT,
ADD COLUMN     "staffName" TEXT NOT NULL,
DROP COLUMN "method",
ADD COLUMN     "method" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "CommissionRun" DROP COLUMN "createdAt",
DROP COLUMN "createdBy",
DROP COLUMN "finalizedBy",
DROP COLUMN "periodFrom",
DROP COLUMN "periodTo",
DROP COLUMN "runNumber",
DROP COLUMN "totalNet",
DROP COLUMN "totalPaid",
ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledByName" TEXT,
ADD COLUMN     "cancelledByUserId" TEXT,
ADD COLUMN     "commissionNumber" TEXT NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "endDate" DATE NOT NULL,
ADD COLUMN     "finalizedByName" TEXT,
ADD COLUMN     "finalizedByUserId" TEXT,
ADD COLUMN     "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "generatedByName" TEXT NOT NULL,
ADD COLUMN     "generatedByUserId" TEXT NOT NULL,
ADD COLUMN     "startDate" DATE NOT NULL;

-- AlterTable
ALTER TABLE "CommissionStatement" DROP COLUMN "attributedNet",
DROP COLUMN "earned",
DROP COLUMN "lines",
DROP COLUMN "net",
DROP COLUMN "paidAmount",
DROP COLUMN "reversed",
ADD COLUMN     "netPayable" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "snapshot" JSONB NOT NULL,
ADD COLUMN     "statementNumber" TEXT NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "PayrollPayment" DROP COLUMN "accountId",
DROP COLUMN "byUserId",
DROP COLUMN "createdAt",
DROP COLUMN "drawerId",
DROP COLUMN "idempotencyKey",
DROP COLUMN "reverseReason",
ADD COLUMN     "branchId" TEXT NOT NULL,
ADD COLUMN     "cashDrawerId" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "onlineAccountId" TEXT,
ADD COLUMN     "onlineAccountName" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "paidByName" TEXT NOT NULL,
ADD COLUMN     "paidByUserId" TEXT NOT NULL,
ADD COLUMN     "paymentNumber" TEXT NOT NULL,
ADD COLUMN     "reference" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "reversalReason" TEXT,
ADD COLUMN     "reversedAt" TIMESTAMP(3),
ADD COLUMN     "reversedByName" TEXT,
ADD COLUMN     "reversedByUserId" TEXT,
ADD COLUMN     "staffName" TEXT NOT NULL,
DROP COLUMN "method",
ADD COLUMN     "method" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PayrollRun" DROP COLUMN "createdAt",
DROP COLUMN "createdBy",
DROP COLUMN "finalizedBy",
DROP COLUMN "periodMonth",
DROP COLUMN "periodYear",
DROP COLUMN "runNumber",
DROP COLUMN "totalNet",
DROP COLUMN "totalPaid",
ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledByName" TEXT,
ADD COLUMN     "cancelledByUserId" TEXT,
ADD COLUMN     "finalizedByName" TEXT,
ADD COLUMN     "finalizedByUserId" TEXT,
ADD COLUMN     "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "generatedByName" TEXT NOT NULL,
ADD COLUMN     "generatedByUserId" TEXT NOT NULL,
ADD COLUMN     "month" TEXT NOT NULL,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "payrollNumber" TEXT NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "policySnapshot" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "Payslip" DROP COLUMN "paidAmount",
ADD COLUMN     "grossPayable" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "payslipNumber" TEXT NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "TipAllocation" DROP COLUMN "type",
ADD COLUMN     "allocatedByName" TEXT NOT NULL,
ADD COLUMN     "allocatedByUserId" TEXT NOT NULL,
ADD COLUMN     "allocationDate" DATE NOT NULL,
ADD COLUMN     "allocationTime" TEXT NOT NULL,
ADD COLUMN     "allocationType" "TipAllocationType" NOT NULL,
ADD COLUMN     "branchId" TEXT NOT NULL,
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledByName" TEXT,
ADD COLUMN     "cancelledByUserId" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "staffName" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "TipPayout" DROP COLUMN "accountId",
DROP COLUMN "byUserId",
DROP COLUMN "drawerId",
DROP COLUMN "idempotencyKey",
DROP COLUMN "reverseReason",
ADD COLUMN     "cashDrawerId" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "onlineAccountId" TEXT,
ADD COLUMN     "onlineAccountName" TEXT,
ADD COLUMN     "paidByName" TEXT NOT NULL,
ADD COLUMN     "paidByUserId" TEXT NOT NULL,
ADD COLUMN     "payoutDate" DATE NOT NULL,
ADD COLUMN     "payoutTime" TEXT NOT NULL,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "reversalDate" DATE,
ADD COLUMN     "reversalReason" TEXT,
ADD COLUMN     "reversalReceivingDrawerId" TEXT,
ADD COLUMN     "reversedAt" TIMESTAMP(3),
ADD COLUMN     "reversedByName" TEXT,
ADD COLUMN     "reversedByUserId" TEXT,
ADD COLUMN     "staffName" TEXT NOT NULL,
DROP COLUMN "method",
ADD COLUMN     "method" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CommissionPayment_paymentNumber_key" ON "CommissionPayment"("paymentNumber");

-- CreateIndex
CREATE INDEX "CommissionPayment_staffId_idx" ON "CommissionPayment"("staffId");

-- CreateIndex
CREATE INDEX "CommissionStatement_staffId_idx" ON "CommissionStatement"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPayment_paymentNumber_key" ON "PayrollPayment"("paymentNumber");

-- CreateIndex
CREATE INDEX "PayrollPayment_staffId_idx" ON "PayrollPayment"("staffId");

-- CreateIndex
CREATE INDEX "PayrollRun_branchId_month_idx" ON "PayrollRun"("branchId", "month");

-- CreateIndex
CREATE INDEX "Payslip_staffId_idx" ON "Payslip"("staffId");

-- CreateIndex
CREATE INDEX "TipAllocation_branchId_allocationDate_idx" ON "TipAllocation"("branchId", "allocationDate");

-- CreateIndex
CREATE INDEX "TipPayout_branchId_payoutDate_idx" ON "TipPayout"("branchId", "payoutDate");

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionStatement" ADD CONSTRAINT "CommissionStatement_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CommissionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionPayment" ADD CONSTRAINT "CommissionPayment_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "CommissionStatement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

