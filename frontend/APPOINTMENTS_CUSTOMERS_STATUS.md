# APPOINTMENTS & CUSTOMERS MODULE STATUS

**Date**: 2026-10-01  
**Project**: SalonOS (iSysware Salon Management System)  
**Batch**: Connected Frontend Batch (Appointments, Customers CRM, POS Queue, Reporting)

---

## 1. Targeted Handoff Check (Historical Tips Across Date Boundaries) - COMPLETED & VERIFIED
- **Condition Verified**: Sept 30 payout reversed on Oct 1.
- **Rules Verified**:
  - Original Sept 30 payout remains captured in September historical reporting.
  - Reversal dated Oct 1 restores liability in October statement.
  - Closing liability strictly satisfies: `Opening Liability + Net Collected Tips - Net Disbursed Payouts`.
- **Test Status**: `Test 13` in `src/services/mock/__tests__/tipsPerformanceService.test.ts` passed (13/13 passing).

---

## 2. Core Service Layer & Invariants (Phase 3G) - COMPLETED & VERIFIED
- **Service Methods Added**:
  - `getAppointments(branchId, dateOrFilter, actor)`
  - `getAppointment(id, actor)`
  - `createAppointment(input, actor)`:
    - Customer lookup / auto-creation with phone normalization.
    - Active catalogue item and staff validation for assigned branch.
    - Sequential slot calculation for services and package components.
    - Staff working schedule shift checks (including overnight shifts).
    - Staff approved leave conflict checks.
    - Overlap conflict detection with existing active bookings (`status !== 'CANCELLED' && status !== 'NO_SHOW'`).
    - Adjacent slots ($End_A = Start_B$) explicitly allowed.
  - `updateAppointment(id, input, actor)`: Revalidates shifts and availability.
  - `updateAppointmentStatus(id, newStatus, cancelReason, actor)`:
    - Cancelling / No-Show releases slot.
    - Prevents silent cancellation / no-show of billed appointments.
    - Moves no financial assets.
  - `rescheduleAppointment(id, newDate, newStartTime, reason, actor)`: Revalidates availability and appends to `rescheduleHistory`.
  - `prepareConfirmationMessage(appointmentId, actor)`: Formats unverified notification text with clean WhatsApp link.
  - `getAppointmentQueue(branchId, date, actor)`: Scoped unbilled confirmed/checked-in/in-service/completed queue for POS.
  - `createClient(input, actor)`, `updateClient(id, input, actor)`, `archiveClient(id, isArchived, actor)`, `getClientDetails(id, actor)`:
    - Non-destructive archiving preserving historical snapshots.
    - Deduplicated visit count derived from completed appointments and non-dues sales invoices.
  - `getAppointmentReport(branchId, startDate, endDate, filters, actor)`:
    - Scheduled date filtering.
    - Separation of quoted estimated price from actual linked invoice net sales.
    - Deduplication of linked invoices in financial totals.
  - `postPOSInvoice` updated with atomic appointment linking, duplicate billing prevention, and `packageComponentsSnapshot`.
- **Test Suite**: `src/services/mock/__tests__/appointmentBookingCustomerService.test.ts` (10/10 tests passed).
- **TypeScript Compilation**: `tsc --noEmit` exits with 0 errors.

---

## 3. UI Implementation Progress
- [x] **Module 1**: Appointment Calendar & Booking UI (`/operations/appointments`) - COMPLETED
  - Spacious monthly calendar grid with month/year navigation (`Today`, `Previous`, `Next`).
  - Month/Day calculations with today indicator and overflow badge `+N more`.
  - Day appointments dialog with "Add for this date" quick booking.
  - Multi-dimensional filters: Branch, Staff Member, Appointment Status, Billing Status, and live Search.
  - Responsive List / Table view toggle with sortable columns and status badges.
  - `BookingFormModal`: 6-step form with customer search / quick creation, branch catalogue, multi-staff package component assignment, instant conflict detection, and Save Pending vs Save & Confirm.
  - `AppointmentDetailsModal`: Reference, customer details, branch, timings, assigned staff for services/package components, price, notes, audit trail (created, updated, confirmed), linked invoice, and state-based actions (Confirm, Check In, Start Service, Complete Service, Cancel, No-Show, Reschedule, Open in POS).
  - `RescheduleModal`: Date/time adjustments with reason logging and availability revalidation.
  - `ConfirmationMessageModal`: Unverified message preview with Copy Message and WhatsApp dispatch link.
  - Mounted in `AppRouter.tsx` on `/operations/appointments`.
