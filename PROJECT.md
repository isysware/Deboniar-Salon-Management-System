# SalonOS (iSysware) — Project Context & Backend + Integration Plan

> Updated: 2026-10-01 · Target: 1 week (Day 1 → Day 7)
> Order: **Backend from zero (module by module) → Frontend integration → QA**
> Backend stack: **Node.js + Express.js + Prisma + PostgreSQL + JavaScript (ESM)**
> Finance/reporting rules: `SalonOS Reporting Inventory Financial Flow Specification.pdf` (v1.0)

---

## 0. Current Status (updated 2026-10-02)

### Progress
| Step | Module | Backend | Tests | Frontend integrated |
|---|---|---|---|---|
| 0 | Setup (Express, Prisma, middleware, seed) | ✅ | — | ✅ Vite proxy, env switch |
| 1–8 | Auth, Branches, Users, Settings, Staff, Catalogue, Clients, Appointments | ✅ | ✅ | ✅ |
| 9 | 💰 Cash drawers, vault, transfers, custody statement | ✅ | ✅ | ✅ |
| 10 | 📦 Inventory & Suppliers | ✅ | ✅ | ✅ |
| 11 | 🧾 POS checkout, invoices, dues collection, refunds | ✅ | ✅ | ✅ |
| 12 | 💸 Expenses (draft → post → reverse) + categories | ✅ | ✅ | ✅ |
| 13 | 🤝 Settlements (submit → approve/reject) | ✅ | ✅ | ✅ |
| 14–15 | 🕒 Attendance, leaves, holidays, manual overtime | ✅ | ✅ | ✅ |
| 16–18 | 💵 Payroll, 📊 Commission, 🪙 Tips | ✅ | ✅ | ✅ |
| 16+ | 💵 Payroll v2: allowances, adjustments, salary advances, exit proration, monthly salary+commission summary, `/reports/staff-salary` + `/reports/staff-commission` (see `payroll.md`) | ✅ | ✅ | ✅ |
| 19 | 📈 Dashboards (`/dashboard/super-admin|admin|accountant|staff`) | ✅ | E2E | ✅ |
| 21 | 📊 Comprehensive 11 Canonical Reports Suite (Sales, Income/Expense, Profit, Drawers, Expenses, HR, Inventory) | ✅ | ✅ (31 tests) | ✅ All 11 pages wired |
| 22 | 🧭 Audit log / general ledger APIs (`/audit-events`, `/ledger`) & UI (`ActivityLogPage`, `GeneralLedgerPage`) | ✅ | ✅ | ✅ |

**Live mode has no mock fallback.** `httpSalonService` implements every `SalonServiceContract` method against the API; no page imports `mockSalonService`/`mockData`; business date comes from `/system/date`. The mock is used only when `VITE_USE_MOCK=true`.

**Verification (2026-10-02):** backend 139/139 tests (14 test files); frontend `tsc` clean; browser sweep of 79 page×role combinations = 0 failed API calls / 0 console errors; 50-step write-flow E2E through the real `salonService` (POS partial pay + tip → dues → expense post/reverse → settlement submit/approve → attendance/leave/overtime → payroll preview → commission finalize/pay/reverse → tips allocate/payout/reverse → dashboards, reports, staff portal).

### How to run
```bash
# 1) Backend  (PostgreSQL must be running; DB: salonos)
cd "Salon Software Backend"
npm install
npx prisma migrate deploy      # first time / after pulling migrations
npm run db:seed                # demo data with the same ids as the frontend mock
npm run dev                    # http://localhost:5000/api/v1

# 2) Frontend
cd "Salon Software Frontend"
cp .env.example .env           # VITE_USE_MOCK=false → API mode
npm run dev                    # http://localhost:3000  (/api is proxied to :5000)

# Tests (backend, uses separate DB salonos_test — reset automatically)
npm test
```
Set `VITE_USE_MOCK=true` in the frontend `.env` to run fully offline on the old mock.

### Integration design
- `src/services/http/apiClient.ts`: fetch wrapper. Access token in memory, httpOnly refresh cookie, one automatic refresh+retry on 401, `Idempotency-Key` on money/stock writes, API errors thrown as `Error(message)`.
- `src/services/http/httpAuthService.ts`: API login/logout/restore-on-reload.
- `src/services/http/httpSalonService.ts`: every contract method → one API call (no mock fallback).
- Payroll finalize is blocked until attendance for the month is complete (finalize each day on the Attendance page first).

### Backend decisions that differ from the mock (spec wins)
- **Inventory:** purchase landed cost includes the allocated header discount. Each purchase line is its own cost layer (batches are never merged).
- **Cash:** branch **Vault** (admin safe) and user **Drawers** are both cash holders. Float transfers debit the vault. Balances are always derived from movements.
- **Appointments:** strict status flow. NO_SHOW only from PENDING/CONFIRMED; nothing changes after COMPLETED/CANCELLED. The UI may show a No-Show button on later statuses, and the API will reject it with a clear message.
- **Pay data:** Accountants get staff lists with pay fields redacted.
- **Migrations:** in non-interactive shells use `npm run db:new-migration -- <name>` (diff → apply). Review the SQL when a column is renamed.

---

## 1. Project Context

**What it is:** A multi-branch salon management system for iSysware (client: Aliyan Salon Management). Branches: Gulberg Flagship Lounge, Lahore (`LHE-01`, 16% PST) and Clifton Luxury Suites, Karachi (`KHI-02`, 13% SST). Currency is PKR and the timezone is `Asia/Karachi`.

**Current state (checked 2026-10-01)**
- **Frontend** (`Salon Software Frontend/`): React 19 + Vite + TypeScript + Tailwind + shadcn/ui. 20 modules are built, and `tsc` passes with 0 errors. All data currently comes from a **mock service** (`src/services/mock/mockSalonService.ts`, localStorage).
- **Backend / DB:** ❌ nothing exists yet. This plan builds it.
- **Backend contract:** `src/services/salonService.ts` has about 165 methods, and the shapes are in `src/types/salon.ts` and `auth.ts`. **The backend must return exactly these JSON shapes (same field names, camelCase)**, so integration only swaps the service and doesn't require changes to every page.

**Folder layout (target)**
```
Salon Software/
├── PROJECT.md
├── SalonOS ... Specification.pdf
├── Salon Software Frontend/      ← existing
└── Salon Software Backend/       ← NEW (this plan)
```

**Roles**
| Role | Scope | Restriction |
|---|---|---|
| SUPER_ADMIN | All branches (`branchId = 'ALL'` or any one) | Only role that creates branches |
| ADMIN | Assigned branch only | — |
| ACCOUNTANT | Assigned branch: POS, expenses, custody, financial reports | No attendance, OT, payroll, commission, tips, or staff reports |
| STAFF | Own records only, read-only | No POS, appointments, or salon financials |

**Demo accounts (seed these):** `superadmin@isysware.com / Super@Salon2026`, `admin.gulberg@isysware.com / Admin@Gulberg2026`, `accountant.gulberg@isysware.com / Accountant@2026`, `zara.stylist@isysware.com / Staff@Zara2026`

**Locked accounting rules (must hold in every module)**
1. Tax is a liability. It never counts as income, profit, or commission base.
2. Tips are a staff liability. They never count as income or commission base.
3. Commission = staff-attributed **net sales after discount** × rate snapshot. A package is one sale split by component weights; adding staff never multiplies the price.
4. Inventory is valued at historical landed cost (FEFO for expiry items, FIFO otherwise). Purchases and supplier payments are **not** COGS.
5. Settlements and transfers move custody. They are not income or expense. Old dues collection is not a new sale.
6. Financial records are never deleted. Refunds, voids, and reversals are **dated events**.
7. Money uses `Decimal(14,2)` (Prisma `Decimal` + `decimal.js`), never JS float math for totals.
8. Every money/stock POST carries an `Idempotency-Key`, so a retry never causes a double debit, refund, or stock deduction.

---

## 2. One-Week Overview

