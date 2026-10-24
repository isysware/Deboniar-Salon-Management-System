# Supplier and client payment verification — 2026-10-14

## Implementation

- Removed automatic "owner funds" adjustments that cancelled supplier deductions, and removed the fallback to the branch vault. Cash supplier payments require the actual actor's open drawer and sufficient cash. Online payments validate the selected active branch account and its available funds.
- Supplier payments reject overpayment against the branch payable, allocate oldest outstanding purchases first, persist allocations (including opening payables), and update purchase paid/due/status in the same transaction. Upfront purchase payments also create payment records and allocations.
- Client collections validate bill-only allocations and outstanding invoice amounts, credit the collector's open drawer or the selected branch account, and update invoice balances. Client receivables remain derived from outstanding invoices.
- Supplier payments, purchases with upfront payments, invoice checkout, collections, and payment reversals use transactional duplicate protection. Concurrent retries share a database lock and saved response; reusing a key with changed payment details is rejected.
- Reversals retain original records, post compensating money movements and supplier ledger entries, restore invoice/purchase balances once, and record the reversing actor, reason, and effective reversal date. Closed/locked drawers and insufficient funds reject the reversal atomically. Collection reversal is blocked after invoice refund/void to avoid conflicting corrections.
- Payment movement source IDs link to individual payment records. Persisted records retain branch, party/invoice link, actual actor, method, source drawer/account, amount, reference, notes, creation timestamp, allocations, and reversal metadata.
- Income & Expense shows collections and supplier payouts as dated settlement rows with zero recognized income/expense. Payment Accounts reconciles dated movements. Cash Drawer Logs includes dated transaction detail and nets collections and reversals in their respective periods. Tax and tips remain excluded from recognized sales/profit.
- Frontend supplier forms include payment date and notes, show posting errors, restrict active accounts, reject amounts above payable, reuse retry keys, and disable duplicate submission. Client collection forms reuse retry keys and guard double clicks. Supplier/client history exposes reversal actions and retains reversed receipts. Payment status labels show Unpaid, Partially Paid, and Fully Paid.

## Verified results

The dedicated API suite passes **12/12 tests** against newly created temporary PostgreSQL databases:

1. Unpaid purchase and required actor drawer.
2. Insufficient cash rolls back all financial changes without inventing funds.
3. Required supplier date/method; empty, inactive, and wrong-branch online accounts rejected.
4. Concurrent duplicate partial cash payment posts once; changed-key payload rejected; reversal/replay restores balances once.
5. Online full settlement, overpayment rejection, and exact account restoration.
6. Unpaid client invoice.
7. Partial cash and full online collection; concurrent duplicates; overcollection rejection; exact-once reversals.
8. Collection/receivable updates and later dated reversals reconcile Income & Expense and Cash Drawer Logs without recognizing sales twice.
9. Multiple supplier installments: partial online then full cash; actual actor/drawer cannot be spoofed; both reversals retained.
10. Upfront purchase payment is allocated and reversible without reversing stock.
11. Insufficient funds block collection reversal without changing payment/invoice records; the same request succeeds after funds are available.
12. Supplier payment/reversal reconcile Payment Accounts and Income & Expense on their respective dates.

Frontend TypeScript checks and production build pass. The build reports its existing large-bundle warning. Browser interaction was not automated.

The broader regression run reported **305 passed, 9 failed, 1 skipped**, plus a stale-path operating-profit suite load error. The stale frontend paths in route/profit tests were corrected and the operating-profit suite subsequently passed **6/6**. Remaining broad-suite failures concern inventory expiry behavior (which adds PKR 1 and causes dependent supplier expectations to fail), daily payroll preview, and attendance punch calculations. These were not silently changed to make the suite green. The original repository had existing uncommitted inventory/POS/navigation changes, which were preserved.

Commands:

```powershell
cd backend
node scripts/run-isolated-tests.js --config vitest.payments.config.js
node scripts/run-isolated-tests.js --config vitest.payment-regression.config.js
node scripts/run-isolated-tests.js --config vitest.payment-regression.config.js operating-profit-regression
cd ../frontend
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build
```

## Development database incident — recovery pending

The first test attempt reset the local `localhost/salonos` development database. The existing isolated runner changed `DATABASE_URL` but did not change Prisma's separate `DIRECT_URL`, so migration reset targeted the development database while seeding targeted the temporary database. The development database now has zero users, invoices, and purchases. Its previous contents cannot be inferred from those counts.

The runner, global setup, and worker setup now set both URLs to the test database; the reset guard validates the actual database name. All later verification used disposable isolated databases.

No database backup was found in the workspace or as another PostgreSQL database, and PostgreSQL WAL archiving is disabled. Original development data has **not** been recovered. A backup location was requested from the user; no demo data was seeded as a substitute. The additive payment schema migrations are applied locally, but normal use of the local system still requires restoring its data.
