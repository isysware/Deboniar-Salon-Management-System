ALTER TABLE "SupplierPayment" ADD COLUMN "reversalDate" DATE;
ALTER TABLE "InvoicePayment" ADD COLUMN "reversalDate" DATE;
ALTER TABLE "IdempotencyKey" ADD COLUMN "requestHash" TEXT;
