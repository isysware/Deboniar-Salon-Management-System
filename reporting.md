# SalonOS — Reporting & Analytics (Context + Material Flow + Formulas + Build Plan)

> Created: 2026-10-07 · Source: `SalonOS Reporting Inventory Financial Flow Specification.pdf` v1.0 (all 15 sections) + current code.
> Backend: `src/modules/reports`, `src/modules/inventory` (COGS), `src/modules/cash` (drawers/accounts), `src/modules/tips`, `src/modules/payroll`, `src/modules/commission`
> Frontend: `src/features/reports/*`, `src/config/navigation.ts` (Reporting & Analytics group)
> Related: `payroll.md` (salary/commission), `Salon Software Frontend/TIPS_PERFORMANCE_STATUS.md` (tips)

---

## 1. Locked accounting rules (must never break)

| # | Rule | Spec |
|---|---|---|
| 1 | **Tax is a liability**, never income, profit or commission base. | Cover, §3.1, §15.3 |
| 2 | **Tips are a staff liability**, never income, profit or commission base. | Cover, §3.1, §15.3 |
| 3 | **Discounts reduce net sales** before commission and tax base. | §3.1, §15.3 |
| 4 | **Commission** = staff-attributed net sales after discounts and reversals, excluding tax and tips. | §4 |
| 5 | **Inventory is valued at historical cost layers**, never at POS selling price. | §5.2 |
| 6 | **Purchases and supplier payments are not COGS.** COGS happens on product sale; material cost happens on salon consumption. | §5.4, §6 |
| 7 | **Bank/online accounts always show** opening, money in, money out, transfers, closing. | §7.1 |
| 8 | **In-house use** is shown separately by quantity and cost. | §5.4, §15.3 |
| 9 | **Nothing financial is deleted.** Original invoices, purchases and events stay; corrections are dated events. | §13, §15.3 |
| 10 | **Refunds/reversals are dated events.** A current REVERSED/REFUNDED/VOIDED status must never erase what happened in a prior period. | §13 |
| 11 | **A report is never the source of truth.** Reports only aggregate canonical records; they never store or invent balances. | §1, §2 |
| 12 | **Reports are read-only.** Mutations stay in source modules (Sales & Invoices may hand off to the invoice for void/refund). | §1 |
| 13 | **Money in decimal**, never binary float; allocation remainder goes to the last/largest component. | §8.3 |
| 14 | **Exports keep on-screen precision** (PKR rounding identical in PDF/Excel/Print). | §8.2 |

---

## 2. Final Reporting & Analytics menu — only these 11 pages (§1)

| # | Report | Purpose |
|---|---|---|
| 1 | Income & Expense | Recognized business income and operating expenses; excludes tax, tips, transfers, supplier-payable settlement |
| 2 | Sales & Invoices | Posted invoices, discounts, tax, tips, payments, outstanding, void/refund lifecycle and sales reversals |
| 3 | Payment Accounts | Named bank/online accounts: opening, in, out, transfers, closing |
| 4 | Cash Drawer Logs | Physical cash custody by user/session: expected, counted, variance, settlements |
| 5 | Detailed Expenses | Expense transactions by category, user, branch, payment source |
| 6 | Staff Salary Report | Finalized payroll, earnings/deductions, paid, outstanding |
| 7 | Staff Commission Report | Attributed net sales, rate snapshots, earned/reversed/paid/outstanding |
| 8 | Staff Performance | Completed work, attributed sales, visits, attendance |
| 9 | Inventory Reports | Stock, valuation, purchases, movements, suppliers, expiry, consumption, COGS, product profit |
| 10 | Attendance & Overtime | Attendance, leave, hours, lateness, authorized manual overtime |
| 11 | Operating Profit | Net sales − product COGS − material consumption − operating expenses |

**No extra report-menu pages.** Tax, appointments, tips statement, unpaid invoices and settlement history may exist as **source-module views/subviews**, not as items in the Reporting sidebar. Tax summaries live inside Sales & Invoices / Payment Accounts / Operating Profit.

---

## 3. Material flow — source event → canonical record → report (§2)

**Golden rule:** operational modules post immutable/auditable events; reports aggregate them with explicit date and status rules.

```
 Appointment ──(no money, no stock, no commission)──► POS Invoice
                                                          │
            ┌──────────────┬──────────────┬───────────────┼────────────────┬──────────────┐
            ▼              ▼              ▼               ▼                ▼              ▼
      Payment Receipt   Net Sales     Tax liability   Tip liability   Commission EARN   Stock OUT (product)
      (drawer/account)  (revenue)     (not income)    (not income)    (liability)       + COGS at layer cost
            │
            ▼
 Refund / Void / Credit  → dated reversal: sales↓, tax↓, tip per actual state, commission REVERSAL,
                           RETURN_IN at original cost (resalable) or DAMAGED_OUT, money OUT only if received

 Purchase ─► Inventory IN (landed cost layers) + Supplier Payable (credit part) + Cash/Account OUT (paid part)
 Supplier Payment ─► Payable↓ + Cash/Account OUT          (never expense, never COGS)
 Salon consumption ─► Stock OUT + material-consumption cost (no sale)
 Expiry / damage / shortage ─► Stock OUT + write-off/loss
 Expense ─► Operating expense + Cash/Account OUT if paid
 Payroll finalize ─► Salary expense + salary liability;  Salary payment ─► liability↓ + money OUT
 Commission event ─► Commission expense + liability;     Commission payout ─► liability↓ + money OUT
 Tip payout ─► Tip liability↓ + money OUT                 (never expense)
 Settlement / Transfer ─► custody moves between users/accounts (never income/expense)
```

