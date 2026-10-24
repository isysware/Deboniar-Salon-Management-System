// payroll.md Steps P1–P3 — allowances, adjustments, salary advances, exit proration,
// monthly commission run and the monthly salary + commission summary (API level).
import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../src/config/prisma.js';
import { as } from './helpers.js';
import { setSystemDate } from '../src/modules/settings/settings.service.js';

const MONTH = '2026-07';
const key = (k) => ({ 'Idempotency-Key': `px-${k}` });

/** Every working day (Mon–Sat) of July 2026 for the three Gulberg stylists. */
const julyRows = () => {
  const rows = [];
  let n = 1;
  for (let d = 1; d <= 31; d++) {
    const date = `${MONTH}-${String(d).padStart(2, '0')}`;
    if (new Date(`${date}T12:00:00Z`).getUTCDay() === 0) continue;
    for (const code of ['EMP-LHE-001', 'EMP-LHE-002', 'EMP-LHE-003']) rows.push({ rowNumber: n++, employeeCode: code, date, checkIn: '09:00 AM', checkOut: '06:00 PM' });
  }
  return rows;
};
const slipOf = (run, staffId) => run.payslips.find((p) => p.staffId === staffId);

describe('Payroll extras · allowances, adjustments, advances', () => {
  let allowance, advance, run;

  beforeAll(async () => {
    await setSystemDate('2026-12-31', { id: 'usr-super-01', name: 'Super Admin', role: 'SUPER_ADMIN' });
    const imp = await as('admin').post('/attendance/import-csv', { rows: julyRows() });
    expect(imp.body.data.rejectedRows).toBe(0);
  });

  it('accountants and staff are blocked from every payroll input', async () => {
    expect((await as('accountant').get('/payroll/allowances')).status).toBe(403);
    expect((await as('accountant').post('/payroll/adjustments', { staffId: 'staff-1', month: MONTH, type: 'BONUS', title: 'x', amount: 1 })).status).toBe(403);
    expect((await as('staff').get('/payroll/advances')).status).toBe(403);
    expect((await as('adminKhi').post('/payroll/allowances', { staffId: 'staff-1', name: 'Transport', amount: 3000 })).status).toBe(403);
  });

  it('creates a recurring allowance, one-off adjustments and an advance', async () => {
    const a = await as('admin').post('/payroll/allowances', { staffId: 'staff-1', name: 'Transport', amount: 3000 });
    expect(a.status).toBe(201);
    allowance = a.body.data;
    expect((await as('admin').post('/payroll/adjustments', { staffId: 'staff-2', month: MONTH, type: 'BONUS', title: 'Eid bonus', amount: 5000 })).status).toBe(201);
    expect((await as('admin').post('/payroll/adjustments', { staffId: 'staff-3', month: MONTH, type: 'DEDUCTION', title: 'Broken dryer', amount: 1000 })).status).toBe(201);
    expect((await as('admin').post('/payroll/adjustments', { staffId: 'staff-3', month: MONTH, type: 'FINE', title: 'x', amount: 1 })).status).toBe(400);

    const accBefore = await prisma.accountMovement.count({ where: { accountId: 'acc-1', type: 'SALARY_ADVANCE' } });
    const adv = await as('admin').post('/payroll/advances', {
      staffId: 'staff-3', amount: 10000, recoveryPerMonth: 4000, startMonth: MONTH, method: 'ONLINE', onlineAccountId: 'acc-1', reason: 'Family need',
    }, key('adv-1'));
    expect(adv.status).toBe(201);
    advance = adv.body.data;
    expect(advance).toMatchObject({ status: 'ACTIVE', balance: 10000, recoveredAmount: 0 });
    expect(advance.advanceNumber).toMatch(/^ADV-LHE-01-2026-/);
    expect(await prisma.accountMovement.count({ where: { accountId: 'acc-1', type: 'SALARY_ADVANCE' } })).toBe(accBefore + 1);
    expect((await as('admin').post('/payroll/advances', { staffId: 'staff-3', amount: 100, recoveryPerMonth: 200, method: 'ONLINE', onlineAccountId: 'acc-1', reason: 'x' }, key('adv-bad'))).status).toBe(400);
  });

  it('preview puts allowances, bonus, deduction and advance recovery on the payslips', async () => {
    const res = await as('admin').post('/payroll/preview', { month: MONTH });
    expect(res.status).toBe(201);
    run = res.body.data;
    expect(slipOf(run, 'staff-1')).toMatchObject({ recurringAllowances: 3000, allowancesTotal: 3000, grossPayable: 88000, netPayable: 88000 });
    expect(slipOf(run, 'staff-2')).toMatchObject({ bonusAmount: 5000, netPayable: 80000 });
    expect(slipOf(run, 'staff-3')).toMatchObject({ otherDeductions: 1000, advanceRecoveryAmount: 4000, netPayable: 60000, canFinalize: true });
  });

  it('finalize locks adjustments and books the advance recovery; month inputs are frozen', async () => {
    const fin = await as('admin').post(`/payroll/runs/${run.id}/finalize`);
    expect(fin.status).toBe(200);
    run = fin.body.data;
    const adv = (await as('admin').get('/payroll/advances?staffId=staff-3')).body.data[0];
    expect(adv).toMatchObject({ balance: 6000, recoveredAmount: 4000, status: 'ACTIVE' });
    expect(adv.recoveries).toEqual([expect.objectContaining({ month: MONTH, amount: 4000, payrollRunId: run.id })]);

    const adjs = (await as('admin').get(`/payroll/adjustments?month=${MONTH}`)).body.data;
    expect(adjs.every((a) => a.locked)).toBe(true);
    expect((await as('admin').post(`/payroll/adjustments/${adjs[0].id}/cancel`)).status).toBe(409);
    const late = await as('admin').post('/payroll/adjustments', { staffId: 'staff-1', month: MONTH, type: 'BONUS', title: 'Late', amount: 100 });
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('PAYROLL_MONTH_LOCKED');
    expect((await as('admin').post(`/payroll/advances/${advance.id}/reverse`, { reason: 'Oops' })).status).toBe(409);
  });

  it('monthly summary shows salary + commission side by side', async () => {
    const res = await as('admin').get(`/payroll/monthly-summary?month=${MONTH}`);
    expect(res.status).toBe(200);
    const zara = res.body.data.rows.find((r) => r.staffId === 'staff-1');
    expect(zara).toMatchObject({ salaryStatus: 'FINALIZED', salaryNet: 88000, salaryPaid: 0, commissionNet: 0, totalEarnings: 88000 });
    expect(res.body.data.rows.find((r) => r.staffId === 'staff-3').advanceBalance).toBe(6000);
    expect(res.body.data.totals.salaryNet).toBe(88000 + 80000 + 60000);
    // Staff who joined after July are not listed for July.
    expect(res.body.data.rows.every((r) => r.salaryStatus !== 'NOT_GENERATED')).toBe(true);
    expect((await as('accountant').get(`/payroll/monthly-summary?month=${MONTH}`)).status).toBe(403);
  });

  it('cancel releases recoveries and adjustments; then the advance can be reversed', async () => {
    const cancel = await as('admin').post(`/payroll/runs/${run.id}/cancel`, { reason: 'Redo July' });
    expect(cancel.body.data.status).toBe('CANCELLED');
    const adv = (await as('admin').get('/payroll/advances?staffId=staff-3')).body.data[0];
    expect(adv).toMatchObject({ balance: 10000, recoveredAmount: 0 });
    const adjs = (await as('admin').get(`/payroll/adjustments?month=${MONTH}`)).body.data;
    expect(adjs.some((a) => a.locked)).toBe(false);

    const rev = await as('admin').post(`/payroll/advances/${advance.id}/reverse`, { reason: 'Issued by mistake' });
    expect(rev.status).toBe(200);
    expect(rev.body.data).toMatchObject({ status: 'REVERSED', balance: 0 });
    const preview = (await as('admin').post('/payroll/preview', { month: MONTH })).body.data;
    expect(slipOf(preview, 'staff-3').advanceRecoveryAmount).toBe(0);
  });

  it('deactivating an allowance removes it from the next preview', async () => {
    await as('admin').put(`/payroll/allowances/${allowance.id}`, { isActive: false });
    const preview = (await as('admin').post('/payroll/preview', { month: MONTH })).body.data;
    expect(slipOf(preview, 'staff-1').allowancesTotal).toBe(0);
  });
});

