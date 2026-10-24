// tests/32-manual-deduction.test.js
// Verifies that ADMIN and SUPER_ADMIN can apply manual deductions on generated employee payslips
// (e.g. for missed punch, late penalties, or disciplinary cuts) after salary generation.

import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../src/config/prisma.js';
import { as } from './helpers.js';

const MONTH = '2026-05';

const augustAttendance = () => {
  const rows = [];
  let n = 1;
  for (let d = 1; d <= 31; d++) {
    const date = `${MONTH}-${String(d).padStart(2, '0')}`;
    if (new Date(`${date}T12:00:00Z`).getUTCDay() === 0) continue;
    for (const code of ['EMP-LHE-001', 'EMP-LHE-002', 'EMP-LHE-003']) {
      rows.push({
        rowNumber: n++,
        employeeCode: code,
        date,
        checkIn: '09:00 AM',
        checkOut: '06:00 PM',
      });
    }
  }
  return rows;
};

describe('Manual Salary Deductions on Generated Payslips', () => {
  let run;
  let payslip;

  beforeAll(async () => {
    // Import attendance for August
    await as('admin').post('/attendance/import-csv', { rows: augustAttendance() });

    // Generate preview
    const previewRes = await as('admin').post('/payroll/preview', { month: MONTH, staffId: 'staff-1' });
    expect(previewRes.status).toBe(201);

    run = previewRes.body.data;
    payslip = run.payslips.find((p) => p.employeeCode === 'EMP-LHE-001');
    expect(payslip).toBeDefined();
    expect(payslip.netPayable).toBeGreaterThan(0);
  });

  it('blocks accountant and staff from applying manual deductions', async () => {
    const accountantRes = await as('accountant').post(`/payroll/payslips/${payslip.id}/deductions`, {
      amount: 500,
      title: 'Missed punch penalty',
    });
    expect(accountantRes.status).toBe(403);

    const staffRes = await as('staff').post(`/payroll/payslips/${payslip.id}/deductions`, {
      amount: 500,
      title: 'Missed punch penalty',
    });
    expect(staffRes.status).toBe(403);
  });

  it('rejects deduction from an admin of a different branch', async () => {
    const res = await as('adminKhi').post(`/payroll/payslips/${payslip.id}/deductions`, {
      amount: 500,
      title: 'Disciplinary deduction',
    });
    expect(res.status).toBe(403);
  });

  it('validates amount: rejects non-positive and exceeding outstanding amount', async () => {
    const zeroRes = await as('admin').post(`/payroll/payslips/${payslip.id}/deductions`, {
      amount: 0,
      title: 'Zero cut',
    });
    expect(zeroRes.status).toBe(400);

    const excessiveRes = await as('admin').post(`/payroll/payslips/${payslip.id}/deductions`, {
      amount: payslip.outstandingAmount + 50000,
      title: 'Too high cut',
    });
    expect(excessiveRes.status).toBe(400);
  });

  it('successfully applies manual deduction and updates net payable and deductions', async () => {
    const initialNet = payslip.netPayable;
    const initialOutstanding = payslip.outstandingAmount;
    const initialOtherDeductions = payslip.otherDeductions || 0;
    const deductionAmount = 1500;

    const res = await as('admin').post(`/payroll/payslips/${payslip.id}/deductions`, {
      amount: deductionAmount,
      title: 'Missed punch & late penalty',
      notes: 'Forgot punch on 2026-08-12 and unapproved late exit',
    });

    expect(res.status).toBe(201);
    const updatedPs = res.body.data.payslip;
    const updatedRun = res.body.data.payrollRun;

    expect(updatedPs.netPayable).toBe(initialNet - deductionAmount);
    expect(updatedPs.outstandingAmount).toBe(initialOutstanding - deductionAmount);
    expect(updatedPs.otherDeductions).toBe(initialOtherDeductions + deductionAmount);
    expect(updatedPs.adjustments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'DEDUCTION',
          title: 'Missed punch & late penalty',
          amount: deductionAmount,
        }),
      ])
    );

    // Verify run totals updated
    expect(updatedRun.totalPayable).toBe(run.totalPayable - deductionAmount);
    expect(updatedRun.totalOutstanding).toBe(run.totalOutstanding - deductionAmount);

    // Verify adjustment saved in DB
    const dbAdjustment = await prisma.payrollAdjustment.findFirst({
      where: {
        staffId: payslip.staffId,
        month: MONTH,
        type: 'DEDUCTION',
        title: 'Missed punch & late penalty',
      },
    });
    expect(dbAdjustment).toBeDefined();
    expect(Number(dbAdjustment.amount)).toBe(deductionAmount);
    expect(dbAdjustment.payrollRunId).toBeNull();

    // Verify audit log
    const audit = await prisma.auditEvent.findFirst({
      where: {
        action: 'PAYROLL_MANUAL_DEDUCTION_ADDED',
        entityId: payslip.id,
      },
    });
    expect(audit).toBeDefined();

    // Finalization recalculates from the persisted adjustment and freezes it.
    const finalized = await as('admin').post(`/payroll/runs/${run.id}/finalize`);
    expect(finalized.status, JSON.stringify(finalized.body)).toBe(200);
    const frozen = finalized.body.data.payslips.find(p => p.staffId === payslip.staffId);
    expect(frozen.netPayable).toBe(updatedPs.netPayable);
    expect((await prisma.payrollAdjustment.findUnique({ where: { id: dbAdjustment.id } })).payrollRunId).toBe(run.id);
    const lateChange = await as('admin').post(`/payroll/payslips/${frozen.id}/deductions`, { amount: 1, title: 'Late deduction' });
    expect(lateChange.status).toBe(409);
    expect(lateChange.body.error.code).toBe('PAYROLL_IMMUTABLE');
    // Now record payment on the remaining net amount
    const payRes = await as('admin').post('/payroll/payments', {
      payrollRunId: run.id,
      payslipId: frozen.id,
      amount: updatedPs.outstandingAmount,
      method: 'ONLINE',
      onlineAccountId: 'acc-1',
      reference: 'Final cleared after manual deduction',
    }, { 'Idempotency-Key': 'pay-manual-ded-cleared' });
    expect(payRes.status).toBe(201);
    expect(payRes.body.data.payrollRun.payslips.find((p) => p.id === frozen.id).outstandingAmount).toBe(0);
  });
});