- [x] **Module 2**: Customer Directory & History UI (`/operations/clients`) - COMPLETED
  - Customer directory table with search (name, normalized phone digits, email), branch scope, acquisition source filters, and active vs archived views.
  - Summary KPI cards: Total Clients, Active in System, Completed Client Visits, and Outstanding Receivables.
  - `ClientFormModal`: Add/Edit customer modal requiring name and valid normalized phone, supporting branch selection, customer acquisition source, source details, email, and preferences.
  - `ClientDetailsModal`: Complete customer relationship history featuring:
    - Profile header with contact, branch, and notes.
    - KPI cards: Deduplicated Completed Visits (derived from appointments and sales invoices), Last Visit Date, Total Lifetime Spend (excl. tax & tips), Current Loyalty Points, and Outstanding Dues.
    - Appointments History tab: scheduled dates, timings, service items, staff, prices, and status.
    - Invoices History tab: invoice numbers, dates, net sales, taxes, totals, and payment balances.
    - Receipts & Payments tab: chronological payment log with method, deposit account, and cashier.
    - Outstanding Dues tab: unpaid invoices with one-click collection action.
    - Quick actions: "New Appointment", "Open in POS", "Edit Profile".
  - `CollectDuesModal`: Direct payment settlement against outstanding customer invoices via physical Cash (with tender/change calculations) or Online Bank Account, preserving full idempotency.
  - Non-destructive archiving preserving historical invoice snapshots.
  - Mounted in `AppRouter.tsx` on `/operations/clients`.
- [x] **Module 3**: POS Appointment Queue & Billing Handoff (`/pos`) - COMPLETED
  - Added dedicated "Appointments Queue" trigger with live unbilled badge count in the POS header bar.
  - `AppointmentQueueSheet`: Branch-scoped queue drawer defaulting to today with custom date picker, real-time search, status labels (`CONFIRMED`, `CHECKED_IN`, `IN_SERVICE`, `COMPLETED`), and service / staff breakdown.
  - `CartOverwritePromptModal`: Strict cart protection modal preventing silent overwrite of active cart items; offers explicit "Replace Cart Items" or "Keep Existing Cart".
  - Multi-staff package component preservation during handoff: retains line instance IDs, component allocation percentages, allocated amounts, and designated stylists.
  - Booking quote price discrepancy detection: compares quoted booking price against canonical catalogue price, displaying an amber warning banner with mandatory acknowledgment checkbox.
  - Linked appointment banner in cart with client identity, appointment number, and unlinking control.
  - Atomic invoice billing handoff: carries `appointmentId` into `postPOSInvoice`, marking the appointment as `BILLED`, locking duplicate invoice generation, snapshotting package components, and updating queue counters.
  - Deep-link support via hash/URL query parameter (`?appointmentId=...` and `?clientId=...`).
- [x] **Module 4**: Dedicated Appointment Report UI (`/reports/appointments`) - COMPLETED
  - Strict read-only audit controls (operational modifications exclusively in `/operations/appointments`).
  - Scheduled date range filter with quick presets (`Today`, `Yesterday`, `This Week`, `This Month`, `Last Month`, `Custom Range`).
  - Multi-dimension audit filters: Branch, Appointment Status, Billing Status, Staff Member, Customer Acquisition Source, and Text Search.
  - KPI summary cards: Total Bookings, Quoted Booking Value, Actual Net Sales Realized, Confirmed/Pending, Completed, and Cancelled/No-Show.
  - Detail audit data table with customer name, phone, branch, services & assigned staff, status badges, billing badges, quoted price, realized net sales, and operational view link to `/operations/appointments`.
  - Print Preview modal rendering formatted printable audit statement with headers, metadata, KPIs, and itemized table.
  - Filter-aware CSV export generating RFC 4180 compliant downloaded reports.
  - Mounted in `AppRouter.tsx` on `/reports/appointments`.
- [x] **Navigation & Permission Wiring** - COMPLETED
  - Updated `src/config/navigation.ts`: Registered `rep-appointments` (`/reports/appointments`) under Reporting navigation.
  - Updated `src/lib/permissions.ts`: Added route permissions for `/reports/appointments` and synonyms (`/reports/appointment-audit`, `/appointments`, `/clients`).
  - Role portal enforcement: `SUPER_ADMIN` and `ADMIN` have full operational and reporting access; `ACCOUNTANT` has read-only appointment reporting, POS queue, and dues settlement access; `STAFF` is restricted to personal workspace (`/my-performance`, etc.).
  - Production build (`vite build`) and TypeScript typecheck (`tsc --noEmit`) verified with 0 errors.
