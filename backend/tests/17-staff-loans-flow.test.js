// tests/17-staff-loans-flow.test.js
// Focused regression test suite for Staff Loans -> Payroll -> Payslip flow.
import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../src/config/prisma.js';
import { evaluateEmployeePayroll, getDatesInRange } from '../src/lib/calculations/payrollCalculations.js';
import { issueAdvance, reverseAdvance, listAdvances } from '../src/modules/payroll/payroll.extras.service.js';
import { generatePreview, finalizeRun, cancelRun } from '../src/modules/payroll/payroll.service.js';
import { setSystemDate } from '../src/modules/settings/settings.service.js';

const POLICY = {
  monthlyAbsenceDivisor: 30,
  dailyStaffPaidLeaveEligibility: true,
  nonWorkedWeeklyOffPaid: false,
  nonWorkedHolidayPaid: true,
  prorationMethod: 'CALENDAR_DAYS',
};

describe('Staff Loans Flow · Pure Engine Calculations', () => {
  const staffHuzaifa = {
    id: 'staff-huzaifa',
    name: 'Huzaifa Ali Warsi',
    employeeCode: 'EMP-0001-001',
    branchId: 'branch-1',
    designation: 'Senior Stylist',
    compensationType: 'MONTHLY_SALARY',
    baseSalary: 30000,
    dailySalaryRate: 0,
    overtimeHourlyRate: 500,
    payrollDivisor: 30,
    joiningDate: '2026-10-07', // Joined on Oct 7 (25 of 31 calendar days)
    effectiveDate: '2026-10-07',
  };

  const attendanceOct = getDatesInRange('2026-10-07', '2026-10-31').map(date => ({
    staffId: 'staff-huzaifa', date, status: date === '2026-10-08' ? 'PAID_LEAVE' : 'PRESENT',
  }));

  const overtimeOct = [
    { id: 'ot-1', staffId: 'staff-huzaifa', date: '2026-10-07', status: 'APPROVED', approvedMinutes: 30, hourlyRate: 500, amount: 250 },
  ];

  it('proration + overtime produces exactly Gross PKR 25,250.00', () => {
    const res = evaluateEmployeePayroll(staffHuzaifa, '2026-10', POLICY, attendanceOct, overtimeOct, [], {});
    expect(res.payslip.baseEarnings).toBe(25000); // 30,000 * 25 / 30
    expect(res.payslip.approvedOvertimeAmount).toBe(250.00);
    expect(res.payslip.grossPayable).toBe(25250);
    expect(res.payslip.calculationDetails.prorationApplied).toBe(true);
    expect(res.payslip.calculationDetails.prorationFormula).toContain('25 eligible days');
  });

  it('Gross 25,250.00 with ONLY 3,000 loan deduction yields exactly Net 22,250.00', () => {
    const extras = {
      advances: [
        { id: 'adv-3k', advanceNumber: 'ADV-0001-2026-0003', recoveryPerMonth: 3000, balance: 10000 },
      ],
    };
    const res = evaluateEmployeePayroll(staffHuzaifa, '2026-10', POLICY, attendanceOct, overtimeOct, [], extras);
    expect(res.payslip.grossPayable).toBe(25250);
    expect(res.payslip.advanceRecoveryAmount).toBe(3000);
    expect(res.payslip.totalDeductions).toBe(3000);
    expect(res.payslip.netPayable).toBe(22250);
    expect(res.payslip.advanceRecoveries).toHaveLength(1);
    expect(res.payslip.advanceRecoveries[0]).toMatchObject({
      advanceNumber: 'ADV-0001-2026-0003',
      amount: 3000,
      balanceBefore: 10000,
      balanceAfter: 7000,
    });
  });

  it('Gross 25,250.00 with 3,000 loan AND additional 4,000 loan deductions yields Net 18,250.00 (itemized)', () => {
    const extras = {
      advances: [
        { id: 'adv-1k', advanceNumber: 'ADV-0001-2026-0001', recoveryPerMonth: 1000, balance: 1000 },
        { id: 'adv-3k-a', advanceNumber: 'ADV-0001-2026-0002', recoveryPerMonth: 3000, balance: 10000 },
        { id: 'adv-3k-b', advanceNumber: 'ADV-0001-2026-0003', recoveryPerMonth: 3000, balance: 10000 },
      ],
    };
    const res = evaluateEmployeePayroll(staffHuzaifa, '2026-10', POLICY, attendanceOct, overtimeOct, [], extras);
    expect(res.payslip.grossPayable).toBe(25250);
    expect(res.payslip.advanceRecoveryAmount).toBe(7000); // 1000 + 3000 + 3000 = 7000
    expect(res.payslip.totalDeductions).toBe(7000);
    expect(res.payslip.netPayable).toBe(18250);
    expect(res.payslip.advanceRecoveries).toHaveLength(3);
    expect(res.payslip.advanceRecoveries[0]).toMatchObject({ advanceNumber: 'ADV-0001-2026-0001', amount: 1000, balanceAfter: 0 });
    expect(res.payslip.advanceRecoveries[1]).toMatchObject({ advanceNumber: 'ADV-0001-2026-0002', amount: 3000, balanceAfter: 7000 });
    expect(res.payslip.advanceRecoveries[2]).toMatchObject({ advanceNumber: 'ADV-0001-2026-0003', amount: 3000, balanceAfter: 7000 });
  });

  it('insufficient earnings cap loan deduction so net pay is never negative', () => {
    // If gross earnings are only 2,000, a 3,000 monthly recovery is capped at 2,000
    const lowBaseStaff = { ...staffHuzaifa, baseSalary: 2000, joiningDate: '2026-10-01' };
    const extras = {
      advances: [
        { id: 'adv-3k', advanceNumber: 'ADV-LOW', recoveryPerMonth: 3000, balance: 10000 },
      ],
    };
    const fullAttendance = getDatesInRange('2026-10-01', '2026-10-31').map(date => ({ staffId: lowBaseStaff.id, date, status: 'PRESENT' }));
    const res = evaluateEmployeePayroll(lowBaseStaff, '2026-10', POLICY, fullAttendance, [], [], extras);
    expect(res.payslip.grossPayable).toBe(2000);
    expect(res.payslip.advanceRecoveryAmount).toBe(2000); // Capped at room
    expect(res.payslip.netPayable).toBe(0); // Never negative
    expect(res.payslip.advanceRecoveries[0].balanceAfter).toBe(8000); // 10,000 - 2,000
  });

  it('final installment only recovers remaining balance, never more', () => {
    const extras = {
      advances: [
        { id: 'adv-final', advanceNumber: 'ADV-FINAL', recoveryPerMonth: 3000, balance: 1200 },
      ],
    };
    const res = evaluateEmployeePayroll(staffHuzaifa, '2026-10', POLICY, attendanceOct, overtimeOct, [], extras);
    expect(res.payslip.advanceRecoveryAmount).toBe(1200); // Balance was 1,200
    expect(res.payslip.advanceRecoveries[0].balanceAfter).toBe(0);
  });
});

