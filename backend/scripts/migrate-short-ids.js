import prisma from '../src/config/prisma.js';

async function main() {
  console.log('🔄 Migrating invoice numbers to short format (INV-0001)...');

  // 1. Get existing invoices ordered by createdAt or date
  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${invoices.length} invoices to update.`);

  let counter = 1;
  for (const inv of invoices) {
    const oldNumber = inv.invoiceNumber;
    const newNumber = `INV-${String(counter).padStart(4, '0')}`;
    counter++;

    console.log(`Updating ${oldNumber} -> ${newNumber}`);

    // Update invoice
    await prisma.invoice.update({
      where: { id: inv.id },
      data: { invoiceNumber: newNumber }
    });

    // Update CommissionEvent
    await prisma.commissionEvent.updateMany({
      where: { invoiceId: inv.id },
      data: { invoiceNumber: newNumber }
    });

    // Update TipReceipt
    await prisma.tipReceipt.updateMany({
      where: { invoiceId: inv.id },
      data: { invoiceNumber: newNumber }
    });
  }

  // Set sequence lastValue for GLOBAL INV
  await prisma.$executeRaw`
    INSERT INTO "Sequence" (id, "branchCode", prefix, year, "lastValue")
    VALUES (gen_random_uuid()::text, 'GLOBAL', 'INV', 0, ${counter - 1})
    ON CONFLICT ("branchCode", prefix, year)
    DO UPDATE SET "lastValue" = ${counter - 1}
  `;

  console.log(`✅ Migration complete. Global INV sequence set to ${counter - 1}.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
