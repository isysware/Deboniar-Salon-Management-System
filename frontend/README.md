# iSysware Salon Management System (SalonOS) - Foundation & Architecture

Phase 1 foundation for an enterprise multi-branch Salon Management System engineered for **iSysware**.

---

## 1. Framework Evaluation & Runtime Limitation Report

**Status**: Next.js App Router migration is **BLOCKED** by the current AI Studio container environment.

### Exact Environment Limitation Details
- **Container Dev Runner**: The Google AI Studio web applet container is standardized on a Node.js runtime hosting a Vite development server bound to port 3000 (`0.0.0.0:3000`).
- **Platform Enforcements**:
  1. The platform injects environment variables including `DISABLE_HMR=true` specifically tailored to Vite's server configuration (`vite.config.ts`).
  2. The AI Studio preview proxy expects the Vite development server to serve client assets from memory or build outputs from `dist/`.
  3. Next.js App Router requires Node.js SSR runtime processes (`next dev` / `next start`), server chunk generation, and standalone directory structures which break the AI Studio live preview container runner.
- **Current Runtime Used**: High-performance React SPA on Vite with TypeScript, Tailwind CSS, and modular component architecture (`src/components/`, `src/services/`, `src/features/`, `src/types/`).
- **Path Forward**: When deploying to production on dedicated infrastructure, the code can be hosted either as an optimized static SPA or ported directly into a Next.js App Router instance connecting to the standalone Express.js + PostgreSQL backend.

---

## 2. Predefined Demo Accounts (One-Click Autofill)

The login page features a **One-Click Demo Accounts Drawer** with instant autofill and portal selection. Rejecting portal/account mismatches is strictly enforced:

| Role | Portal | Identifier / Email | Password | Assigned Branch Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | Super Admin | `superadmin@isysware.com` | `Super@Salon2026` | **All Branches (Consolidated)** / Gulberg Flagship / Clifton Luxury Suites |
| **Branch Admin** | Admin | `admin.gulberg@isysware.com` | `Admin@Gulberg2026` | Locked to **Gulberg Flagship Lounge (Lahore)** (`LHE-01`) |
| **Branch Accountant** | Accountant | `accountant.gulberg@isysware.com` | `Accountant@2026` | Locked to **Gulberg Flagship Lounge (Lahore)** (`LHE-01`) |
| **Staff / Stylist** | Staff | `zara.stylist@isysware.com` | `Staff@Zara2026` | Locked to **Gulberg Flagship Lounge** · **Zara Alvi** |

- **Remember Me**: Remembers the email identifier only in `localStorage`; passwords are never stored.
- **Forgot Password**: Opens a simulated recovery modal with honest feedback.
- **Credential Validation**: Attempting to log into a mismatched portal (e.g., Staff attempting to access Super Admin) is rejected with clear error guidance.

---

## 3. Localization & Regional Configuration

- **Currency**: Pakistani Rupee (`PKR`) formatted with `en-PK` locale across all metrics, tickets, and tables. Null and zero values format cleanly as `PKR 0.00`.
- **Timezone**: `Asia/Karachi` (PKT, UTC+5) for all date filters, biometric punch timestamps, and appointment scheduling.
- **Branches & Tax Configurations**:
  - **Gulberg Flagship Lounge (LHE-01)**: M.M. Alam Road, Gulberg III, Lahore · 16% Punjab Sales Tax on Services (PST).
  - **Clifton Luxury Suites (KHI-02)**: Block 4, Clifton Marine Promenade, Karachi · 13% Sindh Sales Tax on Services (SST).
- **Named Online Payment Accounts**:
  - Lahore: Meezan Bank Corporate Checking, HBL Smart POS Terminal, JazzCash Business Merchant.
  - Karachi: Bank Alfalah Premier Commercial, HBL Smart POS Terminal, Easypaisa Retail Merchant.

---

## 4. Financial Calculations & Business Rules

1. **Separation of Sales, Tax, Tips, and Collections**:
   - **Gross Sales**: Total billing before discounts across all confirmed customer invoices (including paid, partial, and unpaid invoices).
   - **Net Sales**: Sales revenue after promotional/loyalty discounts, strictly excluding tax and tips.
   - **Provincial Sales Tax**: Computed from branch tax rates (16% PST in Lahore, 13% SST in Karachi) and tracked distinctly.
   - **Staff Tips (Segregated Liability)**: 100% of client tips are held outside salon revenue and service commissions.
   - **Actual Bill Collections**: Derived from confirmed payment records across cash and online transactions, including partial deposits and split tender.
   - **Outstanding Receivables**: Remaining unpaid balances from partial and unpaid invoices.
   - **Cash in Custody**: Actual counted physical cash held in active branch cash drawers.
   - **Net Operating Cash Flow**: Calculated as actual bill collections minus total paid expenses (clearly documented basis).
