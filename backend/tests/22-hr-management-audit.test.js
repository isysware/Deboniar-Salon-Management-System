import { describe, it, expect } from 'vitest';
import prisma from '../src/config/prisma.js';
import * as hr from '../src/modules/attendance/attendance.service.js';
import * as ot from '../src/modules/attendance/overtime.service.js';
import * as payroll from '../src/modules/payroll/payroll.service.js';
import * as loans from '../src/modules/payroll/payroll.extras.service.js';
import * as tips from '../src/modules/tips/tips.service.js';
import { postInvoice } from '../src/modules/pos/pos.service.js';
import { refundInvoice } from '../src/modules/pos/pos.refund.js';
import { setSystemDate } from '../src/modules/settings/settings.service.js';
import { evaluateLeaveAllowance } from '../src/lib/calculations/attendanceCalculations.js';
import { accountBalances } from '../src/lib/balances.js';
import { as } from './helpers.js';
import { postCashMovement } from '../src/modules/cash/cash.service.js';

const actor = { id: 'usr-super-01', name: 'Super Admin', role: 'SUPER_ADMIN' };
const DAY = '2026-05-15', MONTH = '2026-05';
let serial = 0;
async function fixture() {
  const n = ++serial;
  const branch = await prisma.branch.create({ data: { name: `HR audit ${n}`, code: `HRA-${n}`, address: 'Test', city: 'Lahore', phone: '03000000000' } });
  const account = await prisma.paymentAccount.create({ data: { branchId: branch.id, name: 'Audit bank', accountType: 'BANK', providerName: 'Test', accountHolder: 'Salon', openingBalance: 10000 } });
  const staff = await prisma.staff.create({ data: { branchId: branch.id, name: 'Audit Staff', employeeCode: `HRA-${n}`, phone: `0320000${String(n).padStart(4, '0')}`, designation: 'Stylist', roleTitle: 'Stylist', joiningDate: new Date('2026-01-01'), effectiveDate: new Date('2026-01-01'), compensationType: 'DAILY_SALARY', dailySalaryRate: 1000, overtimeHourlyRate: 300, allowedLeaveDays: 2, leaveAllowancePeriod: 'MONTHLY', lateInDeduction: { mode: 'NONE' }, earlyExitDeduction: { mode: 'NONE' }, specialties: [] } });
  await setSystemDate(DAY, actor);
  const balance = async () => Number((await accountBalances([account.id])).get(account.id));
  const leave = (from, to = from, type = 'PAID') => hr.markLeave({ branchId: branch.id, staffId: staff.id, startDate: from, endDate: to, type, reason: 'Audit leave' }, actor);
  const attend = () => hr.createAttendance({ branchId: branch.id, staffId: staff.id, date: DAY, checkIn: '09:00 AM', checkOut: '06:00 PM' }, actor);
  const preview = () => payroll.generatePreview(actor, { branchId: branch.id, staffId: staff.id, month: MONTH, startDate: DAY, endDate: DAY, runType: 'DAILY' });
  const finalize = async () => payroll.finalizeRun(actor, (await preview()).id);
  const advance = (key) => loans.issueAdvance(actor, { staffId: staff.id, amount: 500, recoveryPerMonth: 300, startMonth: MONTH, method: 'ONLINE', onlineAccountId: account.id, reason: 'Audit loan', idempotencyKey: key });
  const tipReceipt = async (amount = 100) => {
    const category = await prisma.serviceCategory.create({ data: { branchId: branch.id, name: 'Hair' } });
    const service = await prisma.service.create({ data: { branchId: branch.id, categoryId: category.id, code: 'AUDIT', name: 'Haircut', durationMinutes: 30, price: 1000 } });
    const invoice = await postInvoice({ branchId: branch.id, clientName: 'Audit Client', clientPhone: `0310000${String(n).padStart(4, '0')}`, tip: amount, cartItems: [{ type: 'SERVICE', item: { id: service.id, price: 1000 }, quantity: 1, staffId: staff.id }], payments: [{ method: 'ONLINE_ACCOUNT', paymentAccountId: account.id, amount: 1000 + amount, billAllocation: 1000, tipAllocation: amount }] }, actor, `audit-sale-${n}`);
    return { invoice, receipt: await prisma.tipReceipt.findFirst({ where: { invoiceId: invoice.id } }) };
  };
  const allocate = (receipt, amount = 100) => tips.allocateTips(actor, { tipReceiptId: receipt.id, allocationType: 'DIRECT', recipients: [{ staffId: staff.id, amount }] });
  return { branch, staff, account, balance, leave, attend, preview, finalize, advance, tipReceipt, allocate };
}

