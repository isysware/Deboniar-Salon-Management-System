# SalonOS working notes and current flows

Saved: 2026-10-08. Workspace: `D:\Isysware works\Salon Software`.

Read this file when resuming this work. Keep completed changes and existing data/design; inspect the current diff before making further edits. This file is the persistent handoff for this conversation.

## Current status

### Payroll period correction (2026-10-08)

The Payroll page now forwards compensation type and period to the API. Select Daily for a single date (daily salary / daily plus commission), Full month for monthly contracts, or Custom dates within the selected month for monthly proration or a mixed group. Selecting a daily employee or daily compensation type selects Daily automatically. Commission-only staff retain zero salary base and their separate Staff Commission flow.

Custom monthly salary and recurring allowances follow branch calendar/working-day proration policy. Attendance, approved OT and canonical commission are limited to the selected dates. Loan installments remain capped by balance and monthly recovery allowance; one-off adjustments are consumed once. Independent employee/contract runs in one month can finalize, while overlapping dates for the same employee are rejected, including holidays/off days. Equivalent draft regeneration preserves other employee/type/date/period drafts. Actual dates appear in run headers, payslip details, print and CSV.

Express validation rejects invalid real dates, reversed ranges, cross-month ranges, invalid compensation types and multi-day Daily runs. No schema change or live-data reset was needed. Period payroll in mock mode explicitly requires the live API, avoiding unsupported estimated payouts.

Verification: full isolated backend run passed **23 files / 224 tests** (101.31s, exit 0). Final focused run after tightening equivalent-draft matching and exercising all five contract filters through Express passed **2 files / 25 tests** (20.22s, exit 0). Frontend `npm run lint` (TypeScript) and final `npm run build` passed. Existing Vite native-config and large-bundle warnings remain. Tests cover monthly custom proration, scoped OT/commission, separate consecutive periods, overlap rejection, combined payment/reversal, allowance/loan proration, adjustment consumption, draft replacement, contract selection and invalid HTTP inputs. Manual browser interaction was not performed.

Quick test: Payroll → select employee/compensation → Daily and date, or Full month, or Custom dates within month → Generate Preview → check separate salary/OT/deductions/commission lines → Finalize → Pay. Daily commission example remains 1,000 + 150 OT + 100 commission = 1,250 before deductions.

- Combined payroll commission implementation was already present when this session resumed. It was preserved and verified; incorrect test expectations were corrected and additional concurrency/refund tests added.
- Fixed the payroll page's "Route not found": frontend calls `GET /api/v1/payroll/runs`, but the Express GET registration was missing. Connected it to the existing `listRuns` service.
- Completed and fixed confirmed issues in loan, leave, overtime and tips management. Detailed findings: [HR-AUDIT.md](HR-AUDIT.md). Payroll rules: [payroll.md](payroll.md).
- User is currently manually testing staff commission generation. They reported that commission was not appearing; short reproduction steps were supplied. No specific failing staff/invoice/date or browser reproduction has been supplied yet. Do not describe that user-side symptom as conclusively resolved without reproducing their case.
- No commit or remote deployment was made in this session. The changes are saved in the local workspace. The local backend was restarted after Prisma client generation and verified with authenticated requests.

## Commission generation and combined payroll

1. Before making a sale, configure the staff as `DAILY_PLUS_COMMISSION`, `MONTHLY_PLUS_COMMISSION` (UI: Salary + Commission), or `COMMISSION_ONLY`, with a positive percentage rate. For the example, enter 10%.
2. In POS, assign that staff to the service line or package component and complete/post a new invoice. Commission eligibility and the rate are snapshotted at invoice posting. Changing staff terms does not retroactively create commission for old invoices.
3. POS writes canonical `CommissionEvent` EARN records using net attributed sales after discounts, excluding tax and tips. Refunds write REVERSAL records. Dues collections do not create new commission.
4. In Staff Commission, select a range containing the invoice's business/system date and generate a preview. A 1,000 service net at 10% gives 100 commission.
5. For combined payroll, complete attendance, approve eligible overtime, and generate payroll for the appropriate staff/period. Previews only estimate eligibility and never authorize commission payout.
6. Payroll finalization re-evaluates commission and atomically finalizes/claims canonical events and links statements to the payslip. Existing finalized statements contribute only unpaid balances, and their full date range must fit within the payroll period.
7. Payslip lines separate salary, overtime, loan recovery/other deductions, net salary, commission and combined net payable. Example: 1,000 salary + 150 approved OT + 100 eligible commission = 1,250 before deductions.
8. Payments settle salary first, then commission. Payroll salary amounts and canonical commission payments retain separate accounting/reporting. Linked commission must be paid/reversed through Payroll and cannot also be paid through Staff Commission.
9. Combined payment reversal restores both portions atomically. Cancellation requires reversal of completed payments, releases payroll-created commission events and unlinks existing statements. A refund can block a stale finalized commission amount until payroll is cancelled and regenerated.

Useful diagnostic checks if the user's commission is still zero:

- Was the invoice posted after the staff's commission terms were saved?
- Is the staff assigned to the actual service/component, and is its net commission base positive?
- Does the selected date range match the invoice business date, rather than assuming the computer's real date?
- Were the events already consumed by a finalized Commission or Payroll run? Check existing statement links and payment history before generating again.
- Is the invoice refunded/voided? Do not pay stale previews or bypass canonical records.

