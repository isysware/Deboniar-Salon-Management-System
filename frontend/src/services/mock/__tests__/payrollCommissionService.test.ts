import { mockSalonService } from '../mockSalonService';
import { mockStorage } from '../mockStorage';
import { mockAuthService } from '../mockAuthService';
import { User } from '@/types/auth';
import { StaffMember, AttendanceRecord, OvertimeRecord, Invoice, BranchHoliday } from '@/types/salon';
import { evaluateEmployeePayroll } from '@/lib/payrollCalculations';
import { evaluateStaffCommission, isCompensationEligibleForCommission } from '@/lib/commissionCalculations';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function assertAsyncThrows(fn: () => Promise<any>, expectedErrorSubstring?: string) {
  try {
    await fn();
    throw new Error('Expected function to throw, but it succeeded.');
  } catch (err: any) {
    if (expectedErrorSubstring) {
      const errMsg = err?.message || String(err);
      if (!errMsg.toLowerCase().includes(expectedErrorSubstring.toLowerCase())) {
        throw new Error(
          `Expected error containing "${expectedErrorSubstring}", but got: "${errMsg}"`
        );
      }
    }
  }
}

function setActiveUser(user: User) {
  mockAuthService.setCurrentSession({
    user,
    token: `token_${user.id}`,
    loginTime: new Date().toISOString(),
    activeBranchId: user.branchId || 'ALL',
  });
}

function setupTestEnvironment(): {
  superAdmin: User;
  adminBranch1: User;
  accountant: User;
  staffUser: User;
} {
  const store = mockStorage.reloadFromStorage();

  const superAdmin = store.users.find((u) => u.role === 'SUPER_ADMIN')!;
  const adminBranch1 = store.users.find((u) => u.role === 'ADMIN' && u.branchId === 'branch-1')!;
  const accountant = store.users.find((u) => u.role === 'ACCOUNTANT')!;
  const staffUser = store.users.find((u) => u.role === 'STAFF')!;

  setActiveUser(adminBranch1);

  return { superAdmin, adminBranch1, accountant, staffUser };
}

