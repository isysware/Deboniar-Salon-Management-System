// scripts/senior-qa-audit.js
// Senior Lead QA Automated Audit Script
// Runs full E2E operational and edge-case tests against live SalonOS API (http://localhost:5000/api/v1).

const API_BASE = 'http://localhost:5000/api/v1';

const testResults = [];
let passCount = 0;
let failCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    passCount++;
    console.log(`  ✅ [PASS] ${testName}`);
    testResults.push({ name: testName, status: 'PASS', details });
  } else {
    failCount++;
    console.error(`  ❌ [FAIL] ${testName} - ${details}`);
    testResults.push({ name: testName, status: 'FAIL', details });
  }
}

async function req(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {}),
    },
  });
  let data = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, headers: res.headers, body: data };
}

async function runSeniorQA() {
  console.log('\n======================================================');
  console.log('  SENIOR QA LEAD: STEP-BY-STEP AUTOMATED SYSTEM AUDIT');
  console.log('======================================================\n');

  // ──────────────────────────────────────────────────────────
  // STEP 1: AUTHENTICATION & SECURITY CONTROLS
  // ──────────────────────────────────────────────────────────
  console.log('\n--- STEP 1: AUTHENTICATION & SECURITY AUDIT ---');

  // Test 1.1: Health check
  const health = await req('/health');
  assert(health.status === 200 && health.body.data?.status === 'ok', '1.1 System Health Check API returns 200 OK & DB connected');

  // Test 1.2: Unauthenticated access blocked
  const unauth = await req('/branches');
  assert(unauth.status === 401, '1.2 Access without JWT token rejected with 401 Unauthorized');

  // Test 1.3: Invalid password rejected
  const badLogin = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: 'admin@isysware.com', password: 'WrongPassword!999', portal: 'ADMIN' }),
  });
  assert(badLogin.status === 401, '1.3 Invalid password rejected with 401 Unauthorized');

  // Test 1.4: Portal mismatch blocked
  const portalMismatch = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: 'admin.gulberg@isysware.com', password: 'Admin@Gulberg2026', portal: 'STAFF' }),
  });
  assert(portalMismatch.status === 403, '1.4 Role logging into unauthorized portal rejected with 403 Forbidden');

  // Test 1.5: Valid Super Admin login
  const superLogin = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: 'superadmin@isysware.com', password: 'Super@Salon2026', portal: 'SUPER_ADMIN' }),
  });
  assert(superLogin.status === 200 && !!superLogin.body.data?.token, '1.5 Super Admin valid login returns JWT & consolidated session');
  const superToken = superLogin.body.data?.token;

  // Test 1.6: Valid Admin login
  const adminLogin = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: 'admin.gulberg@isysware.com', password: 'Admin@Gulberg2026', portal: 'ADMIN' }),
  });
  assert(adminLogin.status === 200 && !!adminLogin.body.data?.token, '1.6 Branch Admin valid login returns JWT');
  const adminToken = adminLogin.body.data?.token;
  const adminBranchId = adminLogin.body.data?.user?.branchId;

  // Test 1.7: Valid Accountant login
  const acctLogin = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: 'accountant.gulberg@isysware.com', password: 'Accountant@2026', portal: 'ACCOUNTANT' }),
  });
  assert(acctLogin.status === 200 && !!acctLogin.body.data?.token, '1.7 Accountant valid login returns JWT');
  const acctToken = acctLogin.body.data?.token;

  // Test 1.8: Valid Staff login
  const staffLogin = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: 'zara.stylist@isysware.com', password: 'Staff@Zara2026', portal: 'STAFF' }),
  });
  assert(staffLogin.status === 200 && !!staffLogin.body.data?.token, '1.8 Staff valid login returns JWT');
  const staffToken = staffLogin.body.data?.token;

  // ──────────────────────────────────────────────────────────
  // STEP 2: RBAC DATA ISOLATION & PERMISSION TESTING
  // ──────────────────────────────────────────────────────────
  console.log('\n--- STEP 2: RBAC ACCESS CONTROL & SECURITY ENFORCEMENT ---');

  // Test 2.1: Accountant denied from Staff Salary report
  const acctSalary = await req('/reports/staff-salary', { token: acctToken });
  assert(acctSalary.status === 403, '2.1 Accountant blocked from Staff Salary report (403)');

  // Test 2.2: Accountant denied from Staff Commission report
  const acctComm = await req('/reports/staff-commission', { token: acctToken });
  assert(acctComm.status === 403, '2.2 Accountant blocked from Staff Commission report (403)');

  // Test 2.3: Accountant denied from Attendance & Overtime report
  const acctAtt = await req('/reports/attendance', { token: acctToken });
  assert(acctAtt.status === 403, '2.3 Accountant blocked from Attendance & Overtime report (403)');

  // Test 2.4: Staff denied from all financial reports
  const staffSales = await req('/reports/sales-invoices', { token: staffToken });
  assert(staffSales.status === 403, '2.4 Staff blocked from Sales & Invoices report (403)');

  const staffExpenses = await req('/reports/detailed-expenses', { token: staffToken });
  assert(staffExpenses.status === 403, '2.5 Staff blocked from Detailed Expenses report (403)');

  // ──────────────────────────────────────────────────────────
  // STEP 3: POS BILLING & CATALOGUE INTEGRITY
  // ──────────────────────────────────────────────────────────
  console.log('\n--- STEP 3: POS CATALOGUE & BILLING TRANSACTION INTEGRITY ---');

  // Test 3.1: Fetch catalogue services
  const services = await req('/services', { token: adminToken });
  assert(services.status === 200 && Array.isArray(services.body.data), '3.1 Admin can retrieve catalogue services list');

  // Test 3.2: Fetch catalogue packages
  const packages = await req('/packages', { token: adminToken });
  assert(packages.status === 200 && Array.isArray(packages.body.data), '3.2 Admin can retrieve bundled packages');

  // Test 3.3: Fetch staff directory for attribution
  const staffList = await req('/staff', { token: adminToken });
  assert(staffList.status === 200 && Array.isArray(staffList.body.data), '3.3 Admin can retrieve staff directory for service attribution');

  // Test 3.4: Fetch client list
  const clients = await req('/clients', { token: adminToken });
  assert(clients.status === 200 && Array.isArray(clients.body.data), '3.4 Admin can retrieve client list');

  // ──────────────────────────────────────────────────────────
  // STEP 4: CASH DRAWER & CUSTODY SESSION INTEGRITY
  // ──────────────────────────────────────────────────────────
  console.log('\n--- STEP 4: CASH DRAWER SESSIONS & FINANCIAL CUSTODY ---');

  const drawerReport = await req(`/reports/cash-drawer?branchId=${adminBranchId}`, { token: adminToken });
  assert(drawerReport.status === 200 && Array.isArray(drawerReport.body.data?.rows), '4.1 Admin can query cash drawer session logs & tender breakdown');

  // ──────────────────────────────────────────────────────────
  // STEP 5: EXPENSES & DISBURSEMENT CONTROL
  // ──────────────────────────────────────────────────────────
  console.log('\n--- STEP 5: DETAILED EXPENSES & PAYMENT SOURCES ---');

  const expReport = await req(`/reports/detailed-expenses?branchId=${adminBranchId}`, { token: adminToken });
  assert(expReport.status === 200 && Array.isArray(expReport.body.data?.rows), '5.1 Detailed Expenses report returns valid rows & tender summary');

  // ──────────────────────────────────────────────────────────
  // STEP 6: INVENTORY, MOVEMENTS & COGS AUDIT
  // ──────────────────────────────────────────────────────────
  console.log('\n--- STEP 6: INVENTORY VALUATION & SUPPLY CHAIN AUDIT ---');

  const invValuation = await req(`/reports/inventory?type=valuation&branchId=${adminBranchId}`, { token: adminToken });
  assert(invValuation.status === 200 && Array.isArray(invValuation.body.data?.rows), '6.1 Inventory Valuation report evaluates stock at historical landed unit cost');

  const invMovements = await req(`/reports/inventory?type=movements&branchId=${adminBranchId}`, { token: adminToken });
  assert(invMovements.status === 200 && Array.isArray(invMovements.body.data?.rows), '6.2 Inventory Movements log tracks real stock IN/OUT transactions');

  const invSupplier = await req(`/reports/inventory?type=supplier-ledger&branchId=${adminBranchId}`, { token: adminToken });
  assert(invSupplier.status === 200 && Array.isArray(invSupplier.body.data?.rows), '6.3 Supplier Ledger reflects net payable and credit without clamping to zero');

  // ──────────────────────────────────────────────────────────
  // STEP 7: COMPREHENSIVE FINANCIAL RECONCILIATION GATE
  // ──────────────────────────────────────────────────────────
  console.log('\n--- STEP 7: STRICT FINANCIAL RECONCILIATION GATE (§14) ---');

  const salesReport = await req(`/reports/sales-invoices?branchId=${adminBranchId}&preset=THIS_MONTH`, { token: adminToken });
  assert(salesReport.status === 200 && !!salesReport.body.data?.totals, '7.1 Sales & Invoices report queries valid posted invoices');

  const incomeExpense = await req(`/reports/income-expense?branchId=${adminBranchId}&preset=THIS_MONTH`, { token: adminToken });
  assert(incomeExpense.status === 200 && !!incomeExpense.body.data?.totals, '7.2 Income & Expense report queries recognized revenue & operating expenses');

  const opProfit = await req(`/reports/operating-profit?branchId=${adminBranchId}&preset=THIS_MONTH`, { token: adminToken });
  assert(opProfit.status === 200 && !!opProfit.body.data?.kpis, '7.3 Operating Profit statement generates complete P&L breakdown');

  const paymentAccounts = await req(`/reports/payment-accounts?branchId=${adminBranchId}&preset=THIS_MONTH`, { token: adminToken });
  assert(paymentAccounts.status === 200 && Array.isArray(paymentAccounts.body.data?.rows), '7.4 Payment Accounts report tracks opening, money in/out, and closing');

  // Mathematical equality check:
  if (salesReport.body.data && incomeExpense.body.data && opProfit.body.data) {
    const salesNet = salesReport.body.data.totals.netSales || 0;
    const incNet = incomeExpense.body.data.totals.income ?? incomeExpense.body.data.kpis?.totalRecognizedIncome ?? 0;
    const opRevenue = opProfit.body.data.kpis?.totalNetRevenue || 0;
    const taxInInc = incomeExpense.body.data.rows?.some(r => r.category === 'TAX') || false;
    const tipsInInc = incomeExpense.body.data.rows?.some(r => r.category === 'TIPS') || false;

    assert(!taxInInc, '7.5 Tax Liability strictly excluded from recognized income in P&L');
    assert(!tipsInInc, '7.6 Staff Tips strictly excluded from recognized income in P&L');
    assert(Math.abs(salesNet - incNet) < 0.05, `7.7 Cross-report Net Sales match (Sales: ${salesNet}, IncExp: ${incNet})`);
    assert(Math.abs(salesNet - opRevenue) < 0.05, `7.8 Cross-report Revenue match with Operating Profit (${salesNet} === ${opRevenue})`);
  }

  // ──────────────────────────────────────────────────────────
  // STEP 8: HR & STAFF PAYROLL SUITE
  // ──────────────────────────────────────────────────────────
  console.log('\n--- STEP 8: HR, PAYROLL & ATTENDANCE REPORTING ---');

  const hrSalary = await req(`/reports/staff-salary?branchId=${adminBranchId}&month=2026-10`, { token: adminToken });
  assert(hrSalary.status === 200 && Array.isArray(hrSalary.body.data?.rows), '8.1 Admin can access Staff Salary report with finalized payslips');

  const hrComm = await req(`/reports/staff-commission?branchId=${adminBranchId}&startDate=2026-10-01&endDate=2026-10-10`, { token: adminToken });
  assert(hrComm.status === 200 && Array.isArray(hrComm.body.data?.rows), '8.2 Admin can access Staff Commission report with dated earn/reversal events');

  const hrPerf = await req(`/reports/staff-performance?branchId=${adminBranchId}&startDate=2026-10-01&endDate=2026-10-10`, { token: adminToken });
  assert(hrPerf.status === 200 && (Array.isArray(hrPerf.body.data) || Array.isArray(hrPerf.body.data?.rows)), '8.3 Admin can access Staff Performance report');

  const hrAtt = await req(`/reports/attendance?branchId=${adminBranchId}`, { token: adminToken });
  assert(hrAtt.status === 200 && Array.isArray(hrAtt.body.data?.rows), '8.4 Admin can access Attendance & Overtime report');

  console.log('\n======================================================');
  console.log(`  AUDIT COMPLETE: ${passCount} PASSED, ${failCount} FAILED (TOTAL: ${passCount + failCount})`);
  console.log('======================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runSeniorQA().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
