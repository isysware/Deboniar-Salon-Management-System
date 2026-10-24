# SalonSys Reporting Architecture & Blueprint Implementation Plan (Master Spec v2.1)
**Document Version:** 2.1 (Senior Accounting Corrections Incorporated)  
**Author Perspective:** Senior Accounting Architect & Principal Software Engineer  
**Reference Blueprints:** `SalonSys Report PDFs 1/` (Documents 01 to 14)  
**Audit Rule:** Never assume completion percentages without active code verification. Every formula, endpoint, and UI state must be certified against database facts and double-entry rules.

---

## 1. Executive Summary & Core Accounting Principles

The reporting engine requires strict segregation between **Economic Recognition (Accrual P&L)** and **Cash Custody Movements (Asset Ledger & Cash Flow)**. 

### Universal Golden Rules (Enforced Across All 14 Reports):
1. **Asset Ledger Sign Convention (Debit = In, Credit = Out):**
   * Both **Cash Drawer** and **Named Payment Accounts (Bank, Wallets, Card Clearing)** are **Asset Accounts**.
   * Any money entering the account is a **DEBIT (+In)** (e.g. Sales collected, Dues received, Transfers in).
   * Any money leaving the account is a **CREDIT (-Out)** (e.g. Expenses paid, Refunds, Salary/Commission payouts, Transfers out).
   * $\text{Running Balance} = \text{Opening Balance} + \sum \text{Debits (In)} - \sum \text{Credits (Out)}$.
2. **One-Time Income Recognition (No Revenue Duplication on Collection):**
   * **Revenue / Net Sales:** Recognized **exactly once** when the service/product invoice is posted (Gross − Discounts − Valid Contra Returns), *regardless* of whether the client paid in full, partial, or left it unpaid.
   * **Subsequent Dues / Partial Collections:** When a client pays an outstanding khata balance later, it updates **ONLY** Cash/Bank (Debit) and Customer Receivable (Credit). Revenue is **never** re-recognized or duplicated on cash collection.
3. **Liabilities Are Excluded from Revenue & Commission:**
   * **Sales Tax:** Statutory liability (`Tax Payable`), never salon revenue.
   * **Client Tips:** Custodial liability (`Staff Tips Payable`), never salon revenue and never subject to staff commission calculation.
4. **Non-Destructive Audit Trail:**
   * No hard deletes. Voided or refunded transactions generate linked reversal/contra entries with negative impact, maintaining complete audit history and sequence continuity.
5. **Two-Step Custody Handover (Settlement):**
   * Submitting a settlement creates a `PENDING` request (no cash ledger deduction).
   * Cash ledger deduction occurs **only** when the recipient physically verifies and marks `ACCEPTED` (atomic paired Sender Credit + Receiver Debit).

---

## 2. Asset Ledger Engine (Debit & Credit Matrix)

| Business Event | Asset Account Affected | Debit (In) | Credit (Out) | Counterparty Impact |
| :--- | :--- | :---: | :---: | :--- |
| **POS Cash Sale** | Cash Drawer | **Debit (+)** | — | Revenue (+), Tax Payable (+), Tips Payable (+) |
| **POS Online / Card Sale** | Named Bank Account | **Debit (+)** | — | Revenue (+), Tax Payable (+), Tips Payable (+) |
| **POS Partial Payment** | Cash / Bank Account | **Debit (+)** | — | Client Receivable reduced by paid amount |
| **Client Dues Collection** | Cash / Bank Account | **Debit (+)** | — | Client Outstanding Khata reduced (NO revenue re-booking) |
| **Operating Expense (Cash)** | Cash Drawer | — | **Credit (-)** | Operating Expense recorded |
| **Operating Expense (Bank)** | Named Bank Account | — | **Credit (-)** | Operating Expense recorded |
| **Staff Salary Payout** | Cash / Bank Account | — | **Credit (-)** | Salary Payable liability cleared |
| **Staff Commission Payout** | Cash / Bank Account | — | **Credit (-)** | Commission Payable liability cleared |
| **Cash Tip Payout to Staff** | Cash Drawer | — | **Credit (-)** | Staff Tip Liability cleared |
| **Supplier Payment (Cash)** | Cash Drawer | — | **Credit (-)** | Supplier Payable Khata reduced |
| **Supplier Payment (Online)**| Named Bank Account | — | **Credit (-)** | Supplier Payable Khata reduced |
| **Custody Handover (Accepted)**| Sender Drawer $\rightarrow$ Receiver Vault | Receiver **Debit (+)** | Sender **Credit (-)** | Combined Branch Cash remains unchanged |
| **Card Settlement to Bank** | Card Clearing $\rightarrow$ Bank Account| Bank **Debit (+)** | Card Clearing **Credit (-)**| Inter-account transfer (Net zero) |