| Source event | Canonical record | Report consequence |
|---|---|---|
| Appointment | Customer + schedule + quote + assignments | No sale, commission or stock until POS posting |
| POS Invoice | Final lines, discounts, tax, tips, staff attribution | Sale history; invoice immutable |
| Payment Receipt | Cash / named account / split | Money into drawer/account; no second sale |
| Refund / Void / Credit | Dated reversal/credit | Reduces effective sale; may refund money; never deletes invoice |
| Purchase | Supplier + cost layers + terms | Inventory ↑; credit part → supplier payable |
| Supplier Payment | Supplier ledger + outflow | Payable/advance ↓; never COGS |
| Stock Movement | Purchase in, POS out, consumption, return, adjustment | **Only** way quantity changes |
| Payroll Finalization | Salary expense/liability snapshot | Payment settles liability; never expensed twice |
| Commission Event | Earn/reversal from attributed net sales | Payout settles liability; no second expense |
| Tip Event | Collection/allocation/payout/reversal | Never revenue or commission base |
| Expense | Operating expense + payment source | Expense; if paid, cash/account out |
| Settlement/Transfer | Custody/account transfer | Not income or expense |

### Data lineage & date basis per report

| Report | Primary sources | Default date basis |
|---|---|---|
| Income & Expense | Invoices/refunds, expenses, finalized payroll, commission earn/reversal, write-offs (if operating loss) | Recognition date (not payment date) |
| Sales & Invoices | Invoices, lines, receipts, credit/refund events, customer/staff snapshots | Invoice posting date; refund event date for reversals |
| Payment Accounts | Account movement ledger | Movement timestamp |
| Cash Drawer Logs | Drawer sessions + cash movements + settlements | Movement/session timestamp |
| Detailed Expenses | Expense records + account/drawer link | Expense/posting date |
| Salary | Finalized payroll + salary payments | Payroll period / finalized date; payment date separately |
| Commission | Earn/reversal events + payouts | Event date; payout date separately |
| Staff Performance | Invoice attribution + completed appointments + attendance | Underlying event date |
| Inventory | Stock movements, batches, purchases, supplier ledger | Movement date; valuation as-of date |
| Attendance & Overtime | Attendance, leave, manual overtime | Work date |
| Operating Profit | Sales/refunds + COGS + consumption + expenses + payroll + commission + write-offs | Recognition dates across sources |

---

## 4. Formulas

### 4.1 Invoice, tax, payment (§3)
```
Line Gross          = Quantity × Unit Selling Price
Line Net Sales      = Line Gross − Line Discount − Allocated Invoice Discount
Invoice Net Sales   = Σ valid line net sales − valid net-sales reversals
Tax Charged         = Σ (Taxable Line Net Sales × Tax Rate)      ← after discount
Invoice Total       = Net Sales + Tax + Tip

Effective Invoice Total = Original Total − Approved Credit/Refund Document Total
Net Applied Payments    = Valid Receipts − Customer refunds that de-apply those receipts
Outstanding             = max(0, Effective Invoice Total − Net Applied Payments)
Payment Status          = UNPAID (0) | PARTIALLY_PAID (0 < paid < total) | PAID (paid ≥ total)
Lifecycle (independent) = ACTIVE | PARTIALLY_REFUNDED | REFUNDED | VOIDED

Net Tax Liability   = Tax charged on valid invoices − Tax reversed on refunds/credits
Tax Reversal        = Refunded taxable net × ORIGINAL tax rate snapshot
```
Partially paid invoices: do not call all invoiced tax "cash collected".

**Example (§3.4):** Gross 10,000 − discount 1,000 = **net 9,000**; tax 10% = 900; tip 500; invoice total 10,400.
Revenue in reports = **9,000 only**. Commission base excludes the 900 tax and 500 tip.

### 4.2 Commission (§4)
```
Service:  Commission = Service line net (after discounts) × rate snapshot
Package:  Package Net = Price − discounts allocated to package
          Component Net = Package Net × saved component weight
          Staff Attributed Net = Σ component nets performed by that staff
          Commission = Staff Attributed Net × rate snapshot
Reversal = Refunded attributed net × ORIGINAL rate snapshot (dated on refund date)
Net Commission Liability = Earned − Reversed − Paid
```
Adding staff never multiplies the package price. Example: package 5,000 → Ali 60% @10% = 300, Ahmed 40% @15% = 300.
Only one component refunded → reverse only that component.

### 4.3 Tips (§4.4)
```
Tip Liability Closing = Opening + Collected + Reversals restoring liability − Payouts − Valid tip refunds
```
Payout on Sep 30 reversed on Oct 1 → September keeps the payout; October records the reversal.

