-- DropIndex
DROP INDEX "CommissionEvent_branchId_staffId_idx";

-- DropIndex
DROP INDEX "Invoice_idempotencyKey_key";

-- DropIndex
DROP INDEX "InvoiceRefund_idempotencyKey_key";

-- DropIndex
DROP INDEX "TipReceipt_branchId_idx";

-- DropIndex
DROP INDEX "TipReceipt_invoiceId_key";

-- AlterTable
ALTER TABLE "CommissionEvent" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "invoiceNumber" TEXT NOT NULL,
ALTER COLUMN "rate" SET DATA TYPE DECIMAL(5,2),
ALTER COLUMN "eventDate" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "customerSourceDetails" TEXT,
ADD COLUMN     "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
ADD COLUMN     "processedByName" TEXT NOT NULL,
ADD COLUMN     "staffId" TEXT,
ADD COLUMN     "staffName" TEXT,
ALTER COLUMN "date" SET DATA TYPE DATE,
ALTER COLUMN "idempotencyKey" DROP NOT NULL;

-- AlterTable
ALTER TABLE "InvoiceLine" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unitCostSnapshot" DECIMAL(14,4),
ALTER COLUMN "code" DROP NOT NULL,
ALTER COLUMN "staffId" SET NOT NULL,
ALTER COLUMN "staffName" SET NOT NULL,
ALTER COLUMN "staffCommissionRate" SET NOT NULL,
ALTER COLUMN "staffCommissionRate" SET DEFAULT 0,
ALTER COLUMN "staffCommissionRate" SET DATA TYPE DECIMAL(5,2),
ALTER COLUMN "taxRate" SET DATA TYPE DECIMAL(6,5);

-- AlterTable
ALTER TABLE "InvoiceLineBatch" ADD COLUMN     "batchNumber" TEXT NOT NULL,
ALTER COLUMN "unitCost" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "InvoiceLineComponent" ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "staffId" SET NOT NULL,
ALTER COLUMN "staffName" SET NOT NULL,
ALTER COLUMN "staffCommissionRate" SET NOT NULL,
ALTER COLUMN "staffCommissionRate" SET DEFAULT 0,
ALTER COLUMN "staffCommissionRate" SET DATA TYPE DECIMAL(5,2);

-- AlterTable
ALTER TABLE "InvoicePayment" DROP COLUMN "accountId",
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'POS',
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paymentAccountId" TEXT,
ADD COLUMN     "paymentAccountName" TEXT,
ADD COLUMN     "processedByName" TEXT NOT NULL,
ADD COLUMN     "time" TEXT NOT NULL,
ALTER COLUMN "date" SET DATA TYPE DATE,
ALTER COLUMN "previousBalance" DROP NOT NULL,
ALTER COLUMN "remainingBalance" DROP NOT NULL;

-- AlterTable
ALTER TABLE "InvoiceRefund" DROP COLUMN "idempotencyKey",
ADD COLUMN     "byName" TEXT NOT NULL,
ADD COLUMN     "drawerId" TEXT,
ADD COLUMN     "receivableCancelled" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "refundDate" DATE NOT NULL;

-- AlterTable
ALTER TABLE "RefundLine" DROP COLUMN "componentId",
DROP COLUMN "qty",
ADD COLUMN     "quantity" DECIMAL(14,4) NOT NULL;

-- AlterTable
ALTER TABLE "TipReceipt" ADD COLUMN     "cashDrawerId" TEXT,
ADD COLUMN     "clientName" TEXT NOT NULL,
ADD COLUMN     "collectedByName" TEXT NOT NULL,
ADD COLUMN     "collectedByUserId" TEXT NOT NULL,
ADD COLUMN     "collectionDate" DATE NOT NULL,
ADD COLUMN     "collectionTime" TEXT NOT NULL,
ADD COLUMN     "directStaffId" TEXT,
ADD COLUMN     "directStaffName" TEXT,
ADD COLUMN     "invoiceNumber" TEXT NOT NULL,
ADD COLUMN     "paymentAccountId" TEXT,
ADD COLUMN     "paymentAccountName" TEXT,
ADD COLUMN     "paymentId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "CommissionEvent_branchId_staffId_eventDate_idx" ON "CommissionEvent"("branchId", "staffId", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_appointmentId_key" ON "Invoice"("appointmentId");

-- CreateIndex
CREATE INDEX "Invoice_branchId_status_idx" ON "Invoice"("branchId", "status");

-- CreateIndex
CREATE INDEX "InvoiceLine_staffId_idx" ON "InvoiceLine"("staffId");

-- CreateIndex
CREATE INDEX "InvoiceLineComponent_staffId_idx" ON "InvoiceLineComponent"("staffId");

-- CreateIndex
CREATE INDEX "InvoicePayment_branchId_date_idx" ON "InvoicePayment"("branchId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TipReceipt_paymentId_key" ON "TipReceipt"("paymentId");

-- CreateIndex
CREATE INDEX "TipReceipt_branchId_collectionDate_idx" ON "TipReceipt"("branchId", "collectionDate");

-- CreateIndex
CREATE INDEX "TipReceipt_invoiceId_idx" ON "TipReceipt"("invoiceId");