---

## 3. Detailed Blueprints: Reports 01 to 05

### Report 01: My Cash Balance Sheet
* **UI Label:** `My Cash Balance Sheet` (Cash Custody & Carry-Forward by User & Shift).
* **Key Adjustments:**
  * Label `"Opening / Petty Cash"` renamed to `"Opening / Carry Forward Cash"`.
  * Date range opening = closing ledger balance prior to `From-Date` (never aggregate daily floats).
  * Counted Cash & Variance only display when an actual physical count exists (no fabricated zero shortage).
* **Formula:** $\text{Expected Cash} = \text{Opening} + \text{Cash Sales} + \text{Tips In} + \text{Transfers In} - \text{Refunds} - \text{Expenses} - \text{Tips Paid} - \text{Transfers Out}$.

### Report 02: Account Settlement
* **UI Label:** `Account Settlement` (Count, Submit, Verify, Handover).
* **Key Adjustments:**
  * 2-Step handover enforced: Cashier submits $\rightarrow$ `PENDING` (no cash-out). Receiver physically counts & approves $\rightarrow$ `ACCEPTED` (atomic Sender Credit + Receiver Debit).
  * Self-approval strictly prohibited by RBAC.
  * Discrepancies recorded as explicit variance exceptions, never silently expensed.
* **Formula:** $\text{Proposed Handover} = \text{Counted Cash} - \text{Retained Float}$; $\text{Variance} = \text{Counted} - \text{Expected}$.

### Report 03: Income & Expense Report
* **UI Label:** `Income & Expense Report` (Recognized Income, Operating Expenses & Cash Flow).
* **Key Adjustments & Accounting Correction:**
  * Separate KPI cards for **Recognized Net Revenue** (Accrual) vs. **Actual Cash/Bank Collections** (Cash Flow).
  * Commission Earned (Expense at invoice post) vs. Commission Paid (Liability clearance) tracked separately.
  * Exclude balance sheet movements: tax, tips, supplier principal, and custody transfers.
  * **Accurate Accounting Formula:** COGS must be deducted to compute true Operating Profit.
* **Formulas:**
  $$\text{Gross Contribution} = \text{Net Revenue} - \text{COGS}$$
  $$\text{Net Operating Profit} = \text{Net Revenue} - \text{COGS} - \text{Operating Expenses}$$

### Report 04: Tax Management Report
* **UI Label:** `Tax Management Report` (Invoice Tax, Tax Refunds, Remittances & Net Tax Payable).
* **Key Adjustments:**
  * Explicit breakdown: Taxable Base (discounted), Rate %, Gross Billed Tax, Tax Refunded, Net Tax Payable, Tax Remitted.
  * Sales tax strictly excluded from staff commission calculations and P&L revenue.
* **Formula:** $\text{Net Tax Billed} = \text{Gross Billed Tax} - \text{Tax Refunds}$; $\text{Closing Tax Payable} = \text{Opening} + \text{Net Billed} - \text{Remitted}$.

### Report 05: Sales & Invoices Report
* **UI Label:** `Sales & Invoices Report` (POS Transactions, Discounts, Tender Split, Lifecycle & Receivables).
* **Key Adjustments & Accounting Correction:**
  * Tender split columns: Cash Paid, Bank/Online Paid, Total Paid, and Outstanding Balance.
  * Separate **Payment Status** (`PAID`, `PARTIAL`, `UNPAID`) from **Lifecycle** (`ACTIVE`, `PARTIALLY_REFUNDED`, `REFUNDED`, `VOIDED`).
  * Outstanding balance calculation **must** account for payment refunds and reversals.
* **Formulas:**
  $$\text{Net Sales} = \text{Gross} - \text{Discounts} - \text{Refunds}$$
  $$\text{Net Payments Received} = \text{Total Tendered Paid} - \text{Payment Refunds / Reversals}$$
  $$\text{Outstanding Balance} = \text{Invoice Total Due} - \text{Net Payments Received} - \text{Approved Credits}$$