### 4.4 Inventory (§5)
```
Line Net Merchandise Cost   = Qty × Unit Price − Line Discount
Allocated Header Discount   = Header Discount × (Line Net / Σ Line Nets)
Allocated Capitalizable Chg = Charges × (Line Net / Σ Line Nets)
Landed Line Cost            = Line Net − Allocated Header Discount + Allocated Charges
Landed Unit Cost            = Landed Line Cost / Received Qty           (immutable after posting)

Batch Qty On Hand    = Σ posted IN − Σ posted OUT
Inventory Cost Value = Σ (Remaining Qty × historical landed unit cost)
Potential Retail     = Sellable Qty × current POS price   (informational only — never COGS/profit)

Layer selection: FEFO for expiry-tracked; FIFO by received date otherwise; expired/quarantined blocked.
Product Sale COGS    = Σ (qty from each layer × that layer's landed cost)
Product Gross Profit = Product Net Sales − Product COGS
In-house Use Cost    = Σ consumed qty × layer cost
Write-off Cost       = Σ expired/damaged/missing qty × layer cost
```

### 4.5 Supplier ledger (§6.1)
```
Supplier Closing Payable = Opening + Credit Purchases − Payments − Returns/Credits ± Approved Adjustments
(< 0 → show the absolute amount as Supplier Advance/Credit; never clamp to 0)
```

### 4.6 Payment accounts & cash drawer (§7)
```
Account Closing = Opening + Money In − Money Out + Transfer In − Transfer Out ± Approved Adjustments

Expected Drawer Cash = Opening Float + Cash Sales/Receipts + Approved Cash In − Cash Refunds
                       − Cash Expenses − Accepted Settlements Out ± Approved Cash Adjustments
Drawer Variance      = Physical Count − Expected
Remaining Cash       = Expected − Accepted Settlement (or configured carry-forward)
```
Opening float = custody, not income. Settlement to Admin = custody transfer. Old dues in cash ↑ drawer, no new sale. Cash tips ↑ drawer but stay staff liability.
A bank receipt of 10,400 can hold revenue 9,000 + tax 900 + tip 500 — **cash flow ≠ income**.

### 4.7 Operating profit (§11.2)
```
Total Net Sales    = Net Service/Package Sales + Net Product Sales     (after dated refunds)
Gross Contribution = Total Net Sales − Product COGS − Salon Material Consumption
Operating Profit   = Gross Contribution − Operating Expenses − Salary Expense − Commission Expense
                     − Inventory Write-off/Loss − Other Recognized Operating Expenses
Operating Margin % = Operating Profit / Total Net Sales × 100   (when Total Net Sales > 0)
```
Excluded from profit: tax, tips, supplier payments, inventory purchases, dues collections, settlements, transfers.

| Event | Bank/Cash | Revenue/Profit |
|---|---|---|
| Customer pays 9,000 + tax 900 + tip 500 | +10,400 | Revenue +9,000; +900 tax liability; +500 tip liability |
| Tax remittance 900 | −900 | Tax liability ↓; not expense |
| Tip payout 500 | −500 | Tip liability ↓; not expense |
| Supplier payment 5,000 | −5,000 | Payable ↓; not COGS/expense |
| Settlement between users 20,000 | transfer | None |

### 4.8 Opening / closing (§13.1)
```
Opening Balance = Σ valid dated events before start date
Period Movement = Σ valid dated events in range
Closing Balance = Opening + Movement
```
Applies to: payment accounts, supplier payable/advance, tip liability, commission liability, salary payable, inventory qty/value (as-of), customer receivables, drawer custody.

---

## 5. Universal report controls & UI (§1, §8)

**Screen pattern:** Title + one-line description → compact filter row → KPI/total strip → dense table → footer totals → PDF / Excel / Print. Mobile: filters collapse into a filter sheet.

| Control | Behavior |
|---|---|
| Branch | Super Admin/Owner: All or one branch. Admin/Accountant: fixed own branch |
| Date preset | Today, Yesterday, This Week, This Month, Last Month, Custom Range — page states what the date means |
| From / To | Enabled for Custom; clear timezone/date-basis label (Asia/Karachi) |
| User Type / User | Where the report has an actor; Owner can pick any authorized user |
| Report filters | Status, payment method, category, item, supplier, staff, invoice state, etc. |
| Apply / Reset | Filter state preserved during drill-down |

**Exports:** PDF (salon name/logo, title, branch, date basis/range, filters, generated by/at, KPIs, table) · Excel (filtered rows only, typed numeric/date columns, summary rows, no screenshots) · Print (same as PDF, no buttons). PKR precision identical to screen.

**Access (§15.1):** Super Admin/Owner all branches (read-only consolidated) · Admin own branch · Accountant own-branch financial reports (POS/billing/dues/supplier-payment/accounts), no stock-admin · Staff only personal attendance/performance.
Project decision (PROJECT.md): Accountant has **no** salary, commission, staff performance, attendance or tips reports.

---

## 6. Per-report specification (§9–§11)

### R1 · Income & Expense
- **Date:** recognition date (sales: invoice/refund date; expenses: expense date; payroll/commission: finalized/earn/reversal date)
- **Filters:** branch, date, income/expense source, category, user type, user, payment method (info), status
- **KPIs:** Net Sales Income · Other Valid Income · Operating Expenses · Salary Expense · Commission Expense · Inventory Write-off/Loss · Net Before/After selected cost categories
- **Columns:** Date, Type, Source, Reference, Branch, User, Description, Recognized Income, Recognized Expense, Payment Method, Status
- **Notes:** exclude tax, tips, supplier payments, purchase asset postings, settlements, transfers. Old dues collection is not new income.