| Day | Steps | Modules |
|---|---|---|
| **Day 1** | 0 → 4 | Setup · 🔐 Auth · 🏢 Branches · 🛡️ Users · ⚙️ Branch Settings |
| **Day 2** | 5 → 8 | 👥 Staff · ✂️ Services & Packages · 🙋 Clients · 📅 Appointments |
| **Day 3** | 9 → 10 | 💰 Cash Drawers & Account Ledger · 📦 Inventory & Suppliers |
| **Day 4** | 11 → 13 | 🧾 POS & Invoices · 💸 Expenses · 🤝 Settlements & Custody |
| **Day 5** | 14 → 18 | 🕒 Attendance & Leave · ⏱️ Overtime · 💵 Payroll · 📊 Commission · 🪙 Tips |
| **Day 6** | 19 → 22 | 📈 Dashboards · 👤 Staff Portal · 📑 Reports · 🧭 Audit Log · backend tests |
| **Day 7** | Phase C | 🔌 Frontend integration (all modules) + QA + deploy prep |

> ⚠️ This is a very tight week for about 165 endpoints. Each step has a **Done check**. Don't start the next module until the current module's Done check passes, because later modules depend on earlier ones (e.g. POS needs Staff, Catalogue, Clients, Drawers, and Inventory).

### Module dependency order
```
Setup → Auth → Branches → Users → Settings(Tax, Payment Accounts)
      → Staff → Catalogue → Clients → Appointments
      → Cash Drawers/Account Ledger → Inventory & Suppliers
      → POS & Invoices → Expenses → Settlements
      → Attendance → Overtime → Payroll → Commission → Tips
      → Dashboards → Staff Portal → Reports → Audit view
```

---

## 3. Standard Request Flow (every endpoint follows this)

```
Request
  → helmet / cors / express.json
  → authenticate        (verify JWT → req.user)
  → authorize(...roles) (403 if role not allowed)
  → branchScope         (ADMIN/ACCOUNTANT/STAFF forced to req.user.branchId;
                         SUPER_ADMIN may pass ?branchId= or ALL)
  → idempotency         (money/stock POSTs only: replay saved response if key seen)
  → validate(zodSchema) (400 with field errors)
  → controller          (reads req, calls service, sends res)
  → service             (business rules; prisma.$transaction for multi-table writes)
  → audit.log(...)      (inside the same transaction)
  → mapper.toDTO()      (DB row → frontend type shape)
  → res.json({ data })
Errors → errorHandler → { error: { code, message, details? } } with proper HTTP status
```

**Each module folder contains the same 5 files:**
```
src/modules/<module>/
  <module>.routes.js      ← router + middleware chain
  <module>.controller.js  ← thin: req → service → res
  <module>.service.js     ← business logic + Prisma queries
  <module>.schema.js      ← zod validation schemas
  <module>.mapper.js      ← Prisma row → frontend DTO
```

---

## 4. PHASE A — Backend Build (Step by Step)

---

### STEP 0 — Project Setup (Day 1 morning)

**Flow**
1. Create the folder and init:
   ```bash
   mkdir "Salon Software Backend" && cd "Salon Software Backend"
   npm init -y
   npm i express @prisma/client zod jsonwebtoken bcrypt cors helmet morgan dotenv decimal.js uuid cookie-parser
   npm i -D prisma nodemon vitest supertest
   npx prisma init
   ```
2. In `package.json`, set `"type": "module"` and add scripts: `dev: nodemon src/server.js`, `start: node src/server.js`, `db:migrate: prisma migrate dev`, `db:seed: node prisma/seed.js`, `test: vitest`.
3. Install PostgreSQL locally, create DB `salonos`, and fill in `.env`:
   ```
   DATABASE_URL="postgresql://postgres:password@localhost:5432/salonos"
   PORT=5000
   JWT_ACCESS_SECRET=...
   JWT_REFRESH_SECRET=...
   JWT_ACCESS_EXPIRES=15m
   JWT_REFRESH_EXPIRES=7d
   CORS_ORIGIN=http://localhost:3000
   TZ=Asia/Karachi
   ```
4. Folder structure:
   ```
   Salon Software Backend/
   ├── prisma/ schema.prisma · migrations/ · seed.js
   ├── src/
   │   ├── server.js                ← listen
   │   ├── app.js                   ← express app, middleware, mount /api/v1
   │   ├── routes.js                ← mounts every module router
   │   ├── config/  env.js · prisma.js (single PrismaClient)
   │   ├── middleware/ authenticate.js · authorize.js · branchScope.js
   │   │               idempotency.js · validate.js · errorHandler.js · notFound.js
   │   ├── lib/  AppError.js · asyncHandler.js · money.js (decimal helpers)
   │   │         sequence.js (INV-/PO-/OT- numbers) · audit.js · dates.js (Asia/Karachi)
   │   │         calculations/ (copy logic from frontend src/lib/*.ts → JS)
   │   └── modules/ auth · branches · users · settings · staff · catalogue · clients
   │                appointments · cash · inventory · pos · expenses · settlements
   │                attendance · overtime · payroll · commission · tips
   │                dashboard · portal · reports · audit
   └── tests/
   ```
5. Base Prisma models created now (used by every module):
   - `Sequence { id, branchId, prefix, year, lastValue }` with a unique `(branchId, prefix, year)`
   - `IdempotencyKey { key @id, userId, route, responseJson, createdAt }`
   - `AuditEvent { id, branchId?, userId, userName, action, entity, entityId, before Json?, after Json?, createdAt }`
6. Write the shared helpers:
   - `AppError(status, code, message)` and `asyncHandler(fn)`
   - `sequence.next(tx, branchCode, prefix)` locks the row (`SELECT ... FOR UPDATE`) and returns e.g. `INV-LHE-2026-0001`
   - `money.js`: `toDec`, `add`, `sub`, `mul`, `round2`, `splitWithRemainder(total, weights)` (the remainder goes to the last/largest part)
7. `GET /api/v1/health` returns `{ status: 'ok', db: 'ok' }`.

**Done check:** `npm run dev` starts, `/api/v1/health` returns 200, and `prisma migrate dev --name init` succeeds.

---

### STEP 1 — 🔐 Authentication (Login / Roles) · Medium · Day 1

**Prisma models**
- `User { id, name, email @unique, passwordHash, role (enum SUPER_ADMIN|ADMIN|ACCOUNTANT|STAFF), branchId? (null = ALL), staffId? @unique, title, phone?, avatarUrl?, isActive, createdAt, updatedAt }`
- `RefreshToken { id, userId, tokenHash, expiresAt, revokedAt?, createdAt }`
- `PasswordResetToken { id, userId, tokenHash, expiresAt, usedAt? }`

**Endpoints**
| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/auth/login` | public | Login with `{ email, password, portal }` |
| POST | `/auth/refresh` | public (cookie) | New access token |
| POST | `/auth/logout` | any | Revoke refresh token |
| GET | `/auth/me` | any | Current user + branch name |
| POST | `/auth/forgot-password` | public | Create reset token (logged/email later) |
| POST | `/auth/reset-password` | public | Set new password with token |
| POST | `/auth/change-password` | any | Old + new password |

**Flow — Login**
1. Validate the body with zod: `email`, `password`, `portal` (one of the 4 roles).
2. Find the user by email. If not found or `isActive=false`, return 401 `INVALID_CREDENTIALS` (use the same message for both cases).
3. Run `bcrypt.compare(password, passwordHash)`. On failure, return 401.
4. If `portal !== user.role`, return 403 `PORTAL_MISMATCH` with the message "This account belongs to the X portal". The frontend already shows this.
5. Sign an access JWT `{ sub, role, branchId, staffId }` (15m). Sign a refresh JWT (7d), save its **hash** in `RefreshToken`, and set it as an httpOnly cookie.
6. Write the audit event `LOGIN`.
7. Respond with the `Session` shape: `{ user, token, loginTime, activeBranchId }`. For SUPER_ADMIN, `activeBranchId='ALL'`.

**Flow — Refresh:** read the cookie → verify → find a non-revoked hash → **rotate** (revoke the old token, issue a new pair) → return the new access token.

**Middleware built in this step**
- `authenticate`: reads the `Authorization: Bearer` header, verifies the token, and loads the user (rejecting inactive users), then sets `req.user`.
- `authorize(...roles)`: returns 403 `FORBIDDEN` if the role is not in the list.
- `branchScope`: sets `req.branchId`. Non-super roles are always locked to their own branch. SUPER_ADMIN uses `req.query.branchId || 'ALL'`, and a mutation must name an explicit branch.

**Seed:** the 4 demo users with bcrypt-hashed passwords.

**Done check:** all 4 demo users can log in. Staff logging into the Super Admin portal gets 403. An expired token returns 401, and refresh then works. Logout means the old refresh token fails.

---

### STEP 2 — 🏢 Branches · Medium · Day 1

**Prisma model**
`Branch { id, name, code @unique, address, city, phone, email?, timezone default "Asia/Karachi", currency default "PKR", taxEnabled default false, taxRate Decimal, defaultTaxRuleId?, openingCashFloat Decimal, taxRegistrationNumber?, taxAuthority?, assignedAdminId?, isActive, createdAt, updatedAt }`

**Endpoints**
| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/branches` | all logged-in | SUPER_ADMIN sees all; others see only their own |
| GET | `/branches/:id` | scoped | One branch |
| POST | `/branches` | SUPER_ADMIN | Create |
| PUT | `/branches/:id` | SUPER_ADMIN | Update |
| POST | `/branches/:id/assign-admin` | SUPER_ADMIN | Link an ADMIN user |
| GET | `/branches/:id/deactivation-blockers` | SUPER_ADMIN | Lists open drawers, unpaid invoices, active staff, etc. |
| POST | `/branches/:id/deactivate` | SUPER_ADMIN | Only if there are no blockers |