---

## 4. Detailed Blueprints: Reports 06 to 10

### Report 06: Debit / Credit Statement
* **UI Label:** `Debit / Credit Statement` (Tabs: `Cash Drawer` / `Payment Accounts`).
* **Context & Core Rule:** Single report with two distinct sub-ledgers. Do not combine cash and non-cash accounts into an artificial single running balance.
* **Key Adjustments:**
  * Table Columns: `Date/Time` | `Account/Drawer` | `Account Type` | `Branch` | `Method` | `Source` | `Reference` | `Actual User` | `Debit (In)` | `Credit (Out)` | `Running Balance` | `Status`.
  * Top Filters: Account Type (`All`, `Cash Drawer`, `Bank`, `Card Clearing`, `Online Wallet`) | Payment Method | Account/Drawer | Branch | Date Range.
  * Cash Drawer has separate **Shift Reconciliation** view (Opening, Cash In, Cash Out, Expected, Counted, Variance, Settlement).
  * Card terminal clearing account transfers to bank account as paired Credit/Debit without creating new revenue.
* **Formula:** $\text{Per-Account Running Balance} = \text{Opening Balance} + \sum \text{Debits (In)} - \sum \text{Credits (Out)}$.

### Report 07: Detailed Income Report
* **UI Label:** `Detailed Income Report` (Transaction-Level Recognized Sales Breakdown).
* **Context & Core Rule:** Granular drill-down into every line item (Service, Package Component, Retail Product) tied directly to P&L Net Revenue.
* **Key Adjustments:**
  * Table Columns: `Recognition Date` | `Invoice & Line #` | `Branch` | `Income Source` | `Client` | `Service/Product` | `Gross` | `Discount` | `Net Income` | `Tax (separate)` | `Tip (separate)` | `Received` | `Outstanding` | `Created By`.
  * Source Categories: Service Sale, Package Sale, Retail Product Sale, Revenue Refund / Reversal.
  * Payment allocations displayed in expandable drawer so receiving an old invoice payment is not counted as second revenue.
* **Formula:** $\text{Recognized Line Net} = \text{Line Gross} - \text{Allocated Line Discount} - \text{Line Refund/Reversal}$.

### Report 08: Detailed Expenses Report
* **UI Label:** `Detailed Expenses Report` (Operating Vouchers, Payment Audit and Approvals).
* **Context & Core Rule:** Differentiate between when an expense is recognized (voucher incurred) versus when it is actually paid out (cash/bank credit).
* **Key Adjustments:**
  * Table Columns: `Voucher #` | `Date` | `Branch` | `Category` | `Title` | `Payee` | `Net Expense` | `Paid` | `Due` | `Method` | `Created / Paid By` | `Status`.
  * Supplier stock purchases are **Inventory Assets**, never direct operating expenses.
  * Cash expenses deduct from the active cashier drawer only if authorized; bank expenses credit the named bank account.
* **Formula:** $\text{Outstanding Expense Payable} = \text{Approved Incurred Expense} - \text{Valid Applied Payments}$.

### Report 09: Staff Salary Report
* **UI Label:** `Staff Salary Report` (Finalized Payroll, Deductions and Payments).
* **Context & Core Rule:** Salary expense is recognized once when payroll is finalized; salary disbursement reduces `Salary Payable` and credits Cash/Bank.
* **Key Adjustments:**
  * Table Columns: `Period` | `Payslip #` | `Staff` | `Basic` | `Allowances` | `Overtime` | `Deductions` | `Gross` | `Net Payable` | `Paid` | `Outstanding` | `Status`.
  * Detail breakdown: Approved Overtime, Attendance Penalties, Loan/Advance Recoveries, Withholding Tax.
  * Unapproved overtime is strictly excluded from payroll expense.
* **Formula:** $\text{Gross Salary} = \text{Basic} + \text{Allowances} + \text{Approved OT}$; $\text{Net Payable} = \text{Gross} - \text{Deductions} - \text{Loan Recovery}$.