### R2 · Sales & Invoices
- **Date:** invoice posting date; refund/credit event date for reversals; payment dates separate
- **Filters:** branch, date, cashier/user, customer, invoice #, payment status, lifecycle, payment method, service/package/product, tax status
- **KPIs:** Gross Sales · Discounts · Net Sales · Tax Charged · Tax Reversed · Tips · Invoice Total · Paid · Refunded · Outstanding · Active/Refunded/Voided counts
- **Columns:** Invoice #, Date/Time, Customer, Branch, Sold By, Lines Summary, Gross, Discount, Net Sales, Tax, Tip, Total, Paid, Refunded, Outstanding, Payment Status, Lifecycle, Action/View
- **Notes:** original invoice never disappears; payment status separate from lifecycle; drill-down opens the invoice flow.

### R3 · Payment Accounts
- **Date:** movement timestamp
- **Filters:** branch, date, account, transaction type, source module, user, reference
- **KPIs:** Opening · Money In · Money Out · Transfer In · Transfer Out · Closing
- **Columns:** Date/Time, Account, Type, Reference, Description, User, Money In, Money Out, Transfer, Running Balance, Source Module
- **Notes:** cash/account reconciliation, not P&L (inflows may hold revenue + tax + tips).

### R4 · Cash Drawer Logs
- **Date:** drawer session/movement timestamp
- **Filters:** branch, date, cash user, drawer status/session, movement type, reference
- **KPIs:** Opening Float · Cash Receipts · Cash Refunds · Cash Expenses · Settlements · Expected · Physical · Variance · Remaining
- **Columns:** Session, User, Opened/Closed, Opening, Receipt In, Refund Out, Expense Out, Settlement Out, Expected, Physical, Variance, Status
- **Notes:** custody transfers and float are not income/expense; every movement links to actor + source reference.

### R5 · Detailed Expenses
- **Date:** expense/posting date
- **Filters:** branch, date, category, entered by, payment method/account, status, keyword/reference
- **KPIs:** Total · Cash · Online · Category totals
- **Columns:** Expense #, Date, Category, Title/Description, Branch, Entered By, Payment Method, Account, Amount, Reference, Status
- **Notes:** purchases are not duplicated as expenses; only non-capitalizable ancillary costs.

### R6 · Staff Salary Report — see `payroll.md`
- **Date:** payroll period + finalized date; payment date separate · **KPIs:** Basic, Attendance Impact, OT, Allowances, Deductions, Gross, Net, Paid, Outstanding
- **Columns:** Period, Staff, Branch, Basic, Attendance, OT, Allowances, Deductions, Gross, Net, Paid, Outstanding, Status, Paid Date, Processed By

### R7 · Staff Commission Report — see `payroll.md`
- **Date:** earn/reversal event date; payout date separate · **KPIs:** Attributed Net Sales, Earned, Reversed, Net, Paid, Outstanding
- **Columns:** Date, Staff, Invoice, Customer, Service/Package Component, Attributed Net, Rate Snapshot, Earned, Reversed, Net, Paid, Outstanding

### R8 · Staff Performance
- **Date:** underlying event date (completed appointment, invoice attribution, attendance work date)
- **Filters:** branch, date, staff, service/category, customer/source
- **KPIs:** Completed Visits · Services Performed · Attributed Net Sales · Average Ticket · Commission Earned · Attendance Days/Hours · OT · optional repeat-client
- **Columns:** Staff, Visits, Services, Attributed Net Sales, Product Sales (if attributed), Average Ticket, Commission, Attendance, Hours, OT
- **Notes:** appointment + its invoice = one visit; appointment confirmation alone = no sales.

### R9 · Inventory Reports
- **Date:** movement date for period; as-of date for valuation
- **Filters:** branch, report type, date, category, item, supplier, batch, movement type, item type, user, stock status
- **KPIs:** Current Cost Value · Purchased Value · Net Product Sales · Product COGS · Gross Product Profit · In-house Use Qty/Cost · Expiry/Write-off · Supplier Payable · Low/Near Expiry counts
- **Sub-reports:** stock, batch, movement, purchase, supplier ledger, valuation, COGS, consumption, settlement, expiry
- **Notes:** valued at remaining historical layers; supplier payment is not COGS; in-house use is consumption, not sales.

### R10 · Attendance & Overtime
- **Date:** work date · **Filters:** branch, date, staff, attendance status, shift, leave type, OT status
- **KPIs:** Present · Absent · Leave · Late · Worked Hours · Authorized OT Hours · OT Amount
- **Columns:** Date, Staff, Shift, Check In, Check Out, Worked Hours, Late, Early Leave, Status, Leave, OT Hours, OT Rate, OT Amount, Entered/Approved By
- **Notes:** OT is manual/authorized only; biometric time never creates payable OT.

### R11 · Operating Profit
- **Date:** recognition dates across sale/refund, COGS/consumption, expense, payroll, commission, write-off
- **Filters:** branch (Owner: All), date; optional department/category drill-down
- **KPIs:** Net Service/Package Sales · Net Product Sales · Total Net Sales · Product COGS · Material Consumption · Gross Contribution · Operating Expenses · Salary · Commission · Inventory Write-off · Operating Profit · Margin %
- **Layout:** compact line-oriented P&L rows: current period, optional prior period, amount and % of sales.

---

## 7. Reconciliation controls (§14) — acceptance gate