2. **Shared Authoritative Calculation Engine**:
   - Super Admin branch totals and Branch Admin totals are calculated using the identical shared calculation engine (`computeBranchMetrics`).
3. **Shift Settlement & Custody Hand-off**:
   - Cashier/Accountant submits counted drawer cash for shift close.
   - **No Self-Approval**: Settlement handoffs must be verified and acknowledged by the Branch General Manager.
   - Settlement transfers physical cash custody; it is never double-counted as new income or expense.
4. **Manual Overtime Exclusivity**:
   - Biometric punches record physical attendance timestamps only.
   - Overtime minutes require explicit Admin/Super Admin verification and approval.

---

## 5. Portal Access Control & Scope

- **Super Admin**: Consolidated multi-branch view or branch-filtered view; branch creator and user access administrator.
- **Admin**: Constrained strictly to assigned branch (`Gulberg Flagship Lounge`); operational appointments, attendance verification, and pending managerial actions.
- **Accountant**: Cashier custody, POS collections, expense disbursements, approved financial reports, My Balance Sheet, and Account Settlement. Cannot configure staff, attendance, overtime, payroll, commission, taxes or payment accounts.
- **Staff (Stylist)**: Private, read-only personal workspace. Displays only personal performance, attendance punch history, overtime, direct tips, and itemized commission statements. **Zero access to appointment schedules, POS, other stylists' records, or salon-wide financials.**

---

## 6. Target Express.js + PostgreSQL Backend Contract

When connecting the dedicated Express.js backend in future phases:
- `POST /api/v1/auth/login` (JWT token issuance)
- `GET /api/v1/branches/:id/metrics` (Branch metrics matching `BranchFinancialMetrics`)
- `POST /api/v1/pos/invoices/checkout` (Split tender checkout)
- `POST /api/v1/accounts/settlements/submit` & `PUT /api/v1/accounts/settlements/:id/verify`
- `POST /api/v1/operations/overtime/record` (Admin overtime approval)

---

## 7. shadcn/ui Foundation Architecture & Component System

The UI system has been unified around official shadcn/ui design standards and Radix primitives with Poppins typography:

- **Configuration**: `components.json` with `@/components`, `@/lib/utils`, and `@/components/ui` aliases.
- **Path Resolution**: `@/*` mapped to `./src/*` across both `tsconfig.json` and `vite.config.ts`.
- **Theme Variables**: Semantic CSS variables configured in `src/index.css` via `@theme` (`--color-primary: #2254e1`, `--color-primary-hover: #1b3fc5`, `--color-background: #f5f7fb`, `--color-foreground: #0b1020`, `--radius: 0.5rem`).
- **Installed Components**:
  - `button.tsx`: Primary royal-blue, secondary, outline, destructive, ghost, and loading states.
  - `input.tsx`: Form inputs with integrated left/right adornments, label/error helpers.
  - `label.tsx`: Radix accessible form labels.
  - `checkbox.tsx`: Accessible Radix checkbox with royal-blue active state.
  - `select.tsx`: Radix select dropdown with keyboard navigation and popper positioning.
  - `card.tsx`: Subtle-bordered white cards (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`).
  - `badge.tsx`: Zero-pill status indicators with status dots.
  - `dialog.tsx`: Accessible Radix modal dialog with overlay and animations.
  - `sheet.tsx`: Radix slide-in sheet for mobile navigation drawer.
  - `dropdown-menu.tsx`: Radix menu for branch switching and authenticated user profile controls.
  - `table.tsx`: Clean data tables for branch comparisons, invoices, and attendance.
  - `tabs.tsx`: Radix tab switches with animated indicator and pill-free design.
  - `separator.tsx`: Semantic horizontal and vertical dividers.
  - `tooltip.tsx`: Radix floating tooltips.
  - `skeleton.tsx`: Pulse loading state skeletons.
  - `alert.tsx`: Contextual alert banners for info, success, warning, and authentication notices.
  - `alert-dialog.tsx`: Radix confirmation modals for destructive operational actions.
  - `stat-card.tsx`: Domain metric card wrapper around `Card` preserving KPI hierarchy.
- **Windows File System Safety**: All obsolete uppercase component files (`Button.tsx`, `Card.tsx`, etc.) were removed, leaving consistent lowercase files to prevent case-insensitive Git collisions on Windows.
- **Layout Integrity**: The main AppShell content area spans 100% available viewport width without artificial `overflow-x-hidden`.
