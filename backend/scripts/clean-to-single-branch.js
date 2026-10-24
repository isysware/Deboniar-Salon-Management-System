// scripts/clean-to-single-branch.js
import 'dotenv/config';
import bcrypt from 'bcrypt';
import prisma from '../src/config/prisma.js';

const WARSI_BRANCH_ID = '84b4c825-09f5-4163-8464-d497312f9a23';
const KEEP_USER_EMAILS = [
  'huzaifawarsi2006@gmail.com',
  'superadmin@isysware.com',
];

async function cleanDatabase() {
  console.log('🧹 Starting complete data cleanup to 0 for Warsi Salon...');

  // 1. Clear all transactions, refunds, and financial ledgers
  console.log('1. Clearing refunds & payments...');
  await prisma.refundLine.deleteMany({});
  await prisma.invoiceRefund.deleteMany({});
  await prisma.invoiceLineBatch.deleteMany({});
  await prisma.invoiceLineComponent.deleteMany({});
  await prisma.invoiceLine.deleteMany({});
  await prisma.invoicePayment.deleteMany({});
  await prisma.commissionEvent.deleteMany({});
  await prisma.invoice.deleteMany({});

  console.log('2. Clearing appointments...');
  await prisma.appointmentPackageComponent.deleteMany({});
  await prisma.appointmentItem.deleteMany({});
  await prisma.appointmentReschedule.deleteMany({});
  await prisma.appointment.deleteMany({});

  console.log('3. Clearing tips & commission...');
  await prisma.tipPayout.deleteMany({});
  await prisma.tipAllocation.deleteMany({});
  await prisma.tipReceipt.deleteMany({});
  await prisma.commissionPayment.deleteMany({});
  await prisma.commissionStatement.deleteMany({});
  await prisma.commissionRun.deleteMany({});

  console.log('4. Clearing payroll, advances & allowances...');
  if (prisma.advanceRecovery) await prisma.advanceRecovery.deleteMany({});
  if (prisma.salaryAdvance) await prisma.salaryAdvance.deleteMany({});
  if (prisma.staffAllowance) await prisma.staffAllowance.deleteMany({});
  if (prisma.payrollAdjustment) await prisma.payrollAdjustment.deleteMany({});
  await prisma.payslip.deleteMany({});
  await prisma.payrollPayment.deleteMany({});
  await prisma.payrollRun.deleteMany({});

  console.log('5. Clearing attendance & overtime...');
  await prisma.attendanceCorrection.deleteMany({});
  await prisma.attendancePunch.deleteMany({});
  await prisma.attendanceRecord.deleteMany({});
  await prisma.leaveRecord.deleteMany({});
  await prisma.branchHoliday.deleteMany({});
  await prisma.overtimeRecord.deleteMany({});

  console.log('6. Clearing inventory, stock, purchases, suppliers...');
  await prisma.stockSettlementLine.deleteMany({});
  await prisma.stockSettlement.deleteMany({});
  await prisma.supplierReturnLine.deleteMany({});
  await prisma.supplierReturn.deleteMany({});
  await prisma.purchaseLine.deleteMany({});
  await prisma.purchase.deleteMany({});
  await prisma.supplierPayment.deleteMany({});
  await prisma.supplierLedger.deleteMany({});
  await prisma.stockMovement.deleteMany({});
  await prisma.inventoryBatch.deleteMany({});
  await prisma.inventoryItem.deleteMany({});
  await prisma.supplier.deleteMany({});

  console.log('7. Clearing expenses, settlements, cash custody...');
  await prisma.expense.deleteMany({});
  await prisma.cashVarianceAdjustment.deleteMany({});
  await prisma.settlement.deleteMany({});
  await prisma.cashTransfer.deleteMany({});
  await prisma.drawerMovement.deleteMany({});
  await prisma.accountMovement.deleteMany({});
  await prisma.cashDrawer.deleteMany({});

  console.log('8. Clearing catalogue (services & packages)...');
  await prisma.packageComponent.deleteMany({});
  await prisma.package.deleteMany({});
  await prisma.service.deleteMany({});
  await prisma.serviceCategory.deleteMany({});

  console.log('9. Clearing clients and staff...');
  await prisma.client.deleteMany({});
  await prisma.user.updateMany({ data: { staffId: null } });
  await prisma.staffCompensationHistory.deleteMany({});
  await prisma.staff.deleteMany({});

  console.log('10. Clearing tax rules, payment accounts, expense categories...');
  // First clear branch defaultTaxRule and assignedAdmin references
  await prisma.branch.updateMany({ data: { defaultTaxRuleId: null, assignedAdminId: null } });
  await prisma.taxRule.deleteMany({});
  await prisma.paymentAccount.deleteMany({});
  await prisma.expenseCategory.deleteMany({});
  await prisma.payrollPolicy.deleteMany({});

  console.log('11. Clearing audit events, idempotency keys, sequences...');
  await prisma.auditEvent.deleteMany({});
  await prisma.idempotencyKey.deleteMany({});
  await prisma.sequence.deleteMany({});

  console.log('12. Clearing tokens...');
  await prisma.refreshToken.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});

  console.log('13. Ensuring Warsi Salon branch exists...');
  const warsiBranch = await prisma.branch.upsert({
    where: { id: WARSI_BRANCH_ID },
    update: {
      name: 'Warsi Salon',
      code: 'WARSI-01',
      address: 'Main Commercial Area, Karachi',
      city: 'Karachi',
      phone: '+92 (21) 3587-9200',
      email: 'huzaifawarsi2006@gmail.com',
      timezone: 'Asia/Karachi',
      currency: 'PKR',
      taxEnabled: false,
      taxRate: 0,
      openingCashFloat: 0,
      isActive: true,
      defaultTaxRuleId: null,
      assignedAdminId: null,
    },
    create: {
      id: WARSI_BRANCH_ID,
      name: 'Warsi Salon',
      code: 'WARSI-01',
      address: 'Main Commercial Area, Karachi',
      city: 'Karachi',
      phone: '+92 (21) 3587-9200',
      email: 'huzaifawarsi2006@gmail.com',
      timezone: 'Asia/Karachi',
      currency: 'PKR',
      taxEnabled: false,
      taxRate: 0,
      openingCashFloat: 0,
      isActive: true,
    },
  });

  console.log('14. Deleting all other branches...');
  const deletedBranches = await prisma.branch.deleteMany({
    where: { id: { not: WARSI_BRANCH_ID } },
  });
  console.log(`Deleted ${deletedBranches.count} other branches.`);

  console.log('15. Creating/updating Superadmin and Huzaifa Admin users...');
  const defaultPasswordHash = await bcrypt.hash('admin123', 10);

  // Super Admin
  const superadmin = await prisma.user.upsert({
    where: { email: 'superadmin@isysware.com' },
    update: {
      name: 'Super Administrator',
      role: 'SUPER_ADMIN',
      branchId: null,
      staffId: null,
      passwordHash: defaultPasswordHash,
      phone: '+92 (42) 3578-9100',
      title: 'Global Operations Director',
      isActive: true,
    },
    create: {
      id: 'usr-super-01',
      name: 'Super Administrator',
      email: 'superadmin@isysware.com',
      role: 'SUPER_ADMIN',
      branchId: null,
      passwordHash: defaultPasswordHash,
      phone: '+92 (42) 3578-9100',
      title: 'Global Operations Director',
      isActive: true,
    },
  });

  // Huzaifa Admin
  const huzaifa = await prisma.user.upsert({
    where: { email: 'huzaifawarsi2006@gmail.com' },
    update: {
      name: 'Huzaifa',
      role: 'ADMIN',
      branchId: WARSI_BRANCH_ID,
      staffId: null,
      passwordHash: defaultPasswordHash,
      phone: '03132220567',
      title: 'Branch Manager',
      isActive: true,
    },
    create: {
      id: '85887989-7308-4579-b32d-05d660dcdb8d',
      name: 'Huzaifa',
      email: 'huzaifawarsi2006@gmail.com',
      role: 'ADMIN',
      branchId: WARSI_BRANCH_ID,
      passwordHash: defaultPasswordHash,
      phone: '03132220567',
      title: 'Branch Manager',
      isActive: true,
    },
  });

  // Assign Huzaifa as admin of Warsi Salon branch
  await prisma.branch.update({
    where: { id: WARSI_BRANCH_ID },
    data: { assignedAdminId: huzaifa.id },
  });

  console.log('16. Deleting all other users...');
  const deletedUsers = await prisma.user.deleteMany({
    where: { email: { notIn: KEEP_USER_EMAILS } },
  });
  console.log(`Deleted ${deletedUsers.count} other users.`);

  // 17. Initialize clean foundation for Warsi Salon
  console.log('17. Initializing clean foundation for Warsi Salon...');

  // Create Main Vault for Warsi Salon (Opening Float 0)
  await prisma.cashDrawer.create({
    data: {
      kind: 'VAULT',
      branchId: WARSI_BRANCH_ID,
      custodianName: 'Branch Vault (Admin Safe)',
      date: new Date(),
      status: 'OPEN',
      lastCountedCash: 0,
    },
  });

  // Create default essential expense categories for Warsi Salon
  const defaultExpenseCategories = [
    { name: 'Salon Supplies & Products', description: 'Cosmetics, dyes, shampoos, and supplies' },
    { name: 'Utilities & Bills', description: 'Electricity, water, gas, and internet' },
    { name: 'Refreshments & Tea', description: 'Client and staff refreshments' },
    { name: 'Maintenance & Repairs', description: 'Equipment, chairs, and salon repair' },
    { name: 'Rent', description: 'Premises monthly rent' },
    { name: 'General & Miscellaneous', description: 'Day-to-day general salon expenses' },
  ];
  for (const cat of defaultExpenseCategories) {
    await prisma.expenseCategory.create({
      data: {
        branchId: WARSI_BRANCH_ID,
        name: cat.name,
        description: cat.description,
        isActive: true,
      },
    });
  }

  // Create default standard Payment Accounts for Warsi Salon
  await prisma.paymentAccount.create({
    data: {
      branchId: WARSI_BRANCH_ID,
      name: 'Meezan Bank Checking',
      accountType: 'BANK',
      providerName: 'Meezan Bank Ltd',
      accountHolder: 'Warsi Salon',
      accountIdentifier: 'PK36MEZN0001004821',
      openingBalance: 0,
      isActive: true,
    },
  });

  // Create default Tax Rule (13% Sindh Sales Tax / PST)
  const defaultTax = await prisma.taxRule.create({
    data: {
      branchId: WARSI_BRANCH_ID,
      name: 'Standard Services SST/PST',
      rate: 0.13,
      isBranchDefault: true,
      isActive: true,
    },
  });

  await prisma.branch.update({
    where: { id: WARSI_BRANCH_ID },
    data: { defaultTaxRuleId: defaultTax.id },
  });

  // Set business date to today
  const todayYmd = new Date().toISOString().slice(0, 10);
  await prisma.systemSetting.upsert({
    where: { key: 'BUSINESS_DATE' },
    update: { value: todayYmd },
    create: { key: 'BUSINESS_DATE', value: todayYmd },
  });

  // Verify final state
  console.log('\n📊 FINAL DATABASE VERIFICATION:');
  const [
    bCount, uCount, branches, users, invCount, aptCount, clCount, stCount, expCount, itmCount, supCount, drwCount
  ] = await Promise.all([
    prisma.branch.count(),
    prisma.user.count(),
    prisma.branch.findMany({ select: { id: true, name: true, code: true, assignedAdminId: true } }),
    prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, branchId: true } }),
    prisma.invoice.count(),
    prisma.appointment.count(),
    prisma.client.count(),
    prisma.staff.count(),
    prisma.expense.count(),
    prisma.inventoryItem.count(),
    prisma.supplier.count(),
    prisma.cashDrawer.count(),
  ]);

  console.log(`- Branches (${bCount}):`, JSON.stringify(branches, null, 2));
  console.log(`- Users (${uCount}):`, JSON.stringify(users, null, 2));
  console.log(`- Invoices: ${invCount}`);
  console.log(`- Appointments: ${aptCount}`);
  console.log(`- Clients: ${clCount}`);
  console.log(`- Staff: ${stCount}`);
  console.log(`- Expenses: ${expCount}`);
  console.log(`- Inventory Items: ${itmCount}`);
  console.log(`- Suppliers: ${supCount}`);
  console.log(`- Drawers: ${drwCount}`);
  console.log('\n✨ Database is completely CLEAN & at 0 for Warsi Salon!');
}

cleanDatabase()
  .catch((e) => {
    console.error('❌ Error during cleanup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
