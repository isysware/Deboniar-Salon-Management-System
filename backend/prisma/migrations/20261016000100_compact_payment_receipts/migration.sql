ALTER TABLE "InvoicePayment" ADD COLUMN "receiptNumber" TEXT;
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt", id) AS number FROM "InvoicePayment"
)
UPDATE "InvoicePayment" AS payment
SET "receiptNumber" = 'RCP-' || LPAD(numbered.number::text, GREATEST(4, LENGTH(numbered.number::text)), '0')
FROM numbered WHERE payment.id = numbered.id;
CREATE UNIQUE INDEX "InvoicePayment_receiptNumber_key" ON "InvoicePayment"("receiptNumber");
