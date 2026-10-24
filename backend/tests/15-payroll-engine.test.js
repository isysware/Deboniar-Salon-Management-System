// payroll.md §6 — pure engine scenarios (no database).
import { describe, it, expect } from 'vitest';
import { evaluateEmployeePayroll, resolveTermsAt } from '../src/lib/calculations/payrollCalculations.js';

const POLICY = {
  monthlyAbsenceDivisor: 30, dailyStaffPaidLeaveEligibility: true, nonWorkedWeeklyOffPaid: false,
  nonWorkedHolidayPaid: true, prorationMethod: 'CALENDAR_DAYS',
};
const staff = (over = {}) => ({
  id: 's1', name: 'Test', employeeCode: 'E1', branchId: 'b1', designation: 'Stylist', compensationType: 'MONTHLY_SALARY',
  baseSalary: 60000, dailySalaryRate: 0, overtimeHourlyRate: 500, payrollDivisor: 30, joiningDate: '2024-01-01', effectiveDate: '2026-01-01',
  ...over,
});
const days = (month) => {
  const [y, m] = month.split('-').map(Number);
  return Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
};
const isSunday = (d) => new Date(`${d}T12:00:00Z`).getUTCDay() === 0;

/** Attendance for every working day; `special` overrides a date's status / snapshot. */
const attendance = (month, { from = '0000', to = '9999', holidays = [], special = {} } = {}) =>
  days(month).filter((d) => !isSunday(d) && !holidays.includes(d) && d >= from && d <= to)
    .map((d) => ({ staffId: 's1', date: d, status: 'PRESENT', ...(special[d] || {}) }));

const run = (s, month, att, opts = {}) =>
  evaluateEmployeePayroll(s, month, opts.policy || POLICY, att, opts.ot || [], opts.holidays || [], opts.extras || {});