## Loans / salary advances

- Issue advance: money leaves the selected bank account or the actor's cash drawer; creates a receivable, not a salon expense.
- A preview projects recovery; finalization reserves the recovery. Salary deductions are capped by available salary and the remaining loan balance; existing daily installment proration uses the configured divisor.
- Cancelling unpaid/reversed payroll releases recoveries. An advance cannot be reversed while active payroll recoveries exist.
- Loan issuance retries persist their successful response within the money transaction; concurrent retries debit once. Loan reversal and payroll finalization share a branch lock.
- Existing policy still blocks a new advance whose recovery start month already has finalized payroll. Do not silently change this business rule without discussing the intended behavior.

## Leave and attendance

- Admin marks paid/unpaid leave; scheduled working days exclude Sundays and configured holidays. Paid allowance is validated separately for every affected month/year, including boundary-crossing leave.
- Leave cannot overwrite recorded presence/missing punches or change a finalized payroll period. Concurrent requests cannot overspend the allowance.
- Cancelling leave deletes its synthetic rows and restores an existing absent row if leave replaced it. Cancel payroll first if the period is frozen.
- Attendance creation/correction/import and leave mutations serialize with payroll. Dates and punch times receive real calendar/time validation.
- Staff reads are limited to their linked profile; missing staff linkage is rejected.

## Overtime

- Enter manual OT as draft/submitted, then approve it. Approval snapshots the rate; only approved minutes reach payroll.
- Active duplicate creation is prevented under concurrency. The existing intentional-additional-OT notes convention remains supported.
- Finalized payroll consumes/locks approved OT. Cancellation releases the payroll link. Date/range list filters now work.
- Status changes serialize with payroll so an OT cancellation cannot contradict a finalized payslip snapshot.

## Tips

- POS tip collection creates a separate staff liability. Allocation assigns that liability to staff without moving money; payout moves money and reduces it.
- Each recipient amount is rounded before total validation; zero-cent amounts are rejected. Partial payout retries debit once.
- Allocation, cancellation, payout, reversal and customer refund operations share locks. An allocation with completed payouts cannot be cancelled until those payouts are reversed.
- Reversal uses its own business date and restores liability. Cash reversal validates and credits the UI-selected open drawer in the payout branch.
- Allocation cancellation records both the real audit timestamp and a separate business date. Historical rows retain their timestamp fallback. Cancelled allocations have zero current outstanding.
- Tips Management's Net Collected excludes refunded tips. Statement identity: opening + net collection - net payouts = closing = unallocated + allocated unpaid; variance should be zero.

## Saved verification evidence

Last completed audit validation:

| Check | Actual result |
| --- | --- |
| Backend `npm run test:isolated` | 23 files, **215/215 tests passed**, exit 0; includes 14 new HR audit cases |
| Frontend `npm run lint` | TypeScript check passed, exit 0 |
| Frontend `npm run build` | Production build passed, exit 0 |
| Prisma migration status | 9 migrations; schema up to date |
| Local authenticated API checks | Payroll, loans, leave, overtime and tips endpoints returned 200 |
| Local tips reconciliation | Statement variance 0 |
| Diff whitespace check | Passed |

Existing build warnings: Vite native-config compatibility and large JS bundle. No manual browser interaction was performed for the HR audit; UI changes were source-reviewed and typechecked/built.

These results describe the completed audit run, not an automatic guarantee for subsequent workspace changes. Other edits in POS/catalogue/appointments were appearing concurrently; preserve those changes and rerun appropriate checks after new edits.

## Important files and safe test commands

- `Salon Software Backend/src/lib/hrTransactions.js`: shared payroll/HR branch lock, finalized-period checks, atomic loan/tip request replay.
- `Salon Software Backend/src/modules/payroll/payroll.routes.js`: restored runs GET route and advance request key forwarding.
- `Salon Software Backend/src/modules/commission/payrollCommission.js`: canonical combined-payroll commission eligibility and ownership.
- `Salon Software Backend/src/modules/payroll/payroll.extras.service.js`: loans/recovery integration.
- `Salon Software Backend/src/modules/attendance/attendance.service.js` and `overtime.service.js`: leave/attendance/OT invariants.
- `Salon Software Backend/src/modules/tips/tips.service.js`: tips lifecycle/reconciliation.
- `Salon Software Backend/prisma/migrations/20261008120000_hr_tips_audit/migration.sql`: additive cancellation-date column, already applied locally.
- Tests: `20-payroll-combined-commission.test.js`, `21-api-route-contract.test.js`, `22-hr-management-audit.test.js`.

Run backend tests from `Salon Software Backend`:

```powershell
npm run test:isolated
# Focused audit run:
npm run test:isolated -- tests/22-hr-management-audit.test.js
```

The isolated runner creates and removes its own temporary *_test database. An earlier normal shared-database run was invalidated by another process resetting that database. Never reset the live `salonos` database for testing. `tests/globalSetup.js` skips client regeneration because a running Windows backend can lock the Prisma DLL; generate the client separately after schema changes and briefly restart only the confirmed backend process if needed.

Run frontend checks from `Salon Software Frontend`:

```powershell
npm run lint
npm run build
```

Resume priority: if the user still sees zero commission, reproduce their specific staff/new invoice/business date and inspect canonical events and statement ownership before changing calculations. Preserve all completed payroll/HR safeguards and existing data/design.
