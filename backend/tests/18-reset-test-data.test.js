import { describe, it, expect } from 'vitest';
import prisma from '../src/config/prisma.js';
import { resetTestData } from '../src/modules/settings/settings.service.js';

describe('Test Data Reset · Staff Loans & Payroll Flow', () => {
  it('wipes loans (SalaryAdvance), recoveries, payroll runs, payslips, payments, and adjustments', async () => {
    // Dedicated isolated test branch
    const branchCode = `RST-${Date.now().toString().slice(-4)}`;
    const branch = await prisma.branch.create({
      data: {
        code: branchCode,
        name: `Reset Test Branch ${branchCode}`,
        phone: '+923000000000',
        city: 'Lahore',
        address: 'Test Address',
        taxRate: 0.16,
      },
    });
    const branchId = branch.id;
    const actorSuper = { id: 'usr-super-01', name: 'Super Admin', role: 'SUPER_ADMIN', branchId: null };

    // 1. Create a dummy test staff for this branch
    const staff = await prisma.staff.create({
      data: {
        employeeCode: `EMP-${branchCode}`,
        branchId,
        name: 'Reset Test Employee',
        phone: '+923001234999',
        designation: 'Stylist',
        roleTitle: 'Hair Stylist',
        joiningDate: new Date('2026-01-01'),
        compensationType: 'MONTHLY_SALARY',
        baseSalary: 30000,
        dailySalaryRate: 1000,
        effectiveDate: new Date('2026-01-01'),
        lateInDeduction: {},
        earlyExitDeduction: {},
        specialties: [],
      },
    });

    // 2. Create a test SalaryAdvance
    const adv = await prisma.salaryAdvance.create({
      data: {
        advanceNumber: `ADV-RESET-${Date.now()}`,
        branchId,
        staffId: staff.id,
        staffName: staff.name,
        amount: 5000,
        recoveryPerMonth: 2500,
        startMonth: '2026-10',
        method: 'CASH',
        reason: 'Reset test loan',
        issueDate: new Date(),
        issuedByUserId: actorSuper.id,
        issuedByName: actorSuper.name,
      },
    });

    // 3. Create a test PayrollRun, Payslip, and PayrollPayment
    const run = await prisma.payrollRun.create({
      data: {
        payrollNumber: `PAY-RESET-${Date.now()}`,
        branchId,
        month: '2026-10',
        status: 'FINALIZED',
        policySnapshot: {},
        generatedByUserId: actorSuper.id,
        generatedByName: actorSuper.name,
      },
    });

    const slip = await prisma.payslip.create({
      data: {
        runId: run.id,
        payslipNumber: `PS-RESET-${Date.now()}`,
        staffId: staff.id,
        snapshot: {},
        grossPayable: 30000,
        netPayable: 27500,
      },
    });

    const payment = await prisma.payrollPayment.create({
      data: {
        paymentNumber: `PAYMT-RESET-${Date.now()}`,
        runId: run.id,
        payslipId: slip.id,
        staffId: staff.id,
        staffName: staff.name,
        branchId,
        amount: 27500,
        method: 'CASH',
        paidByUserId: actorSuper.id,
        paidByName: actorSuper.name,
      },
    });

    // 4. Create an AdvanceRecovery linked to the advance and payroll run
    const recovery = await prisma.advanceRecovery.create({
      data: {
        advanceId: adv.id,
        payrollRunId: run.id,
        staffId: staff.id,
        month: '2026-10',
        amount: 2500,
      },
    });

    // 5. Create a PayrollAdjustment
    const adj = await prisma.payrollAdjustment.create({
      data: {
        branchId,
        staffId: staff.id,
        month: '2026-10',
        type: 'BONUS',
        title: 'Festival Bonus',
        amount: 1000,
        createdByUserId: actorSuper.id,
        createdByName: actorSuper.name,
      },
    });

    // Verify records exist before reset
    expect(await prisma.salaryAdvance.findUnique({ where: { id: adv.id } })).not.toBeNull();
    expect(await prisma.advanceRecovery.findUnique({ where: { id: recovery.id } })).not.toBeNull();
    expect(await prisma.payrollRun.findUnique({ where: { id: run.id } })).not.toBeNull();
    expect(await prisma.payslip.findUnique({ where: { id: slip.id } })).not.toBeNull();
    expect(await prisma.payrollPayment.findUnique({ where: { id: payment.id } })).not.toBeNull();
    expect(await prisma.payrollAdjustment.findUnique({ where: { id: adj.id } })).not.toBeNull();

    // 6. Execute resetTestData
    const result = await resetTestData({ branchId }, actorSuper);
    expect(result.success).toBe(true);

    // 7. Verify all loan and payroll records are deleted
    expect(await prisma.salaryAdvance.findUnique({ where: { id: adv.id } })).toBeNull();
    expect(await prisma.advanceRecovery.findUnique({ where: { id: recovery.id } })).toBeNull();
    expect(await prisma.payrollRun.findUnique({ where: { id: run.id } })).toBeNull();
    expect(await prisma.payslip.findUnique({ where: { id: slip.id } })).toBeNull();
    expect(await prisma.payrollPayment.findUnique({ where: { id: payment.id } })).toBeNull();
    expect(await prisma.payrollAdjustment.findUnique({ where: { id: adj.id } })).toBeNull();
  });
});