describe('HR audit: loans, leave, overtime and tips', () => {
  it('concurrent HTTP loan retries debit once, and reversal restores the balance once', async () => {
    const f = await fixture();
    const before = await f.balance();
    const body = { staffId: f.staff.id, amount: 500, recoveryPerMonth: 300, startMonth: MONTH, method: 'ONLINE', onlineAccountId: f.account.id, reason: 'Retry loan' };
    const headers = { 'Idempotency-Key': 'audit-loan-http-retry' };
    const [a, b] = await Promise.all([as('super').post('/payroll/advances', body, headers), as('super').post('/payroll/advances', body, headers)]);
    expect(a.status).toBe(201); expect(b.status).toBe(201);
    expect(a.body.data.id).toBe(b.body.data.id);
    expect(await prisma.salaryAdvance.count({ where: { staffId: f.staff.id } })).toBe(1);
    expect(await f.balance()).toBe(before - 500);
    const wrongRoute = await as('super').post('/tips/payouts', {}, headers);
    expect(wrongRoute.status).toBe(409);
    expect(wrongRoute.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    await loans.reverseAdvance(actor, a.body.data.id, 'Return loan');
    await expect(loans.reverseAdvance(actor, a.body.data.id, 'Duplicate return')).rejects.toMatchObject({ code: 'ALREADY_REVERSED' });
    expect(await f.balance()).toBe(before);
  });

  it('loan reversal versus payroll finalization cannot leave a reversed loan with active recoveries', async () => {
    const f = await fixture();
    const advance = await f.advance('audit-loan-finalize-race');
    await f.attend();
    const draft = await f.preview();
    const [finalized, reversed] = await Promise.allSettled([payroll.finalizeRun(actor, draft.id), loans.reverseAdvance(actor, advance.id, 'Race return')]);
    expect(finalized.status).toBe('fulfilled');
    const saved = await prisma.salaryAdvance.findUnique({ where: { id: advance.id }, include: { recoveries: true } });
    if (reversed.status === 'fulfilled') {
      expect(saved.status).toBe('REVERSED');
      expect(saved.recoveries.filter(r => r.status === 'ACTIVE')).toHaveLength(0);
      expect(finalized.value.payslips[0].advanceRecoveryAmount).toBe(0);
    } else {
      expect(reversed.reason).toMatchObject({ code: 'ADVANCE_HAS_RECOVERIES' });
      expect(finalized.value.payslips[0].advanceRecoveryAmount).toBe(10); // Configured daily recovery divisor is 30.
    }
    await payroll.cancelRun(actor, draft.id, 'Release recovery');
    const released = await loans.listAdvances(actor, { branchId: f.branch.id });
    expect(released[0].recoveredAmount).toBe(0);
  });

  it('splits cross-month paid leave allowance and checks every affected period', async () => {
    const f = await fixture();
    const leave = await f.leave('2026-05-30', '2026-06-02');
    expect(leave.totalDays).toBe(3); // Saturday + Monday + Tuesday; Sunday excluded.
    expect(evaluateLeaveAllowance({ ...f.staff, joiningDate: '2026-01-01' }, [leave], '2026-05-30').usedDays).toBe(1);
    expect(evaluateLeaveAllowance({ ...f.staff, joiningDate: '2026-01-01' }, [leave], '2026-06-02').usedDays).toBe(2);
    await expect(f.leave('2026-06-03')).rejects.toMatchObject({ code: 'ALLOWANCE_EXCEEDED' });
    const filtered = await hr.listLeaves(actor, { branchId: f.branch.id, startDate: '2026-06-01', endDate: '2026-06-03' });
    expect(filtered.map(l => l.id)).toContain(leave.id);
    await hr.cancelLeave(leave.id, 'Release allowance', actor);
    expect((await f.leave('2026-06-03')).status).toBe('APPROVED');
  });

  it('splits yearly allowance over New Year and cannot exceed the following year allowance', async () => {
    const f = await fixture();
    await prisma.staff.update({ where: { id: f.staff.id }, data: { allowedLeaveDays: 1, leaveAllowancePeriod: 'YEARLY' } });
    expect((await f.leave('2026-12-31', '2027-01-01')).totalDays).toBe(2);
    await expect(f.leave('2027-01-02')).rejects.toMatchObject({ code: 'ALLOWANCE_EXCEEDED' });
  });

  it('serializes paid leave allowance requests and preserves existing attendance', async () => {
    const f = await fixture();
    await prisma.staff.update({ where: { id: f.staff.id }, data: { allowedLeaveDays: 1 } });
    const result = await Promise.allSettled([f.leave('2026-05-20'), f.leave('2026-05-21')]);
    expect(result.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(result.find(r => r.status === 'rejected').reason).toMatchObject({ code: 'ALLOWANCE_EXCEEDED' });
    const attendance = await f.attend();
    await expect(f.leave(DAY, DAY, 'UNPAID')).rejects.toMatchObject({ code: 'LEAVE_ATTENDANCE_CONFLICT' });
    expect((await prisma.attendanceRecord.findUnique({ where: { id: attendance.id } })).status).toBe('PRESENT');
  });

  it('blocks leave cancellation and attendance edits covered by finalized payroll', async () => {
    const f = await fixture();
    const leave = await f.leave(DAY);
    const run = await f.finalize();
    await expect(hr.cancelLeave(leave.id, 'Change frozen leave', actor)).rejects.toMatchObject({ code: 'PAYROLL_PERIOD_LOCKED' });
    const day = await prisma.attendanceRecord.findFirst({ where: { leaveId: leave.id } });
    await expect(hr.correctAttendance(day.id, { checkIn: '09:00 AM', checkOut: '06:00 PM', reason: 'Change frozen attendance' }, actor)).rejects.toMatchObject({ code: 'PAYROLL_PERIOD_LOCKED' });
    await payroll.cancelRun(actor, run.id, 'Unlock HR');
    await hr.cancelLeave(leave.id, 'Now allowed', actor);
    expect(await prisma.attendanceRecord.count({ where: { leaveId: leave.id } })).toBe(0);
  });

  it('cancelling leave over a pre-existing absent day restores absence', async () => {
    const f = await fixture();
    const absent = await prisma.attendanceRecord.create({ data: { branchId: f.branch.id, staffId: f.staff.id, workDate: new Date(DAY), checkIn: 'ABSENT', checkOut: 'ABSENT', status: 'ABSENT' } });
    const leave = await f.leave(DAY);
    await hr.cancelLeave(leave.id, 'Restore absence', actor);
    expect(await prisma.attendanceRecord.findUnique({ where: { id: absent.id } })).toMatchObject({ status: 'ABSENT', leaveId: null });
    expect((await f.preview()).payslips[0].paidLeaveDays).toBe(0);
  });

  it('concurrent overtime creation produces one active record and date filters work', async () => {
    const f = await fixture();
    const input = { branchId: f.branch.id, staffId: f.staff.id, date: DAY, minutes: 30, reason: 'Audit OT', status: 'SUBMITTED' };
    const result = await Promise.allSettled([ot.createOvertime(input, actor), ot.createOvertime(input, actor)]);
    expect(result.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(result.find(r => r.status === 'rejected').reason).toMatchObject({ code: 'OVERTIME_EXISTS' });
    const approved = await ot.approveOvertime(result.find(r => r.status === 'fulfilled').value.id, actor);
    expect(approved.amount).toBe(150);
    expect(await ot.listOvertime(actor, { branchId: f.branch.id, startDate: '2026-06-01' })).toHaveLength(0);
    expect(await ot.listOvertime(actor, { branchId: f.branch.id, date: DAY })).toHaveLength(1);
    await f.attend();
    const draft = await f.preview();
    const [finalized, cancelled] = await Promise.allSettled([payroll.finalizeRun(actor, draft.id), ot.cancelOvertime(approved.id, 'Race with payroll', actor)]);
    expect(finalized.status).toBe('fulfilled');
    const saved = await prisma.overtimeRecord.findUnique({ where: { id: approved.id } });
    expect(finalized.value.payslips[0].approvedOvertimeAmount).toBe(saved.status === 'APPROVED' ? 150 : 0);
    if (cancelled.status === 'rejected') expect(cancelled.reason.code).toBe('OVERTIME_LOCKED');
  });

  it('staff without a linked profile cannot list all attendance, leave or overtime', async () => {
    const unlinked = { id: 'unlinked', role: 'STAFF' };
    for (const action of [hr.listAttendance, hr.listLeaves, ot.listOvertime]) await expect(action(unlinked)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects impossible calendar dates, invalid punch times and zero-cent loans', async () => {
    const f = await fixture();
    expect((await as('super').post('/leaves', { branchId: f.branch.id, staffId: f.staff.id, startDate: '2026-02-30', endDate: '2026-03-01', type: 'PAID', reason: 'Bad date' })).status).toBe(400);
    expect((await as('super').post('/attendance', { branchId: f.branch.id, staffId: f.staff.id, date: DAY, checkIn: '29:99' })).status).toBe(400);
    expect((await as('super').get('/tips/receipts?startDate=2026-13-01')).status).toBe(400);
    await expect(loans.issueAdvance(actor, { staffId: f.staff.id, amount: 0.004, recoveryPerMonth: 0.004, method: 'ONLINE', onlineAccountId: f.account.id, reason: 'Zero cents' })).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
  });

  it('concurrent HTTP partial tip retries debit once; cancellation and reversal preserve liability', async () => {
    const f = await fixture();
    const { receipt } = await f.tipReceipt();
    const allocation = (await f.allocate(receipt)).allocations[0];
    const before = await f.balance();
    const input = { allocationId: allocation.id, amount: 25, method: 'ONLINE', onlineAccountId: f.account.id };
    const headers = { 'Idempotency-Key': 'audit-tip-http-retry' };
    const [a, b] = await Promise.all([as('super').post('/tips/payouts', input, headers), as('super').post('/tips/payouts', input, headers)]);
    expect(a.status).toBe(201); expect(b.status).toBe(201);
    expect(a.body.data.payout.id).toBe(b.body.data.payout.id);
    expect(await f.balance()).toBe(before - 25);
    await expect(tips.cancelAllocation(actor, allocation.id, 'Still paid')).rejects.toMatchObject({ code: 'HAS_PAYOUTS' });
    await tips.reversePayout(actor, { payoutId: a.body.data.payout.id, reversalReason: 'Return tips' });
    expect(await f.balance()).toBe(before);
    await setSystemDate('2026-05-16', actor);
    const cancelled = await tips.cancelAllocation(actor, allocation.id, 'Release allocation');
    expect(cancelled.cancelledAllocation.cancellationDate).toBe('2026-05-16');
    expect(cancelled.cancelledAllocation.outstandingAmount).toBe(0);
    const historical = await tips.statement(actor, { branchId: f.branch.id, staffId: f.staff.id, startDate: DAY, endDate: DAY });
    expect(historical.summary).toMatchObject({ closingLiability: 100, variance: 0 });
    const next = await tips.statement(actor, { branchId: f.branch.id, staffId: f.staff.id, startDate: '2026-05-16', endDate: '2026-05-16' });
    expect(next.summary).toMatchObject({ openingLiability: 100, netTipsCollected: -100, closingLiability: 0, variance: 0 });
  });

  it('tip cancellation versus payout never leaves an active payout on a cancelled allocation', async () => {
    const f = await fixture();
    const { receipt } = await f.tipReceipt();
    const allocation = (await f.allocate(receipt)).allocations[0];
    const before = await f.balance();
    const result = await Promise.allSettled([
      tips.recordPayout(actor, { allocationId: allocation.id, amount: 25, method: 'ONLINE', onlineAccountId: f.account.id }),
      tips.cancelAllocation(actor, allocation.id, 'Race cancellation'),
    ]);
    expect(result.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const saved = await prisma.tipAllocation.findUnique({ where: { id: allocation.id }, include: { payouts: true } });
    if (saved.status === 'CANCELLED') {
      expect(saved.payouts).toHaveLength(0); expect(await f.balance()).toBe(before);
    } else {
      expect(saved.payouts).toHaveLength(1); expect(await f.balance()).toBe(before - 25);
    }
    expect((await tips.statement(actor, { branchId: f.branch.id })).summary.variance).toBe(0);
  });

  it('serializes tip allocation with customer refunds and respects cent-rounded allocations', async () => {
    const f = await fixture();
    const { invoice, receipt } = await f.tipReceipt(0.05);
    await expect(tips.allocateTips(actor, { tipReceiptId: receipt.id, allocationType: 'POOLED_CUSTOM', recipients: Array.from({ length: 3 }, () => ({ staffId: f.staff.id, amount: 0.016 })) })).rejects.toMatchObject({ code: 'OVER_ALLOCATION' });
    await expect(f.allocate(receipt, 0.004)).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
    const result = await Promise.allSettled([
      f.allocate(receipt, 0.05),
      refundInvoice({ invoiceId: invoice.id, type: 'VOID', reason: 'Audit refund', refundMethod: 'ONLINE_ACCOUNT', paymentAccountId: f.account.id }, actor),
    ]);
    expect(result.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect((await tips.statement(actor, { branchId: f.branch.id })).summary.variance).toBe(0);
  });

  it('cash tip reversal credits the selected open drawer and rejects a foreign drawer atomically', async () => {
    const f = await fixture();
    const { receipt } = await f.tipReceipt();
    const allocation = (await f.allocate(receipt)).allocations[0];
    const from = await prisma.cashDrawer.create({ data: { branchId: f.branch.id, custodianUserId: actor.id, custodianName: actor.name, date: new Date(DAY) } });
    const receiving = await prisma.cashDrawer.create({ data: { branchId: f.branch.id, custodianUserId: 'usr-admin-01', custodianName: 'Receiving admin', date: new Date(DAY) } });
    await prisma.$transaction(tx => postCashMovement(tx, { holderId: from.id, type: 'OPENING_FLOAT', direction: 'IN', amount: 500, sourceModule: 'AUDIT', actor }));
    const { payout } = await tips.recordPayout(actor, { allocationId: allocation.id, amount: 25, method: 'CASH' });
    const foreign = await fixture();
    const foreignDrawer = await prisma.cashDrawer.create({ data: { branchId: foreign.branch.id, custodianUserId: actor.id, custodianName: actor.name, date: new Date(DAY) } });
    await expect(tips.reversePayout(actor, { payoutId: payout.id, reversalReason: 'Wrong drawer', receivingDrawerId: foreignDrawer.id })).rejects.toMatchObject({ code: 'INVALID_RECEIVING_DRAWER' });
    expect((await prisma.tipPayout.findUnique({ where: { id: payout.id } })).status).toBe('COMPLETED');
    const reversed = await tips.reversePayout(actor, { payoutId: payout.id, reversalReason: 'Selected drawer', receivingDrawerId: receiving.id });
    expect(reversed.reversedPayout.reversalReceivingDrawerId).toBe(receiving.id);
    expect(Number((await prisma.drawerMovement.aggregate({ where: { drawerId: receiving.id, direction: 'IN' }, _sum: { amount: true } }))._sum.amount)).toBe(25);
  });
});
