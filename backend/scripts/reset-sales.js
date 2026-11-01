// scripts/reset-sales.js
import 'dotenv/config';
import prisma from '../src/config/prisma.js';

async function resetSalesData() {
  console.log('⚠️  Starting Sales Data Reset for Production...');
  console.log('📌 NOTE: Branches, Catalogue, Staff, Clients, Expenses, and Master Inventory will NOT be touched.\n');

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Restore inventory batch stock if any products were sold via POS
      console.log('1. Restoring product stock batches if any sold in POS...');
      await tx.$executeRaw`
        UPDATE "InventoryBatch" b
        SET "remainingQuantity" = b."remainingQuantity" + sm.net_qty
        FROM (
          SELECT "batchId",
                 SUM(CASE WHEN "movementType" = 'POS_SALE_OUT' THEN quantity ELSE -quantity END) as net_qty
          FROM "StockMovement"
          WHERE "movementType" IN ('POS_SALE_OUT', 'POS_RETURN_IN') AND "batchId" IS NOT NULL
          GROUP BY "batchId"
        ) sm
        WHERE b.id = sm."batchId"
      `;

      // 2. Clear POS stock movements
      console.log('2. Clearing POS stock movements...');
      await tx.$executeRaw`
        DELETE FROM "StockMovement"
        WHERE "movementType" IN ('POS_SALE_OUT', 'POS_RETURN_IN')
           OR "sourceReferenceType" = 'INVOICE'
      `;

      // 3. Clear POS drawer & account movements (cash & online receipts/refunds)
      console.log('3. Clearing POS cash & bank ledger movements...');
      await tx.$executeRaw`
        DELETE FROM "DrawerMovement"
        WHERE "sourceModule" = 'POS'
           OR "type" IN ('CASH_SALE', 'CASH_TIP', 'DUES_COLLECTION', 'CASH_REFUND')
      `;
      await tx.$executeRaw`
        DELETE FROM "AccountMovement"
        WHERE "sourceModule" = 'POS'
           OR "type" IN ('CASH_SALE', 'CASH_TIP', 'DUES_COLLECTION', 'CASH_REFUND')
      `;

      // 4. Clear Tips generated from sales
      console.log('4. Clearing POS tip payouts, allocations & receipts...');
      await tx.$executeRaw`
        DELETE FROM "TipPayout"
        WHERE "allocationId" IN (
          SELECT a.id FROM "TipAllocation" a
          JOIN "TipReceipt" r ON r.id = a."receiptId"
          WHERE r."invoiceId" IS NOT NULL
        )
      `;
      await tx.$executeRaw`
        DELETE FROM "TipAllocation"
        WHERE "receiptId" IN (SELECT id FROM "TipReceipt" WHERE "invoiceId" IS NOT NULL)
      `;
      await tx.$executeRaw`DELETE FROM "TipReceipt" WHERE "invoiceId" IS NOT NULL`;

      // 5. Clear Commissions generated from sales
      console.log('5. Clearing POS commission events...');
      await tx.$executeRaw`DELETE FROM "CommissionEvent" WHERE "invoiceId" IS NOT NULL`;

      // 6. Clear Refunds on Invoices
      console.log('6. Clearing invoice refunds & lines...');
      await tx.$executeRaw`DELETE FROM "RefundLine"`;
      await tx.$executeRaw`DELETE FROM "InvoiceRefund"`;

      // 7. Clear Invoice Lines, batches & components
      console.log('7. Clearing invoice line details & payments...');
      await tx.$executeRaw`DELETE FROM "InvoiceLineBatch"`;
      await tx.$executeRaw`DELETE FROM "InvoiceLineComponent"`;
      await tx.$executeRaw`DELETE FROM "InvoicePayment"`;
      await tx.$executeRaw`DELETE FROM "InvoiceLine"`;

      // 8. Clear Invoices
      console.log('8. Clearing main invoices...');
      await tx.$executeRaw`DELETE FROM "Invoice"`;

      // 9. Reset Appointment links
      console.log('9. Unlinking appointments from deleted invoices...');
      await tx.$executeRaw`
        UPDATE "Appointment"
        SET "linkedInvoiceId" = NULL,
            "linkedInvoiceNumber" = NULL,
            "billingStatus" = 'UNBILLED'
        WHERE "billingStatus" = 'BILLED' OR "linkedInvoiceId" IS NOT NULL
      `;

      // 10. Reset Invoice numbering sequences back to 0
      console.log('10. Resetting invoice sequence counters...');
      await tx.$executeRaw`
        DELETE FROM "Sequence"
        WHERE prefix IN ('INV', 'RCP', 'TR', 'RFD', 'VOID')
      `;

      // 11. Optional: clean sales audit events
      console.log('11. Clearing sales audit events...');
      await tx.$executeRaw`
        DELETE FROM "AuditEvent"
        WHERE entity IN ('Invoice', 'InvoicePayment', 'InvoiceRefund')
      `;
    });

    console.log('\n✅ All Sales data has been safely reset! Next invoice will start from INV-0001.');
  } catch (error) {
    console.error('\n❌ Error resetting sales data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetSalesData();

