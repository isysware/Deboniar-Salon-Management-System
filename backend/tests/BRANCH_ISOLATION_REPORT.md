# Branch isolation verification

Date: 2026-10-24

## Results

- 45 database/API integration and regression tests passed across shared settings, existing branch isolation, and supplier/client payment settlement suites.
- 11 targeted settings tests passed.
- Frontend TypeScript check and production build passed.
- Syntax checks passed for all 11 changed backend source files.

## Verified coverage

- Single and multiple branch payment account creation, duplicate branch selections, one shared database record, and exclusion from unassigned branches.
- Single and multiple branch tax creation, branch-specific defaults, rate synchronization, and deactivation of a shared default.
- Invalid/empty branch selections rejected without partial writes.
- Admin management reads, creates, updates, and toggles rejected; operational options remain scoped even with a forged branch selection.
- Shared account movements retain their actual branch. Unassigned branch postings and spending another branch's balance are rejected.
- Per-branch balances, pre-period opening balances, account statements, ledger report rows, report branch labels, and dashboard totals remain separated. Consolidated totals count shared accounts once.
- Existing customer isolation, branch-scoped operational lists, report isolation, supplier/client settlements, payment retries, reversals, and financial report reconciliation pass.
- Unused payment account reassignment removes it from its previous branch's listing.

## Fixes from this verification

- Scoped shared account balances, statements, dashboard totals, and ledger movement queries to the requested/authorized branch.
- Ledger rows and summaries use the correct branch identifiers and names.
- Expense and unpaid invoice payment selectors recognize all assigned branches.

## Reproduce

Run from backend:

    node scripts/run-settings-isolation.js
    node node_modules/vitest/vitest.mjs run --config vitest.shared-settings.config.js

The integration runner uses the configured database connection only to create a uniquely named temporary test database. Migrations, seed data, and test mutations run there. The runner drops that temporary database afterward. It does not reset or seed the application database.

## Limits

This is targeted automated API/database verification, not a complete run of every repository test. Browser interaction and visual verification of the dropdown were not performed in this run.
