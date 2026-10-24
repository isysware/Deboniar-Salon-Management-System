# INVENTORY & SUPPLIERS MODULE STATUS

**Date**: 2026-10-01  
**Project**: SalonOS (iSysware Salon Management System)  
**Batch**: Phase 3H — Inventory & Supplier Management Working Tree  
**Status**: COMPLETED & VERIFIED  

---

## 1. Executive Summary & Verification State

- **Inventory/Supplier Test Suite**: **14/14 tests passed** (`src/services/mock/__tests__/inventorySupplierService.test.ts`)
- **TypeScript Compilation**: **0 errors** (`node node_modules/typescript/bin/tsc --noEmit` exited with code 0)
- **Production Bundle Build**: **0 errors** (`node node_modules/vite/bin/vite.js build` exited with code 0)
- **All 10 Regression Suites**: **106/106 tests passed** across all existing module test suites with zero failures and zero modified assertions.
- **Reporting & POS Redesign Safeguard**: Confirmation that final Reporting redesign, POS layout redesign, and purple theme redesign have NOT been started.

---

## 2. Test 13 Root Cause & Canonical Fix

### Root Cause
In `getCOGSReport`, invoices were previously filtered with `inv.status === 'PAID' || inv.status === 'PARTIAL'`. Consequently, any valid invoice with `UNPAID` status was excluded from sales calculations, despite representing valid recognized revenue under the application's sales basis. Additionally, retail product lines lacking an explicit `type === 'PRODUCT'` attribute were skipped when calculating product sales and COGS.

### Solution
1. **Invoice Recognition**: Valid posted invoice recognition covers all confirmed issued invoices (`PAID`, `UNPAID`, `PARTIAL`).
2. **Product Classification**: Product lines are recognized either when `li.type === 'PRODUCT'` or when `itemId` maps to an item master record configured as `RETAIL_PRODUCT` or `BOTH`.
3. **Net Product Sales Formula**:
   $$\text{Net Product Sales} = \sum (\text{Line Net Sales}) - \sum (\text{Dated Product Refund Net Amounts})$$
   Excludes taxes, client tips, service revenues, package components, supplier payments, and purchase stock-ins.
4. **Product COGS Formula**:
   $$\text{Product COGS} = \sum (\text{Valid POS\_SALE\_OUT Movement Cost Snapshots}) - \sum (\text{Product Return / Reversal Stock-Cost Events})$$
   Uses historical posted batch cost snapshots (`unitCostSnapshot` and `cogsAmount`), never current Item Master purchase cost, selling price, or current stock valuation.
5. **Gross Product Profit & Margin**:
   $$\text{Gross Product Profit} = \text{Net Product Sales} - \text{Product COGS}$$
   $$\text{Gross Margin \%} = \frac{\text{Gross Product Profit}}{\text{Net Product Sales}} \times 100 \quad (\text{when Net Product Sales} > 0)$$

---

## 3. Type Compatibility & Input Contract Normalization

### `CreatePurchaseInput`
- **Method Signature**: `createPurchase(input: CreatePurchaseInput, actor?: User): Promise<Purchase>`
- **Normalization**: Inside the service, line unit cost is normalized once:
  ```ts
  const unitPurchaseCost = l.unitPurchaseCost ?? l.unitCost;
  ```
  Followed by strict validation (`unitPurchaseCost >= 0`).
- **Authoritative Snapshot**: The authoritative posted snapshot (`unitPurchaseCost` and `historicalCostSnapshot`) preserves the normalized cost supplied on the purchase line, never falling back to current Item Master cost.
- **Field Aliases**: Safely normalizes `supplierInvoiceNumber ?? supplierInvoiceNo ?? invoiceNumber`, `paidAmount ?? partialPaidAmount`, and `cashDrawerId ?? payerDrawerId`.

### `CreateManualStockOutInput`
- **Method Signature**: `createManualStockOut(input: CreateManualStockOutInput, actor?: User): Promise<StockMovement>`
- **Normalization**: Reason type is normalized safely to preserve explicit values:
  ```ts
  const reasonType = input.reasonType ?? (
    input.reason === 'SALON_CONSUMPTION' ? 'SALON_CONSUMPTION'
    : input.reason === 'DAMAGE' ? 'DAMAGE'
    : input.reason === 'EXPIRED' ? 'EXPIRED'
    : input.reason === 'INTERNAL_USE' ? 'INTERNAL_USE'
    : input.reason === 'PROMOTIONAL' ? 'PROMOTIONAL'
    : 'OTHER'
  );
  ```

### `PaySupplierInput`
- **Method Signature**: `paySupplier(input: PaySupplierInput, actor?: User)` & `recordSupplierPayment(...)` alias
- **Normalization**: Method normalized from `input.method ?? (input.paymentMethod === 'CASH' ? 'CASH' : 'ONLINE')`; drawer normalized from `input.cashDrawerId ?? input.payerDrawerId`.

### `CreateSupplierReturnInput`
- **Method Signature**: `createSupplierReturn(input: CreateSupplierReturnInput, actor?: User): Promise<SupplierReturn>`
- **Normalization**: `refundTreatment ?? 'REDUCE_PAYABLE'`, `purchaseId ?? originalPurchaseId`.