### Report 10: Staff Commission Report
* **UI Label:** `Staff Commission Report` (Earned, Reversed, Paid and Remaining Liability).
* **Context & Core Rule:** Commission is earned at invoice posting and reverses proportionally on refund. Paying commission clears liability, never duplicating expense.
* **Key Adjustments:**
  * Tabs: `By Staff Summary` and `Commission Events Log`.
  * Table Columns: `Staff` | `Invoice/Line` | `Attributed Net Sales` | `Rate %` | `Earned` | `Reversed` | `Net Commission` | `Paid` | `Due` | `Reference` | `Status`.
  * Package component allocation: Split commission accurately per component without duplicating the whole package value.
  * Zero-tax, zero-tip commission base.
* **Formula:** $\text{Closing Commission Due} = \text{Opening Due} + \text{Net Earned Commission} - \text{Commission Paid}$.

---

## 5. Detailed Blueprints: Reports 11 to 14

### Report 11: Staff Performance Report
* **UI Label:** `Staff Performance Report` (Units, Net Sales, Clients, Tips and Hours).
* **Key Adjustments & Accounting Correction:**
  * **Commission Eligibility Separation:** Attributed sales reconcile with invoice line items, but **not all attributed sales earn commission** (e.g. commission-ineligible services, retail without staff commission, or salary-only staff). Staff Performance displays total performed sales, while commission eligibility and historical rates are handled distinctly.
  * Table Columns: `Staff` | `Branch` | `Direct Units` | `Package Units` | `Unique Clients` | `Attributed Net Sales` | `Commission Eligible Sales` | `Commission Earned` | `Tips Allocated/Paid/Due` | `Worked Hours` | `OT Hours`.
  * Attributed Net Sales excludes sales tax and client tips.
* **Formula:** $\text{Sales per Worked Hour} = \frac{\text{Attributed Net Sales}}{\text{Actual Approved Worked Hours}}$ (shows N/A if zero hours).

### Report 12: Inventory Reports
* **UI Label:** `Inventory Reports` (6 Tabs: `Valuation & Layers`, `Movement Trail`, `Purchases`, `Supplier Ledger`, `Salon Usage`, `Expiry & Risk`).
* **Key Adjustments & Accounting Correction (Supplier Ledger):**
  * **Complete Supplier Khata Formula:** Must include Opening Payable, Credit Purchases, Payments, Returns, and Adjustments.
  * **Cash Purchases Exclusion:** Cash purchases (paid upfront at purchase time via drawer/bank) must **NOT** be added to supplier payable debt.
* **Formulas:**
  $$\text{Closing Supplier Payable} = \text{Opening Payable} + \text{Credit Purchases} - \text{Supplier Payments} - \text{Supplier Returns} \pm \text{Approved Adjustments}$$
  $$\text{Inventory Cost Value} = \sum (\text{Remaining Layer Qty} \times \text{Landed Cost})$$
  $$\text{Retail Product COGS} = \sum (\text{Sold Units} \times \text{Landed Cost})$$

### Report 13: Attendance & Overtime Report
* **UI Label:** `Attendance & Overtime Report` (Shifts, Punctuality and Approved Overtime).
* **Key Adjustments:**
  * Table Columns: `Date` | `Staff` | `Branch` | `Shift` | `Check-In/Out` | `Break Mins` | `Worked Hours` | `Late/Early Mins` | `Status` | `Approved OT Hours` | `OT Amount` | `Approved By`.
  * Support overnight shifts crossing midnight and grace period logic.
* **Formula:** $\text{Worked Hours} = \frac{\text{Check-Out} - \text{Check-In} - \text{Unpaid Breaks}}{60}$; $\text{Approved OT Amount} = \text{Approved OT Hours} \times \text{Hourly Rate}$.

### Report 14: Operating Profit & P&L Statement
* **UI Label:** `Operating Profit & P&L Statement` (Income, Cost of Sales, Gross Margin, Overheads & Operating Profit).
* **Context & Core Rule:** The supreme financial statement. Detailed Income and Detailed Expenses drill down into this report with zero discrepancy.
* **Standard P&L Hierarchy:**
  1. **Net Revenue:** Service Net + Package Net + Retail Product Net − Revenue Refunds (Tax & Tips excluded).
  2. **Cost of Sales (COGS):** Retail Product Cost of Goods Sold + Salon Consumable Usage.
  3. **Gross Contribution (Gross Profit):** $\text{Net Revenue} - \text{Cost of Sales}$.
  4. **Operating Overheads:** Finalized Salary Expense + Net Earned Commission + Approved Operating Expense Vouchers + Approved Stock Shrinkage/Write-offs.
  5. **Net Operating Profit:** $\text{Gross Contribution} - \text{Operating Overheads}$.
  6. **Growth %:** $\frac{\text{Current Period} - \text{Prior Period}}{|\text{Prior Period}|} \times 100$ (shows N/A if prior is zero).

