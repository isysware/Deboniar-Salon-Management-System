// Step 16 — Payroll · Step 17 — Commission
import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../src/config/prisma.js';
import { as } from './helpers.js';

const key = (k) => ({ 'Idempotency-Key': `pc-${k}` });
const MONTH = '2026-08';

/** Every working day (Mon–Sat) of August 2026 for the three long-standing Gulberg stylists. */
const augustRows = () => {
  const rows = [];
  let n = 1;
  for (let d = 1; d <= 31; d++) {
    const date = `2026-08-${String(d).padStart(2, '0')}`;
    if (new Date(`${date}T12:00:00Z`).getUTCDay() === 0) continue;
    for (const [code, inT, outT] of [['EMP-LHE-001', '09:00 AM', '06:00 PM'], ['EMP-LHE-002', '10:00 AM', '07:00 PM'], ['EMP-LHE-003', '09:30 AM', '06:30 PM']]) {
      rows.push({ rowNumber: n++, employeeCode: code, date, checkIn: inT, checkOut: outT });
    }
  }
  return rows;
};

describe('Step 16 · Payroll', () => {
  let run;

  beforeAll(async () => {
    const imp = await as('admin').post('/attendance/import-csv', { rows: augustRows() });
    expect(imp.body.data.rejectedRows).toBe(0);
    const ot = await as('admin').post('/overtime', { staffId: 'staff-1', date: '2026-08-14', minutes: 120, reason: 'Wedding rush', status: 'SUBMITTED' });
    await as('admin').post(`/overtime/${ot.body.data.id}/approve`);
  });

  it('preview is a DRAFT with no money movement; accountants are blocked', async () => {
    expect((await as('accountant').post('/payroll/preview', { month: MONTH })).status).toBe(403);
    const res = await as('admin').post('/payroll/preview', { month: MONTH });
    expect(res.status).toBe(201);
    run = res.body.data;
    expect(run).toMatchObject({ status: 'DRAFT', payrollNumber: 'DRAFT', month: MONTH });
    const zara = run.payslips.find((p) => p.staffId === 'staff-1');
    expect(zara).toMatchObject({ approvedOvertimeMinutes: 120, approvedOvertimeAmount: 1200, canFinalize: true, status: 'DRAFT' });
    expect(zara.netPayable).toBeGreaterThan(85000);
  });

  it('finalize freezes payslips, numbers the run and locks overtime', async () => {
    const res = await as('admin').post(`/payroll/runs/${run.id}/finalize`);
    expect(res.status).toBe(200);
    run = res.body.data;
    expect(run).toMatchObject({ status: 'FINALIZED', payrollNumber: 'PAY-LHE-01-2026-08-0001' });
    expect(run.payslips[0].payslipNumber).toMatch(/^PS-LHE-01-2026-08-/);
    const locked = await prisma.overtimeRecord.findFirst({ where: { workDate: new Date('2026-08-14T00:00:00Z') } });
    expect(locked.payrollRunId).toBe(run.id);
    expect((await as('admin').post(`/payroll/runs/${run.id}/finalize`)).status).toBe(409);
    const again = await as('admin').post('/payroll/preview', { month: MONTH });
    const zara = again.body.data.payslips.find((p) => p.staffId === 'staff-1');
    expect(zara.approvedOvertimeMinutes).toBe(0); // consumed overtime is never paid twice
    expect((await as('admin').post(`/payroll/runs/${again.body.data.id}/finalize`)).status).toBe(409);
  });

  it('pays cash + online, rejects over-payment, reversal restores money', async () => {
    const zara = run.payslips.find((p) => p.staffId === 'staff-1');
    const drawerBefore = (await as('admin').get('/cash-drawers/mine')).body.data.expectedInDrawer;
    const cash = await as('admin').post('/payroll/payments', { payrollRunId: run.id, payslipId: zara.id, amount: 1000, method: 'CASH' }, key('pay-1'));
    expect(cash.status).toBe(201);
    expect((await as('admin').get('/cash-drawers/mine')).body.data.expectedInDrawer).toBe(drawerBefore - 1000);

    const rest = zara.netPayable - 1000;
    const online = await as('admin').post('/payroll/payments', { payrollRunId: run.id, payslipId: zara.id, amount: rest, method: 'ONLINE', onlineAccountId: 'acc-1' }, key('pay-2'));
    const slip = online.body.data.payrollRun.payslips.find((p) => p.staffId === 'staff-1');
    expect(slip).toMatchObject({ status: 'PAID', outstandingAmount: 0 });
    expect(online.body.data.payrollRun.status).toBe('PARTIALLY_PAID');

    const over = await as('admin').post('/payroll/payments', { payrollRunId: run.id, payslipId: zara.id, amount: 1, method: 'CASH' }, key('pay-3'));
    expect(over.status).toBe(400);

    const rev = await as('admin').post(`/payroll/payments/${cash.body.data.payment.id}/reverse`, { reason: 'Wrong drawer' });
    expect(rev.body.data.status).toBe('REVERSED');
    expect((await as('admin').get('/cash-drawers/mine')).body.data.expectedInDrawer).toBe(drawerBefore);
    expect((await as('admin').post(`/payroll/runs/${run.id}/cancel`, { reason: 'x' })).status).toBe(409);
  });

  it('staff see only their finalized payslips', async () => {
    const res = await as('staff').get('/payroll/payslips/me');
    expect(res.body.data.every((p) => p.staffId === 'staff-1' && p.status !== 'DRAFT')).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect((await as('staff').get('/payroll/runs')).status).toBe(403);
  });
});