describe('Payroll engine · monthly', () => {
  it.each(['2026-02', '2024-02', '2026-09', '2026-10'])('full %s pays the contractual base for both monthly contracts', (month) => {
    for (const compensationType of ['MONTHLY_SALARY', 'MONTHLY_PLUS_COMMISSION']) {
      const result = run(staff({ compensationType }), month, attendance(month));
      expect(result.canFinalize).toBe(true);
      expect(result.payslip).toMatchObject({ baseEarnings: 60000, netPayable: 60000 });
      expect(result.payslip.calculationDetails).toMatchObject({ prorationApplied: false, payableDays: days(month).length, prorationDivisor: 30 });
    }
  });

  it('Oct 1–8 counts only Oct 8 for an Oct 8 joiner and exposes pre-employment attendance', () => {
    const result = evaluateEmployeePayroll(staff({ joiningDate: '2026-10-08', baseSalary: 30000 }), '2026-10', POLICY,
      attendance('2026-10', { to: '2026-10-08' }), [], [], {}, { startDate: '2026-10-01', endDate: '2026-10-08', runType: 'CUSTOM_RANGE' });
    expect(result.canFinalize).toBe(true);
    expect(result.payslip).toMatchObject({ baseEarnings: 1000, presentDays: 1, joiningDate: '2026-10-08', absenceDeductions: 0 });
    expect(result.payslip.calculationDetails).toMatchObject({ payableDays: 1, prorationDivisor: 30, divisorUsed: 30 });
    expect(result.payslip.employmentNotes[0]).toContain('outside employment dates');
  });

  it('partial monthly salary uses employment days then deducts absence once', () => {
    const result = evaluateEmployeePayroll(staff({ joiningDate: '2026-09-16' }), '2026-09', POLICY,
      attendance('2026-09', { from: '2026-09-16', special: { '2026-09-17': { status: 'ABSENT', calculationSnapshot: { totalDeductionAmount: 2000 } } } }),
      [], [], {}, { startDate: '2026-09-16', endDate: '2026-09-30', runType: 'CUSTOM_RANGE' });
    expect(result.payslip).toMatchObject({ baseEarnings: 30000, absenceDeductions: 2000, attendancePenaltyDeductions: 0, netPayable: 28000 });
  });
  it('S1 full month pays the full base regardless of month length (Feb = 28 days)', () => {
    const r = run(staff(), '2026-02', attendance('2026-02'));
    expect(r.canFinalize).toBe(true);
    expect(r.payslip.netPayable).toBe(60000);
  });

  it('S2 absences and unpaid leave are deducted at base ÷ divisor', () => {
    const r = run(staff(), '2026-09', attendance('2026-09', { special: {
      '2026-09-01': { status: 'ABSENT' }, '2026-09-02': { status: 'ABSENT' }, '2026-09-03': { status: 'UNPAID_LEAVE' }, '2026-09-04': { status: 'PAID_LEAVE' },
    } }));
    expect(r.payslip).toMatchObject({ absentDays: 2, unpaidLeaveDays: 1, paidLeaveDays: 1, absenceDeductions: 6000, attendanceImpact: -6000, netPayable: 54000 });
  });

  it('S3 mid-month joiner uses fixed 30 even with working-day policy', () => {
    const s = staff({ joiningDate: '2026-09-16' });
    const att = attendance('2026-09', { from: '2026-09-16' });
    expect(run(s, '2026-09', att).payslip.baseEarnings).toBe(30000);
    const wd = run(s, '2026-09', att, { policy: { ...POLICY, prorationMethod: 'WORKING_DAYS' } });
    expect(wd.payslip.baseEarnings).toBe(30000); // 15 calendar days at salary / 30
    expect(wd.payslip.calculationDetails.prorationFormula).toContain('/ 30');
  });

  it('S22 staff who left mid-month get the days worked, with no exceptions after the exit date', () => {
    const r = run(staff({ exitDate: '2026-09-19' }), '2026-09', attendance('2026-09', { to: '2026-09-19' }));
    expect(r.canFinalize).toBe(true);
    expect(r.payslip.baseEarnings).toBe(38000); // 19/30 × 60,000
  });

  it('S6/S7 only APPROVED, unlocked overtime is paid', () => {
    const ot = [
      { id: 'o1', staffId: 's1', date: '2026-09-10', status: 'APPROVED', approvedMinutes: 120, hourlyRate: 500 },
      { id: 'o2', staffId: 's1', date: '2026-09-11', status: 'SUBMITTED', minutes: 300 },
      { id: 'o3', staffId: 's1', date: '2026-09-12', status: 'REJECTED', minutes: 300 },
      { id: 'o4', staffId: 's1', date: '2026-09-14', status: 'APPROVED', approvedMinutes: 60, payrollId: 'old-run' },
    ];
    const r = run(staff(), '2026-09', attendance('2026-09'), { ot });
    expect(r.payslip).toMatchObject({ approvedOvertimeMinutes: 120, approvedOvertimeAmount: 1000, consumedOvertimeIds: ['o1'], netPayable: 61000 });
  });

  it('S8 late/early penalties from attendance snapshots are deducted', () => {
    const snap = { calculationSnapshot: { totalDeductionAmount: 200 } };
    const r = run(staff(), '2026-09', attendance('2026-09', { special: { '2026-09-01': snap, '2026-09-02': snap, '2026-09-03': snap } }));
    expect(r.payslip).toMatchObject({ attendancePenaltyDeductions: 600, netPayable: 59400 });
  });

  it('S9 recurring allowances, one-off allowance/bonus and deductions', () => {
    const r = run(staff(), '2026-09', attendance('2026-09'), { extras: {
      allowances: [{ id: 'a1', name: 'Transport', amount: 3000 }],
      adjustments: [{ id: 'j1', type: 'BONUS', title: 'Eid bonus', amount: 5000 }, { id: 'j2', type: 'ALLOWANCE', title: 'Food', amount: 500 }, { id: 'j3', type: 'DEDUCTION', title: 'Damaged dryer', amount: 1000 }],
    } });
    expect(r.payslip).toMatchObject({ recurringAllowances: 3000, oneOffAllowances: 500, bonusAmount: 5000, allowancesTotal: 8500, otherDeductions: 1000, grossPayable: 68500, netPayable: 67500 });
  });

  it('S10 advance recovery takes the monthly installment, never more than balance or net', () => {
    const r = run(staff(), '2026-09', attendance('2026-09'), { extras: {
      advances: [{ id: 'v1', advanceNumber: 'ADV-1', balance: 10000, recoveryPerMonth: 5000 }, { id: 'v2', advanceNumber: 'ADV-2', balance: 1500, recoveryPerMonth: 4000 }],
    } });
    expect(r.payslip.advanceRecoveries).toEqual([
      expect.objectContaining({ advanceId: 'v1', amount: 5000, balanceAfter: 5000 }),
      expect.objectContaining({ advanceId: 'v2', amount: 1500, balanceAfter: 0 }),
    ]);
    expect(r.payslip.netPayable).toBe(53500);

    const small = run(staff({ baseSalary: 3000 }), '2026-09', attendance('2026-09'), { extras: { advances: [{ id: 'v1', balance: 10000, recoveryPerMonth: 5000 }] } });
    expect(small.payslip).toMatchObject({ advanceRecoveryAmount: 3000, netPayable: 0 });
    expect(small.canFinalize).toBe(true);
  });

  it('S12 missing punch blocks finalization while unrecorded days count as absences', () => {
    const att = attendance('2026-09', { special: { '2026-09-01': { status: 'MISSING_PUNCH' } } }).filter((a) => a.date !== '2026-09-02');
    const r = run(staff(), '2026-09', att);
    expect(r.canFinalize).toBe(false);
    expect(r.blockReason).toContain('2026-09-01');
    expect(r.payslip.unrecordedDays).toBe(1);
    expect(r.payslip.exceptionDetails).toEqual(['Missing Punch on 2026-09-01.']);
  });

  it('unrecorded working days deduct salary without blocking finalization', () => {
    const att = attendance('2026-09').filter(a => a.date !== '2026-09-01' && a.date !== '2026-09-02');
    const r = run(staff(), '2026-09', att);
    expect(r.payslip).toMatchObject({ unrecordedDays: 2, absentDays: 2, absenceDeductions: 4000, netPayable: 56000, hasExceptions: false });
    expect(r.canFinalize).toBe(true);
    expect(r.blockReason).toBeUndefined();
  });

  it('daily staff earn zero for an unrecorded working day without blocking finalization', () => {
    const r = evaluateEmployeePayroll(staff({ compensationType: 'DAILY_SALARY', dailySalaryRate: 1000 }), '2026-10', POLICY, [], [], [], {}, { startDate: '2026-10-13', endDate: '2026-10-13' });
    expect(r.payslip).toMatchObject({ absentDays: 1, unrecordedDays: 1, netPayable: 0, hasExceptions: false });
    expect(r.canFinalize).toBe(true);
  });

  it('S13 deductions greater than gross block finalization', () => {
    const r = run(staff(), '2026-09', attendance('2026-09'), { extras: { adjustments: [{ id: 'j', type: 'DEDUCTION', title: 'Loss', amount: 70000 }] } });
    expect(r.canFinalize).toBe(false);
    expect(r.blockReason).toMatch(/Negative salary/);
  });
});

