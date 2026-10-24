# SalonOS Module Connections Matrix

This document defines the cross-module data dependencies, canonical records, and impact pathways across SalonOS. It guarantees that operational actions update canonical data stores once without side effects or phantom financial entries.

---

## Action → Canonical Record → Affected Dashboard/Report Matrix

| User Action | Canonical Record Mutated | Ledger / Drawer Impact | Affected Dashboards & Views | Implementation Status |
| :--- | :--- | :--- | :--- | :--- |
| **Check-In / Punch In** | `AttendanceRecord` (`punches`, `status='PRESENT'`, `isLate`, `lateMinutes`) | **None** (No cash or ledger impact) | • Admin Dashboard (Staff on Duty counter)<br>• Staff Personal Attendance (`/my-attendance`)<br>• Attendance Report (`/reports/attendance`) | **Completed & Verified** |
| **Check-Out / Punch Out** | `AttendanceRecord` (`punches`, `workedHours`, `isEarlyExit`, `earlyExitMinutes`, `calculationSnapshot`) | **None** (Calculates deduction preview snapshot without moving funds) | • Staff Personal Attendance (`/my-attendance`)<br>• Staff Attendance (`/operations/attendance`)<br>• Attendance Report (`/reports/attendance`) | **Completed & Verified** |
| **Correct Punch / Attendance** | `AttendanceRecord` (`corrections` audit trail with before/after snapshots and reason) | **None** | • Staff Attendance (`/operations/attendance`)<br>• Correction Audit Modal<br>• Staff Personal Attendance (`/my-attendance`) | **Completed & Verified** |
| **Mark Staff Leave** | `LeaveRecord` (`LV-{CODE}-{YEAR}-{SEQ}`) and linked `AttendanceRecord` (`PAID_LEAVE` / `UNPAID_LEAVE`) | **None** (Leave allowance tracked against staff contract, zero ledger impact) | • Staff Attendance (`/operations/attendance`)<br>• Staff Personal Portal (`/my-attendance`)<br>• Attendance Report (`/reports/attendance`) | **Completed & Verified** |
| **Cancel Staff Leave** | `LeaveRecord` (`status='CANCELLED'`, audit metadata, removal of synthetic attendance) | **None** | • Staff Attendance (`/operations/attendance`)<br>• Staff Personal Portal (`/my-attendance`) | **Completed & Verified** |
| **Biometric CSV Import** | `AttendanceRecord` batch (matched by `employeeCode` within branch) | **None** | • Staff Attendance (`/operations/attendance`)<br>• Biometric Log & Deduction Snapshots | **Completed & Verified** |
| **Finalize Day Attendance** | `AttendanceRecord` (Marks `MISSING_PUNCH` for unclosed shifts, `ABSENT` for non-attending scheduled staff) | **None** | • Staff Attendance (`/operations/attendance`)<br>• Day & Month KPI Summaries | **Completed & Verified** |
| **Submit Manual Overtime** | `OvertimeRecord` (`OT-{CODE}-{YEAR}-{SEQ}`, `status='SUBMITTED'`, `minutes`, `reason`) | **None** | • Manual Overtime (`/operations/manual-overtime`)<br>• Overtime Audit Report (`/reports/overtime`) | **Completed & Verified** |
| **Approve Manual Overtime** | `OvertimeRecord` (`status='APPROVED'`, `hourlyRate` snapshotted, `approvedMinutes`, `amount`) | **None** (Snapshotted rate stored for future payroll calculation; no immediate cash disbursement) | • Staff Dashboard (Estimated gross payout)<br>• Staff Personal Portal (`/my-attendance`)<br>• Manual Overtime (`/operations/manual-overtime`)<br>• Overtime Audit Report (`/reports/overtime`) | **Completed & Verified** |
| **Reject Manual Overtime** | `OvertimeRecord` (`status='REJECTED'`, `rejectionReason`, `approvedMinutes=0`) | **None** | • Manual Overtime (`/operations/manual-overtime`)<br>• Staff Personal Portal (`/my-attendance`) | **Completed & Verified** |
| **Cancel Manual Overtime** | `OvertimeRecord` (`status='CANCELLED'`, `cancellationReason`, `payrollId` verification) | **None** | • Manual Overtime (`/operations/manual-overtime`)<br>• Staff Personal Portal (`/my-attendance`) | **Completed & Verified** |
| **Generate Payroll Preview** | `PayrollRun` (`status='DRAFT'`, calculation snapshots for all eligible staff) | **None** (Zero ledger impact; previews compute net payable, deductions, allowances, approved overtime) | • Payroll (`/accounts/payroll`)<br>• Staff Salary Report (`/reports/staff-salary`) | **Completed & Verified** |
| **Finalize Payroll Run** | `PayrollRun` (`status='FINALIZED'`, `runNumber='PR-YYYY-MM-SEQ'`, immutable `payslips`), `OvertimeRecord` (`payrollId=run.id`) | **None** (Recognizes payable obligation; locks overtime against re-consumption; no cash movement) | • Payroll (`/accounts/payroll`)<br>• Staff Salary Report (`/reports/staff-salary`)<br>• Staff Personal Reports (`/my-reports`) | **Completed & Verified** |
| **Disburse Payroll (Cash)** | `PayrollPayment` (`status='COMPLETED'`, `method='CASH'`), `PayrollRun` (`totalPaid`, payslip `paidAmount`) | **CashDrawer Atomically Debited** (`cashExpensesPaid += amount`, `expectedInDrawer -= amount`) | • Payroll (`/accounts/payroll`)<br>• Active Cash Drawer Float<br>• Staff Salary Report (`/reports/staff-salary`)<br>• Staff Personal Reports (`/my-reports`) | **Completed & Verified** |
| **Disburse Payroll (Online/Bank)** | `PayrollPayment` (`status='COMPLETED'`, `method='ONLINE'`), `PayrollRun` (`totalPaid`, payslip `paidAmount`) | **OnlineAccount Atomically Debited** (`currentBalance -= amount`) | • Payroll (`/accounts/payroll`)<br>• Online Banking Account Balance<br>• Staff Salary Report (`/reports/staff-salary`)<br>• Staff Personal Reports (`/my-reports`) | **Completed & Verified** |
| **Reverse Payroll Payment** | `PayrollPayment` (`status='REVERSED'`, reason, timestamp), `PayrollRun` (restores payable balance) | **Drawer / Account Reimbursed** (Cash: `cashExpensesPaid -= amount`, `expectedInDrawer += amount`; Online: `currentBalance += amount`) | • Payroll (`/accounts/payroll`)<br>• Active Cash Drawer / Online Account<br>• Staff Salary Report (`/reports/staff-salary`)<br>• Staff Personal Reports (`/my-reports`) | **Completed & Verified** |
| **Cancel Payroll Run** | `PayrollRun` (`status='CANCELLED'`), `OvertimeRecord` (`payrollId=undefined` released) | **None** (Permitted only if 0 payments exist or all payments have been reversed) | • Payroll (`/accounts/payroll`)<br>• Staff Salary Report (`/reports/staff-salary`)<br>• Unlocks overtime records for future runs | **Completed & Verified** |
| **Generate Commission Preview** | `CommissionRun` (`status='DRAFT'`, line-item attributions from non-voided invoices) | **None** (Zero ledger impact; calculates commission strictly on net service sales after discount) | • Staff Commission (`/accounts/commission`)<br>• Staff Commission Report (`/reports/staff-commission`) | **Completed & Verified** |
| **Finalize Commission Run** | `CommissionRun` (`status='FINALIZED'`, `runNumber='CR-YYYY-MM-SEQ'`, `consumedAttributionLineIds`) | **None** (Freezes statement lines; locks attribution lines against duplicate run inclusion) | • Staff Commission (`/accounts/commission`)<br>• Staff Commission Report (`/reports/staff-commission`)<br>• Staff Personal Reports (`/my-reports`) | **Completed & Verified** |
| **Disburse Commission (Cash)** | `CommissionPayment` (`status='COMPLETED'`, `method='CASH'`), `CommissionRun` (`totalPaid`, statement `paidAmount`) | **CashDrawer Atomically Debited** (`cashExpensesPaid += amount`, `expectedInDrawer -= amount`) | • Staff Commission (`/accounts/commission`)<br>• Active Cash Drawer Float<br>• Staff Commission Report (`/reports/staff-commission`)<br>• Staff Personal Reports (`/my-reports`) | **Completed & Verified** |
| **Disburse Commission (Online/Bank)** | `CommissionPayment` (`status='COMPLETED'`, `method='ONLINE'`), `CommissionRun` (`totalPaid`, statement `paidAmount`) | **OnlineAccount Atomically Debited** (`currentBalance -= amount`) | • Staff Commission (`/accounts/commission`)<br>• Online Banking Account Balance<br>• Staff Commission Report (`/reports/staff-commission`)<br>• Staff Personal Reports (`/my-reports`) | **Completed & Verified** |
| **Reverse Commission Payment** | `CommissionPayment` (`status='REVERSED'`, reason, timestamp), `CommissionRun` (restores payable balance) | **Drawer / Account Reimbursed** (Cash: `cashExpensesPaid -= amount`, `expectedInDrawer += amount`; Online: `currentBalance += amount`) | • Staff Commission (`/accounts/commission`)<br>• Active Cash Drawer / Online Account<br>• Staff Commission Report (`/reports/staff-commission`)<br>• Staff Personal Reports (`/my-reports`) | **Completed & Verified** |
| **Cancel Commission Run** | `CommissionRun` (`status='CANCELLED'`), releases `consumedAttributionLineIds` | **None** (Permitted only if 0 payments exist or all payments reversed) | • Staff Commission (`/accounts/commission`)<br>• Staff Commission Report (`/reports/staff-commission`)<br>• Frees invoice service lines for future runs | **Completed & Verified** |
| **Collect Tip at POS** | `TipReceiptRecord` (`TR-{BRANCH}-{YEAR}-{SEQ}`, `collectedAmount`, `unallocatedAmount`) | **Drawer / Account Float** (Cash tip enters Drawer `cashTipsCollected`; Online tip credited to account) | • Tips Management (`/accounts/tips-management`)<br>• Tips Statement (`/reports/tips-statement`)<br>• Cash Drawer Settlement | **Completed & Verified** |
| **Allocate Tip (Direct / Pooled)** | `TipAllocationRecord` (`TA-{BRANCH}-{YEAR}-{SEQ}`, `amount`, `outstandingAmount`, `status='UNPAID'`), `TipReceiptRecord` (`allocatedAmount`, `unallocatedAmount`) | **None** (Establishes staff gratuity liability without moving cash) | • Tips Management (`/accounts/tips-management`)<br>• Tips Statement (`/reports/tips-statement`)<br>• Staff Personal Reports (`/my-reports`) | **Completed & Verified** |
| **Cancel Unpaid Tip Allocation** | `TipAllocationRecord` (`status='CANCELLED'`), `TipReceiptRecord` (restores `unallocatedAmount`, reverts status) | **None** | • Tips Management (`/accounts/tips-management`)<br>• Tips Statement (`/reports/tips-statement`) | **Completed & Verified** |
| **Disburse Tip Payout (Cash)** | `TipPayoutRecord` (`TP-{BRANCH}-{YEAR}-{SEQ}`, `status='COMPLETED'`), `TipAllocationRecord` (`paidAmount`, `outstandingAmount`, status) | **CashDrawer Atomically Debited** (`cashExpensesPaid += amount`, `expectedInDrawer -= amount`) | • Tips Management (`/accounts/tips-management`)<br>• Tips Statement (`/reports/tips-statement`)<br>• Staff Personal Reports (`/my-reports`) | **Completed & Verified** |
| **Disburse Tip Payout (Online/Bank)** | `TipPayoutRecord` (`TP-{BRANCH}-{YEAR}-{SEQ}`, `status='COMPLETED'`), `TipAllocationRecord` (`paidAmount`, `outstandingAmount`, status) | **OnlineAccount Atomically Debited** (`currentBalance -= amount`) | • Tips Management (`/accounts/tips-management`)<br>• Tips Statement (`/reports/tips-statement`)<br>• Staff Personal Reports (`/my-reports`) | **Completed & Verified** |
| **Reverse Tip Payout** | `TipPayoutRecord` (`status='REVERSED'`, reason, timestamp), `TipAllocationRecord` (restores `outstandingAmount`, status) | **Drawer / Account Reimbursed** (Cash: `expectedInDrawer += amount`; Online: `currentBalance += amount`) | • Tips Management (`/accounts/tips-management`)<br>• Tips Statement (`/reports/tips-statement`)<br>• Staff Personal Reports (`/my-reports`) | **Completed & Verified** |
| **Staff View Personal Tips & Performance** | None (Read-only query of personal allocations, payouts, and service metrics matching `user.staffId`) | **None** | • Staff Personal Reports (`/my-reports` Tabs: My Tips & My Performance) | **Completed & Verified** |
| **Staff Performance Management Report** | None (Read-only aggregation of service units, package components, net sales, commissions, tips, and attendance) | **None** | • Staff Performance (`/reports/staff-performance`) | **Completed & Verified** |
| **Tips Financial Statement** | None (Read-only balance sheet reconciliation: `Closing = Opening + Collections - Payouts = Unallocated + Allocated-Unpaid`) | **None** | • Tips Statement (`/reports/tips-statement`) | **Completed & Verified** |
| **Book Appointment** | `Appointment` (`status='PENDING' \| 'CONFIRMED'`, sequential slots, multi-staff package allocations) | **None** (Booking establishes schedule reservation with zero immediate ledger movement) | • Appointments Calendar (`/operations/appointments`)<br>• Customer Details (`/operations/clients`)<br>• POS Queue (`/pos`)<br>• Appointment Report (`/reports/appointments`) | **Completed & Verified** |
| **Reschedule Appointment** | `Appointment` (`rescheduleHistory` audit trail, updated date/time/slots) | **None** | • Appointments Calendar (`/operations/appointments`)<br>• POS Queue (`/pos`)<br>• Appointment Report (`/reports/appointments`) | **Completed & Verified** |
| **Cancel / No-Show Appointment** | `Appointment` (`status='CANCELLED' \| 'NO_SHOW'`, `cancelReason`) | **None** (Releases reserved staff slot immediately without moving funds) | • Appointments Calendar (`/operations/appointments`)<br>• Customer History (`/operations/clients`)<br>• Appointment Report (`/reports/appointments`) | **Completed & Verified** |
| **Handoff Appointment to POS** | None (Pre-populates POS cart preserving line instance IDs, package component percentages, allocated amounts, and designated stylists) | **None** (Strict cart protection prevents silent overwrite) | • POS Billing (`/pos`)<br>• Appointment Queue Drawer | **Completed & Verified** |
| **Post POS Invoice (Linked Appointment)** | `Invoice` (`appointmentId`), `Appointment` (`billingStatus='BILLED'`, `linkedInvoiceId`, `linkedInvoiceNumber`, immutable `packageComponentsSnapshot`) | **Drawer / Account Float** (Cash/Card/Online receipt captured; drawer/account atomically credited) | • POS Billing (`/pos`)<br>• Sales Invoices (`/sales/invoices`)<br>• Customer History (`/operations/clients`)<br>• Appointment Report (`/reports/appointments`) | **Completed & Verified** |
| **Create / Update Customer** | `Client` (`customerSource`, normalized phone, profile) | **None** | • Customer Directory (`/operations/clients`)<br>• Appointment Booking Modal<br>• POS Billing Customer Selector | **Completed & Verified** |
| **Collect Outstanding Customer Dues** | `InvoicePayment` (`method='CASH' \| 'ONLINE'`), `Invoice` (`paidAmount`, `balance`) | **Drawer Atomically Credited** (`cashSalesInDrawer += amount`, `expectedInDrawer += amount`) or **Online Account Credited** | • Customer Details Dues Tab (`/operations/clients`)<br>• POS Invoices<br>• Cash Drawer Audit | **Completed & Verified** |
| **Appointment Audit Report** | None (Read-only aggregation of scheduled dates, quoted booking values vs actual linked invoice net sales, statuses, and staff attributions) | **None** | • Dedicated Appointment Report (`/reports/appointments`) | **Completed & Verified** |
| **Purchase Stock-In (Credit / Upfront)** | `Purchase` (`PO-{BRANCH}-{YEAR}-{SEQ}`), `InventoryBatch`, `StockMovement` (`PURCHASE_IN`), `SupplierLedgerEntry` (`PURCHASE_BILL`) | **Supplier Ledger Credited** (`currentPayable += balanceDue`). If upfront paid: **Drawer/Account Debited** (`expectedInDrawer -= paidAmount`) & `SupplierLedgerEntry` (`SUPPLIER_PAYMENT`) | • Inventory & Suppliers (`/operations/inventory-suppliers`)<br>• Supplier Ledger Drawer<br>• Stock Valuation Report (`/reports/inventory-movement`) | **Completed & Verified** |
| **Pay Supplier / Disburse Advance** | `SupplierPaymentRecord` (`SP-{BRANCH}-{YEAR}-{SEQ}`), `SupplierLedgerEntry` (`SUPPLIER_PAYMENT`), `Supplier` (`currentPayable -= amount`) | **Cash Drawer / Online Account Debited** (`cashExpensesPaid += amount`, `expectedInDrawer -= amount` or `account.currentBalance -= amount`) | • Inventory & Suppliers (`/operations/inventory-suppliers`)<br>• Supplier Ledger Drawer<br>• Cash Drawer Audit | **Completed & Verified** |
| **Execute Supplier Return** | `SupplierReturn` (`PR-{BRANCH}-{YEAR}-{SEQ}`), `StockMovement` (`SUPPLIER_RETURN_OUT`), `SupplierLedgerEntry` (`PURCHASE_RETURN` / `SUPPLIER_REFUND`) | **Supplier Payable Debited** (`currentPayable -= amount`) or **Drawer/Account Float Credited** (if cash/online refund received) | • Inventory & Suppliers (`/operations/inventory-suppliers`)<br>• Supplier Ledger Drawer<br>• Stock Valuation Report | **Completed & Verified** |
| **Manual Stock Out (Salon Consumption / Damage)** | `StockMovement` (`SM-{BRANCH}-{YEAR}-{SEQ}`, `movementType='SALON_CONSUMPTION_OUT' \| 'DAMAGED_OUT' \| ...`), `InventoryBatch` (deducts remaining qty) | **None** (Consumable material cost tracked strictly for COGS and margin reporting; no cash movement) | • Inventory & Suppliers Movements Tab<br>• COGS Report (`/reports/operating-profit`)<br>• Stock Valuation Report | **Completed & Verified** |
| **Post Stock Settlement (Physical Count)** | `StockSettlement` (`ST-{BRANCH}-{YEAR}-{SEQ}`), `StockMovement` (`POSITIVE_ADJUSTMENT` / `NEGATIVE_ADJUSTMENT`), `InventoryBatch` (adjusts remaining qty) | **None** (Physical discrepancy adjustments update unit quantities & cost valuation; zero ledger cash movement) | • Inventory & Suppliers Reconciliation Tab<br>• Stock Movement Audit (`/reports/inventory-movement`) | **Completed & Verified** |
| **POS Retail Product Sale** | `Invoice` (line `unitCostSnapshot`, `cogsAmount`), `StockMovement` (`POS_SALE_OUT`), `InventoryBatch` (FEFO deduction) | **Drawer / Account Credited** (POS sale revenue collected; stock batch deducted; COGS snapshotted) | • POS Billing (`/pos`)<br>• COGS & Profitability Report (`/reports/operating-profit`)<br>• Inventory Movements Audit | **Completed & Verified** |
| **Batch Quarantine / Release** | `InventoryBatch` (`status='QUARANTINED' \| 'VALID'`, `quarantinedReason`) | **None** (Blocks quarantined stock from POS retail sales and issue without financial adjustment) | • Inventory & Suppliers Batches Drawer<br>• Batch Expiry Audit (`/reports/inventory-movement`) | **Completed & Verified** |

---

## Role & Permission Boundaries

1. **Super Admin**:
   - Full cross-branch visibility and management across all branches.
   - Access to operational screens:
     - Attendance & Overtime (`/operations/attendance`, `/operations/manual-overtime`)
     - Financial Accounts (`/accounts/payroll`, `/accounts/commission`, `/accounts/tips-management`)
     - All Reports (`/reports/attendance`, `/reports/overtime`, `/reports/staff-salary`, `/reports/staff-commission`, `/reports/staff-performance`, `/reports/tips-statement`).
   - Authority to configure Payroll Policies (Absence Divisor: /30, /26, CALENDAR_DAYS, WORKING_DAYS; Proration method; Penalty rule).

2. **Branch Admin**:
   - Scoped strictly to assigned branch (`branchId`).
   - Access to operational attendance, corrections, leaves, manual overtime creation, and approval.
   - Access to Payroll (`/accounts/payroll`), Commission (`/accounts/commission`), and Tips Management (`/accounts/tips-management`) for their assigned branch.
   - Can disburse cash disbursements only from open drawers under their custody or online accounts configured for their branch.
   - Access to branch-level Staff Performance (`/reports/staff-performance`) and Tips Statement (`/reports/tips-statement`).

3. **Accountant**:
   - **Zero Access Policy for Gratuity & Confidential Payroll**: Strictly excluded from:
     - Staff Attendance (`/operations/attendance`)
     - Manual Overtime (`/operations/manual-overtime`)
     - Payroll Runs & Policies (`/accounts/payroll`)
     - Staff Commission (`/accounts/commission`)
     - Tips Allocation & Disbursement (`/accounts/tips-management`)
     - Staff Salary Report (`/reports/staff-salary`)
     - Staff Commission Report (`/reports/staff-commission`)
     - Staff Performance Report (`/reports/staff-performance`)
     - Tips Statement Report (`/reports/tips-statement`)
     - Staff Personal Statements (`/my-reports`)
   - **Permitted Action**: Collecting tip amounts during checkout at POS (creates `TipReceiptRecord` segregated from sales revenue).
   - Denied at router level, permissions configuration, in-component role guards, and mock service methods with explicit permission rejection errors.

4. **Staff**:
   - Read-only access to individual records via:
     - `/my-attendance` (personal attendance and leaves)
     - `/my-performance` (personal performance indicators)
     - `/my-reports` (personal finalized salary payslips, commission statements, tips ledger, and performance review).
   - Filtered strictly by authenticated `user.staffId`.
   - Cannot view other staff members' attendance, leaves, overtime, salaries, commissions, or tips.
   - Cannot access operational tip allocation, tip payout disbursement, management performance reports, or tips financial statements.
   - Unfinalized draft runs are never visible to staff.
   - Unapproved / rejected overtime minutes never inflate earnings.

---

## Financial Ledger Invariance & Cash Custody Rules

1. **Draft Generation & Finalization Invariance**:
   - Generating drafts or finalizing payroll and commission runs creates **zero cash movement**.
   - Finalization recognizes a legal payout liability and issues official serial numbers (`PR-YYYY-MM-SEQ` and `CR-YYYY-MM-SEQ`).
   - Overtime and sales line items are locked to prevent double counting.

2. **Tip Liability Segregation & Allocation Invariance**:
   - Tips collected at POS are segregated from salon sales revenue and tracked strictly as gratuity liability.
   - Allocating tips (direct or pooled) creates **zero cash movement**; it binds the collected receipt to specific staff members with deterministic split rounding (`Σ allocations = allocatedAmount`).
   - Unpaid allocations can be safely cancelled, restoring the unallocated receipt balance.

