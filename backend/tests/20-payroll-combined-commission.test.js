import { describe, it, expect } from 'vitest';
import prisma from '../src/config/prisma.js';
import * as payroll from '../src/modules/payroll/payroll.service.js';
import * as commission from '../src/modules/commission/commission.service.js';
import { postInvoice } from '../src/modules/pos/pos.service.js';
import { refundInvoice } from '../src/modules/pos/pos.refund.js';
import { setSystemDate } from '../src/modules/settings/settings.service.js';
import { issueAdvance } from '../src/modules/payroll/payroll.extras.service.js';
import { staffSalaryReport, staffCommissionReport } from '../src/modules/reports/staffPay.report.js';
import { accountBalances } from '../src/lib/balances.js';
import { toDateString } from '../src/lib/dates.js';
import { as } from './helpers.js';

const actor = { id: 'usr-super-01', name: 'Super Admin', role: 'SUPER_ADMIN' };
const DAY = '2026-06-10', MONTH = '2026-06';
let serial = 0;
const slipOf = (run, f) => run.payslips.find((p) => p.staffId === f.staff.id);
const balance = async (f) => Number((await accountBalances([f.account.id])).get(f.account.id));

describe('Payroll generation safety regressions', () => {
  it('finalizes monthly payroll with unrecorded working days treated as deducted absences', async () => {
    const f = await fixture('MONTHLY_PLUS_COMMISSION');
    await setSystemDate('2026-10-13', actor);
    await prisma.staff.update({ where: { id: f.staff.id }, data: { baseSalary: 30000, joiningDate: new Date('2026-10-05') } });
    await prisma.attendanceRecord.createMany({ data: [
      ['2026-10-06', 'PRESENT'], ['2026-10-07', 'PRESENT'],
      ['2026-10-08', 'PAID_LEAVE'], ['2026-10-09', 'PAID_LEAVE'], ['2026-10-13', 'ABSENT'],
    ].map(([date, status]) => ({ branchId: f.branch.id, staffId: f.staff.id, workDate: new Date(date), checkIn: '09:00 AM', checkOut: '06:00 PM', status, isFinalized: true })) });
    const preview = await payroll.generatePreview(actor, { branchId: f.branch.id, month: '2026-10', runType: 'MONTHLY' });
    expect(slipOf(preview, f)).toMatchObject({ baseEarnings: 9000, presentDays: 2, paidLeaveDays: 2, absentDays: 4, unrecordedDays: 3, absenceDeductions: 4000, netPayable: 5000, canFinalize: true, hasExceptions: false });
    const finalized = await payroll.finalizeRun(actor, preview.id);
    expect(slipOf(finalized, f)).toMatchObject({ netPayable: 5000, status: 'FINALIZED' });
  });

  it('cuts the current monthly run at today, clips joining/leaving dates and excludes future attendance and OT', async () => {
    const f = await fixture('MONTHLY_SALARY');
    await setSystemDate('2026-10-13', actor);
    await prisma.staff.update({ where: { id: f.staff.id }, data: { baseSalary: 30000, joiningDate: new Date('2026-10-13') } });
    const original = await prisma.staff.findUnique({ where: { id: f.staff.id } });
    const { id, createdAt, updatedAt, ...data } = original;
    const mid = await prisma.staff.create({ data: { ...data, employeeCode: `${data.employeeCode}-MID`, joiningDate: new Date('2026-10-08') } });
    const left = await prisma.staff.create({ data: { ...data, employeeCode: `${data.employeeCode}-LEFT`, joiningDate: new Date('2026-10-08'), exitDate: new Date('2026-10-10'), isActive: false } });
    for (const staff of [f.staff, mid, left]) {
      const dates = staff.id === f.staff.id ? ['2026-10-13'] : ['2026-10-08','2026-10-09','2026-10-10','2026-10-11','2026-10-12','2026-10-13'];
      await prisma.attendanceRecord.createMany({ data: [...dates, '2026-10-14'].map(date => ({ branchId: f.branch.id, staffId: staff.id, workDate: new Date(date), checkIn: '09:00 AM', checkOut: '06:00 PM', status: date === '2026-10-14' ? 'MISSING_PUNCH' : 'PRESENT', isFinalized: true })) });
    }
    await prisma.overtimeRecord.create({ data: { branchId: f.branch.id, staffId: f.staff.id, workDate: new Date('2026-10-14'), overtimeNumber: `FUTURE-${serial}`, minutes: 60, approvedMinutes: 60, hourlyRate: 300, amount: 300, status: 'APPROVED', reason: 'Future test', enteredByUserId: actor.id, enteredByName: actor.name } });
    const input = { branchId: f.branch.id, month: '2026-10', runType: 'MONTHLY' };
    const preview = await payroll.generatePreview(actor, input);
    expect(preview).toMatchObject({ startDate: '2026-10-01', endDate: '2026-10-13', runType: 'MONTHLY' });
    expect(slipOf(preview, f)).toMatchObject({ startDate: '2026-10-13', endDate: '2026-10-13', baseEarnings: 1000, netPayable: 1000, approvedOvertimeAmount: 0, hasExceptions: false, canFinalize: true });
    expect(preview.payslips.find(p => p.staffId === mid.id)).toMatchObject({ startDate: '2026-10-08', endDate: '2026-10-13', baseEarnings: 6000 });
    expect(preview.payslips.find(p => p.staffId === left.id)).toMatchObject({ startDate: '2026-10-08', endDate: '2026-10-10', baseEarnings: 3000 });
    // A draft created before the cutoff fix must be revalidated at finalization too.
    const draft = await prisma.payrollRun.findUnique({ where: { id: preview.id } });
    await prisma.payrollRun.update({ where: { id: preview.id }, data: { policySnapshot: { ...draft.policySnapshot, endDate: '2026-10-31' } } });
    const finalized = await payroll.finalizeRun(actor, preview.id);
    expect(finalized.endDate).toBe('2026-10-13');
    expect(slipOf(finalized, f).netPayable).toBe(1000);
    const overlap = await payroll.generatePreview(actor, input);
    await expect(payroll.finalizeRun(actor, overlap.id)).rejects.toMatchObject({ code: 'PAYROLL_BLOCKED' });
    await expect(payroll.generatePreview(actor, { branchId: f.branch.id, month: '2026-11' })).rejects.toMatchObject({ code: 'FUTURE_PAYROLL' });
  });

  it('blocks an unresolved punch today while ignoring future missing punches', async () => {
    const f = await fixture('MONTHLY_SALARY');
    await setSystemDate('2026-10-13', actor);
    await prisma.staff.update({ where: { id: f.staff.id }, data: { baseSalary: 30000, joiningDate: new Date('2026-10-13') } });
    await prisma.attendanceRecord.createMany({ data: ['2026-10-13', '2026-10-14'].map(date => ({ branchId: f.branch.id, staffId: f.staff.id, workDate: new Date(date), checkIn: '', checkOut: '', status: 'MISSING_PUNCH', isFinalized: true })) });
    const preview = await payroll.generatePreview(actor, { branchId: f.branch.id, month: '2026-10', runType: 'MONTHLY' });
    expect(slipOf(preview, f).exceptionDetails).toEqual(['Missing Punch on 2026-10-13.']);
    await expect(payroll.finalizeRun(actor, preview.id)).rejects.toMatchObject({ code: 'PAYROLL_BLOCKED' });
  });

  it('loads mixed staff without selection for a single day and atomically rejects concurrent overlaps', async () => {
    const f = await fixture();
    const original = await prisma.staff.findUnique({ where: { id: f.staff.id } });
    const { id, createdAt, updatedAt, ...data } = original;
    const monthly = await prisma.staff.create({ data: { ...data, name: 'Monthly colleague', employeeCode: `${data.employeeCode}-M`, compensationType: 'MONTHLY_SALARY', baseSalary: 30000 } });
    await prisma.attendanceRecord.create({ data: { branchId: f.branch.id, staffId: monthly.id, workDate: new Date(DAY), checkIn: '09:00 AM', checkOut: '06:00 PM', status: 'PRESENT', isFinalized: true } });
    const input = { branchId: f.branch.id, month: MONTH, runType: 'DAILY', startDate: DAY };
    const a = await payroll.generatePreview(actor, input);
    expect(a.payslips.map(p => p.staffId).sort()).toEqual([f.staff.id, monthly.id].sort());
    expect(a.payslips.find(p => p.staffId === monthly.id).baseEarnings).toBe(1000);
    const b = await payroll.generatePreview(actor, { ...input, staffIds: [monthly.id, f.staff.id] });
    expect(await prisma.payrollRun.findUnique({ where: { id: a.id } })).not.toBeNull();
    const outcomes = await Promise.allSettled([payroll.finalizeRun(actor, a.id), payroll.finalizeRun(actor, b.id)]);
    expect(outcomes.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const finalized = outcomes.find(r => r.status === 'fulfilled').value;
    const frozen = await prisma.payslip.findUnique({ where: { id: finalized.payslips[0].id } });
    await expect(payroll.applyManualDeduction(actor, frozen.id, { amount: 1, title: 'Late change' })).rejects.toMatchObject({ code: 'PAYROLL_IMMUTABLE' });
    expect((await prisma.payslip.findUnique({ where: { id: frozen.id } })).snapshot).toEqual(frozen.snapshot);
    await payroll.cancelRun(actor, finalized.id, 'Release reservations');
    const retry = await payroll.generatePreview(actor, input);
    expect(retry.payslips.find(p => p.staffId === f.staff.id)).toMatchObject({ approvedOvertimeAmount: 150, commissionPayable: 100 });
    await payroll.finalizeRun(actor, retry.id);
  });
});

// Each case owns a branch, account and real POS sale: no dependency on other tests' balances/events.
async function fixture(type = 'DAILY_PLUS_COMMISSION') {
  const n = ++serial;
  const branch = await prisma.branch.create({ data: { name: `Combined payroll ${n}`, code: `PC-${n}`, address: 'Test', city: 'Lahore', phone: '03000000000', taxEnabled: true, taxRate: 0.16 } });
  const account = await prisma.paymentAccount.create({ data: { branchId: branch.id, name: 'Payroll bank', accountType: 'BANK', providerName: 'Test', accountHolder: 'Salon', openingBalance: 100000 } });
  const staff = await prisma.staff.create({ data: { branchId: branch.id, name: 'Combined Staff', employeeCode: `PC-${n}`, phone: `030000000${String(n).padStart(2, '0')}`,
    roleTitle: 'Stylist', designation: 'Stylist', joiningDate: new Date('2026-01-01'), effectiveDate: new Date('2026-01-01'), compensationType: type,
    baseSalary: 1000, dailySalaryRate: 1000, commissionRate: 10, overtimeHourlyRate: 300,
    lateInDeduction: { mode: 'NONE' }, earlyExitDeduction: { mode: 'NONE' }, specialties: [] } });
  const category = await prisma.serviceCategory.create({ data: { branchId: branch.id, name: 'Hair' } });
  const service = await prisma.service.create({ data: { branchId: branch.id, categoryId: category.id, code: 'HAIR', name: 'Haircut', durationMinutes: 30, price: 1250 } });
  const isMonthly = type === 'MONTHLY_PLUS_COMMISSION';
  await prisma.attendanceRecord.createMany({ data: Array.from({ length: 30 }, (_, i) => ({ branchId: branch.id, staffId: staff.id, workDate: new Date(`${MONTH}-${String(i + 1).padStart(2, '0')}`),
    checkIn: '09:00 AM', checkOut: '06:00 PM', status: isMonthly || i === 9 ? 'PRESENT' : 'ABSENT', isFinalized: true })) });
  await prisma.overtimeRecord.create({ data: { branchId: branch.id, staffId: staff.id, workDate: new Date(DAY), overtimeNumber: `OT-PC-${n}`, minutes: 30, approvedMinutes: 30,
    hourlyRate: 300, amount: 150, status: 'APPROVED', reason: 'Approved OT', enteredByUserId: actor.id, enteredByName: actor.name } });
  await setSystemDate(DAY, actor);
  const invoice = await postInvoice({ branchId: branch.id, clientName: 'Payroll Test', clientPhone: `031000000${String(n).padStart(2, '0')}`,
    discountType: 'PERCENTAGE', discountValue: 20, tip: 500,
    cartItems: [{ type: 'SERVICE', item: { id: service.id, price: 1250 }, quantity: 1, staffId: staff.id }],
    payments: [{ method: 'ONLINE_ACCOUNT', paymentAccountId: account.id, amount: 1660, billAllocation: 1160, tipAllocation: 500 }],
  }, actor, `pc-sale-${n}`);
  // Existing full-month cases exercise a closed month, rather than a future projection.
  await setSystemDate('2026-06-30', actor);
  const previewInput = { branchId: branch.id, month: MONTH, staffId: staff.id, ...(isMonthly ? {} : { startDate: DAY, endDate: DAY, runType: 'DAILY' }) };
  const preview = () => payroll.generatePreview(actor, previewInput);
  const finalize = async () => payroll.finalizeRun(actor, (await preview()).id);
  const pay = (run, amount, key) => payroll.recordPayment(actor, { payrollRunId: run.id, payslipId: slipOf(run, { staff }).id, amount, method: 'ONLINE', onlineAccountId: account.id, idempotencyKey: key });
  const cPreview = (startDate = DAY, endDate = DAY) => commission.generatePreview(actor, { branchId: branch.id, startDate, endDate });
  const refund = async () => {
    // Refund scenarios target the sale day; restore the closed payroll month afterwards.
    await setSystemDate(DAY, actor);
    try {
      return await refundInvoice({ invoiceId: invoice.id, type: 'VOID', reason: 'Customer refund', refundMethod: 'ONLINE_ACCOUNT', paymentAccountId: account.id }, actor);
    } finally {
      await setSystemDate('2026-06-30', actor);
    }
  };
  return { branch, account, staff, invoice, preview, finalize, pay, cPreview, refund };
}

describe('Payroll periods and contract selection', () => {
  it('prorates monthly custom dates, scopes OT and commission, permits the next range and blocks overlap', async () => {
    const f = await fixture('MONTHLY_PLUS_COMMISSION');
    await prisma.staff.update({ where: { id: f.staff.id }, data: { baseSalary: 30000 } });
    const input = { branchId: f.branch.id, month: MONTH, staffId: f.staff.id, runType: 'CUSTOM_RANGE', compensationType: 'MONTHLY_PLUS_COMMISSION' };
    const first = await payroll.generatePreview(actor, { ...input, startDate: '2026-06-01', endDate: '2026-06-15' });
    const next = await payroll.generatePreview(actor, { ...input, startDate: '2026-06-16', endDate: '2026-06-30' });
    expect(await prisma.payrollRun.findUnique({ where: { id: first.id } })).not.toBeNull();
    expect(slipOf(first, f)).toMatchObject({ baseEarnings: 15000, approvedOvertimeAmount: 150, commissionPayable: 100, netPayable: 15250 });
    expect(slipOf(next, f)).toMatchObject({ baseEarnings: 15000, approvedOvertimeAmount: 0, commissionPayable: 0, netPayable: 15000 });
    const a = await payroll.finalizeRun(actor, first.id);
    await payroll.finalizeRun(actor, next.id);
    const overlap = await payroll.generatePreview(actor, { ...input, startDate: '2026-06-14', endDate: '2026-06-18' });
    await expect(payroll.finalizeRun(actor, overlap.id)).rejects.toMatchObject({ code: 'PAYROLL_BLOCKED' });
    const paid = await f.pay(a, 15250, 'custom-monthly-payment');
    expect(paid.payment).toMatchObject({ salaryAmount: 15150, commissionAmount: 100 });
    await payroll.reversePayment(actor, paid.payment.id, 'Custom period reversal');
    expect(slipOf((await payroll.listRuns(actor, { branchId: f.branch.id, month: MONTH })).find((r) => r.id === a.id), f).outstandingAmount).toBe(15250);
  });

  it.each(['DAILY_SALARY', 'DAILY_PLUS_COMMISSION', 'MONTHLY_SALARY', 'MONTHLY_PLUS_COMMISSION', 'COMMISSION_ONLY'])('honors %s contract filter and preserves other drafts', async (type) => {
    const f = await fixture(type);
    const daily = type.startsWith('DAILY');
    const input = { branchId: f.branch.id, month: MONTH, runType: daily ? 'DAILY' : 'MONTHLY', compensationType: type, ...(daily ? { startDate: DAY, endDate: DAY } : {}) };
    const response = await as('super').post('/payroll/preview', input);
    expect(response.status).toBe(201);
    const preview = response.body.data;
    expect(preview.payslips.map((p) => p.compensationType)).toEqual([type]);
    const repeat = await payroll.generatePreview(actor, input);
    expect(await prisma.payrollRun.findUnique({ where: { id: preview.id } })).toBeNull();
    expect(await prisma.payrollRun.findUnique({ where: { id: repeat.id } })).not.toBeNull();
    await expect(payroll.generatePreview(actor, { ...input, compensationType: daily ? 'MONTHLY_SALARY' : 'DAILY_SALARY' })).rejects.toMatchObject({ code: 'NO_ELIGIBLE_STAFF' });
  });

  it('rejects invalid, reversed, cross-month and multiple-day daily periods', async () => {
    const f = await fixture();
    for (const dates of [
      { startDate: '2026-06-31', endDate: '2026-06-31' },
      { startDate: '2026-06-12', endDate: DAY },
      { startDate: DAY, endDate: '2026-07-01' },
      { startDate: DAY, endDate: '2026-06-11', runType: 'DAILY' },
    ]) await expect(payroll.generatePreview(actor, { branchId: f.branch.id, month: MONTH, ...dates })).rejects.toMatchObject({ code: 'INVALID_RANGE' });
  });

  it('prorates recurring allowance and loan installment while consuming monthly adjustments once', async () => {
    const f = await fixture('MONTHLY_PLUS_COMMISSION');
    await prisma.staff.update({ where: { id: f.staff.id }, data: { baseSalary: 30000 } });
    await prisma.staffAllowance.create({ data: { branchId: f.branch.id, staffId: f.staff.id, name: 'Travel', amount: 3000, createdByUserId: actor.id, createdByName: actor.name } });
    await issueAdvance(actor, { staffId: f.staff.id, amount: 600, recoveryPerMonth: 600, startMonth: MONTH, method: 'ONLINE', onlineAccountId: f.account.id, reason: 'Loan' });
    await prisma.payrollAdjustment.create({ data: { branchId: f.branch.id, staffId: f.staff.id, month: MONTH, type: 'DEDUCTION', title: 'Other', amount: 50, createdByUserId: actor.id, createdByName: actor.name } });
    const input = { branchId: f.branch.id, month: MONTH, staffId: f.staff.id, runType: 'CUSTOM_RANGE' };
    const first = await payroll.finalizeRun(actor, (await payroll.generatePreview(actor, { ...input, startDate: '2026-06-01', endDate: '2026-06-15' })).id);
    expect(slipOf(first, f)).toMatchObject({ allowancesTotal: 1500, advanceRecoveryAmount: 300, otherDeductions: 50, commissionPayable: 100, netPayable: 16400 });
    const next = await payroll.finalizeRun(actor, (await payroll.generatePreview(actor, { ...input, startDate: '2026-06-16', endDate: '2026-06-30' })).id);
    expect(slipOf(next, f)).toMatchObject({ allowancesTotal: 1500, advanceRecoveryAmount: 300, otherDeductions: 0, netPayable: 16200 });
  });
});

describe('Combined payroll uses canonical commission, separate ledgers and atomic ownership', () => {
  it('carries an earlier part-paid statement forward without changing its dates or payment history', async () => {
    const f = await fixture('MONTHLY_PLUS_COMMISSION');
    const cr = await commission.finalizeRun(actor, (await f.cPreview()).id);
    const paid = await commission.recordPayment(actor, { commissionRunId: cr.id, statementId: cr.statements[0].id, amount: 40, method: 'ONLINE', onlineAccountId: f.account.id });
    const preview = await payroll.generatePreview(actor, { branchId: f.branch.id, month: MONTH, staffId: f.staff.id,
      startDate: '2026-06-16', endDate: '2026-06-30', runType: 'CUSTOM_RANGE' });
    expect(slipOf(preview, f).commissionPayable).toBe(60);
    expect(slipOf(preview, f).calculationDetails.formula).toContain('Commission (Rs. 60)');
    const run = await payroll.finalizeRun(actor, preview.id);
    const st = await prisma.commissionStatement.findUnique({ where: { id: cr.statements[0].id }, include: { payments: true, run: true } });
    expect(st.payrollPayslipId).toBe(slipOf(run, f).id);
    expect(st.run.startDate.toISOString().slice(0, 10)).toBe(DAY);
    expect(st.payments).toHaveLength(1);
    expect(st.payments[0].id).toBe(paid.payment.id);
    const payment = await f.pay(run, slipOf(run, f).netPayable, 'carry-forward');
    expect(payment.payment.commissionAmount).toBe(60);
    await payroll.reversePayment(actor, payment.payment.id, 'Restore carried balance');
    const restored = (await commission.listRuns(actor, { branchId: f.branch.id })).find(r => r.id === cr.id).statements[0];
    expect(restored).toMatchObject({ paidAmount: 40, outstandingAmount: 60 });
    expect(restored.payments).toHaveLength(2);
  });
  it.each(['DAILY_PLUS_COMMISSION', 'MONTHLY_PLUS_COMMISSION'])('%s: 1000 salary + 150 OT + 100 commission = 1250; preview does not consume/pay', async (type) => {
    const f = await fixture(type);
    expect(f.invoice).toMatchObject({ netSales: 1000, tax: 160, tip: 500 });
    const before = await balance(f);
    const preview = await f.preview();
    expect(slipOf(preview, f)).toMatchObject({ baseEarnings: 1000, approvedOvertimeAmount: 150, salaryNetPayable: 1150, commissionPayable: 100, netPayable: 1250 });
    expect(await prisma.commissionStatement.count({ where: { staffId: f.staff.id } })).toBe(0);
    expect(await prisma.commissionEvent.findFirst({ where: { staffId: f.staff.id } })).toMatchObject({ consumedByRunId: null });
    await expect(f.pay(preview, 1250)).rejects.toMatchObject({ code: 'RUN_NOT_PAYABLE' });
    const run = await payroll.finalizeRun(actor, preview.id);
    const slip = slipOf(run, f);
    expect(slip.commissionLinks).toHaveLength(1);
    const st = await prisma.commissionStatement.findFirst({ where: { staffId: f.staff.id } });
    expect(st.payrollPayslipId).toBe(slip.id);
    expect(Number(st.netPayable)).toBe(100);
    expect(Number((await prisma.payslip.findUnique({ where: { id: slip.id } })).netPayable)).toBe(1150);
    expect(await balance(f)).toBe(before);
    await expect(commission.recordPayment(actor, { commissionRunId: st.runId, statementId: st.id, amount: 100, method: 'ONLINE', onlineAccountId: f.account.id })).rejects.toMatchObject({ code: 'COMMISSION_LINKED_TO_PAYROLL' });
    await expect(commission.cancelRun(actor, st.runId, 'Cannot unlink independently')).rejects.toMatchObject({ code: 'COMMISSION_LINKED_TO_PAYROLL' });
    const payment = await f.pay(run, 1250, `example-${type}`);
    expect(payment.payment).toMatchObject({ amount: 1250, salaryAmount: 1150, commissionAmount: 100 });
    expect(slipOf(payment.payrollRun, f)).toMatchObject({ status: 'PAID', outstandingAmount: 0 });
    expect(await balance(f)).toBe(before - 1250);
    const cp = await prisma.commissionPayment.findFirst({ where: { payrollPaymentId: payment.payment.id } });
    expect(Number(cp.amount)).toBe(100);
    await expect(commission.reversePayment(actor, cp.id, 'Wrong screen')).rejects.toMatchObject({ code: 'COMMISSION_LINKED_TO_PAYROLL' });
    const salaryReport = await staffSalaryReport(actor, { branchId: f.branch.id, month: MONTH });
    expect(salaryReport.totals).toMatchObject({ net: 1150, paid: 1150, outstanding: 0 });
    // Earnings use the business date; payouts use their actual paid timestamp.
    const paymentDay = toDateString(new Date(payment.payment.paidAt));
    const reportEnd = paymentDay > DAY ? paymentDay : DAY;
    const commissionReport = await staffCommissionReport(actor, { branchId: f.branch.id, startDate: DAY, endDate: reportEnd });
    expect(commissionReport.totals).toMatchObject({ earned: 100, reversed: 0, paid: 100, outstanding: 0 });
    const summary = await payroll.monthlySummary(actor, { branchId: f.branch.id, month: MONTH });
    expect(summary.totals).toMatchObject({ salaryNet: 1150, salaryPaid: 1150, commissionNet: 100, commissionPaid: 100, totalPaid: 1250 });
    await payroll.reversePayment(actor, payment.payment.id, 'Reverse together');
    expect(await balance(f)).toBe(before);
    expect((await prisma.commissionPayment.findUnique({ where: { id: cp.id } })).status).toBe('REVERSED');
    expect((await staffCommissionReport(actor, { branchId: f.branch.id, startDate: DAY, endDate: reportEnd })).totals).toMatchObject({ paid: 0, outstanding: 100 });
    await expect(payroll.reversePayment(actor, payment.payment.id, 'Retry')).rejects.toMatchObject({ code: 'ALREADY_REVERSED' });
    await payroll.cancelRun(actor, run.id, 'Release eligibility');
    expect((await prisma.commissionEvent.findFirst({ where: { staffId: f.staff.id } })).consumedByRunId).toBeNull();
    const regenerated = await f.finalize();
    expect(slipOf(regenerated, f).netPayable).toBe(1250);
  });

  it('re-evaluates commission at finalization and ignores stale previews after a refund', async () => {
    const f = await fixture();
    const draft = await f.preview();
    await f.refund();
    const run = await payroll.finalizeRun(actor, draft.id);
    expect(slipOf(run, f)).toMatchObject({ commissionPayable: 0, netPayable: 1150 });
    expect(await prisma.commissionEvent.count({ where: { staffId: f.staff.id, consumedByRunId: { not: null } } })).toBe(2);
  });

  it('a refund after finalization blocks obsolete commission payout and rolls back both money parts', async () => {
    const f = await fixture();
    const run = await f.finalize();
    await f.refund();
    const before = await balance(f);
    await expect(f.pay(run, 1250, 'refunded')).rejects.toMatchObject({ code: 'COMMISSION_REFUND_ADJUSTMENT' });
    expect(await balance(f)).toBe(before);
    expect(await prisma.payrollPayment.count({ where: { runId: run.id } })).toBe(0);
    await payroll.cancelRun(actor, run.id, 'Refresh refunded commission');
    expect(slipOf(await f.finalize(), f).netPayable).toBe(1150);
  });

  it('links only the unpaid balance of an already-finalized statement and releases it on cancel', async () => {
    const f = await fixture();
    const cr = await commission.finalizeRun(actor, (await f.cPreview()).id);
    const st = cr.statements[0];
    await commission.recordPayment(actor, { commissionRunId: cr.id, statementId: st.id, amount: 40, method: 'ONLINE', onlineAccountId: f.account.id });
    const run = await f.finalize();
    expect(slipOf(run, f)).toMatchObject({ commissionPayable: 60, netPayable: 1210 });
    expect(await prisma.commissionStatement.count({ where: { staffId: f.staff.id } })).toBe(1);
    await payroll.cancelRun(actor, run.id, 'Standalone instead');
    expect((await prisma.commissionRun.findUnique({ where: { id: cr.id } })).status).toBe('FINALIZED');
    await commission.recordPayment(actor, { commissionRunId: cr.id, statementId: st.id, amount: 60, method: 'ONLINE', onlineAccountId: f.account.id });
    expect(slipOf(await f.finalize(), f).commissionPayable).toBe(0);
  });

  it('concurrent retries of a partial payout create one record; salary-first split and commission-only remainder reverse correctly', async () => {
    const f = await fixture();
    const run = await f.finalize();
    const before = await balance(f);
    const [a, b] = await Promise.all([f.pay(run, 1175, 'same-key'), f.pay(run, 1175, 'same-key')]);
    expect(a.payment.id).toBe(b.payment.id);
    expect(a.payment).toMatchObject({ salaryAmount: 1150, commissionAmount: 25 });
    expect(await balance(f)).toBe(before - 1175);
    const tail = await f.pay(run, 75, 'tail');
    expect(tail.payment).toMatchObject({ amount: 75, salaryAmount: 0, commissionAmount: 75, onlineAccountId: f.account.id });
    await expect(f.pay(run, 1, 'extra')).rejects.toMatchObject({ code: 'OVERPAYMENT' });
    await payroll.reversePayment(actor, tail.payment.id, 'Reverse commission-only tail');
    expect(await balance(f)).toBe(before - 1175);
    await payroll.reversePayment(actor, a.payment.id, 'Reverse first part');
    expect(await balance(f)).toBe(before);
  });

  it('serializes overlapping commission/payroll finalizations and disallows duplicate payment paths', async () => {
    const f = await fixture();
    const cd = await f.cPreview(`${MONTH}-01`, `${MONTH}-30`);
    const pd = await f.preview();
    const [pr, cr] = await Promise.all([payroll.finalizeRun(actor, pd.id), commission.finalizeRun(actor, cd.id)]);
    const records = await prisma.commissionStatement.findMany({ where: { staffId: f.staff.id }, include: { payments: true } });
    expect(records.reduce((s, st) => s + Number(st.netPayable), 0)).toBe(100);
    expect(await prisma.commissionEvent.count({ where: { staffId: f.staff.id, consumedByRunId: { not: null } } })).toBe(1);
    const slip = slipOf(pr, f);
    await f.pay(pr, slip.netPayable, 'race-payroll');
    const standalone = cr.statements.find((s) => !s.payrollPayslipId && s.netCommissionPayable > 0);
    if (standalone) await commission.recordPayment(actor, { commissionRunId: cr.id, statementId: standalone.id, amount: 100, method: 'ONLINE', onlineAccountId: f.account.id });
    expect(Number((await prisma.commissionPayment.aggregate({ where: { staffId: f.staff.id, status: 'COMPLETED' }, _sum: { amount: true } }))._sum.amount)).toBe(100);
    await expect(payroll.finalizeRun(actor, pd.id)).rejects.toMatchObject({ code: 'NOT_DRAFT' });
    const overlap = await f.preview();
    await expect(payroll.finalizeRun(actor, overlap.id)).rejects.toMatchObject({ code: 'PAYROLL_BLOCKED' });
  });

  it('HTTP concurrent partial-payment retries are idempotent before the middleware cache exists', async () => {
    const f = await fixture();
    const run = await f.finalize();
    const body = { payrollRunId: run.id, payslipId: slipOf(run, f).id, amount: 500, method: 'ONLINE', onlineAccountId: f.account.id };
    const [a, b] = await Promise.all([as('super').post('/payroll/payments', body, { 'Idempotency-Key': 'combined-http-retry' }), as('super').post('/payroll/payments', body, { 'Idempotency-Key': 'combined-http-retry' })]);
    expect(a.status).toBe(201); expect(b.status).toBe(201);
    expect(a.body.data.payment.id).toBe(b.body.data.payment.id);
    expect(await prisma.payrollPayment.count({ where: { runId: run.id } })).toBe(1);
  });

  it('concurrent Payroll and Staff Commission payouts cannot pay a linked statement twice', async () => {
    const f = await fixture();
    const cr = await commission.finalizeRun(actor, (await f.cPreview()).id);
    const run = await f.finalize();
    const before = await balance(f);
    const [combined, standalone] = await Promise.allSettled([
      f.pay(run, 1250, 'cross-screen-payroll'),
      commission.recordPayment(actor, { commissionRunId: cr.id, statementId: cr.statements[0].id, amount: 100, method: 'ONLINE', onlineAccountId: f.account.id, idempotencyKey: 'cross-screen-commission' }),
    ]);
    expect(combined.status).toBe('fulfilled');
    expect(standalone.status).toBe('rejected');
    expect(standalone.reason).toMatchObject({ code: 'COMMISSION_LINKED_TO_PAYROLL' });
    expect(await balance(f)).toBe(before - 1250);
    expect(await prisma.commissionPayment.count({ where: { staffId: f.staff.id, status: 'COMPLETED' } })).toBe(1);
  });

  it('refund debt after a completed payout survives cancellation and blocks repayment', async () => {
    const f = await fixture();
    const run = await f.finalize();
    const paid = await f.pay(run, 1250, 'paid-before-refund');
    await f.refund();
    await expect(payroll.cancelRun(actor, run.id, 'Has completed payment')).rejects.toMatchObject({ code: 'HAS_PAYMENTS' });
    await payroll.reversePayment(actor, paid.payment.id, 'Return combined payout');
    await expect(f.pay(run, 1250, 'repay-after-refund')).rejects.toMatchObject({ code: 'COMMISSION_REFUND_ADJUSTMENT' });
    await payroll.cancelRun(actor, run.id, 'Recalculate refunded sale');
    const regenerated = await f.finalize();
    expect(slipOf(regenerated, f)).toMatchObject({ commissionPayable: 0, netPayable: 1150 });
    await f.pay(regenerated, 1150, 'salary-after-refund');
    expect(await prisma.commissionPayment.count({ where: { staffId: f.staff.id, status: 'COMPLETED' } })).toBe(0);
  });

  it('insufficient combined funds roll back salary movement, commission payment and payment records', async () => {
    const f = await fixture();
    const run = await f.finalize();
    await prisma.paymentAccount.update({ where: { id: f.account.id }, data: { openingBalance: -460 } }); // POS receipt 1660 leaves 1200.
    const before = await balance(f);
    expect(before).toBe(1200);
    await expect(f.pay(run, 1250, 'insufficient')).rejects.toMatchObject({ code: 'INSUFFICIENT_ACCOUNT_BALANCE' });
    expect(await balance(f)).toBe(before);
    expect(await prisma.payrollPayment.count({ where: { runId: run.id } })).toBe(0);
    expect(await prisma.commissionPayment.count({ where: { staffId: f.staff.id } })).toBe(0);
  });

  it.each(['DAILY_PLUS_COMMISSION', 'MONTHLY_PLUS_COMMISSION'])('%s: loan and other deductions remain salary lines; commission is added once after deductions', async (type) => {
    const f = await fixture(type);
    await issueAdvance(actor, { staffId: f.staff.id, amount: 100, recoveryPerMonth: 100, startMonth: MONTH, method: 'ONLINE', onlineAccountId: f.account.id, reason: 'Loan' });
    await prisma.payrollAdjustment.create({ data: { branchId: f.branch.id, staffId: f.staff.id, month: MONTH, type: 'DEDUCTION', title: 'Other deduction', amount: 50, createdByUserId: actor.id, createdByName: actor.name } });
    const run = await f.finalize();
    // Preserve daily installment proration (100 / 30) and monthly full recovery.
    const recovery = type === 'DAILY_PLUS_COMMISSION' ? 3.33 : 100;
    expect(slipOf(run, f)).toMatchObject({ advanceRecoveryAmount: recovery, otherDeductions: 50, totalDeductions: recovery + 50, salaryNetPayable: 1100 - recovery, commissionPayable: 100, netPayable: 1200 - recovery });
  });
});
