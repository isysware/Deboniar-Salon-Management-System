# POS Customer and Billing UI Update Status

**Project**: SalonOS (`iSysware Salon Management System`)  
**Date**: September 29, 2026  
**Status**: Completed  
**Preview URL**: [http://localhost:3000/](http://localhost:3000/)  

---

## 1. Executive Summary
The POS Customer and Billing UI update has been fully implemented in SalonOS without rebuilding unrelated modules or modifying the underlying React + Vite + TypeScript framework. All requirements—including responsive Poppins typography, branch-scoped customer lookup, customer source persistence, previous receivables collection, detailed tax/discount/tip breakdown, named payment account controls, and updated receipt presentation—have been implemented and verified with 100% passing automated test suites.

---

## 2. Completed Scope & Features

### 1. Clear Responsive POS Layout
- **Design & Typography**: Enforced `Poppins` font everywhere, shadcn/ui component standards, and royal-blue accent (`#2254E1`).
- **Desktop Grid**:
  - **Top**: Customer attribution, source selection, details field, branch-scoped search/lookup dropdown, and previous receivable banner.
  - **Main Left (65%)**: Searchable services/packages catalogue with category filter pills, service line item staff assignment dropdowns, package component staff assignments, manual package selling prices, and no staff photographs (Initials Badges preserved).
  - **Right (35%)**: Sticky Billing Summary card (Subtotal, Discount selector, Net sales, Tax breakdown, Total, Tip separately, Total payable, Amount applied, Current bill outstanding, Change to return) and Payment Controls.
- **Mobile Layout**: Responsive layout with stacked controls and accessible bill summary.

### 2. Customer Details & Source Persistence
- **Always Displayed**: Customer Name, Phone Number, Customer Source dropdown (`Walk-in`, `Referral`, `Social Media`, `Other`).
- **Conditional Details Input**: Dynamic details field for `Referral` (Referrer Name/Code), `Social Media` (Platform/Handle), and `Other` (Notes/Channel).
- **Historical Attribution Persistence**: `customerSource` and `customerSourceDetails` persist on the `Invoice` snapshot so historical attribution remains unchanged if customer profile is later modified.
- **Branch-Scoped Lookup**: Real-time lookup by name or phone via `salonService.searchClients(branchId, query)` with normalized phone matching without merging ambiguous records.
- **Walk-in & Partial Sale Rules**: Fully paid walk-ins allow anonymous sales (`Walk-in Customer`). Any sale with an outstanding balance (`amountDue > 0`) strictly requires a named customer and valid phone.
- **Mock Customer Registry**: Seeded `Client` registry in `mockStorage.ts` with auto-sync on invoice posting.

### 3. Previous Receivable & Dues Collection
- **Previous Balance Banner**: Displays previous outstanding balance when selecting a customer with unpaid dues.
- **Buttons**: `View Outstanding Invoices` and `Collect Dues`.
- **Collection Modal**: Opens invoice list for the customer (`salonService.getClientOutstandingInvoices`) and allows collecting payment (Cash, Online) against an original invoice.
- **Financial Isolation**: Previous dues are kept 100% separate from current cart sales. Never added as a service or taxable line item. Old sales are not re-recognized.
- **Balance Sync**: Automatically refreshes customer outstanding balance upon successful collection.
- **Cart Preservation**: The current POS cart remains intact during previous dues collection.

### 4. Bill Summary, Discount & Tax Calculation
- **Summary Display**: Subtotal before discount/tax, Discount selector (`Amount (PKR)` vs `Percentage (%)`), Discount amount, Net sales, Tax breakdown, Current invoice total, Tip separately, Total payable, Amount applied, Current bill outstanding, Change to return.
- **Discount Validation**: Fixed discounts validated against subtotal (0 to subtotal); percentage discounts validated 0 to 100%. Reused proportional discount allocation (`roundCurrency`).
- **Automatic Tax Calculation**: Calculated automatically from branch/service/package tax settings (`taxTreatment`, `specificTaxRuleId`, `taxExempt`). No hardcoded rates or POS overrides.

### 5. Payment Controls
- **Payment Choices**: `CASH`, `ONLINE`, `SPLIT`, `UNPAID`.
- **Cash**: Cash tendered input with calculated retained cash (bill + tip allocation) & change to return.
- **Online**: Named active branch payment account dropdown (`paymentAccountId`), amount input, optional reference note.
- **Split Payment**: Multi-row payment builder with Cash + multiple active named online accounts. Reconciled totals.
- **Account Reconciliation**: Active branch payment accounts loaded from storage; displayed paid total strictly reconciles with payment rows. Cash received is never silently increased.

### 6. Posting & Receipt Presentation
- **Submit Protection**: Submit buttons disabled while processing (`isPosting`). Idempotency key generated per submission intent. Safe retries on failure with preserved inputs. Cart cleared only on success.
- **Receipt Presentation**: `ReceiptModal.tsx` updated with customer information, source & details, discount breakdown, tax, tip, payment split, remaining balance, and official tax registration number (if configured on branch).
- **Collection Receipts**: Previous dues collections produce a receipt linked to the original invoice.

### 7. Branch Permissions
- **Super Admin**: Must select a specific active branch to post.
- **Admin & Accountant**: Restricted to their assigned branch.
- **Staff**: Blocked from POS billing and customer financial records.

---

## 3. Verification Results

| Check / Test Suite | Result | Details |
|---|---|---|
| **POS Customer Test Suite** (`posCustomerService.test.ts`) | **PASS (7/7)** | Customer source persistence, lookup, branch isolation, discount equivalence, named online account allocation, previous dues collection, cart preservation, unpaid validation |
| **POS Financial Correctness Suite** (`salonService.test.ts`) | **PASS (11/11)** | Atomic transactions, zero partial changes on error, price quotes, idempotency, package discount rounding, split payments, cross-branch/role guards |
| **Staff Configuration Suite** (`staffService.test.ts`) | **PASS (13/13)** | Compensation types, overtime, working schedule, leave allowance, deductions, portal access, photo removal |
| **TypeScript Check** (`npm.cmd run lint`) | **PASS (0 Errors)** | `tsc --noEmit` verified clean |
| **Production Build** (`npm.cmd run build`) | **PASS** | Vite production build completed in 1.16s (`dist/` generated) |

---

## 4. Modified Files
- `src/types/salon.ts`
- `src/services/mock/mockStorage.ts`
- `src/services/salonService.ts`
- `src/services/mock/mockSalonService.ts`
- `src/features/pos/POSBillingPage.tsx`
- `src/features/pos/ReceiptModal.tsx`
- `src/services/mock/__tests__/posCustomerService.test.ts`
- `POS_UI_UPDATE_STATUS.md`

---

## 5. Manual Testing Steps for Verification
1. Navigate to `http://localhost:3000/` and sign in as Branch Admin (`admin.lounge@isysware-salon.pk`) or Super Admin.
2. Go to **POS Billing** (`/pos`).
3. **Customer Lookup & Attribution**:
   - Type `Zainab` in the customer lookup input. Select `Zainab Ahmed`.
   - Observe the Previous Outstanding Balance banner (`PKR 35,680.00`).
   - Change source to `Referral` and enter `Dr. Usman`.
4. **Collect Previous Dues**:
   - Click `Collect Previous Dues`.
   - In the modal, select invoice `INV-LHE-2026-0044`, select `Cash`, and confirm collection.
   - Observe collection receipt modal linked to original invoice. Note that active cart items were not cleared or altered.
5. **POS Sale & Billing Breakdown**:
   - Add `Signature Blowout & Treatment` to cart.
   - Select a fixed discount of `PKR 500` or percentage discount `10%`.
   - Observe live calculations for Subtotal, Net Sales, Tax, and Bill Total.
   - Add staff tip `PKR 200`.
   - Click `Proceed to Checkout`, choose `Split Payment` or `Online Account` (e.g. `Meezan Corporate Checking`), and confirm payment.
   - Verify final printed receipt shows customer source, discount, tax, tip, payment account name, and 0 balance due.