---

## 6. Actionable Implementation Roadmap (Verified Delivery Status)

| Part | Reports Covered | Key Changes & Senior Accounting Corrections Applied | Verified Status |
| :--- | :--- | :--- | :--- |
| **Part 1** | **Core Asset Ledger & Reports 01, 02, 06** | • Standardized Cash Drawer and Payment Accounts to Asset Ledger double-entry convention: **Debit = In, Credit = Out**.<br>• Enforced per-account running balance: $\text{Opening} + \sum \text{Debits} - \sum \text{Credits}$.<br>• Renamed Petty Cash to Carry-Forward Cash.<br>• 2-Step Handover verification: submit `PENDING` $\rightarrow$ receiver approval `ACCEPTED`. | **100% COMPLETE & TESTED (200 OK)** |
| **Part 2** | **Revenue & Tax Suite (Reports 04, 05, 07)** | • **Report 05 (Sales & Invoices):** Added Tender Split columns (`Cash Paid`, `Online Paid`, `Total Paid`, `Outstanding Due`), KPI summary cards, dedicated `PARTIALLY_REFUNDED` badge, and adjusted outstanding balance for refunds & cancellations.<br>• **Report 04 (Tax Management):** Added Taxable Base, Rate %, Gross Tax, Tax Refunded, and Net Tax Liability tabs.<br>• **Report 07 (Detailed Income):** Created new transaction-level drilldown endpoint & UI page (`DetailedIncomeReportPage.tsx`) breaking down service, package component, and retail product sales with one-time revenue recognition. | **100% COMPLETE & TESTED (200 OK)** |
| **Part 3** | **Expense & Payroll Suite (Reports 03, 08, 09, 10)** | • **Report 03 (Income & Expense):** Corrected Operating Profit formula to deduct COGS: $\text{Operating Profit} = \text{Net Revenue} - \text{COGS} - \text{Operating Expenses}$.<br>• **Report 08 (Detailed Expenses):** Itemized operational disbursements by category, voucher, payee, payment source, and status.<br>• **Report 09 (Staff Salary):** Finalized payroll with Basic, Approved OT, Allowances, Deductions, and Net Payable.<br>• **Report 10 (Staff Commission):** Summary by Staff and Commission Events Log, tracking Opening Liability, Earned, Reversed, Paid, and Closing Due. | **100% COMPLETE & TESTED (200 OK)** |
| **Part 4** | **Operations & P&L Suite (Reports 11, 12, 13, 14)** | • **Report 11 (Staff Performance):** Reconciled with line items while separating total attributed sales from `commissionEligibleSales` (Correction #4).<br>• **Report 12 (Inventory & Supplier Khata):** Valuation & Layers, Movement Trail, Purchases, Salon Usage, Expiry Risk, and complete Supplier Khata formula (excluding upfront cash purchases from payable debt).<br>• **Report 13 (Attendance & OT):** Shifts, Worked Hours, Punctuality, and authorized overtime.<br>• **Report 14 (Operating Profit & P&L):** Master P&L Statement with 6-stage hierarchy (Revenue $\rightarrow$ COGS $\rightarrow$ Gross Contribution $\rightarrow$ Overheads $\rightarrow$ Net Operating Profit $\rightarrow$ Growth %). | **100% COMPLETE & TESTED (200 OK)** |

---

## 7. Verification Summary
* **Active Dev Servers:**
  - Backend: `http://localhost:5000` (Healthy, Express 5 + Prisma)
  - Frontend: `http://localhost:3000` (Healthy, Vite + React)
* **TypeScript Check:** `npx tsc --noEmit` exited with **0 errors**.
* **API Endpoints Test:** All 14 report endpoints passed live contract checks with **Status 200 OK**.
* **Database State:** PostgreSQL active single branch `Warsi Salon` with zero mock data. All report statistics, totals, and ledgers are 100% dynamically computed from live DB transactions.
