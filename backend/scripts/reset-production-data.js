// scripts/reset-production-data.js
import 'dotenv/config';
import prisma from '../src/config/prisma.js';

async function resetAllExceptAdminBranchPaymentTax() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('⚠️   FULL SYSTEM DATA PURGE & RESET (PRODUCTION READY)');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🔒 PRESERVED & PROTECTED:');
  console.log('   ✓ SuperAdmin & Admin Users (Login, password, roles intact)');
  console.log('   ✓ Branches / Campuses');
  console.log('   ✓ Payment Accounts (Bank accounts, Cash accounts)');
  console.log('   ✓ Tax Rules & Settings');
  console.log('   ✓ System Settings & Expense Categories\n');
  console.log('🗑️  BEING CLEARED (EVERYTHING ELSE):');
  console.log('   - Services, Service Categories, Packages & Components');
  console.log('   - Inventory Items, Batches, Stock Movements & Settlements');
  console.log('   - Suppliers, Purchases, Purchase Lines, Returns & Ledger');
  console.log('   - Invoices, Sales, Lines, Payments, Refunds & Appointments');
  console.log('   - Clients');
  console.log('   - Staff & Staff Compensation History');
  console.log('   - Staff Salary, Payroll Runs, Payslips, Advances & Allowances');
  console.log('   - Commissions, Statements, Runs, Events, Tips & Payouts');
  console.log('   - Attendance, Punches, Overtime & Leave records');
  console.log('   - Expenses, Settlements, Cash Transfers & Drawer Movements');
  console.log('   - All Auto-numbering Sequences (reset back to 1)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Commission & Tips
      console.log('1. Clearing Tips & Commission payouts, runs, statements...');
      await tx.$executeRaw`DELETE FROM "TipPayout";`;
      await tx.$executeRaw`DELETE FROM "TipAllocation";`;
      await tx.$executeRaw`DELETE FROM "TipReceipt";`;
      await tx.$executeRaw`DELETE FROM "CommissionPayment";`;
      await tx.$executeRaw`DELETE FROM "CommissionStatement";`;
      await tx.$executeRaw`DELETE FROM "CommissionRun";`;
      await tx.$executeRaw`DELETE FROM "CommissionEvent";`;

      // 2. Staff Payroll & Salary & Advances
      console.log('2. Clearing Payroll, Advances, Allowances, Payslips...');
      await tx.$executeRaw`DELETE FROM "AdvanceRecovery";`;
      await tx.$executeRaw`DELETE FROM "SalaryAdvance";`;
      await tx.$executeRaw`DELETE FROM "PayrollPayment";`;
      await tx.$executeRaw`DELETE FROM "PayrollAdjustment";`;
      await tx.$executeRaw`DELETE FROM "StaffAllowance";`;
      await tx.$executeRaw`DELETE FROM "Payslip";`;
      await tx.$executeRaw`DELETE FROM "PayrollRun";`;

      // 3. Attendance, Overtime & Leaves
      console.log('3. Clearing Attendance, Overtime, and Leaves...');
      await tx.$executeRaw`DELETE FROM "AttendanceCorrection";`;
      await tx.$executeRaw`DELETE FROM "AttendancePunch";`;
      await tx.$executeRaw`DELETE FROM "AttendanceRecord";`;
      await tx.$executeRaw`DELETE FROM "LeaveRecord";`;
      await tx.$executeRaw`DELETE FROM "OvertimeRecord";`;

      // 4. Sales, Invoices & Refunds
      console.log('4. Clearing Invoices, Lines, Payments, and Refunds...');
      await tx.$executeRaw`DELETE FROM "RefundLine";`;
      await tx.$executeRaw`DELETE FROM "InvoiceRefund";`;
      await tx.$executeRaw`DELETE FROM "InvoiceLineBatch";`;
      await tx.$executeRaw`DELETE FROM "InvoiceLineComponent";`;
      await tx.$executeRaw`DELETE FROM "InvoicePayment";`;
      await tx.$executeRaw`DELETE FROM "InvoiceLine";`;
      await tx.$executeRaw`DELETE FROM "Invoice";`;

      // 5. Appointments & Clients
      console.log('5. Clearing Appointments & Clients...');
      await tx.$executeRaw`DELETE FROM "AppointmentPackageComponent";`;
      await tx.$executeRaw`DELETE FROM "AppointmentReschedule";`;
      await tx.$executeRaw`DELETE FROM "AppointmentItem";`;
      await tx.$executeRaw`DELETE FROM "Appointment";`;
      await tx.$executeRaw`DELETE FROM "Client";`;

      // 6. Services & Packages Catalogue
      console.log('6. Clearing Services, Service Categories, Packages & Components...');
      await tx.$executeRaw`DELETE FROM "PackageComponent";`;
      await tx.$executeRaw`DELETE FROM "Package";`;
      await tx.$executeRaw`DELETE FROM "Service";`;
      await tx.$executeRaw`DELETE FROM "ServiceCategory";`;

      // 7. Suppliers, Purchases, Stock & Inventory
      console.log('7. Clearing Suppliers, Purchases, Stock Movements & Inventory...');
      await tx.$executeRaw`DELETE FROM "SupplierReturnLine";`;
      await tx.$executeRaw`DELETE FROM "SupplierReturn";`;
      await tx.$executeRaw`DELETE FROM "PurchaseLine";`;
      await tx.$executeRaw`DELETE FROM "Purchase";`;
      await tx.$executeRaw`DELETE FROM "SupplierPayment";`;
      await tx.$executeRaw`DELETE FROM "SupplierLedger";`;
      await tx.$executeRaw`DELETE FROM "Supplier";`;
      await tx.$executeRaw`DELETE FROM "StockSettlementLine";`;
      await tx.$executeRaw`DELETE FROM "StockSettlement";`;
      await tx.$executeRaw`DELETE FROM "StockMovement";`;
      await tx.$executeRaw`DELETE FROM "InventoryBatch";`;
      await tx.$executeRaw`DELETE FROM "InventoryItem";`;

      // 8. Expenses, Cash Transfers & Ledger Movements
      console.log('8. Clearing Expenses, Drawer & Account movements...');
      await tx.$executeRaw`DELETE FROM "Expense";`;
      await tx.$executeRaw`DELETE FROM "Settlement";`;
      await tx.$executeRaw`DELETE FROM "CashVarianceAdjustment";`;
      await tx.$executeRaw`DELETE FROM "CashTransfer";`;
      await tx.$executeRaw`DELETE FROM "DrawerMovement";`;
      await tx.$executeRaw`DELETE FROM "AccountMovement";`;

      // 9. Staff & Non-Admin Users (SUPER_ADMIN & ADMIN PRESERVED)
      console.log('9. Clearing Staff & Non-admin users (preserving Admins & SuperAdmins)...');
      await tx.$executeRaw`UPDATE "User" SET "staffId" = NULL;`;
      await tx.$executeRaw`
        DELETE FROM "RefreshToken"
        WHERE "userId" IN (SELECT id FROM "User" WHERE role NOT IN ('SUPER_ADMIN', 'ADMIN'));
      `;
      await tx.$executeRaw`
        DELETE FROM "PasswordResetToken"
        WHERE "userId" IN (SELECT id FROM "User" WHERE role NOT IN ('SUPER_ADMIN', 'ADMIN'));
      `;
      await tx.$executeRaw`
        DELETE FROM "User"
        WHERE role NOT IN ('SUPER_ADMIN', 'ADMIN');
      `;
      await tx.$executeRaw`DELETE FROM "StaffCompensationHistory";`;
      await tx.$executeRaw`DELETE FROM "Staff";`;

      // 10. Reset Auto-numbering Sequences back to 1
      console.log('10. Resetting ALL sequence counters back to 1...');
      await tx.$executeRaw`DELETE FROM "Sequence";`;

      // 11. Stale Audits & Idempotency
      console.log('11. Clearing audit logs and idempotency keys...');
      await tx.$executeRaw`DELETE FROM "IdempotencyKey";`;
      await tx.$executeRaw`DELETE FROM "AuditEvent";`;
    });

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('✅ COMPLETE PURGE SUCCESSFUL!');
    console.log('   All SuperAdmin and Admin logins are 100% intact.');
    console.log('   Branches, Payment Accounts, and Tax settings are 100% preserved.');
    console.log('   System is clean and ready for fresh setup from scratch.');
    console.log('═══════════════════════════════════════════════════════════════════');
  } catch (error) {
    console.error('\n❌ Error during purge:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetAllExceptAdminBranchPaymentTax();
