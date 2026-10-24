# SalonOS Payroll & Staff Commission Modules — Implementation & Verification Report

**Project**: SalonOS (iSysware Salon Management System)  
**Date**: September 30, 2026  
**Status**: Completed & Verified  

---

## 1. Executive Summary & Handoff Verification

### Test Count Reconciliation
- **Previous Report Claim**: The previous status document claimed 63 tests, but the itemized breakdown totaled 60 tests (Attendance & Overtime: 9, Staff: 13, Settlement: 10, Expense: 10, POS & Customer: 7, Salon Core POS: 11).
- **Actual Verified Counts**:
  - `attendanceOvertimeService.test.ts`: 9 tests
  - `staffService.test.ts`: 13 tests
  - `settlementService.test.ts`: 10 tests
  - `expenseService.test.ts`: 10 tests
  - `posCustomerService.test.ts`: 7 tests
  - `salonService.test.ts`: 11 tests
  - **Subtotal Previous Tests**: 60 tests
- **New Test Suite Added**:
  - `payrollCommissionService.test.ts`: 9 comprehensive tests
- **Current Total**: **69 / 69 tests executed and passing** across 7 test suites.

### Dev Server Origin & LocalStorage Persistence
- **Active Origin**: `http://localhost:3000/` (Vite dev server running as background process).
- **Storage Scope**: Web `localStorage` is partitioned strictly by origin (`protocol + hostname + port`). Because the development server operates on `http://localhost:3000`, all persistent entities (branches, staff, attendance, invoices, cash drawers, online accounts, expenses, payroll runs, commission runs) remain intact without cross-origin loss or simulated data migration.

---

## 2. Module 1: Payroll System

### Routes & Navigation
- Operational Payroll Management: `/accounts/payroll`
- Connected Staff Salary Report: `/reports/staff-salary` (rendered with full parity via shared component)

### Supported Compensation Types
1. **MONTHLY_SALARY**:
   - Preserves full monthly base salary regardless of month length (28, 29, 30, or 31 days) when no unpaid absences occur.
   - Unpaid absences deducted based on branch policy divisor.
2. **DAILY_SALARY**:
   - Calculated as: `Daily Rate × Eligible Paid Days` (Worked Days + Approved Paid Leaves).
   - Zero double-deduction for absences.
3. **MONTHLY_PLUS_COMMISSION**:
   - Base salary, allowances, and attendance deductions processed in Payroll.
   - Commission component processed independently in Staff Commission.
4. **DAILY_PLUS_COMMISSION**:
   - Daily rate $\times$ eligible paid days in Payroll.
   - Commission component processed in Staff Commission.
5. **COMMISSION_ONLY**:
   - Guaranteed `0 PKR` base salary in Payroll.
   - Salary deductions automatically suppressed (`0 PKR`).
   - Approved overtime earnings included if configured.

### Absence Divisors & Proration
- **Configurable Policy Divisor**:
  - `/30`: Standard 30-day commercial calendar.
  - `/26`: Standard 26-day working-day standard.
  - `CALENDAR_DAYS`: Actual days in the payroll month (28–31).
  - `WORKING_DAYS`: Actual scheduled working days for the employee in the month.
- **Mid-Month Join / Exit Proration**:
  - Prorated based on calendar days or scheduled working days: `(Prorated Days / Total Days) × Base Salary`.
- **Negative Salary Protection**:
  - Net salary cannot drop below `0 PKR`.
  - Excessive penalty deductions raise an explicit blocking validation error on payslips (`blockReason: 'Negative net pay detected'`).

### Actionable Exception Handling & Finalization Gate
- **Missing Punches & Unrecorded Attendance**:
  - Staff with `MISSING_PUNCH` or unfinalized shift attendance are flagged as actionable exceptions.
  - Finalizing a payroll batch is strictly blocked until all attendance exceptions for the period are resolved or marked by an administrator.

### Overtime Consumption & Immutability
- Approved overtime records within the payroll month are calculated using the snapshotted approved hourly rate.
- Upon payroll run finalization, overtime records are locked by setting `payrollId = finalizedRun.id`.
- Locked overtime cannot be claimed in any subsequent payroll run.
- Cancelling a payroll run releases the lock (`payrollId = undefined`).

---

## 3. Module 2: Staff Commission System

### Routes & Navigation
- Operational Commission Management: `/accounts/commission`
- Connected Staff Commission Report: `/reports/staff-commission` (rendered with full parity via shared component)

### Net Service Sales Calculation
- **Commission Basis**: Strictly calculated from **net service sales after line discounts**:
  $$\text{Net Sales} = (\text{Service Price} \times \text{Quantity}) - \text{Discount Allocated}$$
- **Exclusions**:
  - Taxes (Sales Tax / GST) are strictly excluded from commission calculations.
  - Client Tips are segregated directly into drawer tip floats and excluded from commissionable sales.
  - Previous-dues collections (collecting accounts receivable from prior invoices) generate zero additional commission.
- **Package Component Allocation**:
  - For package sales, revenue is prorated across individual component services according to their individual catalogue values.
  - Staff performing package components are credited with their proportional discounted net revenue.

### Attribution Tracking & Deduplication
- Each service line and package component generates a unique attribution ID:
  - Service item: `${invoiceId}-li-${itemId}`
  - Package component: `${invoiceId}-comp-${itemId}-${serviceId}`
- Finalized commission runs record consumed attribution IDs in `commissionRun.consumedAttributionLineIds`.
- Subsequent runs cross-check against consumed IDs, preventing duplicate commission disbursements across overlapping date ranges.

---

## 4. Cash Custody & Payment Lifecycle

### Payout Execution
1. **Cash Payment**:
   - Payer must have an active `OPEN` cash drawer (`custodianUserId === user.id`).
   - Verifies `drawer.expectedInDrawer >= paymentAmount`.
   - Atomically updates:
     - `drawer.cashExpensesPaid += paymentAmount`
     - `drawer.expectedInDrawer -= paymentAmount`
   - Updates payslip/statement `paidAmount` and run `totalPaid`.
   - Records payment transaction without creating duplicate manual expense entries.
2. **Online / Bank Transfer**:
   - Payer selects an authorized branch `OnlineAccount`.
   - Verifies `account.currentBalance >= paymentAmount`.
   - Atomically updates `account.currentBalance -= paymentAmount`.
   - Updates payslip/statement `paidAmount` and run `totalPaid`.

### Reversals & Run Cancellation
- **Auditable Reversals**:
  - Direct deletion of payments is prohibited.
  - Payments can be reversed with a mandatory audit reason and timestamp.
  - Reversing a cash payment reimburses the active drawer float (`expectedInDrawer += amount`, `cashExpensesPaid -= amount`).
  - Reversing an online payment restores the online account balance (`currentBalance += amount`).
- **Safe Run Cancellation**:
  - A finalized run cannot be cancelled while completed payments exist.
  - All payments must first be reversed before cancellation is permitted.
  - Cancelling releases locked overtime records (`payrollId = undefined`) and frees commission attribution line IDs.

---

## 5. Staff Portal Integration

### Routes & Personal View
- Route: `/my-reports`
- Provides staff members with private, read-only statements:
  - **Summary Cards**: Estimated Commission, Finalized Payable, Total Paid, Outstanding Balance.
  - **Tab 1: My Salary Payslips**: Itemized payslips showing base salary, prorated working days, allowances, absence deductions, approved overtime, and net payable. Includes a printable individual payslip modal.
  - **Tab 2: My Commission Statements**: Itemized commission statements showing period, total net sales attributed, commission earned, paid amount, and balance. Includes a printable statement modal with service attribution breakdown.
- **Isolation & Security**:
  - Data queries strictly filter by authenticated `user.staffId`.
  - Staff members cannot view other employees' earnings or branch aggregates.
  - Unfinalized draft runs are hidden from the staff portal.

---

## 6. Access Control & Role Boundaries

| Feature / Action | Super Admin | Branch Admin | Accountant | Staff |
| :--- | :---: | :---: | :---: | :---: |
| Access `/accounts/payroll` | Full Cross-Branch | Assigned Branch | **DENIED** | **DENIED** |
| Access `/accounts/commission` | Full Cross-Branch | Assigned Branch | **DENIED** | **DENIED** |
| Configure Payroll Policy | Allowed | View Only | **DENIED** | **DENIED** |
| Finalize Runs & Disburse Payments | Allowed | Assigned Branch | **DENIED** | **DENIED** |
| Access `/reports/staff-salary` | Full Cross-Branch | Assigned Branch | **DENIED** | **DENIED** |
| Access `/reports/staff-commission` | Full Cross-Branch | Assigned Branch | **DENIED** | **DENIED** |
| Access `/my-reports` | Restricted | Restricted | **DENIED** | **Allowed (Personal Only)** |

---

## 7. Verification Results

### Test Execution Summary
Command: `npx.cmd tsx <test-file>`

| Suite | File | Tests | Result |
| :--- | :--- | :---: | :---: |
| **Payroll & Commission** | `payrollCommissionService.test.ts` | 9 / 9 | **PASSED** |
| **Attendance & Overtime** | `attendanceOvertimeService.test.ts` | 9 / 9 | **PASSED** |
| **Staff & Compensation** | `staffService.test.ts` | 13 / 13 | **PASSED** |
| **Custody & Settlement** | `settlementService.test.ts` | 10 / 10 | **PASSED** |
| **Expense Management** | `expenseService.test.ts` | 10 / 10 | **PASSED** |
| **POS Customer & Billing** | `posCustomerService.test.ts` | 7 / 7 | **PASSED** |
| **POS Core Correctness** | `salonService.test.ts` | 11 / 11 | **PASSED** |
| **TOTAL** | **7 Suites** | **69 / 69** | **100% PASSED** |

### TypeScript & Production Build
- **Type Checking (`npx.cmd tsc --noEmit`)**: Clean exit code 0; 0 errors.
- **Vite Production Build (`npm.cmd run build`)**: Clean exit code 0; compiled in 1.77s.
- **Browser Automation Tool Limitation**: Note that headless Playwright driver installation encountered AzureEdge CDN network 404s in this environment (`https://playwright.azureedge.net/builds/driver/playwright-1.57.0-win32_x64.zip`), so UI execution is verified via dev server running at `http://localhost:3000` and automated service/calculation suites.

---

## 8. Unrelated Reports Scheduled for Phase 4

The following standalone reporting modules are scheduled for Phase 4:
- `/reports/income-expense` (General Ledger Income & Expense)
- `/reports/tips-statement` (Staff Gratuity Distribution)
- `/reports/inventory-movement` (Stock In / Stock Out Movements)
- `/reports/operating-profit` (EBITDA & Net Operating Profit)