| Control | Required equality |
|---|---|
| Sales | Σ invoice net − sales reversals = Sales & Invoices net = Operating Profit sales line |
| Tax | Charged − reversed = net tax liability; tax never in revenue/commission/profit |
| Tips | Collections ± reversals − payouts = tip liability; never in revenue/commission |
| Payment accounts | Opening + in − out ± transfers = closing, per account |
| Cash drawer | Opening + cash in − cash out − settlements ± adjustments = expected; compare to count |
| Inventory qty | Opening + IN − OUT = closing, per branch/item/batch |
| Inventory value | Closing layers × historical cost = current inventory cost value |
| COGS | Stock sale-out cost − COGS reversals = product COGS |
| Supplier | Opening + credit purchases − payments − returns ± adjustments = closing payable/advance |
| Commission | Earned − reversed − paid = outstanding |
| Receivables | Effective invoice totals − net applied payments = outstanding |
| Profit | Uses recognized events, never bank balance changes |

**Gate (§15.2):** the reporting batch is not complete until the same branch + date range gives reconciling figures across **Sales & Invoices, Payment Accounts, Inventory/COGS and Operating Profit**, with tax/tips excluded from income and commission.

---

## 8. Scenarios (test cases)

| # | Scenario | Expected |
|---|---|---|
| R-S1 | Sale: gross 10,000, disc 1,000, tax 10%, tip 500 | Net 9,000; tax 900; tip 500; total 10,400; income 9,000 |
| R-S2 | Same sale paid to bank | Payment Accounts +10,400; Income & Expense +9,000 only |
| R-S3 | Partially paid 10,000 (paid 6,000) then full void | Effective total 0; refund only 6,000; outstanding 0; invoice still listed as VOIDED |
| R-S4 | Fully paid 11,500 (net 10,000 + tax 1,000 + tip 500), full refund later | Sales −10,000 on refund date; tax −1,000; tip −500 per tip state; commission reversal on 10,000 only |
| R-S5 | Partial refund of one line | Lifecycle PARTIALLY_REFUNDED; payment status recomputed against reduced total |
| R-S6 | Sept sale, Oct refund | Sept report unchanged; Oct shows the reversal |
| R-S7 | Tip payout Sep 30 reversed Oct 1 | Sept keeps payout; Oct records reversal |
| R-S8 | Package 5,000, Ali/Ahmed split | Commission 300 + 300 exactly, after rounding and after one-component refund |
| R-S9 | Credit purchase 100,000 | Inventory +100,000, payable +100,000, cash 0, COGS 0 |
| R-S10 | Cash purchase 100,000 | Inventory +100,000, cash −100,000, COGS 0 |
| R-S11 | Partial purchase (40,000 paid) | Cash −40,000, payable +60,000 |
| R-S12 | Supplier payment 60,000 later | Payable −60,000, account −60,000; no expense/COGS |
| R-S13 | POS product sale over two layers | COGS = exact Σ layer qty × layer cost; retry never double-deducts |
| R-S14 | In-house use | Stock ↓, material cost ↑, sales 0 |
| R-S15 | Expired/damaged stock | Write-off, not product COGS |
| R-S16 | Resalable customer return | RETURN_IN at original cost, COGS reversed |
| R-S17 | Goodwill refund, no product back | Revenue reverses; no fake stock-in or COGS reversal |
| R-S18 | Branch transfer | Source OUT + destination IN at same cost; no revenue/COGS |
| R-S19 | Supplier over-paid | Ledger shows Supplier Advance (absolute value), not 0 |
| R-S20 | Cash settlement 20,000 user → admin | No income/expense; drawer expected ↓ |
| R-S21 | Old dues collected in cash | Drawer ↑; no new sale/income |
| R-S22 | Opening float | Not income |
| R-S23 | Payroll finalized then paid | Salary expense once (on finalize); payment only settles |
| R-S24 | Every report, same branch + date | §7 equalities hold |
| R-S25 | Accountant opens salary/commission/performance/attendance | 403; Admin limited to own branch |

---

## 9. Current status (code survey 2026-10-07 — verify each before building)

| # | Report | Menu route | What exists now | Gap vs spec |
|---|---|---|---|---|
| 1 | Income & Expense | `/reports/income-expense` | `IncomeExpenseReportPage` computes **in the browser** from `getInvoices` + `getExpenses` | No backend `/reports/income-expense`; refunds not on refund date; no salary/commission/write-off lines; tax/tips shown as side strip — verify exclusion |
| 2 | Sales & Invoices | `/reports/sales-invoices` | Operational `SalesInvoicesPage` (`getInvoices`) | No report API/KPI strip per §9.2 (tax reversed, refunded, counts); verify columns |
| 3 | Payment Accounts | `/reports/payment-accounts` | Routes to **`BranchSettingsPage`** (admin settings) + `/account-statements` API | Needs a read-only report page: opening/in/out/transfers/closing + running balance |
| 4 | Cash Drawer Logs | `/reports/cash-drawer` | Routes to `AccountSettlementPage` (operational) | Needs read-only session log per §9.4 |
| 5 | Detailed Expenses | `/reports/detailed-expenses` | Routes to `ExpenseManagementPage` (operational) | Needs read-only report page per §10.1 |
| 6 | Staff Salary | `/reports/staff-salary` | `StaffSalaryReportPage` + `/reports/staff-salary` API | ✅ (payroll.md P4/P5) |
| 7 | Staff Commission | `/reports/staff-commission` | `StaffCommissionReportPage` + `/reports/staff-commission` API | ✅ (payroll.md P4/P5) |
| 8 | Staff Performance | `/reports/staff-performance` | `StaffPerformancePage` + API | ✅ mostly; tips now dated (2026-10-07); verify visit de-dup |
| 9 | Inventory Reports | `/reports/inventory-movement` ("Inventory Movement") | `InventoryReportsPage` from items/batches/movements/suppliers | Rename to "Inventory Reports"; add valuation/COGS/consumption/expiry/supplier-ledger sub-reports + KPIs |
| 10 | Attendance & Overtime | `/reports/attendance` + `/reports/overtime` (two items) | Operational attendance and overtime pages | Merge into one read-only report per §11.1 |
| 11 | Operating Profit | `/reports/operating-profit` | `COGSReportPage` + `/inventory/cogs-report` (sales, COGS, consumption) | Add expenses, salary, commission, write-off, margin %, prior period |