---

## 4. Test Suite Coverage Summary

| Suite Name | File | Tests Passed | Status |
| :--- | :--- | :---: | :---: |
| **Inventory & Supplier** | `src/services/mock/__tests__/inventorySupplierService.test.ts` | **14 / 14** | ✅ PASSED |
| **POS Core / SalonService** | `src/services/mock/__tests__/salonService.test.ts` | **11 / 11** | ✅ PASSED |
| **POS Customer & Billing** | `src/services/mock/__tests__/posCustomerService.test.ts` | **7 / 7** | ✅ PASSED |
| **Appointments & CRM** | `src/services/mock/__tests__/appointmentBookingCustomerService.test.ts` | **10 / 10** | ✅ PASSED |
| **Tips & Performance** | `src/services/mock/__tests__/tipsPerformanceService.test.ts` | **13 / 13** | ✅ PASSED |
| **Payroll & Commission** | `src/services/mock/__tests__/payrollCommissionService.test.ts` | **9 / 9** | ✅ PASSED |
| **Expense Management** | `src/services/mock/__tests__/expenseService.test.ts` | **10 / 10** | ✅ PASSED |
| **Attendance & Overtime** | `src/services/mock/__tests__/attendanceOvertimeService.test.ts` | **9 / 9** | ✅ PASSED |
| **Cash Settlement & Custody** | `src/services/mock/__tests__/settlementService.test.ts` | **10 / 10** | ✅ PASSED |
| **Staff & Compensation** | `src/services/mock/__tests__/staffService.test.ts` | **13 / 13** | ✅ PASSED |
| **TOTAL** | **All 10 Test Suites** | **106 / 106** | ✅ **100% PASSED** |

---

## 5. UI Architecture & Working URLs

### Completed UI Modules
1. **Inventory & Suppliers Workspace** (`/operations/inventory-suppliers`, `/operations/inventory`):
   - **Overview Tab**: Valuation summary KPI cards (Total Stock Cost, Total Retail Value, Items Count, Low Stock, Near Expiry, Supplier Payable), quick-action links.
   - **Items & Stock Tab**: Filterable items table (SKU, Category, Purchase Cost, Selling Price, Stock on Hand, Stock Status), Item Master modal, Batch Drawer with quarantine/release toggle.
   - **Purchases Tab**: Purchase order history, Stock-In modal with dynamic line items, automated batch creation, and payment method allocation (Cash/Online/Credit/Partial).
   - **Suppliers Tab**: Supplier directory, Add/Edit Supplier modal, dedicated Supplier Ledger drawer (debit/credit running balance), Pay Supplier modal with float debit.
   - **Movements Tab**: Chronological audit trail with filter presets (In/Out, Movement Type, Item, Date), Manual Stock-Out modal (Salon Consumption, Damage, Internal Use, Promotional).
   - **Physical Reconciliation Tab**: Periodic stock count history, Stock Settlement modal with counted quantity input, auto-computed variance, and adjustment movements.
2. **Dedicated Inventory Reporting** (`/reports/inventory-movement`, `/reports/inventory`):
   - 5 sub-report tabs: Stock Valuation by Branch, Movement Audit Trail, Low Stock & Reorder Alerts, Batch Expiry Audit, and Supplier Payables Aging.
3. **COGS & Profitability Report** (`/reports/operating-profit`, `/reports/cogs`):
   - Key financial indicators: Net Product Sales, Product COGS, Gross Profit, Retail Gross Margin %, Salon Consumable Material Cost, and Service Revenue Contribution.
   - Item-by-item profitability table with quantity sold, returns, net sales, COGS, gross profit, and margin %.
4. **POS Retail Product Integration** (`/pos`):
   - Dedicated "Retail Products" tab in POS catalogue with live batch stock counter badges.
   - Automatic deduction of sellable stock using FEFO batch ordering.
   - Expired and quarantined batch blocking.
   - Commission staff assignment for retail sales.

---

## 6. Verification Status: Browser vs Code-Only

- **Code-Level Verification**: 100% verified.
  - TypeScript compilation: 0 errors (`tsc --noEmit`).
  - Production build: Clean bundle generated (`dist/assets/index-DrWIQ8up.js`).
  - Unit/Service test execution: All 14 inventory tests and all 92 regression tests verified through direct execution via `tsx`.
- **Browser-Tested vs Code-Only**:
  - The local development server is active and serving `http://localhost:3000` (HTTP 200).
  - Headless browser automation via Playwright encountered an environment driver installation failure (`could not install driver: got 404 from playwright.azureedge.net/builds/driver/playwright-1.57.0-win32_x64.zip`).
  - Therefore, UI pages are verified via strict static typecheck, compilation, production build, route wiring, and comprehensive mock service layer tests. Visual verification in the actual browser remains available for the user on `http://localhost:3000`.

---

## 7. Known Limitations & Next Steps

1. **Browser Playwright Driver**: Playwright's automated browser binary download is blocked by a 404 on Azure CDN in this offline/corporate environment; browser QA must be conducted directly by the user in Chrome/Edge at `http://localhost:3000`.
2. **Reporting & POS Redesign Batch**: Held intentionally; will begin only after user confirmation.
