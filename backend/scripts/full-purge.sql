BEGIN;

-- 1. Commission & Tips
DELETE FROM "TipPayout";
DELETE FROM "TipAllocation";
DELETE FROM "TipReceipt";
DELETE FROM "CommissionPayment";
DELETE FROM "CommissionStatement";
DELETE FROM "CommissionRun";
DELETE FROM "CommissionEvent";

-- 2. Staff Payroll, Salary Advances & Payslips
DELETE FROM "AdvanceRecovery";
DELETE FROM "SalaryAdvance";
DELETE FROM "PayrollPayment";
DELETE FROM "PayrollAdjustment";
DELETE FROM "StaffAllowance";
DELETE FROM "Payslip";
DELETE FROM "PayrollRun";

-- 3. Attendance, Leaves & Overtime
DELETE FROM "AttendanceCorrection";
DELETE FROM "AttendancePunch";
DELETE FROM "AttendanceRecord";
DELETE FROM "LeaveRecord";
DELETE FROM "OvertimeRecord";

-- 4. Sales, Invoices & Refunds
DELETE FROM "RefundLine";
DELETE FROM "InvoiceRefund";
DELETE FROM "InvoiceLineBatch";
DELETE FROM "InvoiceLineComponent";
DELETE FROM "InvoicePayment";
DELETE FROM "InvoiceLine";
DELETE FROM "Invoice";

-- 5. Appointments & Clients
DELETE FROM "AppointmentPackageComponent";
DELETE FROM "AppointmentReschedule";
DELETE FROM "AppointmentItem";
DELETE FROM "Appointment";
DELETE FROM "Client";

-- 6. Services & Packages
DELETE FROM "PackageComponent";
DELETE FROM "Package";
DELETE FROM "Service";
DELETE FROM "ServiceCategory";

-- 7. Suppliers, Purchases, Stock & Inventory
DELETE FROM "SupplierReturnLine";
DELETE FROM "SupplierReturn";
DELETE FROM "PurchaseLine";
DELETE FROM "Purchase";
DELETE FROM "SupplierPayment";
DELETE FROM "SupplierLedger";
DELETE FROM "Supplier";
DELETE FROM "StockSettlementLine";
DELETE FROM "StockSettlement";
DELETE FROM "StockMovement";
DELETE FROM "InventoryBatch";
DELETE FROM "InventoryItem";

-- 8. Expenses, Cash Transfers & Ledger Movements
DELETE FROM "Expense";
DELETE FROM "Settlement";
DELETE FROM "CashVarianceAdjustment";
DELETE FROM "CashTransfer";
DELETE FROM "DrawerMovement";
DELETE FROM "AccountMovement";

-- 9. Staff & Non-Admin Users (SUPER_ADMIN & ADMIN 100% PRESERVED)
UPDATE "User" SET "staffId" = NULL;

DELETE FROM "RefreshToken"
WHERE "userId" IN (SELECT id FROM "User" WHERE role NOT IN ('SUPER_ADMIN', 'ADMIN'));

DELETE FROM "PasswordResetToken"
WHERE "userId" IN (SELECT id FROM "User" WHERE role NOT IN ('SUPER_ADMIN', 'ADMIN'));

DELETE FROM "User"
WHERE role NOT IN ('SUPER_ADMIN', 'ADMIN');

DELETE FROM "StaffCompensationHistory";
DELETE FROM "Staff";

-- 10. Reset Auto-numbering Sequences (All counters reset back to 1)
DELETE FROM "Sequence";

-- 11. Stale Audits & Idempotency
DELETE FROM "IdempotencyKey";
DELETE FROM "AuditEvent";

COMMIT;