**Extra items to remove from the Reporting menu (§1):** Unpaid Invoices, Appointment Report, Settlement History, separate Overtime Audit (and Tips Statement — already moved to Tips Management on 2026-10-07). Keep them as source-module views.

**Common gaps:** universal filter row (preset + user type/user) is not uniform; PDF export with metadata missing on most pages; most reports aggregate in the browser instead of a backend report API.

---

## 10. Comprehensive 10-Step Implementation Plan

> **STRICT DIRECTIVE — ZERO MOCK DATA (0.0%):**
> Every reporting feature across all 10 steps must be powered 100% by live Express backend endpoints querying PostgreSQL via Prisma. No in-browser fake arrays, no mock timeouts, and no synthetic numbers.
>
> **TABLE & UI SPECIFICATION (As per Reference Design):**
> 1. **Filter Header Row:** Dynamic filter controls (Branch/Campus, Category/Class, Item/Type, Status, Date Presets `Asia/Karachi`, Actor/Staff) with a distinct primary blue **`[Filter]`** button.
> 2. **Dark Blue Section Banner:** High-contrast sub-header bar identifying the active report.
> 3. **Top Action Export Strip:** Standard export button group located on the top right:
>    - `[Excel]` (Emerald green button with spreadsheet icon)
>    - `[CSV]` (Cyan / Teal button with raw data icon)
>    - `[PDF]` (Crimson red button with document icon)
>    - `[Print]` (Slate grey button with printer icon)
> 4. **Landscape Table & Horizontal Scroller:**
>    - Wrapped in a dedicated responsive container (`overflow-x-auto min-w-full whitespace-nowrap`).
>    - Column contents must **never wrap awkwardly or squash vertically** when there are many columns.
>    - Smooth styled horizontal scrollbar for fluid horizontal panning.
>    - Column `#` (sequential row index), bold colored code/identifier column (e.g. `INV-001`, `EXP-042`), left-aligned text, right-aligned monetary values (`PKR #,##0.00`).
>    - Maintained SalonOS premium theme: Royal Blue accent (`#2254E1`), clean borders (`border-slate-200`), crisp white table body, and light header background (`#EBF1FA` / `bg-slate-100/80`).

---

### Step 1: Universal Reporting Framework & Landscape Table Shell (Shared Base) [COMPLETED]
* **Backend:**
  - Create `src/lib/reportRange.js` to parse date presets (`TODAY`, `YESTERDAY`, `THIS_WEEK`, `THIS_MONTH`, `LAST_MONTH`, `CUSTOM`) locked to `Asia/Karachi` timezone with branch RBAC scoping (`SUPER_ADMIN` all vs `ADMIN`/`ACCOUNTANT` single branch).
  - Define unified response schema: `{ meta: { branchId, branchName, from, to, dateBasis, filters, generatedAt, generatedBy }, kpis, rows, totals }`.
* **Frontend:**
  - Create reusable `ReportShell.tsx` and `ReportTable.tsx` components.
  - Implement the top filter row with responsive dropdowns and the **`[Filter]`** action trigger.
  - Implement the dark blue section title strip and the 4-button export strip (`[Excel]`, `[CSV]`, `[PDF]`, `[Print]`).
  - Implement the **Landscape Scroller** container (`overflow-x-auto whitespace-nowrap min-w-full`) with custom scrollbar styles preserving SalonOS theme.

---

### Step 2: Sales & Invoices Report (`/reports/sales-invoices`) [COMPLETED]
* **Backend (`modules/reports/reports.service.js`):**
  - Real Prisma query aggregating posted `Invoice`, `InvoiceLine`, `PaymentReceipt`, and dated `CreditNote`/`RefundEvent` records.
  - Calculate gross sales, line discounts, invoice-level discounts, net sales, tax liability charged, tax reversed, staff tips, total paid, and net customer outstanding.
  - Enforce dual-status classification: Payment Status (`PAID`, `PARTIALLY_PAID`, `UNPAID`) vs Lifecycle Status (`ACTIVE`, `PARTIALLY_REFUNDED`, `REFUNDED`, `VOIDED`).
  - Exclude voided invoices from recognized net sales; subtract refunds from net totals.