describe('Step 17 · Commission', () => {
  let run;

  it('preview nets dated EARN and REVERSAL events (no tax, tip or products)', async () => {
    const res = await as('admin').post('/commission/preview', { startDate: '2026-09-01', endDate: '2026-09-30' });
    expect(res.status).toBe(201);
    run = res.body.data;
    const zara = run.statements.find((s) => s.staffId === 'staff-1');
    const hamza = run.statements.find((s) => s.staffId === 'staff-2');
    expect(hamza).toMatchObject({ grossCommissionEarned: 1400.4, refundAdjustments: 0, netCommissionPayable: 1400.4 });
    expect(zara).toMatchObject({ grossCommissionEarned: 2834, refundAdjustments: -1330, netCommissionPayable: 1504 });
    expect(zara.lineItems.some((l) => l.eventType === 'REVERSAL' && l.commissionEarned < 0)).toBe(true);
    expect(run.statements.find((s) => s.staffId === 'staff-4')).toBeUndefined(); // other branch
  });

  it('finalize consumes events so they are never paid twice', async () => {
    const res = await as('admin').post(`/commission/runs/${run.id}/finalize`);
    expect(res.body.data).toMatchObject({ status: 'FINALIZED', commissionNumber: 'COM-LHE-01-2026-0001' });
    expect(res.body.data.consumedAttributionLineIds.length).toBeGreaterThan(0);
    run = res.body.data;
    const again = await as('admin').post('/commission/preview', { startDate: '2026-09-01', endDate: '2026-09-30' });
    expect(again.body.data.totalCommissionPayable).toBe(0);
  });

  it('pays commission and cancel is blocked until payments are reversed; cancel releases events', async () => {
    const hamza = run.statements.find((s) => s.staffId === 'staff-2');
    const pay = await as('admin').post('/commission/payments', { commissionRunId: run.id, statementId: hamza.id, amount: 400.4, method: 'ONLINE', onlineAccountId: 'acc-1' }, key('com-1'));
    expect(pay.status).toBe(201);
    expect(pay.body.data.commissionRun.statements.find((s) => s.staffId === 'staff-2')).toMatchObject({ paidAmount: 400.4, outstandingAmount: 1000, status: 'PARTIALLY_PAID' });
    expect((await as('admin').post(`/commission/runs/${run.id}/cancel`, { reason: 'Redo' })).status).toBe(409);
    await as('admin').post(`/commission/payments/${pay.body.data.payment.id}/reverse`, { reason: 'Redo' });
    const cancel = await as('admin').post(`/commission/runs/${run.id}/cancel`, { reason: 'Redo' });
    expect(cancel.body.data.status).toBe('CANCELLED');
    const fresh = await as('admin').post('/commission/preview', { startDate: '2026-09-01', endDate: '2026-09-30' });
    expect(fresh.body.data.totalCommissionPayable).toBe(2904.4);
  });

  it('access: accountants blocked; staff see only finalized personal statements', async () => {
    expect((await as('accountant').get('/commission/runs')).status).toBe(403);
    const me = await as('staff').get('/commission/statements/me');
    expect(me.status).toBe(200);
    expect(me.body.data.every((s) => s.staffId === 'staff-1')).toBe(true);
  });
});