describe('Payroll · exit-month proration and pay terms in force', () => {
  it('a staff member who left mid-month still gets a prorated payslip', async () => {
    const res = await as('admin').post('/staff/staff-3/deactivate', { exitDate: `${MONTH}-20` });
    expect(res.status).toBe(200);
    const staff = (await as('admin').get('/staff/staff-3')).body.data;
    expect(staff).toMatchObject({ isActive: false, exitDate: `${MONTH}-20` });

    const preview = (await as('admin').post('/payroll/preview', { month: MONTH })).body.data;
    const slip = slipOf(preview, 'staff-3');
    expect(slip.baseEarnings).toBe(43333.33); // 65,000 × 20/30 (fixed 30-day divisor)
    expect(slip.calculationDetails.prorationApplied).toBe(true);
    // Not employed in the next month at all.
    const aug = (await as('admin').post('/payroll/preview', { month: '2026-11' })).body.data;
    expect(slipOf(aug, 'staff-3')).toBeUndefined();

    const back = await as('admin').put('/staff/staff-3', { isActive: true });
    expect(back.body.data.exitDate).toBeUndefined();
  });

  it('a raise effective next month does not change this month', async () => {
    await as('admin').put('/staff/staff-2', { baseSalary: 90000, effectiveDate: '2026-12-01' });
    const preview = (await as('admin').post('/payroll/preview', { month: MONTH })).body.data;
    expect(slipOf(preview, 'staff-2').effectiveBaseSalary).toBe(75000);
    const dec = (await as('admin').post('/payroll/preview', { month: '2026-12' })).body.data;
    expect(slipOf(dec, 'staff-2').effectiveBaseSalary).toBe(90000);
    await as('admin').post('/payroll/preview', { month: MONTH }); // leave a July draft behind

    // A draft is only an estimate in the monthly summary — never earned/outstanding.
    const sum = (await as('admin').get(`/payroll/monthly-summary?month=${MONTH}`)).body.data;
    const hamza = sum.rows.find((r) => r.staffId === 'staff-2');
    expect(sum.payrollStatus).toBe('DRAFT');
    expect(hamza).toMatchObject({ salaryStatus: 'DRAFT', salaryNet: 0, salaryOutstanding: 0 });
    expect(hamza.salaryEstimate).toBeGreaterThan(0);
    expect(sum.totals.totalOutstanding).toBe(sum.totals.commissionOutstanding);
  });
});