* **Frontend (`SalesInvoicesPage.tsx`):**
  - Connect directly to `GET /api/v1/reports/sales-invoices` (zero mock data).
  - Landscape table columns: `#`, `Invoice #`, `Date/Time`, `Customer`, `Branch`, `Sold By`, `Lines Summary`, `Gross`, `Discount`, `Net Sales`, `Tax Charged`, `Tax Reversed`, `Tip`, `Total`, `Paid`, `Refunded`, `Outstanding`, `Payment Status`, `Lifecycle`, `Actions`.
  - Wire up Excel, CSV, PDF, and Print exports reflecting exact on-screen data.
* **Test Suite:** `tests/30-financial-reports-suite.test.js` passing.

---

### Step 3: Income & Expense Report (`/reports/income-expense`) [COMPLETED]
* **Backend:**
  - Endpoint `GET /api/v1/reports/income-expense`: queries recognized revenue from valid invoices (minus dated refunds) and operating expenses from posted `Expense` records, finalized `Payroll` base salaries, and net earned `CommissionEvent` records.
  - Strictly enforce accounting rule: Tax, tips, supplier payments, capitalizable purchases, and custody transfers are **completely excluded** from this P&L view.
* **Frontend (`IncomeExpenseReportPage.tsx`):**
  - Connect to backend API. Zero mock data.
  - KPI summary strip: Net Recognized Sales, Other Income, Total Operating Expenses, Net Operating Position.
  - Landscape table: `#`, `Date`, `Type (INCOME/EXPENSE)`, `Category`, `Source Module`, `Reference Code`, `Branch`, `Description`, `Income Amount`, `Expense Amount`, `Payment Method`, `Status`.
* **Test Suite:** `tests/30-financial-reports-suite.test.js` passing.

---

### Step 4: Operating Profit & P&L Statement (`/reports/operating-profit`) [COMPLETED]
* **Backend:**
  - Endpoint `GET /api/v1/reports/operating-profit`: combines Net Sales with FIFO/FEFO Product COGS (`StockMovement` type `SALE`), Salon Consumable Consumption (`StockMovement` type `CONSUMPTION`), Operating Expenses, Finalized Payroll, Commission, and Inventory Write-offs.
  - Compute Gross Contribution and Net Operating Profit along with Operating Margin %.
* **Frontend (`COGSReportPage.tsx` / `OperatingProfitReportPage.tsx`):**
  - Formal financial statement table with landscape layout.
  - Breakdown: 1. Revenue (Services, Packages, Retail Products) → 2. Cost of Sales (COGS + Salon Consumables) → 3. Gross Margin → 4. Operating Expenses (Payroll, Commissions, Direct Expenses, Losses) → 5. Net Operating Profit.
  - Include prior-period comparison columns and export functionality.
* **Test Suite:** `tests/30-financial-reports-suite.test.js` passing.

---

### Step 5: Payment Accounts Ledger Report (`/reports/payment-accounts`) [COMPLETED]
* **Backend:**
  - Endpoint `GET /api/v1/reports/payment-accounts`: calculates pre-period opening balance from `PaymentAccountMovement`, period inflows (`Money In`), outflows (`Money Out`), inter-account `Transfers In/Out`, and closing balance for each bank/online account.
* **Frontend (`PaymentAccountsReportPage.tsx`):**
  - Dedicated read-only audit report page.
  - Filter by Account, Transaction Type, Source Module, and Date.
  - Landscape table: `#`, `Date/Time`, `Account Name`, `Tx Type`, `Reference #`, `Source Module`, `Description`, `User`, `Money In`, `Money Out`, `Transfer`, `Running Balance`.
* **Test Suite:** `tests/30-financial-reports-suite.test.js` passing.

---

### Step 6: Cash Drawer Custody & Session Logs (`/reports/cash-drawer`) [COMPLETED]
* **Backend:**
  - Endpoint `GET /api/v1/reports/cash-drawer`: extracts physical cash drawer sessions from `CashDrawerSession` and `CashMovement`.
  - Track: Opening Float, Cash Sales, Cash In, Cash Refunds, Cash Expenses, Accepted Settlements Out, Expected Drawer Cash, Physical Counted Cash, and Variance (Over/Short).
* **Frontend (`CashDrawerLogsReportPage.tsx`):**
  - Clean read-only session custody report page with tender breakdown.
  - Landscape table: `#`, `Session ID`, `Cashier User`, `Branch`, `Opened At`, `Closed At`, `Opening Float`, `Cash Receipts`, `Cash Refunds`, `Cash Expenses`, `Settlements Out`, `Expected Cash`, `Counted Cash`, `Variance (Short/Over)`, `Status`.
* **Test Suite:** `tests/25-cash-drawer-report.test.js` passing.

---

### Step 7: Detailed Operational Expenses Report (`/reports/detailed-expenses`) [COMPLETED]
* **Backend:**
  - Endpoint `GET /api/v1/reports/expenses` / `/reports/detailed-expenses`: queries real database `Expense` records joined with expense categories, payment accounts, branches, and logging users.
  - Ensure supplier payable settlements are excluded (as they belong to the supplier ledger, not operational expenses).
* **Frontend (`DetailedExpensesReportPage.tsx`):**
  - Read-only reporting table with tender and category breakdowns.
  - Filter by Category, Branch, Paying Account/Cash, Entered By, and Status.
  - Landscape table: `#`, `Expense Code`, `Date`, `Category`, `Title / Notes`, `Branch`, `Recorded By`, `Payment Source`, `Account`, `Amount`, `Voucher Reference`, `Status`.