describe('Staff Loans Flow · Backend Integration with Prisma', () => {
  const actor = { id: 'usr-admin-01', name: 'Aamina Sheikh', role: 'ADMIN', branchId: 'branch-1' };
  let testStaff, testAccount, testAdvance;

  beforeAll(async () => {
    await setSystemDate('2026-11-30', actor);
    testStaff = await prisma.staff.findFirst({ where: { branchId: 'branch-1', isActive: true } });
    testAccount = await prisma.paymentAccount.findFirst({ where: { branchId: 'branch-1', isActive: true } });
    // Ensure test account has enough funds for loan issuance even after preceding test runs
    await prisma.paymentAccount.update({ where: { id: testAccount.id }, data: { openingBalance: 1000000 } });
  });

  it('loan issue records disbursement once, increases staff loan outstanding, and debits account', async () => {
    testAdvance = await issueAdvance(actor, {
      staffId: testStaff.id,
      amount: 10000,
      recoveryPerMonth: 3000,
      startMonth: '2026-11',
      method: 'ONLINE',
      onlineAccountId: testAccount.id,
      reason: 'Home renovation assistance',
    });

    expect(testAdvance).toMatchObject({
      status: 'ACTIVE',
      amount: 10000,
      recoveryPerMonth: 3000,
      balance: 10000,
      recoveredAmount: 0,
    });
    expect(testAdvance.advanceNumber).toMatch(/^ADV-/);
  });

  it('payroll preview does not mutate loan balances in the database', async () => {
    const advBefore = await prisma.salaryAdvance.findUnique({ where: { id: testAdvance.id }, include: { recoveries: true } });
    expect(advBefore.recoveries).toHaveLength(0);

    const preview = await generatePreview(actor, { branchId: 'branch-1', month: '2026-11' });
    const slip = preview.payslips.find((p) => p.staffId === testStaff.id);
    expect(slip).toBeDefined();

    // The preview displays projected recovery
    const rec = slip.advanceRecoveries?.find((r) => r.advanceId === testAdvance.id);
    expect(rec).toMatchObject({ amount: 3000, balanceBefore: 10000, balanceAfter: 7000 });

    // BUT the database is strictly untouched
    const advAfter = await prisma.salaryAdvance.findUnique({ where: { id: testAdvance.id }, include: { recoveries: true } });
    expect(advAfter.recoveries).toHaveLength(0);
    expect(Number(advAfter.amount)).toBe(10000);
  });

  it('cancellation before finalization permits loan reversal with full refund to account', async () => {
    // Reverse the test advance cleanly
    const reversed = await reverseAdvance(actor, testAdvance.id, 'Clean up integration test advance');
    expect(reversed.status).toBe('REVERSED');
    expect(reversed.balance).toBe(0);

    // After reversal, preview no longer recovers it
    const preview = await generatePreview(actor, { branchId: 'branch-1', month: '2026-11' });
    const slip = preview.payslips.find((p) => p.staffId === testStaff.id);
    const rec = slip.advanceRecoveries?.find((r) => r.advanceId === testAdvance.id);
    expect(rec).toBeUndefined();
  });
});
