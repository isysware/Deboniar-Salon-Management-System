// tests/19-daily-payroll.test.js — Daily and Daily + Commission Payroll Flow
import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../src/config/prisma.js';
import { as } from './helpers.js';
import { evaluateEmployeePayroll } from '../src/lib/calculations/payrollCalculations.js';

const POLICY = {
  monthlyAbsenceDivisor: 30,
  dailyStaffPaidLeaveEligibility: true,
  nonWorkedWeeklyOffPaid: false,
  nonWorkedHolidayPaid: true,
  prorationMethod: 'CALENDAR_DAYS',
};

describe('Daily Payroll Flow · Pure Engine Calculations', () => {
  const hamzaStaff = {
    id: 'staff-hamza-daily',
    name: 'Hamza',
    employeeCode: 'EMP-DAILY-01',
    branchId: 'branch-1',
    compensationType: 'DAILY_PLUS_COMMISSION',
    dailySalaryRate: 1000,
    baseSalary: 0,
    overtimeHourlyRate: 300,
    joiningDate: '2026-01-01',
  };

  it('evaluates single-day payroll: Rs. 1,000 daily pay + Rs. 150 approved OT = Rs. 1,150', () => {
    const attendance = [
      {
        id: 'att-1',
        staffId: hamzaStaff.id,
        date: '2026-10-07',
        status: 'PRESENT',
        checkIn: '09:00',
        checkOut: '17:30',
        calculationSnapshot: { totalDeductionAmount: 0 },
      },
    ];
    const overtime = [
      {
        id: 'ot-1',
        staffId: hamzaStaff.id,
        date: '2026-10-07',
        status: 'APPROVED',
        minutes: 30,
        approvedMinutes: 30,
        hourlyRate: 300,
        amount: 150,
      },
    ];

    const result = evaluateEmployeePayroll(
      hamzaStaff,
      '2026-10',
      POLICY,
      attendance,
      overtime,
      [],
      {},
      { startDate: '2026-10-07', endDate: '2026-10-07', runType: 'DAILY' }
    );

    expect(result.canFinalize).toBe(true);
    expect(result.blockReason).toBeUndefined();
    expect(result.payslip.presentDays).toBe(1);
    expect(result.payslip.baseEarnings).toBe(1000);
    expect(result.payslip.approvedOvertimeMinutes).toBe(30);
    expect(result.payslip.approvedOvertimeAmount).toBe(150);
    expect(result.payslip.grossPayable).toBe(1150);
    expect(result.payslip.totalDeductions).toBe(0);
    expect(result.payslip.netPayable).toBe(1150);
    expect(result.payslip.unrecordedDays).toBe(0);
  });

  it('does not trigger missing-attendance errors for future dates outside the single day period', () => {
    // Attendance only on 2026-10-07; dates 2026-10-08 through 2026-10-31 have no attendance
    const attendance = [
      {
        id: 'att-1',
        staffId: hamzaStaff.id,
        date: '2026-10-07',
        status: 'PRESENT',
      },
    ];

    const result = evaluateEmployeePayroll(
      hamzaStaff,
      '2026-10',
      POLICY,
      attendance,
      [],
      [],
      {},
      { startDate: '2026-10-07', endDate: '2026-10-07', runType: 'DAILY' }
    );

    expect(result.canFinalize).toBe(true);
    expect(result.payslip.unrecordedDays).toBe(0);
    expect(result.payslip.exceptionDetails).toBeUndefined();
  });

  it('blocks finalization when there is a genuine missing punch within the selected period', () => {
    const attendance = [
      {
        id: 'att-punch-missing',
        staffId: hamzaStaff.id,
        date: '2026-10-07',
        status: 'MISSING_PUNCH',
        isMissingPunch: true,
        checkIn: '09:00',
        checkOut: null,
      },
    ];

    const result = evaluateEmployeePayroll(
      hamzaStaff,
      '2026-10',
      POLICY,
      attendance,
      [],
      [],
      {},
      { startDate: '2026-10-07', endDate: '2026-10-07', runType: 'DAILY' }
    );

    expect(result.canFinalize).toBe(false);
    expect(result.blockReason).toContain('Unresolved attendance exceptions');
    expect(result.blockReason).toContain('Missing Punch on 2026-10-07');
  });

  it('prorates loan recovery on daily run and does not deduct full monthly installment', () => {
    const attendance = [
      { id: 'att-1', staffId: hamzaStaff.id, date: '2026-10-07', status: 'PRESENT' },
    ];
    const extras = {
      advances: [
        {
          id: 'adv-1',
          advanceNumber: 'ADV-001',
          balance: 10000,
          recoveryPerMonth: 3000, // Monthly installment is 3,000
          recoveredThisMonth: 0,
        },
      ],
    };

    const result = evaluateEmployeePayroll(
      hamzaStaff,
      '2026-10',
      POLICY,
      attendance,
      [],
      [],
      extras,
      { startDate: '2026-10-07', endDate: '2026-10-07', runType: 'DAILY' }
    );

    // 3000 / 30 = 100 daily recovery, NOT the full 3,000!
    expect(result.payslip.advanceRecoveryAmount).toBe(100);
    expect(result.payslip.grossPayable).toBe(1000);
    expect(result.payslip.netPayable).toBe(900); // 1000 - 100
  });

  it('respects monthly recovery cap across multiple daily runs', () => {
    const attendance = [
      { id: 'att-1', staffId: hamzaStaff.id, date: '2026-10-07', status: 'PRESENT' },
    ];
    const extras = {
      advances: [
        {
          id: 'adv-1',
          advanceNumber: 'ADV-001',
          balance: 10000,
          recoveryPerMonth: 3000,
          recoveredThisMonth: 2950, // 2,950 already recovered this month
        },
      ],
    };

    const result = evaluateEmployeePayroll(
      hamzaStaff,
      '2026-10',
      POLICY,
      attendance,
      [],
      [],
      extras,
      { startDate: '2026-10-07', endDate: '2026-10-07', runType: 'DAILY' }
    );

    // Only 50 remaining allowance for this month
    expect(result.payslip.advanceRecoveryAmount).toBe(50);
  });
});