* **Test Suite:** `tests/26-detailed-expenses-report.test.js` passing.

---

### Step 8: Inventory & Supply Chain Reports Suite (`/reports/inventory`) [COMPLETED]
* **Backend:**
  - Endpoint `GET /api/v1/reports/inventory?type=valuation|movements|purchases|supplier-ledger|consumption|expiry`:
    - **Valuation:** Remaining inventory batches evaluated at historical landed unit cost (never POS selling price).
    - **Movements:** Real log of all `PURCHASE_IN`, `SALE_OUT`, `IN_HOUSE_CONSUMPTION`, `RETURN_IN`, `DAMAGE_OUT`, `EXPIRED_OUT`.
    - **Purchases:** Inbound inventory with physical cash vs online bank accounts breakdown.
    - **Supplier Ledger:** Running balance of purchases, payments, returns, showing net payables or advances without clamping to zero.
    - **Consumption:** In-house salon consumable usage by volume and total cost.
    - **Expiry:** Batches evaluated against `Asia/Karachi` date for expired, critical, and near-expiry risk audit.
  - Test Suite: `tests/27-inventory-report.test.js` passing (6/6).
* **Frontend (`InventoryReportsPage.tsx`):**
  - Full 6-in-1 sub-report navigation tabs with landscape scrolling table (`overflow-x-auto min-w-full whitespace-nowrap`).
  - Table columns and KPI cards customized per sub-report with stock & expiry status badges.
  - Tender breakdown banner showing Physical Cash vs Online Accounts.
  - Complete export suite for all 6 sub-reports (`[Excel]`, `[CSV]`, `[PDF]`, `[Print]`).
  - 100% connected to live Express backend API (`salonService.getInventoryReport(...)`). Zero mock data.

---

### Step 9: Staff HR, Salary, Commission & Attendance Suite [COMPLETED]
* **Backend (`modules/reports/staffPay.report.js` & `reports.service.js`):**
  - Audited and verified live endpoints for:
    - `/reports/staff-salary`: Finalized monthly payroll, earnings, attendance penalties, OT allowances, paid vs unpaid.
    - `/reports/staff-commission`: Net attributed sales, locked rate snapshot, earned, reversed, paid, outstanding.
    - `/reports/staff-performance`: Completed appointments, services count, sales contribution, average ticket, attendance hours.
    - `/reports/attendance-overtime` (and alias `/reports/attendance`): Work days, shifts, punches, late arrival, early departure, leaves, authorized overtime hours and amounts.
  - Test Suite: `tests/28-attendance-overtime-report.test.js` passing (4/4).
* **Frontend (`StaffSalaryReportPage.tsx`, `StaffCommissionReportPage.tsx`, `StaffPerformancePage.tsx`, `AttendanceOvertimeReportPage.tsx`):**
  - Merged Attendance and Overtime into one consolidated read-only report page (`AttendanceOvertimeReportPage.tsx`) using `ReportShell` & landscape scrolling `ReportTable` (`overflow-x-auto min-w-full whitespace-nowrap`).
  - Added KPI summary strip (Records, Present, Absent, On Leave, Late Arrivals, Worked Hours, Authorized OT Hours, OT Payable Amount).
  - Complete export suite (`[Excel]`, `[CSV]`, `[PDF]`, `[Print]`).
  - Connected 100% to live Express backend API. Zero mock data.
  - TypeScript compiler (`tsc --noEmit`) passes with 0 errors.

---

### Step 10: Strict Cross-Report Reconciliation Gate, Navigation Cleanup & E2E Validation [COMPLETED]
* **Navigation Cleanup:**
  - Updated `src/config/navigation.ts` to strictly feature the 11 canonical reporting pages defined in §2:
    1. Income & Expense (`/reports/income-expense`)
    2. Sales & Invoices (`/reports/sales-invoices`)
    3. Payment Accounts (`/reports/payment-accounts`)
    4. Cash Drawer Logs (`/reports/cash-drawer`)
    5. Detailed Expenses (`/reports/detailed-expenses`)
    6. Staff Salary Report (`/reports/staff-salary`)
    7. Staff Commission Report (`/reports/staff-commission`)
    8. Staff Performance (`/reports/staff-performance`)
    9. Inventory Reports (`/reports/inventory`)
    10. Attendance & Overtime (`/reports/attendance`)
    11. Operating Profit (`/reports/operating-profit`)
  - Operational subviews and redundant entries removed from the reporting sidebar.
* **Automated Reconciliation Gate (§14):**
  - Cross-report mathematical parity verified: `Sales & Invoices Net Sales === Income & Expense Net Sales === Operating Profit Revenue`.
  - Cash Drawer and Payment Account closings reconcile exactly: `Closing = Opening + Money In - Money Out + Transfers In - Transfers Out`.
  - Tax and Tips are 100% strictly segregated from revenue, gross margins, and commissions.
  - Test Suite: `tests/29-reporting-reconciliation-gate.test.js` passing (6/6). Full suite passes (26/26 reporting tests).
* **UI & Export Audit:**
  - All 11 reporting pages use the standardized `ReportShell` & landscape table with `overflow-x-auto min-w-full whitespace-nowrap`.
  - All pages support four export options: `[Excel]`, `[CSV]`, `[PDF]`, and `[Print]`.
  - Frontend TypeScript verification passes with 0 errors (`npx tsc --noEmit`). Zero mock data.

