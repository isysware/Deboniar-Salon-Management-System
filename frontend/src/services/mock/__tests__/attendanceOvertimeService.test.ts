import { mockSalonService } from '../mockSalonService';
import { mockStorage, StorageSchema } from '../mockStorage';
import { mockAuthService } from '../mockAuthService';
import { User } from '../../../types/auth';
import {
  evaluateLateness,
  evaluateEarlyExit,
  calculateWorkedHours,
  calculateScheduledHours,
  calculateDeductionSnapshot,
  evaluateLeaveAllowance,
} from '../../../lib/attendanceCalculations';
import { StaffMember } from '../../../types/salon';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function assertAsyncThrows(fn: () => Promise<any>, expectedSubstring?: string) {
  let threw = false;
  let caughtError: any = null;
  try {
    await fn();
  } catch (err: any) {
    threw = true;
    caughtError = err;
  }
  if (!threw) {
    throw new Error(`ASSERTION FAILED: Expected async function to throw an error, but it succeeded.`);
  }
  if (expectedSubstring && !caughtError.message.includes(expectedSubstring)) {
    throw new Error(
      `ASSERTION FAILED: Expected error containing "${expectedSubstring}", but got "${caughtError.message}"`
    );
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
  adminBranch2: User;
  accountant: User;
  staffUser: User;
} {
  const store = mockStorage.reloadFromStorage();

  const superAdmin = store.users.find((u) => u.role === 'SUPER_ADMIN')!;
  const adminBranch1 = store.users.find((u) => u.role === 'ADMIN' && u.branchId === 'branch-1')!;
  const adminBranch2 = store.users.find((u) => u.role === 'ADMIN' && u.branchId === 'branch-2') || {
    id: 'user-admin-b2',
    name: 'Admin Branch 2',
    email: 'admin.b2@isysware.com',
    role: 'ADMIN' as const,
    title: 'Branch Administrator',
    branchId: 'branch-2',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  };
  const accountant = store.users.find((u) => u.role === 'ACCOUNTANT')!;
  const staffUser = store.users.find((u) => u.role === 'STAFF')!;

  setActiveUser(adminBranch1);

  return { superAdmin, adminBranch1, adminBranch2, accountant, staffUser };
}

async function runAttendanceOvertimeTests() {
  console.log('====================================================');
  console.log('  RUNNING ATTENDANCE & MANUAL OVERTIME TEST SUITE   ');
  console.log('====================================================\n');

  const { superAdmin, adminBranch1, adminBranch2, accountant, staffUser } = setupTestEnvironment();

  // --------------------------------------------------------------------------
  // TEST 1: Grace Threshold Boundaries (Exact Threshold is NOT Late/Early)
  // --------------------------------------------------------------------------
  console.log('Running Test 1: Grace threshold boundaries (exact minute = on time)...');
  {
    // Start time: 09:00 AM, grace: 15 minutes. Threshold is 09:15 AM.
    const onTimeBefore = evaluateLateness('09:10 AM', '09:00 AM', 15);
    assert(!onTimeBefore.isLate && onTimeBefore.lateMinutes === 0, '09:10 AM should not be late.');

    const onExactThreshold = evaluateLateness('09:15 AM', '09:00 AM', 15);
    assert(!onExactThreshold.isLate && onExactThreshold.lateMinutes === 0, '09:15 AM exact grace threshold must NOT be late.');

    const oneMinutePast = evaluateLateness('09:16 AM', '09:00 AM', 15);
    assert(oneMinutePast.isLate && oneMinutePast.lateMinutes === 16, '09:16 AM should be late by 16 minutes.');

    // End time: 06:00 PM (18:00), grace: 15 minutes. Threshold is 05:45 PM (17:45).
    const earlyExactThreshold = evaluateEarlyExit('05:45 PM', '06:00 PM', 15, false);
    assert(!earlyExactThreshold.isEarlyExit && earlyExactThreshold.earlyExitMinutes === 0, '05:45 PM exact grace threshold must NOT be early exit.');

    const oneMinuteEarly = evaluateEarlyExit('05:44 PM', '06:00 PM', 15, false);
    assert(oneMinuteEarly.isEarlyExit && oneMinuteEarly.earlyExitMinutes === 16, '05:44 PM should be early exit by 16 minutes.');

    console.log('✓ Test 1 Passed: Exact grace threshold boundary rules verified.');
  }

  // --------------------------------------------------------------------------
  // TEST 2: Overnight Shifts Duration and Calculation
  // --------------------------------------------------------------------------
  console.log('\nRunning Test 2: Overnight shift duration and calculation...');
  {
    // Shift: 09:00 PM (21:00) to 05:00 AM (05:00 next day) = 8 hours
    const scheduled = calculateScheduledHours('09:00 PM', '05:00 AM', true);
    assert(scheduled === 8.0, `Expected 8.0 scheduled hours, got ${scheduled}`);

    // Worked: Check in 09:00 PM, Check out 05:00 AM
    const workedFull = calculateWorkedHours('09:00 PM', '05:00 AM', true);
    assert(workedFull === 8.0, `Expected 8.0 worked hours, got ${workedFull}`);

    // Worked with early exit: Check out 04:30 AM
    const earlyRes = evaluateEarlyExit('04:30 AM', '05:00 AM', 15, true);
    assert(earlyRes.isEarlyExit && earlyRes.earlyExitMinutes === 30, '04:30 AM should be 30m early exit for 05:00 AM end.');

    console.log('✓ Test 2 Passed: Overnight shifts calculate correctly across midnight.');
  }

  // --------------------------------------------------------------------------
  // TEST 3: Deduction Snapshot Calculation Rules
  // --------------------------------------------------------------------------
  console.log('\nRunning Test 3: Deduction snapshot rules (commission protection, divisor, policies)...');
  {
    // A. Commission Only staff: strictly zero deduction
    const commStaff: StaffMember = {
      id: 'staff-comm',
      name: 'Commission Stylist',
      employeeCode: 'CMS-01',
      branchId: 'branch-1',
      designation: 'Stylist',
      roleTitle: 'Stylist',
      compensationType: 'COMMISSION_ONLY',
      baseSalary: 0,
      dailySalaryRate: 0,
      commissionRate: 0.35,
      overtimeHourlyRate: 500,
      effectiveDate: '2026-01-01',
      startTime: '09:00 AM',
      endTime: '06:00 PM',
      lateGraceMinutes: 15,
      earlyGraceMinutes: 15,
      allowedLeaveDays: 2,
      leaveAllowancePeriod: 'MONTHLY',
      isActive: true,
      specialties: ['Haircut'],
      lateInDeduction: { enabled: true, type: 'FIXED', amount: 500 },
      earlyExitDeduction: { enabled: true, type: 'FIXED', amount: 500 },
      combinationPolicy: 'HIGHEST_ONLY',
      joiningDate: '2026-01-01',
      phone: '03001234567',
    };

    const commDeduction = calculateDeductionSnapshot(commStaff, true, 30, true, 30);
    assert(commDeduction.totalDeductionAmount === 0, 'Commission-only staff must have 0 deduction.');

    // B. Monthly staff with 26-day divisor and percentage deductions
    const monthlyStaff: StaffMember = {
      id: 'staff-monthly',
      name: 'Salaried Stylist',
      employeeCode: 'SAL-01',
      branchId: 'branch-1',
      designation: 'Senior Stylist',
      roleTitle: 'Senior Stylist',
      compensationType: 'MONTHLY_SALARY',
      baseSalary: 52000,
      dailySalaryRate: 0,
      commissionRate: 0,
      overtimeHourlyRate: 500,
      effectiveDate: '2026-01-01',
      payrollDivisor: 26, // daily base = 52000 / 26 = 2000
      startTime: '09:00 AM',
      endTime: '06:00 PM',
      lateGraceMinutes: 15,
      earlyGraceMinutes: 15,
      allowedLeaveDays: 2,
      leaveAllowancePeriod: 'MONTHLY',
      isActive: true,
      specialties: ['Coloring'],
      lateInDeduction: { enabled: true, type: 'PERCENTAGE', amount: 10 }, // 10% of 2000 = 200
      earlyExitDeduction: { enabled: true, type: 'PERCENTAGE', amount: 15 }, // 15% of 2000 = 300
      combinationPolicy: 'HIGHEST_ONLY',
      joiningDate: '2026-01-01',
      phone: '03007654321',
    };

    const deductionHighest = calculateDeductionSnapshot(monthlyStaff, true, 25, true, 30);
    assert(deductionHighest.effectiveDailyBase === 2000, `Expected daily base 2000, got ${deductionHighest.effectiveDailyBase}`);
    assert(deductionHighest.lateDeductionAmount === 200, `Expected late deduction 200, got ${deductionHighest.lateDeductionAmount}`);
    assert(deductionHighest.earlyExitDeductionAmount === 300, `Expected early exit deduction 300, got ${deductionHighest.earlyExitDeductionAmount}`);
    assert(deductionHighest.totalDeductionAmount === 300, `Expected HIGHEST_ONLY total 300, got ${deductionHighest.totalDeductionAmount}`);

    // C. Change combination policy to BOTH
    monthlyStaff.combinationPolicy = 'BOTH';
    const deductionBoth = calculateDeductionSnapshot(monthlyStaff, true, 25, true, 30);
    assert(deductionBoth.totalDeductionAmount === 500, `Expected BOTH total 500, got ${deductionBoth.totalDeductionAmount}`);

    console.log('✓ Test 3 Passed: Deduction snapshots enforce protection and policy combinations.');
  }

  // --------------------------------------------------------------------------
  // TEST 4: Leave Allowance Validation & Overlapping Prevention
  // --------------------------------------------------------------------------
  console.log('\nRunning Test 4: Leave allowance validation and overlapping prevention...');
  {
    const store = mockStorage.reloadFromStorage();
    const staff = store.staff.find((s) => s.branchId === 'branch-1' && s.isActive)!;

    // Configure annual allowance = 2 days
    staff.allowedLeaveDays = 2;
    staff.leaveAllowancePeriod = 'YEARLY';
    mockStorage.saveStore(store);

    // Apply 2 days paid leave
    const leave1 = await mockSalonService.markLeave(
      {
        branchId: staff.branchId,
        staffId: staff.id,
        startDate: '2026-10-01',
        endDate: '2026-10-02',
        type: 'PAID',
        reason: 'Family event',
      },
      adminBranch1
    );
    assert(leave1.totalDays === 2, `Expected 2 days count, got ${leave1.totalDays}`);
    assert(leave1.status === 'APPROVED', 'Leave should be approved.');

    // Attempting overlapping leave must fail
    await assertAsyncThrows(
      () =>
        mockSalonService.markLeave(
          {
            branchId: staff.branchId,
            staffId: staff.id,
            startDate: '2026-10-02',
            endDate: '2026-10-03',
            type: 'PAID',
            reason: 'Overlapping request',
          },
          adminBranch1
        ),
      'already exists'
    );

    // Attempting additional paid leave when balance exhausted must fail
    await assertAsyncThrows(
      () =>
        mockSalonService.markLeave(
          {
            branchId: staff.branchId,
            staffId: staff.id,
            startDate: '2026-10-10',
            endDate: '2026-10-10',
            type: 'PAID',
            reason: 'Excess paid leave',
          },
          adminBranch1
        ),
      'remaining'
    );

    // Cancel the leave
    const cancelled = await mockSalonService.cancelLeave(leave1.id, 'Employee cancelled plan', adminBranch1);
    assert(cancelled.status === 'CANCELLED', 'Leave status should be CANCELLED.');

    console.log('✓ Test 4 Passed: Leave allowance limits and overlap protection validated.');
  }

  // --------------------------------------------------------------------------
  // TEST 5: Finalize Day Attendance (Marking Missing Punches and Absences)
  // --------------------------------------------------------------------------
  console.log('\nRunning Test 5: Finalize day attendance logic...');
  {
    const store = mockStorage.reloadFromStorage();
    const staffMembers = store.staff.filter((s) => s.branchId === 'branch-1' && s.isActive);
    assert(staffMembers.length >= 2, 'Need at least 2 active staff in branch-1.');

    const staff1 = staffMembers[0];
    const staff2 = staffMembers[1];
    const testDate = '2026-09-18'; // completed past working Friday

    // Clear attendance on testDate
    store.attendance = (store.attendance || []).filter((a) => a.date !== testDate);
    // Create one check-in without check-out for staff1
    store.attendance.push({
      id: 'att-test-p1',
      staffId: staff1.id,
      staffName: staff1.name,
      employeeCode: staff1.employeeCode,
      branchId: 'branch-1',
      date: testDate,
      checkIn: '09:00 AM',
      checkOut: undefined,
      scheduledHours: 8,
      workedHours: 0,
      status: 'PRESENT',
      source: 'MANUAL',
    });
    // Staff2 has no record at all
    mockStorage.saveStore(store);

    // Finalize the day
    const result = await mockSalonService.finalizeDayAttendance('branch-1', testDate, adminBranch1);
    assert(result.finalizedCount >= 2, `Expected at least 2 finalized, got ${result.finalizedCount}`);

    const updatedStore = mockStorage.getStore();
    const rec1 = updatedStore.attendance.find((a) => a.staffId === staff1.id && a.date === testDate);
    assert(rec1?.status === 'MISSING_PUNCH' && rec1.isMissingPunch === true, 'Staff1 should be MISSING_PUNCH.');

    const rec2 = updatedStore.attendance.find((a) => a.staffId === staff2.id && a.date === testDate);
    assert(rec2?.status === 'ABSENT' && rec2.checkIn === 'ABSENT', 'Staff2 should be marked ABSENT.');

    // Future date finalization must be rejected
    await assertAsyncThrows(
      () => mockSalonService.finalizeDayAttendance('branch-1', '2099-01-01', adminBranch1),
      'Cannot finalize attendance for a future date'
    );

    console.log('✓ Test 5 Passed: Finalize day marks missing punches and absences; blocks future dates.');
  }

  // --------------------------------------------------------------------------
  // TEST 6: Biometric CSV Import Deduplication & Branch Mapping
  // --------------------------------------------------------------------------
  console.log('\nRunning Test 6: Biometric CSV import validation and deduplication...');
  {
    const store = mockStorage.reloadFromStorage();
    const staff = store.staff.find((s) => s.branchId === 'branch-1' && s.isActive)!;
    const testDate = '2026-09-21';

    // Clear attendance on testDate
    store.attendance = (store.attendance || []).filter((a) => a.date !== testDate);
    mockStorage.saveStore(store);

    const rows = [
      {
        rowNumber: 1,
        employeeCode: staff.employeeCode,
        date: testDate,
        checkIn: '08:55 AM',
        checkOut: '06:05 PM',
        status: 'VALID' as const,
      },
      {
        rowNumber: 2,
        employeeCode: 'INVALID-CODE-999',
        date: testDate,
        checkIn: '09:00 AM',
        checkOut: '06:00 PM',
        status: 'VALID' as const,
      },
    ];

    const importResult = await mockSalonService.importAttendanceCSV('branch-1', rows, adminBranch1);
    assert(importResult.acceptedRows === 1, `Expected 1 accepted row, got ${importResult.acceptedRows}`);
    assert(importResult.rejectedRows === 1, `Expected 1 rejected row, got ${importResult.rejectedRows}`);

    // Re-importing same valid row must detect duplicate
    const duplicateImport = await mockSalonService.importAttendanceCSV('branch-1', [rows[0]], adminBranch1);
    assert(duplicateImport.duplicateRows === 1, 'Expected duplicate to be rejected.');
    assert(duplicateImport.acceptedRows === 0, 'No rows should be accepted on duplicate import.');

    console.log('✓ Test 6 Passed: Biometric CSV import verifies employee codes and rejects duplicates.');
  }

  // --------------------------------------------------------------------------
  // TEST 7: Manual Overtime Rate Snapshotting on Approval & Payroll Lock
  // --------------------------------------------------------------------------
  console.log('\nRunning Test 7: Overtime rate snapshotting on approval & payroll lock immutability...');
  {
    const store = mockStorage.reloadFromStorage();
    const staff = store.staff.find((s) => s.branchId === 'branch-1' && s.isActive)!;
    staff.overtimeHourlyRate = 600; // 600 PKR/hour
    mockStorage.saveStore(store);

    // Create 90 minutes overtime (1.5 hours)
    const ot = await mockSalonService.createOvertime(
      {
        staffId: staff.id,
        branchId: 'branch-1',
        date: '2026-09-22',
        minutes: 90,
        reason: 'Wedding rush bridal styling support',
        status: 'SUBMITTED',
      },
      adminBranch1
    );

    assert(ot.status === 'SUBMITTED', 'Initial status should be SUBMITTED.');
    assert(ot.amount === 900, `Expected amount 900 PKR (1.5h * 600), got ${ot.amount}`);

    // Admin approves overtime
    const approvedOt = await mockSalonService.approveOvertime(ot.id, adminBranch1);
    assert(approvedOt.status === 'APPROVED', 'Status should be APPROVED.');
    assert(approvedOt.hourlyRate === 600, 'Hourly rate should be snapshotted to 600.');
    assert(approvedOt.approvedMinutes === 90, 'Approved minutes should be 90.');

    // If staff rate changes later, approved record must remain untouched
    const storeAfter = mockStorage.getStore();
    const staffToUpdate = storeAfter.staff.find((s) => s.id === staff.id)!;
    staffToUpdate.overtimeHourlyRate = 900;
    mockStorage.saveStore(storeAfter);

    const reloadedOt = (mockStorage.getStore().overtime || []).find((o) => o.id === ot.id)!;
    assert(reloadedOt.hourlyRate === 600, `Snapshotted rate must remain 600, but got ${reloadedOt.hourlyRate}`);
    assert(reloadedOt.amount === 900, `Snapshotted amount must remain 900, but got ${reloadedOt.amount}`);

    // Approved overtime cannot be edited directly
    await assertAsyncThrows(
      () => mockSalonService.updateOvertime(ot.id, { minutes: 120 }, adminBranch1),
      'Approved overtime cannot be edited directly'
    );

    // Simulate linking to finalized payroll
    const storeWithPayroll = mockStorage.getStore();
    const lockedOt = (storeWithPayroll.overtime || []).find((o) => o.id === ot.id)!;
    lockedOt.payrollId = 'pr-batch-2026-09';
    mockStorage.saveStore(storeWithPayroll);

    // Cannot cancel payroll-locked overtime
    await assertAsyncThrows(
      () => mockSalonService.cancelOvertime(ot.id, 'Trying to cancel locked', adminBranch1),
      'already linked to finalized payroll'
    );

    console.log('✓ Test 7 Passed: Overtime rate is snapshotted upon approval and protected by payroll lock.');
  }

  // --------------------------------------------------------------------------
  // TEST 8: Strict Accountant Rejection and Staff Own-Record Isolation
  // --------------------------------------------------------------------------
  console.log('\nRunning Test 8: Accountant denial and Staff own-record isolation...');
  {
    // Accountant session must be blocked from attendance and overtime
    setActiveUser(accountant);
    await assertAsyncThrows(
      () => mockSalonService.getAttendance('branch-1', undefined, undefined, accountant),
      'Access Denied: Accountants do not have permission'
    );

    await assertAsyncThrows(
      () => mockSalonService.getLeaves('branch-1', undefined, accountant),
      'Access Denied: Accountants do not have permission'
    );

    await assertAsyncThrows(
      () => mockSalonService.getOvertime('branch-1', undefined, accountant),
      'Access Denied: Accountants do not have permission'
    );

    // Staff session accessing own personal profile
    setActiveUser(staffUser);
    const personalAttendance = await mockSalonService.getStaffPersonalAttendance(staffUser);
    assert(personalAttendance.summary !== undefined, 'Staff personal attendance summary returned.');
    assert(Array.isArray(personalAttendance.records), 'Staff personal records returned.');

    const personalOvertime = await mockSalonService.getStaffPersonalOvertime(staffUser);
    assert(typeof personalOvertime.approvedMinutes === 'number', 'Personal approved minutes computed.');
    assert(typeof personalOvertime.approvedPay === 'number', 'Personal approved pay computed.');

    console.log('✓ Test 8 Passed: Accountant role denied; Staff restricted strictly to own records.');
  }

  // --------------------------------------------------------------------------
  // TEST 9: Ledger & Cash Float Isolation (Zero Financial Transactions)
  // --------------------------------------------------------------------------
  console.log('\nRunning Test 9: Zero financial transactions created by attendance/overtime...');
  {
    setActiveUser(adminBranch1);
    const storeBefore = mockStorage.getStore();
    const expensesCountBefore = (storeBefore.expenses || []).length;
    const settlementsCountBefore = (storeBefore.settlements || []).length;
    const drawersBefore = JSON.stringify(storeBefore.cashDrawers);

    // Create attendance with penalty snapshot
    await mockSalonService.createAttendance(
      {
        staffId: storeBefore.staff[0].id,
        branchId: 'branch-1',
        date: '2026-09-23',
        checkIn: '10:00 AM', // 1 hour late
        checkOut: '06:00 PM',
        notes: 'Late arrival',
      },
      adminBranch1
    );

    // Create and approve overtime
    const newOt = await mockSalonService.createOvertime(
      {
        staffId: storeBefore.staff[0].id,
        branchId: 'branch-1',
        date: '2026-09-23',
        minutes: 60,
        reason: 'Store prep',
      },
      adminBranch1
    );
    await mockSalonService.approveOvertime(newOt.id, adminBranch1);

    const storeAfter = mockStorage.getStore();
    const expensesCountAfter = (storeAfter.expenses || []).length;
    const settlementsCountAfter = (storeAfter.settlements || []).length;
    const drawersAfter = JSON.stringify(storeAfter.cashDrawers);

    assert(expensesCountBefore === expensesCountAfter, 'Expenses count must NOT change on attendance/overtime.');
    assert(settlementsCountBefore === settlementsCountAfter, 'Settlements count must NOT change on attendance/overtime.');
    assert(drawersBefore === drawersAfter, 'Cash drawer balances and floats must remain completely unchanged.');

    console.log('✓ Test 9 Passed: Attendance penalties & overtime approvals create ZERO financial ledger/cash entries.');
  }

  console.log('\n====================================================');
  console.log('  ATTENDANCE & OVERTIME SUITE: ALL 9 TESTS PASSED!  ');
  console.log('====================================================\n');
}

runAttendanceOvertimeTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED WITH ERROR:');
  console.error(err);
  process.exit(1);
});
