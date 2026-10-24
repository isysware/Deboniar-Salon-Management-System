-- AlterTable
ALTER TABLE "CommissionPayment" ADD COLUMN     "payrollPaymentId" TEXT,
ADD COLUMN     "requestKey" TEXT;

-- AlterTable
ALTER TABLE "CommissionStatement" ADD COLUMN     "payrollPayslipId" TEXT;

-- AlterTable
ALTER TABLE "PayrollPayment" ADD COLUMN     "commissionAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "requestKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CommissionPayment_requestKey_key" ON "CommissionPayment"("requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPayment_requestKey_key" ON "PayrollPayment"("requestKey");

-- AddForeignKey
ALTER TABLE "CommissionStatement" ADD CONSTRAINT "CommissionStatement_payrollPayslipId_fkey" FOREIGN KEY ("payrollPayslipId") REFERENCES "Payslip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionPayment" ADD CONSTRAINT "CommissionPayment_payrollPaymentId_fkey" FOREIGN KEY ("payrollPaymentId") REFERENCES "PayrollPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