**Flow — Create Branch**
1. Validate the input (`code` uppercase and unique, `openingCashFloat >= 0`).
2. In a transaction: create the branch, then create its default sequences, then write the audit event `BRANCH_CREATED`.
3. Return the `Branch` DTO (include `assignedAdminName` through a join).

**Flow — Deactivate:** call `checkBlockers()`. If the list is not empty, return 409 `BRANCH_HAS_BLOCKERS` with the list. Otherwise set `isActive=false` and write an audit event. The blocker list grows as later modules are added (drawers, invoices, appointments).

**Seed:** `LHE-01` Gulberg and `KHI-02` Clifton (copy the values from frontend `mockData.ts`).

**Done check:** ADMIN calling `GET /branches` sees only Gulberg. ADMIN calling `POST /branches` gets 403. A duplicate code returns 409.

---

### STEP 3 — 🛡️ Users & Access Control · Medium · Day 1

Uses the `User` model from Step 1.

**Endpoints**
| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/users` | SUPER_ADMIN, ADMIN | List (ADMIN sees own branch only) |
| GET | `/users/:id` | SUPER_ADMIN, ADMIN | One user |
| POST | `/users` | SUPER_ADMIN, ADMIN | Create |
| PUT | `/users/:id` | SUPER_ADMIN, ADMIN | Update name, role, branch, phone |
| POST | `/users/:id/deactivate` | SUPER_ADMIN, ADMIN | Disable and revoke tokens |
| POST | `/users/:id/reset-password` | SUPER_ADMIN, ADMIN | Set a temporary password |

**Flow — Create User**
1. Validate the input (email unique, role, `branchId` required unless SUPER_ADMIN).
2. Permission rules: ADMIN can only create ACCOUNTANT/STAFF users in **their own** branch, and cannot create SUPER_ADMIN or ADMIN users.
3. Hash the password, create the user, and write the audit event `USER_CREATED`.
4. Never return `passwordHash` (the mapper strips it).

**Done check:** ADMIN cannot create a user in Karachi. A deactivated user can no longer log in or refresh.

---

### STEP 4 — ⚙️ Branch Settings (Tax Rules, Payment Accounts, Expense Categories, Payroll Policy) · Medium · Day 1

**Prisma models**
- `TaxRule { id, branchId, name, rate Decimal(5,4), description?, isActive, isBranchDefault }`
- `PaymentAccount { id, branchId, name, accountType (BANK|EASYPAISA|JAZZCASH|OTHER), providerName, accountHolder, accountIdentifier?, openingBalance Decimal, isActive, createdAt }`. **No stored `currentBalance`**: the balance is computed from `AccountMovement` (Step 9) and returned in the DTO.
- `ExpenseCategory { id, branchId?, name, description?, isActive }`
- `PayrollPolicy { id, branchId?, absenceDivisor, prorationMethod, penaltyRule, updatedBy, updatedAt }`

**Endpoints**
| Method | Path | Roles |
|---|---|---|
| GET/POST | `/tax-rules` | read: all staff roles · write: SUPER_ADMIN, ADMIN |
| PUT | `/tax-rules/:id` · POST `/tax-rules/:id/toggle` · POST `/tax-rules/:id/set-default` | SUPER_ADMIN, ADMIN |
| GET/POST | `/payment-accounts` | read: SA, ADMIN, ACCOUNTANT · write: SA, ADMIN |
| PUT | `/payment-accounts/:id` · POST `/payment-accounts/:id/toggle` | SA, ADMIN |
| GET/POST/PUT | `/expense-categories` (+ `/:id/toggle`) | SA, ADMIN |
| GET/PUT | `/payroll-policy` | SUPER_ADMIN |

**Flow — Set Default Tax Rule:** in a transaction, set `isBranchDefault=false` on all of the branch's rules, set `true` on the chosen one, then update `branch.defaultTaxRuleId` and `branch.taxRate`. Write an audit event.
**Rule:** rate changes never touch old invoices, because invoices store a rate snapshot.

**Seed:** PST 16% (LHE), SST 13% (KHI); Meezan, HBL POS, and JazzCash for LHE; Alfalah, HBL POS, and Easypaisa for KHI; the default expense categories.

**Done check:** the branch default switches correctly, and ACCOUNTANT cannot create a tax rule.

---

### STEP 5 — 👥 Staff · Medium · Day 2

**Prisma models**
- `Staff { id, employeeCode, branchId, name, phone, email?, designation, roleTitle, joiningDate, compensationType (enum), baseSalary, dailySalaryRate, commissionRate, overtimeHourlyRate, effectiveDate, startTime, endTime, lateGraceMinutes, earlyGraceMinutes, isOvernightShift, allowedLeaveDays, leaveAllowancePeriod, lateInDeduction Json, earlyExitDeduction Json, payrollDivisor?, combinationPolicy, specialties String[], avatarUrl?, isActive, createdAt, updatedAt }` with a unique `(branchId, employeeCode)`
- `StaffCompensationHistory { id, staffId, snapshot Json, effectiveDate, changedBy, createdAt }`: keeps old rates so that history is never rewritten.

**Endpoints**
| Method | Path | Roles |
|---|---|---|
| GET | `/staff` (filters: branch, active, search) | SA, ADMIN, ACCOUNTANT (limited fields for ACCOUNTANT) |
| GET | `/staff/:id` | SA, ADMIN |
| POST | `/staff` | SA, ADMIN |
| PUT | `/staff/:id` | SA, ADMIN |
| POST | `/staff/:id/deactivate` | SA, ADMIN |
| POST | `/staff/:id/portal-access` | SA, ADMIN — create/enable/disable the linked STAFF user |

**Flow — Update Staff (compensation change)**
1. Validate the input. If any compensation field changed, `effectiveDate` is required.
2. In a transaction: insert the old values into `StaffCompensationHistory`, then update the staff row, then write the audit event (before/after).
3. Payroll and commission later read the rate **effective on that date**.

**Flow — Portal Access:** if enabling and no user is linked, create a `User(role=STAFF, staffId, branchId)` with a temporary password. If disabling, set `user.isActive=false`. Respond with `hasPortalAccess`, `linkedUserId`, and `linkedUserEmail`.

**Seed:** the staff from `mockData.ts` (Zara Alvi linked to `zara.stylist@isysware.com`).

**Done check:** an employee code is unique within its branch, and a rate change creates a history row.

---

### STEP 6 — ✂️ Services & Packages (Catalogue) · Medium · Day 2

**Prisma models**
- `ServiceCategory { id, branchId?, name, isActive }`
- `Service { id, branchId, categoryId, code, name, durationMinutes, price Decimal, taxTreatment (BRANCH_DEFAULT|SPECIFIC_RULE|EXEMPT), taxRuleId?, isActive }`
- `Package { id, branchId, code, name, price Decimal, taxTreatment, taxRuleId?, isActive }`
- `PackageComponent { id, packageId, serviceId, quantity, allocationPercentage Decimal, sortOrder }`

**Endpoints**
| Method | Path | Roles |
|---|---|---|
| GET/POST | `/service-categories` | read all · write SA, ADMIN |
| GET/POST, GET/PUT `/:id`, POST `/:id/toggle` | `/services` | read all · write SA, ADMIN |
| GET/POST, GET/PUT `/:id`, POST `/:id/toggle` | `/packages` | read all · write SA, ADMIN |

**Flow — Create Package**
1. Validate the input: at least 1 component, every `serviceId` is active and in the same branch.
2. **Σ allocationPercentage must equal exactly 100**, otherwise return 400 `ALLOCATION_NOT_100`.
3. In a transaction: create the package and its components, then write an audit event.
4. Return the `PackageItem` DTO with the components expanded (service code, name, and duration).

**Rule:** price and weight edits only affect **future** sales, because invoices snapshot them (Step 11).

**Done check:** a package with weights totalling 90% is rejected, and toggling a service doesn't break existing packages (it shows a warning).

---

### STEP 7 — 🙋 Clients / CRM · Medium · Day 2

**Prisma model**
`Client { id, branchId, name, phone, phoneNormalized, email?, gender?, dateOfBirth?, customerSource (enum), customerSourceDetails?, notes?, isArchived, createdAt, updatedAt }` with a unique `(branchId, phoneNormalized)`

**Endpoints**
| Method | Path | Roles |
|---|---|---|
| GET | `/clients` (search, source, page) | SA, ADMIN, ACCOUNTANT |
| GET | `/clients/search?q=` | SA, ADMIN, ACCOUNTANT (POS & booking quick search) |
| GET | `/clients/:id` | SA, ADMIN, ACCOUNTANT |
| GET | `/clients/:id/details` | Profile + appointments + invoices + dues (filled after Steps 8 and 11) |
| GET | `/clients/:id/outstanding` | Unpaid/partial invoices |
| POST | `/clients` · PUT `/clients/:id` · POST `/clients/:id/archive` | SA, ADMIN, ACCOUNTANT |

**Flow — Create Client**
1. Validate the input, then normalize the phone (`0300-1234567` / `+92300...` → `923001234567`).
2. If the normalized phone already exists in the branch, return 409 `CLIENT_EXISTS` with the existing client so the UI can select it.
3. Create the client and write an audit event.

**Done check:** the same number in two formats is detected as a duplicate.

---

### STEP 8 — 📅 Appointments · High · Day 2

**Prisma models**
- `Appointment { id, appointmentNumber, branchId, clientId?, clientName, clientPhone, customerSource?, date (Date), startTime, endTime, durationMinutes, price Decimal, status (enum), billingStatus (UNBILLED|BILLED), linkedInvoiceId?, notes?, createdBy/confirmedBy/cancelledBy ids+names+timestamps, cancelReason?, createdAt, updatedAt }`
- `AppointmentItem { id, appointmentId, lineInstanceId, type (SERVICE|PACKAGE), itemId, code, name, durationMinutes, unitPrice, staffId, startTime, endTime }`
- `AppointmentPackageComponent { id, appointmentItemId, componentInstanceId, serviceId, serviceCode, serviceName, durationMinutes, allocationPercentage, staffId, startTime, endTime }`
- `AppointmentReschedule { id, appointmentId, previousDate/Start/End, newDate/Start/End, reason?, byUserId, byName, at }`

**Endpoints**
| Method | Path | Roles |
|---|---|---|
| GET | `/appointments?date=&from=&to=&staffId=&status=` | SA, ADMIN |
| GET | `/appointments/:id` | SA, ADMIN |
| POST | `/appointments` | SA, ADMIN |
| PUT | `/appointments/:id` | SA, ADMIN (only PENDING/CONFIRMED and UNBILLED) |
| PATCH | `/appointments/:id/status` | SA, ADMIN |
| POST | `/appointments/:id/reschedule` | SA, ADMIN |
| GET | `/appointments/:id/confirmation-message` | SA, ADMIN (WhatsApp/SMS text) |
| GET | `/appointments/queue?date=` | SA, ADMIN, ACCOUNTANT (POS queue: CHECKED_IN/IN_SERVICE/COMPLETED + UNBILLED) |

**Flow — Book Appointment**
1. Validate the input: client (existing id, or a new client inline → reuses Step 7 create), date, start time, and items with staff.
2. Build **sequential slots**: each item or package component gets a `startTime`/`endTime` one after another, and `endTime` = start + Σ duration.
3. **Conflict check (inside the transaction)**: for each staffId, look for an overlapping slot on that date where status is not CANCELLED or NO_SHOW. If one exists, return 409 `STAFF_SLOT_CONFLICT` with details.
4. Check that each staff member is active and belongs to the branch, and that each service/package is active.
5. `price` = Σ item unit prices (a **quote only**: no sale, no commission, no stock movement).
6. Generate `appointmentNumber` (`APT-LHE-2026-0001`), create the appointment, items, and components, then write an audit event.
7. Set the status to `PENDING` or `CONFIRMED` (from "Save & Confirm").

**Status flow (allowed transitions)**
```
PENDING → CONFIRMED → CHECKED_IN → IN_SERVICE → COMPLETED
PENDING/CONFIRMED → CANCELLED (reason required) | NO_SHOW
BILLED appointments cannot be edited, rescheduled or cancelled.
```
**Flow — Reschedule:** save the old date/time in `AppointmentReschedule`, then rerun the conflict check (excluding this appointment), then update.

**Done check:** a double booking of the same stylist is rejected. Cancelling frees the slot. An invalid transition (e.g. COMPLETED → PENDING) returns 400.

---

### STEP 9 — 💰 Cash Drawers & Payment Account Ledger · High · Day 3

The money core. POS, expenses, payroll, tips, and suppliers all post through this module.

**Prisma models**
- `CashDrawer { id, branchId, custodianUserId, date, openingCash Decimal, status (OPEN|SETTLEMENT_PENDING|SETTLED), actualInDrawer?, variance?, closedAt?, settledAt?, successorDrawerId?, createdAt }`
- `DrawerMovement { id, drawerId, branchId, type (OPENING_FLOAT|CASH_SALE|CASH_TIP|DUES_COLLECTION|CASH_REFUND|EXPENSE|PAYROLL_PAYOUT|COMMISSION_PAYOUT|TIP_PAYOUT|SUPPLIER_PAYMENT|SUPPLIER_REFUND|TRANSFER_IN|TRANSFER_OUT|SETTLEMENT_OUT|ADJUSTMENT|REVERSAL), direction (IN|OUT), amount Decimal, sourceModule, sourceId, reference, userId, createdAt }`
- `AccountMovement { id, accountId, branchId, type (same idea), direction, amount, sourceModule, sourceId, reference, userId, createdAt }`
- `CashTransfer { id, branchId, fromDrawerId, toDrawerId, amount, reason, byUserId, createdAt }`

**Core service functions (`cash.service.js`, called by other modules inside their own transaction)**
- `getOpenDrawer(tx, userId)`: returns the OPEN drawer for this custodian, or throws `NO_OPEN_DRAWER`.
- `postDrawerMovement(tx, { drawerId, type, direction, amount, source... })`: locks the drawer row, and **for OUT movements checks `expected >= amount`**, otherwise throws `INSUFFICIENT_DRAWER_CASH`.
- `postAccountMovement(tx, {...})`: same, with an account balance check for OUT.
- `drawerExpected(drawerId)` = opening + Σ IN − Σ OUT (always computed, never stored).
- `accountBalance(accountId, asOf?)` = openingBalance + Σ IN − Σ OUT.

**Endpoints**
| Method | Path | Roles |
|---|---|---|
| POST | `/cash-drawers/open` | SA, ADMIN, ACCOUNTANT (one OPEN drawer per user) |
| GET | `/cash-drawers` (branch, date, status) | SA, ADMIN, ACCOUNTANT |
| GET | `/cash-drawers/mine` | current user's open drawer + expected cash |
| GET | `/cash-drawers/:id/movements` | movements list |
| POST | `/cash-transfers` | float transfer between drawers |
| GET | `/payment-accounts/:id/movements?from&to` | ledger with running balance |

**Flow — Open Drawer**
1. Check that the user has no OPEN or SETTLEMENT_PENDING drawer.
2. Create the drawer and post an `OPENING_FLOAT IN` movement (custody, not income).
3. Return the `CashDrawer` DTO, with `cashSales`, `cashTipsCollected`, `cashExpensesPaid`, and `expectedInDrawer` computed from movements.

**Done check:** an expense larger than the drawer cash is rejected, the expected amount equals the formula, and two drawers can't be open for the same user.

---

### STEP 10 — 📦 Inventory & Suppliers · High · Day 3

**Prisma models**
- `InventoryItem { id, branchId, sku, name, itemType (RETAIL_PRODUCT|SALON_CONSUMABLE|BOTH), unit, sellingPrice?, reorderLevel, isExpiryTracked, isArchived }`
- `InventoryBatch { id, itemId, branchId, batchNumber, expiryDate?, receivedDate, landedUnitCost Decimal, qtyReceived, status (VALID|QUARANTINED|EXHAUSTED), quarantinedReason? }`. Quantity on hand is **computed from movements**.
- `StockMovement { id, movementNumber, branchId, itemId, batchId?, type (PURCHASE_IN|POS_SALE_OUT|SALON_CONSUMPTION_OUT|DAMAGED_OUT|EXPIRED_OUT|SUPPLIER_RETURN_OUT|RETURN_IN|POSITIVE_ADJUSTMENT|NEGATIVE_ADJUSTMENT|TRANSFER_IN|TRANSFER_OUT), qty (+/−), unitCost, sourceModule, sourceId, reason?, userId, createdAt }`
- `Supplier { id, branchId, name, phone, contactPerson?, openingPayable Decimal, isArchived }`
- `SupplierLedger { id, supplierId, type (OPENING|PURCHASE_BILL|SUPPLIER_PAYMENT|PURCHASE_RETURN|SUPPLIER_REFUND|ADJUSTMENT), debit, credit, reference, sourceId, createdAt }`
- `Purchase { id, purchaseNumber, branchId, supplierId, date, headerDiscount, capitalizableCharges, total, paidAmount, paymentMethod, paymentStatus, accountId? }` + `PurchaseLine { id, purchaseId, itemId, qty, unitPrice, lineDiscount, landedUnitCost, batchId }`
- `SupplierPayment`, `SupplierReturn` + `SupplierReturnLine`, `StockSettlement` + `StockSettlementLine`

**Endpoints**
| Area | Endpoints |
|---|---|
| Items | `GET/POST /inventory/items`, `GET/PUT /inventory/items/:id`, `POST /:id/archive`, `GET /inventory/stock-levels`, `GET /inventory/items/:id/stock` |
| Batches | `GET /inventory/batches`, `POST /inventory/batches/:id/quarantine`, `POST /inventory/batches/:id/release` |
| Suppliers | `GET/POST /suppliers`, `GET/PUT /suppliers/:id`, `POST /:id/archive`, `GET /suppliers/:id/ledger`, `POST /suppliers/:id/pay` |
| Purchases | `GET/POST /purchases`, `GET /purchases/:id` |
| Returns | `GET/POST /supplier-returns` |
| Stock out | `GET /stock-movements`, `POST /stock-movements/manual-out` |
| Count | `GET/POST /stock-settlements`, `GET /stock-settlements/:id` |
| Summary | `GET /inventory/summary`, `GET /inventory/cogs-report` |

**Flow — Create Purchase (Stock-In)**
1. Validate: supplier, lines (qty > 0), payment method (CASH/ONLINE/CREDIT/PARTIAL).
2. **Landed cost per line**: line net = qty × price − line discount. Share header discount and capitalizable charges in proportion to line net. Landed unit cost = landed line cost / qty.
3. Transaction:
   - a. Create the `Purchase` (number `PO-LHE-2026-0001`) and its lines.
   - b. Create one `InventoryBatch` per line plus a `StockMovement PURCHASE_IN`.
   - c. Post `SupplierLedger PURCHASE_BILL` (credit = total).
   - d. If any amount was paid up front, post a drawer or account OUT movement and `SupplierLedger SUPPLIER_PAYMENT` (debit).
   - e. Write an audit event.
4. **No COGS and no expense** at purchase.

**Flow — Stock-Out selection (shared `pickBatches(tx, itemId, qty)`, also used by POS)**
- Valid, non-quarantined, non-expired batches with remaining stock > 0. Order: FEFO (expiry asc) if expiry-tracked, otherwise FIFO (receivedDate asc).
- Lock the rows, split the qty across batches, and return `[{ batchId, qty, unitCost }]`. If there isn't enough stock, throw `INSUFFICIENT_STOCK`.

**Flow — Pay Supplier:** drawer/account OUT → `SupplierPayment` → ledger debit. Closing payable = opening + bills − payments − returns. If the result is negative, show it as an advance (don't clamp it to 0).
**Flow — Stock Settlement (physical count):** difference = counted − system qty, giving a POSITIVE/NEGATIVE_ADJUSTMENT movement at batch cost. A reason is required.

**Done check:** a credit purchase increases stock and payable, a supplier payment reduces payable and cash only (no COGS), and quarantined stock can't be picked.

---

### STEP 11 — 🧾 POS & Invoices (Checkout, Dues, Refund, Void) · High · Day 4

**Prisma models**
- `Invoice { id, invoiceNumber, branchId, appointmentId?, clientId?, clientName, clientPhone (snapshot), customerSource?, date, time, subtotal, discount, discountType?, discountValue?, netSales, tax, tip, total, status (UNPAID|PARTIAL|PAID), lifecycle (ACTIVE|PARTIALLY_REFUNDED|REFUNDED|VOIDED), amountPaid, amountDue, processedByUserId, idempotencyKey @unique, notes?, createdAt }`
- `InvoiceLine { id, invoiceId, type (SERVICE|PACKAGE|PRODUCT), itemId, code, name, staffId, staffName, staffCommissionRate, quantity, unitPrice, discountAllocated, netSales, taxTreatment, taxRate, tax, total, cogsAmount? }`. **Everything is a snapshot.**
- `InvoiceLineComponent { id, lineId, serviceId, serviceCode, serviceName, staffId, staffName, allocationPercentage, allocatedAmount, staffCommissionRate }`
- `InvoiceLineBatch { id, lineId, batchId, qty, unitCost }` (COGS layers)
- `InvoicePayment { id, invoiceId, branchId, date, amount, billAmountAllocated, tipAmountAllocated, method (CASH|ONLINE_ACCOUNT), accountId?, drawerId?, cashTendered?, changeReturned?, previousBalance, remainingBalance, processedByUserId, createdAt }`
- `CommissionEvent { id, branchId, staffId, invoiceId, lineId, componentId?, type (EARN|REVERSAL), attributedNet, rate, amount, eventDate, consumedByRunId? }`
- `InvoiceRefund { id, refundNumber, invoiceId, type (REFUND|VOID), netReversed, taxReversed, tipReversed, cashOut, method, accountId?, reason, byUserId, idempotencyKey @unique, createdAt }` + `RefundLine { lineId, componentId?, qty, net, tax, restock (RESALABLE|DAMAGED|NONE) }`

**Endpoints**
| Method | Path | Roles |
|---|---|---|
| POST | `/pos/invoices/checkout` | SA, ADMIN, ACCOUNTANT (requires `Idempotency-Key`) |
| GET | `/invoices` (date, status, lifecycle, client, staff, method) | SA, ADMIN, ACCOUNTANT |
| GET | `/invoices/:id` | same |
| POST | `/invoices/:id/payments` | collect outstanding dues |
| POST | `/invoices/:id/refund` | SA, ADMIN (full/partial) |
| POST | `/invoices/:id/void` | SA, ADMIN |
| GET | `/invoices/:id/refunds` | same |

**Flow — POS Checkout (one DB transaction)**
1. Check the idempotency key. If it was already used, return the saved invoice.
2. Validate the cart (items, staff, qty), discount, tip, and payments `[{ method, accountId?, amount, billAllocation, tipAllocation, cashTendered }]`.
3. Load the current catalogue prices, staff commission rates, and branch tax rules, then **build the snapshot lines**:
   - Line gross = qty × unit price.
   - Invoice discount is shared across lines in proportion to gross; line net = gross − discount share.
   - Tax = line net × tax rate (EXEMPT → 0; SPECIFIC_RULE → that rule's rate).
   - Package: component allocated amount = package net × weight, using `splitWithRemainder` so the parts add up exactly.
4. Totals: netSales = Σ line net; tax = Σ line tax; total = netSales + tax + tip.
5. If there is a cash payment, call `getOpenDrawer(user)`; otherwise return 400 `NO_OPEN_DRAWER`.
6. Create the invoice (`INV-LHE-2026-0001`), its lines, and components.
7. **Product lines**: `pickBatches()` FEFO → `StockMovement POS_SALE_OUT` + `InvoiceLineBatch`; cogsAmount = Σ qty × unit cost.
8. **Payments**: create `InvoicePayment` rows. Cash → `DrawerMovement CASH_SALE` (bill part) + `CASH_TIP` (tip part). Online → `AccountMovement` IN.
9. Status: paid = 0 → UNPAID; paid < total → PARTIAL; otherwise PAID. amountDue = total − paid.
10. **Commission EARN events**: one per service line, plus one per package component per staff member (attributed net × rate snapshot).
11. If there is a tip → create a `TipReceipt` (Step 18 model; create the table now).
12. If `appointmentId` is set → appointment `billingStatus=BILLED`, `linkedInvoiceId`, status COMPLETED.
13. Save the idempotency response, write an audit event, and return the `Invoice` DTO (with payments).

**Flow — Collect Dues:** validate amount ≤ amountDue → payment row → drawer or account IN (`DUES_COLLECTION`, **not a new sale**) → recompute status → return the receipt data (previous and remaining balance).

**Flow — Refund (partial or full)**
1. Pick the lines/components and quantities to refund (amount ≤ remaining refundable).
2. Net reversed = the refunded lines' net; tax reversed = net reversed × the **original tax rate snapshot**.
3. Product lines: RESALABLE → `RETURN_IN` at the original unit cost (reverses COGS). DAMAGED → RETURN_IN to quarantine, then `DAMAGED_OUT`. NONE (goodwill) → no stock movement.
4. Commission `REVERSAL` event dated **today** (old months stay unchanged).
5. Money back: cash → `DrawerMovement CASH_REFUND` OUT; online → account OUT. The refund amount is capped at what was actually paid.
6. Lifecycle → PARTIALLY_REFUNDED or REFUNDED. Recompute payment status against the effective total.
**Flow — Void:** same as a full refund, plus cancel the remaining receivable (amountDue → 0). Lifecycle becomes VOIDED. The original invoice stays visible.

**Done check:** a double-click on checkout creates one invoice. Tax and tip are not in netSales. Package commission adds up exactly. A cash sale increases drawer expected cash. A refund restores stock and reverses commission.

---

### STEP 12 — 💸 Expenses · Medium · Day 4

**Prisma model**
`Expense { id, expenseNumber, branchId, categoryId, title, description?, amount Decimal, expenseDate, paymentMethod (CASH|ONLINE_ACCOUNT), accountId?, drawerId?, reference?, status (DRAFT|POSTED|REVERSED), enteredByUserId, postedAt?, reversedAt?, reverseReason?, createdAt }`

**Endpoints**
| Method | Path | Roles |
|---|---|---|
| GET | `/expenses` (date, category, status, method) | SA, ADMIN, ACCOUNTANT |
| GET | `/expenses/:id` | same |
| POST | `/expenses` (draft) · PUT `/expenses/:id` · DELETE `/expenses/:id` (draft only) | same |
| POST | `/expenses/:id/post` | same (Idempotency-Key) |
| POST | `/expenses/:id/reverse` | SA, ADMIN (reason required) |

**Flow — Post Expense**
1. Only a DRAFT can be posted.
2. Cash → `getOpenDrawer(user)` → `postDrawerMovement(EXPENSE, OUT)` (the balance check is inside). Online → `postAccountMovement(OUT)`.
3. Status → POSTED, generate the number (`EXP-LHE-2026-0001`), write an audit event.
**Flow — Reverse:** POSTED only → an opposite IN movement (`REVERSAL`) back to the same drawer or account → status REVERSED. The row is never deleted.

**Done check:** a posted expense reduces drawer cash, a reversal restores it, and a draft can be deleted but a posted expense cannot.

---

### STEP 13 — 🤝 Settlements & Custody (My Balance Sheet, Account Settlement) · High · Day 4

**Prisma models**
- `Settlement { id, settlementNumber, branchId, drawerId, submittedByUserId, receiverUserId?, expectedCash, countedCash, variance, settlementAmount, carryForward, status (DRAFT|SUBMITTED|APPROVED|REJECTED), denominations Json?, notes?, reviewedByUserId?, reviewedAt?, rejectionReason?, createdAt }`
- `CashVarianceAdjustment { id, settlementId, amount, reason, approvedBy }`

**Endpoints**
| Method | Path | Roles |
|---|---|---|
| GET | `/custody/statement?from&to` | own statement (all money in/out for this user) |
| GET | `/custody/balance-sheet` | own drawer summary (`BalanceSheetSummary` shape) |
| GET | `/settlements` (status, user) | SA, ADMIN see branch; ACCOUNTANT sees own |
| GET | `/settlements/:id` | same |
| POST | `/settlements` (draft) | drawer custodian |
| POST | `/settlements/:id/submit` | custodian |
| PUT | `/settlements/:id/approve` | SA, ADMIN — **not the submitter** |
| PUT | `/settlements/:id/reject` | SA, ADMIN (reason) |

**Flow — Submit → Approve**
1. Submit: compute expected = drawer formula, enter counted cash, variance = counted − expected. Drawer status → `SETTLEMENT_PENDING`, which **locks** POS cash, dues, expenses, and transfers on that drawer.
2. Approve: if `reviewer.id === submitter.id`, return 403 `SELF_APPROVAL_NOT_ALLOWED`. In a transaction: post `SETTLEMENT_OUT` from the drawer, a variance adjustment if any (with a reason), drawer → SETTLED, a new successor drawer with the carry-forward amount (if configured), and an audit event.
3. Reject: drawer → back to OPEN, with the reason stored.
**Rule:** a settlement is a custody transfer only, never income or expense.

**Done check:** the accountant cannot approve their own settlement, and a pending drawer blocks a POS cash sale.

---

### STEP 14 — 🕒 Attendance & Leave · High · Day 5

**Prisma models**
- `AttendanceRecord { id, branchId, staffId, workDate, status (PRESENT|ABSENT|LATE|HALF_DAY|PAID_LEAVE|UNPAID_LEAVE|HOLIDAY|MISSING_PUNCH|OFF_DAY), source (MANUAL|IMPORT|BIOMETRIC), isLate, lateMinutes, isEarlyExit, earlyExitMinutes, workedMinutes, calculationSnapshot Json, isFinalized, createdAt, updatedAt }` with a unique `(staffId, workDate)`
- `AttendancePunch { id, recordId, type (IN|OUT), time, source }`
- `AttendanceCorrection { id, recordId, before Json, after Json, reason, byUserId, createdAt }`
- `LeaveRecord { id, leaveNumber, branchId, staffId, fromDate, toDate, days, type (PAID|UNPAID), reason, status (ACTIVE|CANCELLED), cancelledBy?, createdAt }`
- `BranchHoliday { id, branchId, date, name }`

**Endpoints**
| Method | Path | Roles |
|---|---|---|
| GET | `/attendance?date=&from&to&staffId&status` | SA, ADMIN |
| POST | `/attendance` (manual punch in/out) | SA, ADMIN |
| PUT | `/attendance/:id/correct` (reason required) | SA, ADMIN |
| POST | `/attendance/finalize-day` `{ date }` | SA, ADMIN |
| POST | `/attendance/import-csv` (multipart or JSON rows) | SA, ADMIN |
| GET/POST | `/leaves` · POST `/leaves/:id/cancel` | SA, ADMIN |
| GET/POST | `/holidays` | SA, ADMIN |

**Flow — Punch**
1. Find or create the record for (staff, date) and add the punch.
2. Recalculate with `attendanceCalculations.js` (ported from the frontend): late minutes vs `startTime + grace`, early exit, worked minutes, and the deduction preview snapshot.
3. **No money movement and no overtime** created from punches.

**Flow — CSV import:** match `employeeCode` within the branch → per row, create or merge punches → return `{ imported, skipped, errors[] }`.
**Flow — Finalize day:** future dates are blocked. Open shifts → `MISSING_PUNCH`; scheduled staff with no record → `ABSENT` (skipping holidays and leave); `isFinalized=true`.
**Flow — Leave:** check the allowance (monthly/yearly) → create `LV-` → create PAID_LEAVE/UNPAID_LEAVE attendance rows for each day. Cancelling removes those synthetic rows.

**Done check:** a late arrival beyond grace is marked late, and a correction keeps its before/after audit.

---

### STEP 15 — ⏱️ Manual Overtime · Medium · Day 5

**Prisma model**
`OvertimeRecord { id, otNumber, branchId, staffId, workDate, minutes, reason, status (DRAFT|SUBMITTED|APPROVED|REJECTED|CANCELLED), approvedMinutes, hourlyRateSnapshot?, amount?, approvedBy?, approvedAt?, rejectionReason?, cancellationReason?, payrollRunId?, createdBy, createdAt }`

**Endpoints:** `GET/POST /overtime`, `PUT /overtime/:id`, `POST /overtime/:id/approve`, `/reject`, `/cancel`, all SA and ADMIN only.

**Flow — Approve**
1. Status must be SUBMITTED.
2. Snapshot the staff `overtimeHourlyRate` (effective on workDate). amount = approvedMinutes / 60 × rate.
3. Status → APPROVED, with an audit event. **No cash movement**; payroll picks it up later.
**Rule:** cancelling is blocked if `payrollRunId` is set and that run is finalized.

**Done check:** a rejected OT never appears in payroll.

---

### STEP 16 — 💵 Payroll · High · Day 5

**Prisma models**
- `PayrollRun { id, runNumber?, branchId, periodYear, periodMonth, status (DRAFT|FINALIZED|PARTIALLY_PAID|PAID|CANCELLED), totalNet, totalPaid, createdBy, finalizedBy?, finalizedAt? }`
- `Payslip { id, runId, staffId, snapshot Json (basic, attendance impact, OT, allowances, deductions, gross, net, calculation details), netPayable, paidAmount }`
- `PayrollPayment { id, runId, payslipId, staffId, amount, method (CASH|ONLINE), drawerId?, accountId?, status (COMPLETED|REVERSED), reverseReason?, idempotencyKey @unique, byUserId, createdAt }`

**Endpoints (SA, ADMIN only)**
`POST /payroll/preview` `{ year, month }` · `GET /payroll/runs` · `GET /payroll/runs/:id` · `POST /payroll/runs/:id/finalize` · `POST /payroll/runs/:id/cancel` · `POST /payroll/payments` · `POST /payroll/payments/:id/reverse`

**Flow**
1. **Preview (DRAFT):** for each active staff member, run `payrollCalculations.js` using the policy (divisor/proration), finalized attendance, leaves, and APPROVED + unlocked OT. Save the payslip snapshots. **Zero money movement.**
2. **Finalize:** DRAFT → FINALIZED, `PR-2026-10-001`, payslips become immutable, and the OT rows get `payrollRunId` (locked).
3. **Pay:** cash → drawer `PAYROLL_PAYOUT` OUT (balance check); online → account OUT. Update payslip `paidAmount` and the run status. Uses an idempotency key.
4. **Reverse payment:** status REVERSED → opposite IN movement → restore the payable.
5. **Cancel run:** only if there are no completed payments → release the OT locks.

**Done check:** finalize moves no money, cash pay reduces the drawer, reverse restores it, and a run with payments can't be cancelled.

---

### STEP 17 — 📊 Commission · High · Day 5

Uses the `CommissionEvent` rows created by POS (Step 11).

**Prisma models**
- `CommissionRun { id, runNumber?, branchId, periodFrom, periodTo, status, totalNet, totalPaid, ... }`
- `CommissionStatement { id, runId, staffId, attributedNet, earned, reversed, net, paidAmount, lines Json }`
- `CommissionPayment` (same shape as PayrollPayment)

**Endpoints (SA, ADMIN only)**
`POST /commission/preview` · `GET /commission/runs` · `GET /commission/runs/:id` · `POST /commission/runs/:id/finalize` · `/cancel` · `POST /commission/payments` · `POST /commission/payments/:id/reverse`

**Flow**
1. **Preview:** collect EARN + REVERSAL events in the period that are not yet consumed (`consumedByRunId = null`) → group by staff → net = earned − reversed. Base = attributed net only (**no tax, tip, or discount**).
2. **Finalize:** `CR-2026-10-001` → set `consumedByRunId` on the events (no double counting).
3. **Pay / Reverse / Cancel:** same pattern as payroll (cancel releases the events).

**Done check:** the spec example works (package PKR 5,000: Ali 60% @10% = 300, Ahmed 40% @15% = 300), and an October refund creates an October reversal while September stays unchanged.

---

### STEP 18 — 🪙 Tips · High · Day 5

**Prisma models**
- `TipReceipt { id, receiptNumber (TR-), branchId, invoiceId, collectedAmount, allocatedAmount, unallocatedAmount, method, status (UNALLOCATED|PARTIALLY_ALLOCATED|FULLY_ALLOCATED), createdAt }`, created by POS
- `TipAllocation { id, allocationNumber (TA-), receiptId, staffId, type (DIRECT|POOLED_EQUAL|POOLED_CUSTOM), amount, paidAmount, outstandingAmount, status (UNPAID|PARTIALLY_PAID|PAID|CANCELLED) }`
- `TipPayout { id, payoutNumber (TP-), allocationId, staffId, amount, method, drawerId?, accountId?, status (COMPLETED|REVERSED), reverseReason?, reversedAt?, idempotencyKey, createdAt }`

**Endpoints (SA, ADMIN; ACCOUNTANT has none)**
`GET /tips/receipts` · `POST /tips/allocate` · `POST /tips/allocations/:id/cancel` · `GET /tips/allocations` · `POST /tips/payouts` · `GET /tips/payouts` · `POST /tips/payouts/:id/reverse` · `GET /tips/statement?from&to`

**Flow**
1. **Allocate:** amount ≤ the receipt's unallocated amount. A pooled split uses `splitWithRemainder` so Σ = amount exactly. **No cash moves** (liability only).
2. **Cancel allocation:** only if nothing has been paid → restore the receipt's unallocated amount.
3. **Payout:** drawer `TIP_PAYOUT` OUT or account OUT → reduce outstanding.
4. **Reverse payout:** dated reversal event (the original payout date stays in its own period) → money back IN → outstanding restored.
5. **Statement:** closing = opening + collected − payouts + reversals, and it must also equal unallocated + allocated-unpaid.

**Done check:** both statement equations balance, and the accountant gets 403 on every tips route.

---

### STEP 19 — 📈 Dashboards · Medium · Day 6

**Endpoints:** `GET /dashboard/super-admin?branchId=ALL|id`, `GET /dashboard/admin`, `GET /dashboard/accountant`, `GET /dashboard/staff`, `GET /branches/:id/metrics?from&to`

**Flow**
1. Build one shared `computeBranchMetrics(branchId, from, to)`: gross sales, discounts, net sales, tax, tips, collections, receivables, cash in custody, expenses, and net operating cash flow, all via Prisma `aggregate`/`groupBy` or `$queryRaw` SQL.
2. The super-admin dashboard calls it for every branch and also produces the consolidated total. Admin and accountant dashboards use the same function, so the numbers always match.
3. Each response must match the shape the frontend dashboard already reads from `getSuperAdminDashboardData` and the related methods (check the mock's return objects).

**Done check:** the super-admin per-branch figures equal the admin dashboard figures for the same branch and date.

---

### STEP 20 — 👤 Staff Portal (My Performance / Attendance / Reports) · Low · Day 6

**Endpoints (STAFF only, always filtered by `req.user.staffId`)**
`GET /me/attendance` · `/me/overtime` · `/me/leaves` · `/me/payslips` (FINALIZED runs only) · `/me/commissions` (finalized statements) · `/me/tips` (allocations + payouts) · `/me/performance`

**Flow:** these are read-only queries. The `staffId` comes **only from the token**, never from query params. Draft runs and unapproved OT are never returned.

**Done check:** Zara sees only Zara's data, and passing `?staffId=other` changes nothing.

---

### STEP 21 — 📑 Reports (the spec's 11 reports) · High · Day 6

All reports are read-only and accept the common query `branchId, from, to, preset, userType, userId` plus report-specific filters. Each response is `{ summary: {...KPIs}, rows: [...], totals: {...} }`, and `?format=xlsx` returns an Excel file (`exceljs`).

| # | Endpoint | Source tables | Date basis | Roles |
|---|---|---|---|---|
| 1 | `/reports/income-expense` | invoices, refunds, expenses, payroll, commission events, write-offs | Recognition date | SA, ADMIN, ACC |
| 2 | `/reports/sales-invoices` | invoices, lines, payments, refunds | Invoice date / refund date | SA, ADMIN, ACC |
| 3 | `/reports/payment-accounts` | account movements | Movement time | SA, ADMIN, ACC |
| 4 | `/reports/cash-drawer` | drawers, drawer movements, settlements | Movement time | SA, ADMIN, ACC |
| 5 | `/reports/expenses` | expenses | Expense date | SA, ADMIN, ACC |
| 6 | `/reports/staff-salary` | payroll runs, payslips, payments | Payroll period | SA, ADMIN |
| 7 | `/reports/staff-commission` | commission events, statements, payments | Event date | SA, ADMIN |
| 8 | `/reports/staff-performance` | invoice attribution, appointments, attendance | Event date | SA, ADMIN |
| 9 | `/reports/inventory?type=stock\|batch\|movement\|purchase\|supplier\|valuation\|cogs\|consumption\|expiry` | stock tables | Movement date / as-of | SA, ADMIN |
| 10 | `/reports/attendance-overtime` | attendance, leaves, overtime | Work date | SA, ADMIN |
| 11 | `/reports/operating-profit` | sales, refunds, COGS, consumption, expenses, payroll, commission, write-offs | Recognition date | SA, ADMIN, ACC |

**Flow (common to every report)**
1. Resolve the date range from the preset in `Asia/Karachi`.
2. **Opening** = Σ events before `from`; **movement** = Σ events within the range; **closing** = opening + movement (for accounts, drawers, supplier payable, tips, and commission).
3. Aggregate with SQL from canonical tables only. Never store report balances.
4. Exclusion rules: tax, tips, supplier payments, purchases, settlements, transfers, and dues collection are **never** income or profit.

**Operating profit formula**
```
Total Net Sales     = Net Service/Package Sales + Net Product Sales  (after refunds)
Gross Contribution  = Total Net Sales − Product COGS − Salon Material Consumption
Operating Profit    = Gross Contribution − Operating Expenses − Salary − Commission − Inventory Write-off
Margin %            = Operating Profit / Total Net Sales × 100
```

**Done check (reconciliation gate):** for the same branch and date: Sales & Invoices net sales = the Operating Profit sales line; Payment Accounts opening + in − out = closing; drawer expected = formula; tax and tips appear in no income line.

---

### STEP 22 — 🧭 Audit & Activity Log + Backend Test Pass · Medium · Day 6

- `GET /audit-events?from&to&userId&entity&action` for SA and ADMIN (branch scoped). The events were already being written since Step 0.
- `GET /ledger?from&to&source` (General Ledger) for SA and ADMIN: a union of drawer and account movements with source references.

**Test pass (vitest + supertest, test DB)**
- [ ] Auth: 4 logins, portal mismatch, refresh rotation
- [ ] Branch scope: ADMIN/ACCOUNTANT cannot read or write another branch
- [ ] The 9 permanent regression tests from spec §14 (tax excluded, package commission rounding, purchase flows, supplier payment ≠ COGS, POS FEFO + no double deduct, in-house use, cross-date reversals, account opening/closing, operating profit totals)
- [ ] Idempotency: the same key twice gives one record

**Done check:** `npm test` is green, and the seed script loads the full demo dataset (copied from frontend `mockData.ts`).

---

## 5. PHASE B — Frontend Integration (Day 7)

Goal: the frontend keeps all its pages, and only the **data source** changes from mock to API.

### Step I-1 · Environment & HTTP client
1. Add the following to the frontend `.env`:
   ```
   VITE_API_URL=http://localhost:5000/api/v1
   VITE_USE_MOCK=false
   ```
2. Create `src/services/http/apiClient.ts`:
   - `request(method, path, { body, query, idempotent })`
   - Adds `Authorization: Bearer <accessToken>` (token kept in memory/AuthContext)
   - `credentials: 'include'` for the refresh cookie
   - On 401 → call `/auth/refresh` once → retry → if it still fails, log out
   - `idempotent: true` → adds an `Idempotency-Key: crypto.randomUUID()` header (generated once per user action, reused on retry)
   - Converts `{ error: { code, message } }` into a thrown `Error(message)`, the same as the mock throws, so the UI's error messages keep working

### Step I-2 · Service switch
1. Create `src/services/http/httpSalonService.ts` that implements the same `SalonService` interface. Each method is a 2–5 line call to the endpoint from Phase A.
2. In `src/services/index.ts`, export `import.meta.env.VITE_USE_MOCK === 'true' ? mockSalonService : httpSalonService`.
3. Do the same for `authService` (mock vs http).

### Step I-3 · Wire module by module (same order as the backend; test each in the browser before the next)

| # | Module | Frontend files touched | Browser test |
|---|---|---|---|
| 1 | 🔐 Auth | `authService.ts`, `AuthContext.tsx`, `LoginPage.tsx` | 4 demo logins, wrong portal error, refresh after 15 min, logout |
| 2 | 🏢 Branches | `BranchManagementPage` | Create, edit, deactivate blockers; branch switcher in header |
| 3 | 🛡️ Users | `UsersAccessPage` | Create accountant; ADMIN can't see Karachi |
| 4 | ⚙️ Settings | `BranchSettingsPage` | Tax default switch, add payment account |
| 5 | 👥 Staff | `StaffDirectoryPage` | Create, edit rates, portal access |
| 6 | ✂️ Catalogue | `ServicesPackagesPage` | Package with 100% weights |
| 7 | 🙋 Clients | `ClientsPage` + modals | Duplicate phone detection |
| 8 | 📅 Appointments | `AppointmentsPage` + modals | Book, conflict, reschedule, cancel |
| 9 | 💰 Drawers | `MyBalanceSheetPage`, POS drawer banner | Open drawer, expected cash |
| 10 | 📦 Inventory | `InventoryPage`, `InventoryReportsPage` | Purchase → batches → supplier pay → stock count |
| 11 | 🧾 POS & Invoices | `POSBillingPage`, `ReceiptModal`, `SalesInvoicesPage`, `UnpaidInvoicesPage`, `AppointmentQueueSheet` | Appointment → POS → split pay → dues → receipt |
| 12 | 💸 Expenses | `ExpenseManagementPage` | Draft → post → reverse |
| 13 | 🤝 Settlements | `AccountSettlementPage` | Submit (accountant) → approve (admin) |
| 14 | 🕒 Attendance | `StaffAttendancePage` | Punch, CSV import, finalize day, leave |
| 15 | ⏱️ Overtime | `ManualOvertimePage` | Submit → approve |
| 16 | 💵 Payroll | `PayrollPage` | Preview → finalize → pay → reverse |
| 17 | 📊 Commission | `StaffCommissionPage` | Preview → finalize → pay |
| 18 | 🪙 Tips | `TipsManagementPage`, `TipsStatementPage` | Allocate → payout → statement balances |
| 19 | 📈 Dashboards | 4 dashboard files | Numbers match reports |
| 20 | 👤 Staff portal | `StaffDashboard`, `StaffPersonal*Page` | Login as Zara: own data only |
| 21 | 📑 Reports | existing report pages | Filters + totals reconcile |

**For each module:**
1. Implement its methods in `httpSalonService`.
2. Open the page and check that the network tab shows the correct requests and that there are no console errors.
3. Compare the response fields with the TS type. If something is missing, fix the backend **mapper** rather than the page.
4. Test the happy path plus one error path (validation or permission).
5. Tick it off ✅ in the tracking table below.

### Step I-4 · Final QA & deploy prep
- [ ] Role QA: open every route as each of the 4 roles (Accountant blocked from payroll, tips, and staff reports; Staff sees only their own data).
- [ ] Idempotency: double-click checkout, payout, and expense post each produce 1 record.
- [ ] Date boundaries: Asia/Karachi midnight, and month-crossing refunds/reversals.
- [ ] Reconciliation gate (Step 21) passes for both branches.
- [ ] Deploy: PostgreSQL (managed), backend on a VPS/Render/Railway (`prisma migrate deploy` + seed), frontend `vite build` → static host, CORS origin set, daily DB backup.

---

## 6. Daily Tracking

| Day | Steps | Backend ✅ | Integration ✅ | Notes |
|---|---|---|---|---|
| 1 | 0 Setup, 1 Auth, 2 Branches, 3 Users, 4 Settings | | | |
| 2 | 5 Staff, 6 Catalogue, 7 Clients, 8 Appointments | | | |
| 3 | 9 Drawers/Ledger, 10 Inventory & Suppliers | | | |
| 4 | 11 POS & Invoices, 12 Expenses, 13 Settlements | | | |
| 5 | 14 Attendance, 15 Overtime, 16 Payroll, 17 Commission, 18 Tips | | | |
| 6 | 19 Dashboards, 20 Portal, 21 Reports, 22 Audit + tests | | | |
| 7 | Integration I-1 → I-4 | | | |

## 7. Not in this plan (later)
- New frontend pages that don't exist yet (Income & Expense, Payment Accounts, Cash Drawer, and Detailed Expenses report pages; General Ledger page; Activity Log page). Their **APIs are built** in Steps 21–22, so the pages can be added on top later.
- The purple/magenta UI redesign, and PDF export (the Excel API is included).