describe('Commission · monthly run', () => {
  it('preview accepts a month and uses 1st..last day', async () => {
    const res = await as('admin').post('/commission/preview', { month: '2026-09' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ startDate: '2026-09-01', endDate: '2026-09-30', status: 'DRAFT' });
    expect((await as('admin').post('/commission/preview', {})).status).toBe(400);
  });
});

describe('Reports · Staff Salary (§10.2) and Staff Commission (§10.3)', () => {
  it('salary report uses finalized payslips only and reconciles net − paid = outstanding', async () => {
    expect((await as('accountant').get('/reports/staff-salary?month=2026-08')).status).toBe(403);
    const res = await as('admin').get('/reports/staff-salary?fromMonth=2026-07&toMonth=2026-08');
    expect(res.status).toBe(200);
    const { rows, totals } = res.body.data;
    expect(rows.every((r) => r.period === '2026-08')).toBe(true); // July only has draft/cancelled runs
    const zara = rows.find((r) => r.staffId === 'staff-1');
    expect(zara).toMatchObject({ status: 'PARTIALLY_PAID', outstanding: 1000, overtime: 1200 });
    expect(zara.paid).toBe(zara.net - 1000);
    expect(zara.processedBy).toBeTruthy();
    expect(totals.net - totals.paid).toBeCloseTo(totals.outstanding, 2);
    expect(totals.basic + totals.attendance + totals.overtime + totals.allowances - totals.deductions).toBeCloseTo(totals.net, 2);
    const paidOnly = await as('admin').get('/reports/staff-salary?month=2026-08&paymentStatus=PAID');
    expect(paidOnly.body.data.rows.every((r) => r.status === 'PAID')).toBe(true);
  });

  it('commission report: dated earn/reversal events, tax/tip excluded, liability reconciles', async () => {
    expect((await as('accountant').get('/reports/staff-commission?startDate=2026-09-01&endDate=2026-09-30')).status).toBe(403);
    const res = await as('admin').get('/reports/staff-commission?startDate=2026-09-01&endDate=2026-09-30');
    expect(res.status).toBe(200);
    const { byStaff, rows, totals } = res.body.data;
    expect(byStaff.find((s) => s.staffId === 'staff-1')).toMatchObject({ earned: 2834, reversed: 1330, net: 1504 });
    expect(byStaff.find((s) => s.staffId === 'staff-2')).toMatchObject({ earned: 1400.4, reversed: 0 });
    expect(rows.some((r) => r.eventType === 'REVERSAL' && r.net < 0)).toBe(true);
    expect(totals.openingLiability + totals.net - totals.paid).toBeCloseTo(totals.outstanding, 2);
  });
});
