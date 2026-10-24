# Loan, leave, overtime and tips audit — 2026-10-08

Audited the frontend requests and calculations, Express routes and authorization, canonical records, payroll integration, money movements, refunds, reversals and concurrent operations. Existing unrelated workspace changes were preserved.

| Area | Confirmed issue | Result |
| --- | --- | --- |
| Loans | Concurrent HTTP retries could issue two advances before the middleware response cache existed. | The successful response is persisted inside the advance transaction under a request lock; retries return the original advance. |
| Loans | Reversal could race with payroll finalization and leave recoveries on a reversed advance. | Both operations use the payroll branch lock and re-read the current loan/recoveries. |
| Leave | A leave crossing a month/year boundary charged its full day count to both periods and validated only the starting period. | Working days are counted per allowance period; every requested period is validated. Existing canonical attendance dates are used for backend allowance usage. |
| Leave | Marking leave could overwrite actual attendance; cancelling leave over a prior absent row could leave paid-leave status behind. | Attendance conflicts are rejected; cancelling a voucher restores pre-existing absent rows and removes synthetic leave rows. |
| HR inputs | Leave, attendance and overtime mutations could race with, or modify periods covered by, finalized payroll. | Shared branch locking and staff/period checks preserve finalized inputs. Cancel payroll before changing covered HR records. |
| Overtime | Concurrent creation could produce duplicate active vouchers; API date filters were ignored. | Creation and status changes serialize with payroll; date/range filters are applied. |
| Access | A staff actor without a linked staff profile could fall through to an unrestricted list query. | Attendance, leave and overtime list services reject unlinked staff actors. |
| Tips | Partial payout retries, allocation cancellation and customer refunds could race. | Payout response persistence and shared branch/row locks prevent repeated payouts and contradictory allocation/refund states. |
| Tips | Allocation validation summed unrounded recipient amounts instead of the actual stored cents. | Each recipient is rounded first; the stored amounts are summed and validated. Zero-cent allocations/payouts are rejected. |
| Tips reports | Allocation cancellation used the actual audit timestamp instead of the business date; cancelled allocations still displayed an outstanding amount. | A nullable cancellation business date is stored; historical records retain their previous timestamp fallback. Cancelled outstanding is zero. |
| Tips UI | “Net Tips Collected” included refunded tips; the selected cash reversal drawer was ignored. | Net collection uses the receipt's allocated plus unallocated balance. Cash reversal validates and credits the selected open drawer in the payout branch. |
| Validation | Impossible dates and invalid punch times passed format-only validation. | HR and tips routes validate real dates; HR punch times validate hour/minute ranges. |
| Request keys | An HTTP response cached for one operation could be replayed on a different route. | Reuse across routes returns `IDEMPOTENCY_CONFLICT`. |

## Actual verification

- `npm run test:isolated`: **23 test files, 215 tests passed**, exit 0. Includes 14 new HR audit tests and the existing payroll, commission, loans, attendance, tips, reporting and API route tests.
- Frontend `npm run lint` (`tsc --noEmit`): **passed**, exit 0.
- Frontend `npm run build`: **passed**, exit 0. Existing Vite native-config and large-bundle warnings remain.
- `prisma migrate status`: **up to date**, 9 migrations. The additive tips cancellation-date migration was applied and the Prisma client regenerated.
- Authenticated checks against the running local backend: advances, leaves, overtime, tip receipts, allocations and statement all returned **200**; the live tips statement reported **variance 0**.
- `git diff --check`: **passed**.

One earlier shared-database test run was invalidated by a simultaneous database reset. The final suite ran against an independently created temporary test database, which was removed afterward. Use `npm run test:isolated` when other test work is running.

## Existing rules and verification limits

Loan recoveries are reserved at payroll finalization, released on cancellation, and cannot be reversed while active recoveries exist. Daily loan installment proration uses the configured divisor (30 in the audit fixture). The existing restriction on issuing an advance whose recovery start month already has finalized payroll remains in force. Paid leave excludes Sundays and configured branch holidays; only approved overtime reaches payroll. Tips remain a staff liability separate from salary, commission and salon income.

Live verification used read-only financial endpoints. Mutation, money movement, concurrency and historical-report scenarios ran on isolated test data. Frontend changes were source-reviewed and typechecked/built; no manual browser interaction was performed.
