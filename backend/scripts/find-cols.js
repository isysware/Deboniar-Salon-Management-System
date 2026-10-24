import prisma from '../src/config/prisma.js';

async function main() {
  const invs = await prisma.invoice.findMany({ select: { id: true, invoiceNumber: true } });
  console.log('Invoices:', invs);

  const commEvents = await prisma.commissionEvent.findMany({
    select: { id: true, invoiceNumber: true, invoiceId: true }
  });
  console.log('CommissionEvents:', commEvents);

  const tips = await prisma.tipReceipt.findMany({
    select: { id: true, invoiceNumber: true, invoiceId: true }
  });
  console.log('TipReceipts:', tips);

  const cdm = await prisma.cashDrawerMovement.findMany({
    where: { description: { contains: 'INV-' } },
    select: { id: true, description: true }
  });
  console.log('CashDrawerMovements with INV-:', cdm);

  const exp = await prisma.expense.findMany({
    where: { description: { contains: 'INV-' } },
    select: { id: true, voucherNumber: true, description: true }
  });
  console.log('Expenses with INV-:', exp);
}

main().catch(console.error).finally(() => prisma.$disconnect());
