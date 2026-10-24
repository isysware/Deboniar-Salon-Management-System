// prisma/seed.js
// Seeds demo master data (same ids as the frontend mock). Safe to re-run: every write is an upsert.
// Run: npm run db:seed

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { normalizePhoneDigits } from '../src/lib/phone.js';
import { postStockMovement } from '../src/lib/stock.js';
import {
  BRANCHES, TAX_RULES, USERS, STAFF, SERVICE_CATEGORIES, SERVICES, PACKAGES,
  PAYMENT_ACCOUNTS, EXPENSE_CATEGORIES, CLIENTS, VAULTS, INVENTORY_ITEMS, SUPPLIERS, OPENING_BATCHES,
} from './seed-data.js';

const prisma = new PrismaClient();
const day = (s) => new Date(`${s}T00:00:00.000Z`);

async function main() {
  console.log('🌱  Seeding SalonOS demo data...');

  // Branches first without defaultTaxRuleId/admin (those rows don't exist yet).
  for (const { defaultTaxRuleId, assignedAdminId, ...b } of BRANCHES) {
    await prisma.branch.upsert({ where: { id: b.id }, update: {}, create: b });
  }

  for (const r of TAX_RULES) {
    await prisma.taxRule.upsert({ where: { id: r.id }, update: {}, create: r });
  }

  for (const s of STAFF) {
    const { joiningDate, effectiveDate, ...rest } = s;
    await prisma.staff.upsert({
      where:  { id: s.id },
      update: {},
      create: { ...rest, joiningDate: day(joiningDate), effectiveDate: day(effectiveDate) },
    });
  }

  for (const { password, createdAt, ...u } of USERS) {
    await prisma.user.upsert({
      where:  { id: u.id },
      update: {},
      create: { ...u, createdAt: day(createdAt), passwordHash: await bcrypt.hash(password, 12) },
    });
  }

  for (const b of BRANCHES) {
    await prisma.branch.update({
      where: { id: b.id },
      data:  { defaultTaxRuleId: b.defaultTaxRuleId, assignedAdminId: b.assignedAdminId },
    });
  }
  console.log('✅  Branches, tax rules, staff and users');

  for (const c of SERVICE_CATEGORIES) {
    await prisma.serviceCategory.upsert({ where: { id: c.id }, update: {}, create: c });
  }
  for (const { category, ...s } of SERVICES) {
    const cat = SERVICE_CATEGORIES.find((c) => c.branchId === s.branchId && c.name === category);
    await prisma.service.upsert({ where: { id: s.id }, update: {}, create: { ...s, categoryId: cat.id } });
  }
  for (const { components, ...p } of PACKAGES) {
    await prisma.package.upsert({
      where:  { id: p.id },
      update: {},
      create: { ...p, components: { create: components.map((c, i) => ({ ...c, sortOrder: i })) } },
    });
  }
  console.log('✅  Service catalogue');

  for (const { createdAt, ...a } of PAYMENT_ACCOUNTS) {
    await prisma.paymentAccount.upsert({ where: { id: a.id }, update: {}, create: { ...a, createdAt: day(createdAt) } });
  }
  for (const c of EXPENSE_CATEGORIES) {
    await prisma.expenseCategory.upsert({ where: { id: c.id }, update: {}, create: { ...c, createdAt: day('2026-01-01') } });
  }
  for (const c of CLIENTS) {
    await prisma.client.upsert({
      where:  { id: c.id },
      update: {},
      create: { ...c, phoneNormalized: normalizePhoneDigits(c.phone) },
    });
  }
  console.log('✅  Payment accounts, expense categories, clients');

  // Branch vaults (admin safe) with their opening cash — posted as an OPENING_FLOAT movement
  // so the balance is derived from the ledger like every other cash holder.
  for (const v of VAULTS) {
    const exists = await prisma.cashDrawer.findUnique({ where: { id: v.id } });
    if (exists) continue;
    await prisma.cashDrawer.create({
      data: {
        id: v.id, kind: 'VAULT', branchId: v.branchId, custodianName: 'Branch Vault (Admin Safe)', date: day('2026-01-01'),
        movements: {
          create: {
            branchId: v.branchId, type: 'OPENING_FLOAT', direction: 'IN', amount: v.openingCash,
            sourceModule: 'OPENING_BALANCE', description: 'Opening vault cash balance', userId: 'usr-super-01', userName: 'Super Administrator',
          },
        },
      },
    });
  }
  console.log('✅  Branch vaults');

  // ── Inventory: items, suppliers (opening payable via ledger), opening stock layers ──
  for (const item of INVENTORY_ITEMS) {
    await prisma.inventoryItem.upsert({ where: { id: item.id }, update: {}, create: item });
  }
  for (const { ledgerBranchId, ...s } of SUPPLIERS) {
    const exists = await prisma.supplier.findUnique({ where: { id: s.id } });
    if (exists) continue;
    await prisma.supplier.create({ data: { ...s, createdById: 'usr-admin-01', createdByName: 'Aamina Sheikh' } });
    if (s.openingPayable > 0) {
      await prisma.supplierLedger.create({
        data: {
          supplierId: s.id, branchId: ledgerBranchId, date: day('2026-09-01'), entryType: 'OPENING_BALANCE', referenceType: 'OPENING',
          referenceId: s.id, referenceNumber: `OPN-${s.supplierCode}`, description: 'Authorized Opening Payable Balance',
          credit: s.openingPayable, userId: 'usr-admin-01', userName: 'Aamina Sheikh',
        },
      });
    }
  }
  // Keep the supplier-code sequence ahead of the seeded codes.
  await prisma.sequence.upsert({
    where: { branchCode_prefix_year: { branchCode: 'ALL', prefix: 'SUP', year: 0 } },
    update: {}, create: { branchCode: 'ALL', prefix: 'SUP', year: 0, lastValue: SUPPLIERS.length },
  });

  const seedActor = { id: 'usr-admin-01', name: 'Aamina Sheikh' };
  for (const b of OPENING_BATCHES) {
    if (await prisma.inventoryBatch.findUnique({ where: { id: b.id } })) continue;
    await prisma.$transaction(async (tx) => {
      const supplier = SUPPLIERS.find((s) => s.id === b.supplierId);
      const branch = BRANCHES.find((x) => x.id === b.branchId);
      const batch = await tx.inventoryBatch.create({
        data: {
          id: b.id, itemId: b.itemId, branchId: b.branchId, batchNumber: b.batchNumber, supplierId: supplier.id, supplierName: supplier.name,
          receivedDate: day(b.receivedDate), expiryDate: b.expiryDate ? day(b.expiryDate) : null,
          initialQuantity: b.quantity, remainingQuantity: 0, unitCost: b.unitCost,
        },
      });
      await postStockMovement(tx, {
        branchCode: branch.code, branchId: b.branchId, itemId: b.itemId, batch, movementType: 'OPENING_STOCK', quantity: b.quantity,
        unitCost: b.unitCost, sourceReferenceType: 'OPENING', sourceReferenceId: batch.id, sourceReferenceNumber: `OPN-${b.batchNumber}`,
        reason: 'Opening stock balance', actor: seedActor,
      });
    });
  }
  console.log('✅  Inventory items, suppliers, opening stock');

  console.log('\n📋  Demo accounts:');
  for (const u of USERS) console.log(`    ${u.email.padEnd(34)} ${u.password.padEnd(20)} [${u.role}]`);
  console.log('\n🎉  Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌  Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
