-- DropIndex
DROP INDEX "Settlement_branchId_idx";

-- AlterTable
ALTER TABLE "CashVarianceAdjustment" DROP COLUMN "amount",
DROP COLUMN "approvedBy",
DROP COLUMN "reason",
ADD COLUMN     "adjustmentNumber" TEXT NOT NULL,
ADD COLUMN     "approvedByName" TEXT NOT NULL,
ADD COLUMN     "approvedByUserId" TEXT NOT NULL,
ADD COLUMN     "branchId" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "date" DATE NOT NULL,
ADD COLUMN     "explanation" TEXT NOT NULL,
ADD COLUMN     "settlementNumber" TEXT NOT NULL,
ADD COLUMN     "time" TEXT NOT NULL,
ADD COLUMN     "varianceAmount" DECIMAL(14,2) NOT NULL;

-- AlterTable
ALTER TABLE "Settlement" DROP COLUMN "carryForward",
DROP COLUMN "denominations",
DROP COLUMN "receiverUserId",
DROP COLUMN "reviewedByUserId",
DROP COLUMN "settlementAmount",
ADD COLUMN     "date" DATE NOT NULL,
ADD COLUMN     "denominationBreakdown" JSONB,
ADD COLUMN     "destinationVaultId" TEXT,
ADD COLUMN     "destinationVaultName" TEXT,
ADD COLUMN     "handoverAmount" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "receivedByName" TEXT,
ADD COLUMN     "receivedByUserId" TEXT,
ADD COLUMN     "retainedFloat" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "submittedByName" TEXT NOT NULL,
ADD COLUMN     "submittedByRole" TEXT NOT NULL,
ADD COLUMN     "successorDrawerId" TEXT,
ADD COLUMN     "time" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "varianceAdjustmentRecordId" TEXT,
ADD COLUMN     "varianceExplanation" TEXT,
ALTER COLUMN "settlementNumber" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CashVarianceAdjustment_adjustmentNumber_key" ON "CashVarianceAdjustment"("adjustmentNumber");

-- CreateIndex
CREATE INDEX "Settlement_branchId_status_idx" ON "Settlement"("branchId", "status");

-- CreateIndex
CREATE INDEX "Settlement_drawerId_idx" ON "Settlement"("drawerId");