3. **Payment & Tip Disbursement Execution**:
   - Payments and tip payouts move funds directly from physical cash custody or named online accounts.
   - **Cash Payouts**:
     - Require the executing user to possess an active `OPEN` cash drawer (`custodianUserId === user.id`).
     - Reject if `expectedInDrawer < paymentAmount`.
     - Atomically increment `drawer.cashExpensesPaid += amount` and decrement `drawer.expectedInDrawer -= amount`.
     - Recorded under the drawer's audit history without creating duplicate manual expense entries.
     - Protected by idempotency keys to eliminate double debits on network retry.
   - **Online Payments**:
     - Require selecting an authorized `OnlineAccount`.
     - Reject if `account.currentBalance < paymentAmount`.
     - Atomically decrement `account.currentBalance -= amount`.

4. **Auditable Payment & Tip Reversals**:
   - Direct deletions are prohibited. Payouts can only be reversed with an audit reason and timestamp.
   - Reversal atomically reimburses the drawer float or online account balance and restores unpaid liability.
   - Prevent double reversal attempts.

5. **Tips Statement Liability Equation**:
   - Closing liability strictly balances:
     $$\text{Closing Liability} = \text{Opening Liability} + \text{Net Tips Collected} - \text{Net Completed Payouts}$$
   - Independent verification balances:
     $$\text{Closing Liability} = \text{Unallocated Tips} + \text{Allocated Unpaid Tips}$$

---

## Scope & Completed / Unfinished Reports Status

### Completed & Verified in Phase 3H:
- `/reports/inventory-movement` (Stock Movement & Batches Audit Trail: `<InventoryReportsPage />` wired and tested)
- `/reports/operating-profit` (Product COGS & Inventory Summary Report: `<COGSReportPage />` wired and tested)

### Scheduled for Phase 4:
- `/reports/income-expense` (General Ledger Income vs Expense Statement)

The `/reports/income-expense` route remains untouched in this batch and will be connected in Phase 4.