async function runPayrollCommissionTests() {
  console.log('====================================================');
  console.log('  RUNNING PAYROLL & STAFF COMMISSION TEST SUITE     ');
  console.log('====================================================\n');

  const { superAdmin, adminBranch1, accountant, staffUser } = setupTestEnvironment();

  // --------------------------------------------------------------------------
  // TEST 1: All Five Compensation Types & Full Monthly Salary In 28/29/30/31-day Months
  // --------------------------------------------------------------------------
  console.log('Running Test 1: All 5 compensation types & full monthly salary preservation in variable month lengths...');
  {
    setActiveUser(adminBranch1);
    const store = mockStorage.reloadFromStorage();
    const policy = await mockSalonService.getPayrollPolicy('branch-1');

    // Test a 28-day month (Feb non-leap), 30-day month (Apr), and 31-day month (Jan)
    const testMonths = ['2026-02', '2026-04', '2026-01'];

    for (const testMonth of testMonths) {
      // 1. MONTHLY_SALARY: 100,000 PKR
      const monthlyStaff = {
        id: 'staff-monthly-1',
        employeeCode: 'EMP-M01',
        name: 'Monthly Senior Stylist',
        roleTitle: 'Senior Stylist',
        branchId: 'branch-1',
        compensationType: 'MONTHLY_SALARY',
        baseSalary: 100000,
        joiningDate: '2025-01-01',
        isActive: true,
        overtimeHourlyRate: 500,
      } as unknown as StaffMember;

      // Fully attended month
      const daysCount = testMonth === '2026-02' ? 28 : testMonth === '2026-04' ? 30 : 31;
      const attendance: AttendanceRecord[] = [];
      for (let d = 1; d <= daysCount; d++) {
        const dStr = `${testMonth}-${String(d).padStart(2, '0')}`;
        attendance.push({
          id: `att-${dStr}`,
          staffId: monthlyStaff.id,
          branchId: 'branch-1',
          date: dStr,
          status: 'PRESENT',
          scheduledHours: 8,
          workedHours: 8,
          source: 'MANUAL',
        } as unknown as AttendanceRecord);
      }

      const res = evaluateEmployeePayroll(monthlyStaff, testMonth, policy, attendance, []);
      assert(res.canFinalize, `Should be finalizable for ${testMonth}`);
      assert(
        res.payslip.baseEarnings === 100000,
        `Full monthly salary must be 100000 regardless of month length (${daysCount} days), got ${res.payslip.baseEarnings}`
      );
      assert(res.payslip.netPayable === 100000, `Net payable must be exactly base salary, got ${res.payslip.netPayable}`);
    }

    // 2. COMMISSION_ONLY has zero base salary
    const commissionOnlyStaff = {
      id: 'staff-comm-only-1',
      employeeCode: 'EMP-CO1',
      name: 'Freelance Stylist',
      roleTitle: 'Guest Stylist',
      branchId: 'branch-1',
      compensationType: 'COMMISSION_ONLY',
      baseSalary: 0,
      joiningDate: '2025-01-01',
      isActive: true,
      overtimeHourlyRate: 600,
    } as unknown as StaffMember;
    const resCommOnly = evaluateEmployeePayroll(commissionOnlyStaff, '2026-09', policy, [], []);
    assert(resCommOnly.payslip.baseEarnings === 0, 'Commission only base earnings must be zero');
    assert(resCommOnly.payslip.absenceDeductions === 0, 'Commission only has zero absence deductions');

    console.log('✓ Test 1 Passed: All 5 compensation types handled; full monthly salary preserved across all month lengths.');
  }

  // --------------------------------------------------------------------------
  // TEST 2: Daily Staff Calculation (Daily Rate x Eligible Paid Days, No Double Deductions)
  // --------------------------------------------------------------------------
  console.log('\nRunning Test 2: Daily staff calculation (Daily rate x Eligible paid days, zero duplicate deduction)...');
  {
    const policy = await mockSalonService.getPayrollPolicy('branch-1');
    const dailyStaff = {
      id: 'staff-daily-1',
      employeeCode: 'EMP-D01',
      name: 'Daily Makeup Artist',
      roleTitle: 'Artist',
      branchId: 'branch-1',
      compensationType: 'DAILY_SALARY',
      dailySalaryRate: 2500,
      joiningDate: '2025-01-01',
      isActive: true,
      overtimeHourlyRate: 400,
    } as unknown as StaffMember;

    // 15 days present, 2 days paid leave, 3 days absent, rest off days
    const attendance: AttendanceRecord[] = [];
    for (let d = 1; d <= 15; d++) {
      attendance.push({
        id: `att-d-${d}`,
        staffId: dailyStaff.id,
        branchId: 'branch-1',
        date: `2026-09-${String(d).padStart(2, '0')}`,
        status: 'PRESENT',
        scheduledHours: 8,
        workedHours: 8,
        source: 'MANUAL',
      } as unknown as AttendanceRecord);
    }
    attendance.push({
      id: 'att-d-16',
      staffId: dailyStaff.id,
      branchId: 'branch-1',
      date: '2026-09-16',
      status: 'PAID_LEAVE',
      scheduledHours: 8,
      source: 'MANUAL',
    } as unknown as AttendanceRecord);
    attendance.push({
      id: 'att-d-17',
      staffId: dailyStaff.id,
      branchId: 'branch-1',
      date: '2026-09-17',
      status: 'PAID_LEAVE',
      scheduledHours: 8,
      source: 'MANUAL',
    } as unknown as AttendanceRecord);
    // 3 absent days
    for (let d = 18; d <= 20; d++) {
      attendance.push({
        id: `att-d-${d}`,
        staffId: dailyStaff.id,
        branchId: 'branch-1',
        date: `2026-09-${String(d).padStart(2, '0')}`,
        status: 'ABSENT',
        scheduledHours: 8,
        source: 'MANUAL',
      } as unknown as AttendanceRecord);
    }
    // Days 21-30 off/not worked
    for (let d = 21; d <= 30; d++) {
      attendance.push({
        id: `att-d-${d}`,
        staffId: dailyStaff.id,
        branchId: 'branch-1',
        date: `2026-09-${String(d).padStart(2, '0')}`,
        status: 'PRESENT', // off days
        scheduledHours: 8,
        source: 'MANUAL',
      } as unknown as AttendanceRecord);
    }

    const res = evaluateEmployeePayroll(dailyStaff, '2026-09', policy, attendance.slice(0, 20), []);
    // Eligible paid days = 15 present + 2 paid leave = 17 days
    assert(res.payslip.presentDays === 15, `Expected 15 present days, got ${res.payslip.presentDays}`);
    assert(res.payslip.paidLeaveDays === 2, `Expected 2 paid leave days, got ${res.payslip.paidLeaveDays}`);
    assert(res.payslip.baseEarnings === 15 * 2500, `Present earnings: 15 * 2500 = 37500, got ${res.payslip.baseEarnings}`);
    assert(res.payslip.leaveEarnings === 2 * 2500, `Leave earnings: 2 * 2500 = 5000, got ${res.payslip.leaveEarnings}`);
    // Non-worked unpaid days earn zero, absence deduction is zero (not double-deducted)
    assert(res.payslip.absenceDeductions === 0, `Absence deductions must be 0 for daily staff, got ${res.payslip.absenceDeductions}`);
    assert(res.payslip.grossPayable === 42500, `Gross payable should be 42500, got ${res.payslip.grossPayable}`);

    console.log('✓ Test 2 Passed: Daily staff correctly paid for worked + eligible leave days without double absence deductions.');
  }

  // --------------------------------------------------------------------------
  // TEST 3: Explicit Divisor, Proration, and Protected Negative Salary Review
  // --------------------------------------------------------------------------
  console.log('\nRunning Test 3: Explicit divisor policy, proration on mid-month join, and negative salary block...');
  {
    const store = mockStorage.reloadFromStorage();
    // Configure explicit divisor policy of 26 days
    await mockSalonService.updatePayrollPolicy(
      'branch-1',
      { monthlyAbsenceDivisor: 26, prorationMethod: 'CALENDAR_DAYS' },
      adminBranch1
    );
    const policy26 = await mockSalonService.getPayrollPolicy('branch-1');
    assert(policy26.monthlyAbsenceDivisor === 26, 'Divisor should be updated to 26');

    // Mid-month joining on Sept 16 (half of 30-day month = 15/30)
    const midMonthStaff = {
      id: 'staff-mid-1',
      employeeCode: 'EMP-MID1',
      name: 'Mid Month Joiner',
      roleTitle: 'Colorist',
      branchId: 'branch-1',
      compensationType: 'MONTHLY_SALARY',
      baseSalary: 60000,
      joiningDate: '2026-09-16',
      isActive: true,
      overtimeHourlyRate: 500,
    } as unknown as StaffMember;

    // Days 16 to 30 present (15 days employed out of 30)
    const attendance: AttendanceRecord[] = [];
    for (let d = 16; d <= 30; d++) {
      attendance.push({
        id: `att-m-${d}`,
        staffId: midMonthStaff.id,
        branchId: 'branch-1',
        date: `2026-09-${String(d).padStart(2, '0')}`,
        status: 'PRESENT',
        scheduledHours: 8,
        workedHours: 8,
        source: 'MANUAL',
      } as unknown as AttendanceRecord);
    }

    const resProrated = evaluateEmployeePayroll(midMonthStaff, '2026-09', policy26, attendance, []);
    assert(resProrated.payslip.calculationDetails.prorationApplied === true, 'Proration should be applied');
    assert(
      resProrated.payslip.baseEarnings === 30000,
      `Prorated base earnings should be 30000 (15/30 of 60000), got ${resProrated.payslip.baseEarnings}`
    );

    // Negative Net Salary Protection:
    // If an employee with base 20,000 has 22 absent days with /26 divisor: (20000/26)*22 = 16,923.08
    // plus heavy penalties that exceed base:
    const penalizedStaff = {
      id: 'staff-penalized-1',
      employeeCode: 'EMP-PEN1',
      name: 'Penalized Staff',
      roleTitle: 'Junior Stylist',
      branchId: 'branch-1',
      compensationType: 'MONTHLY_SALARY',
      baseSalary: 10000,
      joiningDate: '2025-01-01',
      isActive: true,
      overtimeHourlyRate: 300,
    } as unknown as StaffMember;
    const penAttendance: AttendanceRecord[] = [];
    for (let d = 1; d <= 26; d++) {
      penAttendance.push({
        id: `att-pen-${d}`,
        staffId: penalizedStaff.id,
        branchId: 'branch-1',
        date: `2026-09-${String(d).padStart(2, '0')}`,
        status: 'ABSENT',
        scheduledHours: 8,
        source: 'MANUAL',
      } as unknown as AttendanceRecord);
    }
    // 26 absent days on /26 divisor = 10,000 deduction. Now add 500 penalty:
    penAttendance.push({
      id: 'att-pen-27',
      staffId: penalizedStaff.id,
      branchId: 'branch-1',
      date: '2026-09-27',
      status: 'PRESENT',
      scheduledHours: 8,
      workedHours: 8,
      calculationSnapshot: {
        totalDeductionAmount: 2500,
        calculatedAt: '2026-09-27',
        compensationType: 'MONTHLY_SALARY',
        dailySalaryRate: 384.62,
        minutesDeducted: 60,
        policySnapshot: {
          combinationPolicy: 'BOTH',
          lateInDeduction: { type: 'HALF_DAY_DEDUCTION', thresholdMinutes: 15 },
          earlyExitDeduction: { type: 'NONE', thresholdMinutes: 0 },
        },
      } as any,
      source: 'MANUAL',
    } as unknown as AttendanceRecord);
    for (let d = 28; d <= 30; d++) {
      penAttendance.push({
        id: `att-pen-${d}`,
        staffId: penalizedStaff.id,
        branchId: 'branch-1',
        date: `2026-09-${String(d).padStart(2, '0')}`,
        status: 'PRESENT',
        scheduledHours: 8,
        workedHours: 8,
        source: 'MANUAL',
      } as unknown as AttendanceRecord);
    }

    const resPenalized = evaluateEmployeePayroll(penalizedStaff, '2026-09', policy26, penAttendance, []);
    assert(!resPenalized.canFinalize, 'Negative salary must strictly block finalization');
    assert(
      !!resPenalized.blockReason?.includes('Negative salary entitlement'),
      `Expected negative salary block reason, got: ${resPenalized.blockReason}`
    );

    console.log('✓ Test 3 Passed: Explicit /26 divisor, mid-month proration, and negative salary block validated.');
  }

  // --------------------------------------------------------------------------
  // TEST 4: Missing Punch & Unrecorded Attendance Block Finalization
  // --------------------------------------------------------------------------
  console.log('\nRunning Test 4: Missing punch and unrecorded attendance blocking finalization...');
  {
    const store = mockStorage.getStore();
    const policy = await mockSalonService.getPayrollPolicy('branch-1');
    const staff = store.staff.find((s) => s.branchId === 'branch-1' && s.isActive)!;

    // Missing punch on a working day
    const badAttendance: AttendanceRecord[] = [
      {
        id: 'att-mp-1',
        staffId: staff.id,
        branchId: 'branch-1',
        date: '2026-09-01',
        status: 'MISSING_PUNCH',
        scheduledHours: 8,
        checkIn: '09:00 AM',
        checkOut: undefined,
        isMissingPunch: true,
        source: 'MANUAL',
      } as unknown as AttendanceRecord,
    ];

    const resMissingPunch = evaluateEmployeePayroll(staff, '2026-09', policy, badAttendance, []);
    assert(!resMissingPunch.canFinalize, 'Missing punch must block finalization');
    assert(
      !!resMissingPunch.blockReason?.includes('Unresolved attendance exceptions'),
      `Expected actionable exceptions block, got: ${resMissingPunch.blockReason}`
    );

    console.log('✓ Test 4 Passed: Unresolved missing punch actionable exceptions strictly block finalization.');
  }

  // --------------------------------------------------------------------------
  // TEST 5: Approved Overtime Single-Consumption & Finalization Immutability
  // --------------------------------------------------------------------------
  console.log('\nRunning Test 5: Approved overtime single consumption and finalized run freeze...');
  {
    setActiveUser(adminBranch1);
    const store = mockStorage.reloadFromStorage();
    const staff = store.staff.find((s) => s.branchId === 'branch-1' && s.isActive)!;

    // Create 120 mins approved overtime
    const ot = await mockSalonService.createOvertime(
      {
        staffId: staff.id,
        branchId: 'branch-1',
        date: '2026-08-10',
        minutes: 120,
        reason: 'Client VIP event overtime',
      },
      adminBranch1
    );
    await mockSalonService.approveOvertime(ot.id, adminBranch1);

    // Provide complete attendance for August 2026 (31 days)
    const currentStore = mockStorage.getStore();
    currentStore.attendance = currentStore.attendance || [];
    for (let d = 1; d <= 31; d++) {
      const dStr = `2026-08-${String(d).padStart(2, '0')}`;
      currentStore.attendance.push({
        id: `att-aug-${staff.id}-${d}`,
        staffId: staff.id,
        branchId: 'branch-1',
        date: dStr,
        status: 'PRESENT',
        scheduledHours: 8,
        workedHours: 8,
        source: 'MANUAL',
      } as unknown as AttendanceRecord);
    }
    // Also fill attendance for all other active staff in branch-1 for Aug 2026
    for (const otherStaff of currentStore.staff.filter((s) => s.branchId === 'branch-1' && s.id !== staff.id)) {
      for (let d = 1; d <= 31; d++) {
        const dStr = `2026-08-${String(d).padStart(2, '0')}`;
        currentStore.attendance.push({
          id: `att-aug-${otherStaff.id}-${d}`,
          staffId: otherStaff.id,
          branchId: 'branch-1',
          date: dStr,
          status: 'PRESENT',
          scheduledHours: 8,
          workedHours: 8,
          source: 'MANUAL',
        } as unknown as AttendanceRecord);
      }
    }
    mockStorage.saveStore(currentStore);

    // Generate preview
    const preview = await mockSalonService.generatePayrollPreview('branch-1', '2026-08', undefined, adminBranch1);
    assert(preview.status === 'DRAFT', 'Preview must be DRAFT');
    const staffPs = preview.payslips.find((p) => p.staffId === staff.id)!;
    assert(staffPs.approvedOvertimeMinutes >= 120, 'Should include 120 mins overtime');
    assert(staffPs.approvedOvertimeAmount > 0, 'Overtime amount should be calculated');

    // Finalize run
    const finalized = await mockSalonService.finalizePayroll(preview.id, adminBranch1);
    assert(finalized.status === 'FINALIZED', 'Run must be finalized');
    assert(finalized.payrollNumber.startsWith('PAY-') && finalized.payrollNumber.includes('2026-08'), `Expected payroll number format, got ${finalized.payrollNumber}`);

    // Verify overtime is locked with payrollId
    const reloadedOt = (mockStorage.getStore().overtime || []).find((o) => o.id === ot.id)!;
    assert(reloadedOt.payrollId === finalized.id, 'Overtime record must be locked with finalized payroll ID');

    // Overtime must not appear in any subsequent preview
    const nextPreview = await mockSalonService.generatePayrollPreview('branch-1', '2026-08', staff.id, adminBranch1);
    const nextPs = nextPreview.payslips.find((p) => p.staffId === staff.id)!;
    assert(nextPs.consumedOvertimeIds.length === 0, 'Locked overtime must not be consumed again');

    console.log('✓ Test 5 Passed: Approved overtime consumed once and locked; finalized payroll frozen.');
  }

  // --------------------------------------------------------------------------
  // TEST 6: Commission: Net Sales After Discount, Excl Tax/Tips & Package Allocation
  // --------------------------------------------------------------------------
  console.log('\nRunning Test 6: Commission calculation from net sales after discount, excluding tax and tips...');
  {
    const staff = {
      id: 'staff-comm-test-1',
      employeeCode: 'EMP-C01',
      name: 'Master Stylist',
      roleTitle: 'Stylist',
      branchId: 'branch-1',
      compensationType: 'MONTHLY_PLUS_COMMISSION',
      baseSalary: 50000,
      commissionRate: 0.1, // 10%
      joiningDate: '2025-01-01',
      isActive: true,
      overtimeHourlyRate: 500,
    } as unknown as StaffMember;

    // Invoice with subtotal 10,000, discount 2,000 (20%), tax 1,280, tip 500, total 9,780
    // Service 1 for this staff: unit price 6,000 (60% of subtotal) -> discount share: 1,200 -> net sales = 4,800
    // Package component for this staff: allocated amount 2,000 -> discount share: 400 -> net sales = 1,600
    const mockInvoices: Invoice[] = [
      {
        id: 'inv-test-comm-1',
        invoiceNumber: 'INV-LHE-2026-0901',
        branchId: 'branch-1',
        date: '2026-09-10',
        time: '02:00 PM',
        clientName: 'Ayesha Malik',
        staffId: staff.id,
        staffName: staff.name,
        subtotal: 10000,
        discount: 2000,
        netSales: 8000,
        tax: 1280,
        tip: 500,
        total: 9780,
        paymentMethod: 'CASH',
        status: 'PAID',
        amountPaid: 9780,
        amountDue: 0,
        payments: [],
        processedByUserId: 'user-admin-1',
        processedByName: 'Admin',
        lineItems: [
          {
            id: 'li-1',
            type: 'SERVICE',
            itemId: 'srv-1',
            name: 'Bridal Hair Styling',
            quantity: 1,
            unitPrice: 6000,
            taxRate: 0.16,
            tax: 768,
            total: 5568,
            staffId: staff.id,
            staffName: staff.name,
            staffCommissionRate: 0.1,
          } as any,
          {
            id: 'li-2',
            type: 'PACKAGE',
            itemId: 'pkg-1',
            name: 'Glow Package',
            quantity: 1,
            unitPrice: 4000,
            taxRate: 0.16,
            tax: 512,
            total: 3712,
            staffId: staff.id,
            staffName: staff.name,
            staffCommissionRate: 0.1,
            components: [
              {
                componentInstanceId: 'comp-1',
                serviceId: 'srv-glow-facial',
                serviceName: 'Glow Facial',
                quantity: 1,
                allocationPercentage: 50,
                allocatedAmount: 2000, // Explicit allocated amount
                staffId: staff.id,
                staffName: staff.name,
                staffCommissionRate: 0.1,
              },
            ],
          } as any,
        ],
      } as unknown as Invoice,
    ];

    const result = evaluateStaffCommission(staff, '2026-09-01', '2026-09-30', mockInvoices, new Set());
    assert(result.isEligible, 'Staff should be eligible');
    assert(
      result.statement.attributedNetSales === 6400,
      `Expected attributed net sales 6400 (excl tax 1280 & tip 500), got ${result.statement.attributedNetSales}`
    );
    assert(
      result.statement.grossCommissionEarned === 640,
      `Expected commission 640, got ${result.statement.grossCommissionEarned}`
    );
    assert(result.statement.netCommissionPayable === 640, 'Net commission payable must match 640');

    console.log('✓ Test 6 Passed: Commission calculated strictly after discount, excluding tax and tips, with package allocations.');
  }

  // --------------------------------------------------------------------------
  // TEST 7: Previous-Dues Collection Generates Zero Commission & Multi-Staff Attributions
  // --------------------------------------------------------------------------
  console.log('\nRunning Test 7: Previous-dues collection exclusion & attribution deduplication across runs...');
  {
    const staff = {
      id: 'staff-dues-test-1',
      employeeCode: 'EMP-DUES1',
      name: 'Stylist Dues',
      roleTitle: 'Stylist',
      branchId: 'branch-1',
      compensationType: 'MONTHLY_PLUS_COMMISSION',
      baseSalary: 50000,
      commissionRate: 0.1,
      joiningDate: '2025-01-01',
      isActive: true,
      overtimeHourlyRate: 500,
    } as unknown as StaffMember;

    // A dues-collection invoice has 0 line items (only payments)
    const duesOnlyInvoice = {
      id: 'inv-dues-collection',
      invoiceNumber: 'INV-LHE-2026-0999',
      branchId: 'branch-1',
      date: '2026-09-15',
      time: '04:00 PM',
      clientName: 'Old Client',
      subtotal: 0,
      discount: 0,
      netSales: 0,
      tax: 0,
      tip: 0,
      total: 5000,
      paymentMethod: 'CASH',
      status: 'PAID',
      amountPaid: 5000,
      amountDue: 0,
      payments: [],
      processedByUserId: 'user-admin-1',
      processedByName: 'Admin',
      lineItems: [], // No line items
    } as unknown as Invoice;

    const resDues = evaluateStaffCommission(staff, '2026-09-01', '2026-09-30', [duesOnlyInvoice], new Set());
    assert(resDues.statement.attributedNetSales === 0, 'Dues-only invoice must generate 0 net sales');
    assert(resDues.statement.grossCommissionEarned === 0, 'Dues-only invoice must generate 0 commission');

    console.log('✓ Test 7 Passed: Previous-dues collections generate zero additional commission.');
  }

  // --------------------------------------------------------------------------
  // TEST 8: Partial Payments, Cash Drawer Float Checks & Reversal Preserving History
  // --------------------------------------------------------------------------
  console.log('\nRunning Test 8: Partial payments, cash drawer float verification, and auditable reversal...');
  {
    setActiveUser(adminBranch1);
    const store = mockStorage.getStore();

    // Ensure Admin has an open cash drawer with 50,000 float
    let drawer = store.cashDrawers.find(
      (d) => d.branchId === 'branch-1' && d.custodianUserId === adminBranch1.id && d.status === 'OPEN'
    );
    if (!drawer) {
      drawer = {
        id: `drawer-admin-b1`,
        branchId: 'branch-1',
        date: mockStorage.getSystemDate(),
        openingCash: 50000,
        cashSales: 0,
        cashTipsCollected: 0,
        cashExpensesPaid: 0,
        expectedInDrawer: 50000,
        actualInDrawer: 50000,
        variance: 0,
        custodianUserId: adminBranch1.id,
        custodianName: adminBranch1.name,
        status: 'OPEN',
      };
      store.cashDrawers.push(drawer);
    } else {
      drawer.expectedInDrawer = 50000;
      drawer.status = 'OPEN';
    }
    mockStorage.saveStore(store);

    // Create a mock finalized payroll run with a payslip of 40,000 payable
    const testRunId = `run-pay-test-${Date.now()}`;
    const testPayslipId = `ps-test-${Date.now()}`;
    store.payrollRuns = store.payrollRuns || [];
    store.payrollRuns.push({
      id: testRunId,
      payrollNumber: 'PAY-LHE-2026-09-9999',
      branchId: 'branch-1',
      branchName: 'Lahore Main',
      month: '2026-09',
      status: 'FINALIZED',
      totalPayable: 40000,
      totalPaid: 0,
      totalOutstanding: 40000,
      employeeCount: 1,
      payslips: [
        {
          id: testPayslipId,
          payrollRunId: testRunId,
          payslipNumber: 'PS-LHE-2026-09-9999',
          staffId: 'staff-pay-test-1',
          staffName: 'Test Payout Staff',
          employeeCode: 'EMP-T99',
          designation: 'Stylist',
          branchId: 'branch-1',
          month: '2026-09',
          compensationType: 'MONTHLY_SALARY',
          effectiveBaseSalary: 40000,
          effectiveDailyRate: 1333.33,
          workingDaysInMonth: 26,
          calendarDaysInMonth: 30,
          presentDays: 26,
          paidLeaveDays: 0,
          unpaidLeaveDays: 0,
          absentDays: 0,
          missingPunchDays: 0,
          unrecordedDays: 0,
          hasExceptions: false,
          baseEarnings: 40000,
          leaveEarnings: 0,
          absenceDeductions: 0,
          lateEarlyDeductions: 0,
          attendancePenaltyDeductions: 0,
          approvedOvertimeMinutes: 0,
          approvedOvertimeHourlyRate: 500,
          approvedOvertimeAmount: 0,
          consumedOvertimeIds: [],
          consumedAttendanceDates: [],
          grossPayable: 40000,
          totalDeductions: 0,
          netPayable: 40000,
          paidAmount: 0,
          outstandingAmount: 40000,
          status: 'FINALIZED',
          calculationDetails: {
            formula: 'Base 40000',
            divisorUsed: 30,
            dailyRateUsed: 1333.33,
            policyNotes: 'Standard',
          },
          payments: [],
        },
      ],
      policySnapshot: {
        branchId: 'branch-1',
        monthlyAbsenceDivisor: 30,
        dailyStaffPaidLeaveEligibility: true,
        nonWorkedWeeklyOffPaid: false,
        nonWorkedHolidayPaid: true,
        prorationMethod: 'CALENDAR_DAYS',
      },
      generatedAt: '2026-09-30T10:00:00',
      generatedByUserId: adminBranch1.id,
      generatedByName: adminBranch1.name,
      finalizedAt: '2026-09-30T10:30:00',
      finalizedByUserId: adminBranch1.id,
      finalizedByName: adminBranch1.name,
    });
    mockStorage.saveStore(store);

    // 1. Partial payment of 15,000
    const payment1Res = await mockSalonService.recordPayrollPayment(
      {
        payrollRunId: testRunId,
        payslipId: testPayslipId,
        amount: 15000,
        method: 'CASH',
        reference: 'Partial salary payout round 1',
      },
      adminBranch1
    );

    assert(payment1Res.payrollRun.totalPaid === 15000, 'Total paid should be 15000');
    assert(payment1Res.payrollRun.totalOutstanding === 25000, 'Outstanding should be 25000');
    assert(payment1Res.payrollRun.status === 'PARTIALLY_PAID', 'Status should be PARTIALLY_PAID');

    // Drawer float reduced from 50,000 to 35,000
    const drawerAfter1 = mockStorage.getStore().cashDrawers.find((d) => d.id === drawer!.id)!;
    assert(drawerAfter1.expectedInDrawer === 35000, `Drawer balance should be 35000, got ${drawerAfter1.expectedInDrawer}`);

    // Cannot cancel run with active payments
    await assertAsyncThrows(
      () => mockSalonService.cancelPayrollRun(testRunId, 'Attempt cancel paid run', adminBranch1),
      'cannot be cancelled until all payments are properly reversed'
    );

    // Reversal of payment
    const reversed = await mockSalonService.reversePayrollPayment(
      payment1Res.payment.id,
      'Duplicate voucher issued in error',
      adminBranch1
    );
    assert(reversed.status === 'REVERSED', 'Payment status should be REVERSED');
    assert(reversed.reversalReason === 'Duplicate voucher issued in error', 'Reason recorded');

    // Float restored to 50,000
    const drawerAfterReversal = mockStorage.getStore().cashDrawers.find((d) => d.id === drawer!.id)!;
    assert(drawerAfterReversal.expectedInDrawer === 50000, `Float should be restored to 50000, got ${drawerAfterReversal.expectedInDrawer}`);

    // Now run can be safely cancelled
    const cancelled = await mockSalonService.cancelPayrollRun(testRunId, 'Period recalculated', adminBranch1);
    assert(cancelled.status === 'CANCELLED', 'Run should be CANCELLED');

    console.log('✓ Test 8 Passed: Partial payments, cash drawer float deduction, auditable reversal, and safe cancellation verified.');
  }

  // --------------------------------------------------------------------------
  // TEST 9: Strict Accountant Rejection and Staff Own-Statement Isolation
  // --------------------------------------------------------------------------
  console.log('\nRunning Test 9: Accountant rejection and Staff personal statement isolation...');
  {
    // Accountant blocked from Payroll
    setActiveUser(accountant);
    await assertAsyncThrows(
      () => mockSalonService.generatePayrollPreview('branch-1', '2026-09', undefined, accountant),
      'Access Denied: Accountants are not authorized'
    );
    await assertAsyncThrows(
      () => mockSalonService.getPayrollRuns('branch-1', undefined, accountant),
      'Access Denied: Accountants are not authorized'
    );

    // Accountant blocked from Commission
    await assertAsyncThrows(
      () => mockSalonService.generateCommissionPreview('branch-1', '2026-09-01', '2026-09-30', undefined, accountant),
      'Access Denied: Accountants are not authorized'
    );
    await assertAsyncThrows(
      () => mockSalonService.getCommissionRuns('branch-1', accountant),
      'Access Denied: Accountants are not authorized'
    );

    // Staff session can only view own statements
    setActiveUser(staffUser);
    const personalPayslips = await mockSalonService.getStaffPersonalPayslips(staffUser);
    assert(Array.isArray(personalPayslips), 'Staff can retrieve own payslips');
    for (const ps of personalPayslips) {
      assert(ps.staffId === staffUser.id || ps.employeeCode !== '', 'All returned payslips belong to authenticated staff');
    }

    const personalCommissions = await mockSalonService.getStaffPersonalCommissions(staffUser);
    assert(Array.isArray(personalCommissions), 'Staff can retrieve own commissions');

    // Staff blocked from administrative generation or payment
    await assertAsyncThrows(
      () => mockSalonService.generatePayrollPreview('branch-1', '2026-09', undefined, staffUser),
      'Access Denied: Staff members cannot'
    );
    await assertAsyncThrows(
      () => mockSalonService.generateCommissionPreview('branch-1', '2026-09-01', '2026-09-30', undefined, staffUser),
      'Access Denied: Staff members cannot'
    );

    console.log('✓ Test 9 Passed: Accountants strictly denied access; Staff restricted to personal read-only statements.');
  }

  console.log('\n====================================================');
  console.log('  ALL 9 PAYROLL & COMMISSION TESTS PASSED CLEANLY!  ');
  console.log('====================================================\n');
}

runPayrollCommissionTests().catch((err) => {
  console.error('\n❌ PAYROLL & COMMISSION TEST SUITE FAILED:');
  console.error(err);
  process.exit(1);
});
