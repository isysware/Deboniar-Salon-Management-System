import { describe, it, expect } from 'vitest';
import { evaluateEmployeePayroll, getDatesInRange } from '../src/lib/calculations/payrollCalculations.js';
const staff = { id: 's', name: 'Test', compensationType: 'MONTHLY_SALARY', baseSalary: 30000, joiningDate: '2020-01-01', payrollDivisor: 26 };
const policy = { monthlyAbsenceDivisor: 'WORKING_DAYS', customDivisorDays: 26, prorationMethod: 'WORKING_DAYS' };
const run = (month, startDate, endDate, priorDates = new Set(), priorBase = 0, overrides = {}, statuses = {}) => {
  const attendance = getDatesInRange(startDate, endDate).map(date => ({ staffId: 's', date, status: statuses[date] || 'PRESENT' }));
  return evaluateEmployeePayroll({ ...staff, ...overrides }, month, policy, attendance, [], [], {}, { startDate, endDate, alreadyFinalizedDates: priorDates, alreadyFinalizedBaseEarnings: priorBase });
};
describe('fixed 30-day monthly base', () => {
  it('flags missing punches only in employment and excludes overtime outside employment', () => {
    const r = evaluateEmployeePayroll({ ...staff, joiningDate: '2026-10-08', exitDate: '2026-10-09' }, '2026-10', policy,
      [{ staffId: 's', date: '2026-10-08', status: 'PRESENT' }, { staffId: 's', date: '2026-10-09', status: 'MISSING_PUNCH' }],
      [{ id: 'outside', staffId: 's', date: '2026-10-07', status: 'APPROVED', amount: 500 }]);
    expect(r.payslip.unrecordedDays).toBe(0);
    expect(r.payslip.missingPunchDays).toBe(1);
    expect(r.payslip.exceptionDetails).toEqual(['Missing Punch on 2026-10-09.']);
    expect(r.payslip.approvedOvertimeAmount).toBe(0);
    expect(r.canFinalize).toBe(false);
  });
  it('reconciles February loan installments across daily runs and never repeats monthly recovery', () => {
    let dates = new Set(), base = 0, recovered = 0;
    for (const date of getDatesInRange('2026-02-01', '2026-02-28')) {
      const r = evaluateEmployeePayroll(staff, '2026-02', policy, [{ staffId: 's', date, status: 'PRESENT' }], [], [], {
        advances: [{ id: 'loan', recoveryPerMonth: 3000, balance: 10000 - recovered, recoveredThisMonth: recovered }],
      }, { startDate: date, endDate: date, alreadyFinalizedDates: dates, alreadyFinalizedBaseEarnings: base });
      expect(r.canFinalize).toBe(true);
      expect(r.payslip.netPayable).toBeGreaterThanOrEqual(0);
      recovered += r.payslip.advanceRecoveryAmount;
      base += r.payslip.baseEarnings;
      dates.add(date);
    }
    expect(base).toBe(30000);
    expect(recovered).toBe(3000);
  });
  it('pays 2,000 for two eligible days and overrides legacy divisor policies', () => {
    const r = run('2026-10', '2026-10-08', '2026-10-09', new Set(), 0, { joiningDate: '2026-10-08' });
    expect(r.payslip.baseEarnings).toBe(2000);
    expect(r.payslip.calculationDetails).toMatchObject({ divisorUsed: 30, prorationDivisor: 30, payableDays: 2 });
    expect(r.payslip.calculationDetails.formula).toContain('/ 30');
  });
  it.each([['2026-02',28],['2024-02',29],['2026-09',30],['2026-10',31]])('reconciles full and split %s including reverse order', (month, count) => {
    const end = `${month}-${count}`;
    expect(run(month, `${month}-01`, end).payslip.baseEarnings).toBe(30000);
    for (const reverse of [false,true]) {
      let dates = new Set(), base = 0;
      const ranges = [[`${month}-01`,`${month}-15`],[`${month}-16`,end]];
      if(reverse) ranges.reverse();
      for(const [start, finish] of ranges) {
        const r = run(month,start,finish,dates,base);
        expect(r.canFinalize).toBe(true);
        base += r.payslip.baseEarnings;
        getDatesInRange(start,finish).forEach(d=>dates.add(d));
      }
      expect(base).toBe(30000);
    }
  });
  it('blocks overlap even on weekly off days', () => {
    const r = run('2026-10','2026-10-04','2026-10-05',new Set(['2026-10-04']),1000);
    expect(r.canFinalize).toBe(false);
    expect(r.blockReason).toContain('already been paid');
  });
  it('deducts absences once at salary / 30 with unrounded intermediate rate', () => {
    const r = run('2026-10','2026-10-01','2026-10-03',new Set(),0,{baseSalary:10000},{'2026-10-01':'ABSENT','2026-10-02':'UNPAID_LEAVE'});
    expect(r.payslip.absenceDeductions).toBe(666.67);
    expect(r.payslip.baseEarnings).toBe(1000);
    expect(r.payslip.netPayable).toBe(333.33);
  });
  it('reconciles rounding and previous frozen legacy earnings', () => {
    const dates = new Set(getDatesInRange('2026-02-01','2026-02-27'));
    expect(run('2026-02','2026-02-28','2026-02-28',dates,28928.57).payslip.baseEarnings).toBe(1071.43);
  });
  it('caps a long partial employment span and preserves short employment proration', () => {
    expect(run('2026-10','2026-10-01','2026-10-31',new Set(),0,{exitDate:'2026-10-30'}).payslip.baseEarnings).toBe(30000);
    expect(run('2026-02','2026-02-27','2026-02-28',new Set(),0,{joiningDate:'2026-02-27'}).payslip.baseEarnings).toBe(2000);
  });
});