describe('Daily Payroll Flow · Backend API & Integration', () => {
  let dailyStaffId;

  beforeAll(async () => {
    await as('super').put('/system/date', { date: '2026-10-07' });
    // Find or create daily staff member in branch-1
    let dailyStaff = await prisma.staff.findFirst({
      where: { branchId: 'branch-1', compensationType: 'DAILY_PLUS_COMMISSION' },
    });

    if (!dailyStaff) {
      dailyStaff = await prisma.staff.create({
        data: {
          branchId: 'branch-1',
          name: 'Hamza Daily',
          employeeCode: 'EMP-HAMZA-01',
          phone: '+923001239999',
          roleTitle: 'Stylist',
          effectiveDate: new Date('2026-01-01T00:00:00Z'),
          lateInDeduction: { mode: 'NONE' },
          earlyExitDeduction: { mode: 'NONE' },
          specialties: [],
          joiningDate: new Date('2026-01-01T00:00:00Z'),
          compensationType: 'DAILY_PLUS_COMMISSION',
          designation: 'Stylist',
          dailySalaryRate: 1000,
          baseSalary: 0,
          overtimeHourlyRate: 300,
          isActive: true,
        },
      });
    }
    dailyStaffId = dailyStaff.id;

    // Seed attendance and overtime for 2026-10-07
    await prisma.attendanceRecord.upsert({
      where: {
        staffId_workDate: {
          staffId: dailyStaffId,
          workDate: new Date('2026-10-07T00:00:00Z'),
        },
      },
      create: {
        branchId: 'branch-1',
        staffId: dailyStaffId,
        workDate: new Date('2026-10-07T00:00:00Z'),
        checkIn: '09:00 AM',
        checkOut: '06:00 PM',
        status: 'PRESENT',
      },
      update: {
        status: 'PRESENT',
      },
    });

    // Seed approved overtime on 2026-10-07 (30 mins = Rs. 150)
    const existingOt = await prisma.overtimeRecord.findFirst({
      where: {
        staffId: dailyStaffId,
        workDate: new Date('2026-10-07T00:00:00Z'),
      },
    });

    if (!existingOt) {
      await prisma.overtimeRecord.create({
        data: {
          branchId: 'branch-1',
          staffId: dailyStaffId,
          workDate: new Date('2026-10-07T00:00:00Z'),
          overtimeNumber: 'OT-DAILY-REGRESSION',
          enteredByUserId: 'usr-admin-01',
          enteredByName: 'Admin',
          status: 'APPROVED',
          minutes: 30,
          approvedMinutes: 30,
          hourlyRate: 300,
          amount: 150,
          reason: 'Daily test overtime',
        },
      });
    } else {
      await prisma.overtimeRecord.update({
        where: { id: existingOt.id },
        data: {
          status: 'APPROVED',
          payrollRunId: null,
          minutes: 30,
          approvedMinutes: 30,
          hourlyRate: 300,
          amount: 150,
        },
      });
    }
  });

  it('generates single-day preview and finalizes without duplicate errors', async () => {
    const previewRes = await as('admin').post('/payroll/preview', {
      month: '2026-10',
      startDate: '2026-10-07',
      endDate: '2026-10-07',
      runType: 'DAILY',
      staffId: dailyStaffId,
    });

    expect(previewRes.status).toBe(201);
    const run = previewRes.body.data;
    expect(run.status).toBe('DRAFT');
    expect(run.runType).toBe('DAILY');
    expect(run.startDate).toBe('2026-10-07');
    expect(run.endDate).toBe('2026-10-07');

    const slip = run.payslips.find((p) => p.staffId === dailyStaffId);
    expect(slip).toBeDefined();
    expect(slip.canFinalize).toBe(true);
    expect(slip.baseEarnings).toBe(1000);
    expect(slip.approvedOvertimeAmount).toBe(150);
    expect(slip.netPayable).toBe(1150);

    // Finalize
    const finRes = await as('admin').post(`/payroll/runs/${run.id}/finalize`);
    expect(finRes.status).toBe(200);
    expect(finRes.body.data.status).toBe('FINALIZED');
    expect(finRes.body.data.totalPayable).toBe(1150);

    // Verify overtime is locked
    const otCheck = await prisma.overtimeRecord.findFirst({
      where: { staffId: dailyStaffId, workDate: new Date('2026-10-07T00:00:00Z') },
    });
    expect(otCheck.payrollRunId).toBe(run.id);

    // Attempting to finalize an overlapping run covering 2026-10-07 again must be blocked!
    const previewRes2 = await as('admin').post('/payroll/preview', {
      month: '2026-10',
      startDate: '2026-10-07',
      endDate: '2026-10-07',
      runType: 'DAILY',
      staffId: dailyStaffId,
    });
    expect(previewRes2.status).toBe(201);
    const finRes2 = await as('admin').post(`/payroll/runs/${previewRes2.body.data.id}/finalize`);
    expect(finRes2.status).toBe(409); // Conflict: already finalized for 2026-10-07
  });
});
