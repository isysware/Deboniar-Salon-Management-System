-- DropIndex
DROP INDEX "Expense_expenseNumber_key";

-- AlterTable
ALTER TABLE "Expense" DROP COLUMN "accountId",
DROP COLUMN "categoryId",
DROP COLUMN "drawerId",
DROP COLUMN "enteredByUserId",
DROP COLUMN "expenseNumber",
DROP COLUMN "paymentMethod",
DROP COLUMN "postedAt",
DROP COLUMN "reference",
DROP COLUMN "reverseReason",
ADD COLUMN     "category" TEXT NOT NULL,
ADD COLUMN     "createdByName" TEXT NOT NULL,
ADD COLUMN     "createdByUserId" TEXT NOT NULL,
ADD COLUMN     "externalReference" TEXT,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "isReversalRecord" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paidByName" TEXT,
ADD COLUMN     "paidByUserId" TEXT,
ADD COLUMN     "paidFromDrawerId" TEXT,
ADD COLUMN     "payee" TEXT NOT NULL,
ADD COLUMN     "paymentAccountId" TEXT,
ADD COLUMN     "paymentAccountName" TEXT,
ADD COLUMN     "paymentSource" TEXT NOT NULL,
ADD COLUMN     "receivingCustodianName" TEXT,
ADD COLUMN     "receivingCustodianUserId" TEXT,
ADD COLUMN     "receivingDrawerId" TEXT,
ADD COLUMN     "reversalOfVoucherNumber" TEXT,
ADD COLUMN     "reversalReason" TEXT,
ADD COLUMN     "reversalVoucherNumber" TEXT,
ADD COLUMN     "reversedByName" TEXT,
ADD COLUMN     "reversedByUserId" TEXT,
ADD COLUMN     "time" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "voucherNumber" TEXT NOT NULL,
ALTER COLUMN "expenseDate" SET DATA TYPE DATE;

-- CreateIndex
CREATE UNIQUE INDEX "Expense_voucherNumber_key" ON "Expense"("voucherNumber");

-- CreateIndex
CREATE INDEX "Expense_branchId_status_idx" ON "Expense"("branchId", "status");