describe('Payroll engine · daily & commission-only', () => {
  const daily = (over = {}) => staff({ compensationType: 'DAILY_SALARY', baseSalary: 0, dailySalaryRate: 2000, ...over });

  it('S4 daily rate × present days + paid leave', () => {
    const r = run(daily(), '2026-09', attendance('2026-09', { special: { '2026-09-01': { status: 'PAID_LEAVE' } } }));
    expect(r.payslip).toMatchObject({ presentDays: 25, paidLeaveDays: 1, baseEarnings: 50000, leaveEarnings: 2000, absenceDeductions: 0, netPayable: 52000 });
  });

  it('S5 holidays / weekly offs paid only when the policy says so', () => {
    const holidays = [{ id: 'h', branchId: 'ALL', date: '2026-09-15', title: 'Holiday' }];
    const att = attendance('2026-09', { holidays: ['2026-09-15'] });
    expect(run(daily(), '2026-09', att, { holidays }).payslip).toMatchObject({ paidHolidayDays: 1, holidayEarnings: 2000, netPayable: 52000 });
    expect(run(daily(), '2026-09', att, { holidays, policy: { ...POLICY, nonWorkedHolidayPaid: false } }).payslip.netPayable).toBe(50000);
    const weekly = run(daily(), '2026-09', att, { holidays, policy: { ...POLICY, nonWorkedWeeklyOffPaid: true } });
    expect(weekly.payslip).toMatchObject({ paidWeeklyOffDays: 4, holidayEarnings: 10000 });
    // Monthly staff never get extra holiday pay (already inside the fixed salary).
    expect(run(staff(), '2026-09', att, { holidays }).payslip).toMatchObject({ holidayEarnings: 0, netPayable: 60000 });
  });

  it('commission-only pays zero base and suppresses salary deductions', () => {
    const r = run(staff({ compensationType: 'COMMISSION_ONLY' }), '2026-09', attendance('2026-09', { special: { '2026-09-01': { status: 'ABSENT' } } }));
    expect(r.payslip).toMatchObject({ baseEarnings: 0, absenceDeductions: 0, netPayable: 0 });
  });
});

describe('Payroll engine · pay terms in force (S11)', () => {
  it('a raise entered for next month never changes this month', () => {
    const current = staff({ baseSalary: 70000, effectiveDate: '2026-11-01' });
    const history = [{ effectiveDate: '2026-01-01', snapshot: { baseSalary: 60000, compensationType: 'MONTHLY_SALARY' } }];
    expect(resolveTermsAt(current, history, '2026-10-31').baseSalary).toBe(60000);
    expect(resolveTermsAt(current, history, '2026-11-30').baseSalary).toBe(70000);
    expect(resolveTermsAt(current, [], '2026-10-31').baseSalary).toBe(70000); // no history → current terms
  });
});
