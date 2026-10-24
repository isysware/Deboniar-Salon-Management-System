import {
  StaffMember,
  AttendanceRecord,
  OvertimeRecord,
  PayrollPolicyConfig,
  PayslipRecord,
  BranchHoliday,
} from '../types/salon';
import { roundCurrency } from './taxCalculations';
import { isWorkingDay } from './attendanceCalculations';

export interface EvaluateEmployeePayrollResult {
  payslip: Omit<PayslipRecord, 'id' | 'payrollRunId' | 'payslipNumber' | 'status' | 'payments'>;
  canFinalize: boolean;
  blockReason?: string;
}

/**
 * Returns total calendar days in a given YYYY-MM month.
 */
export function getCalendarDaysInMonth(yearMonth: string): number {
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  return new Date(year, month, 0).getDate();
}

/**
 * Evaluates monthly payroll for a single staff member against canonical attendance, leaves, and approved overtime.
 */
export function evaluateEmployeePayroll(
  staff: StaffMember,
  month: string, // YYYY-MM
  policy: PayrollPolicyConfig,
  attendanceRecords: AttendanceRecord[],
  overtimeRecords: OvertimeRecord[],
  branchHolidays: BranchHoliday[] = []
): EvaluateEmployeePayrollResult {
  const totalCalendarDays = getCalendarDaysInMonth(month);
  const startDateStr = `${month}-01`;
  const endDateStr = `${month}-${String(totalCalendarDays).padStart(2, '0')}`;

  // 1. Calculate working days in month
  let workingDaysInMonth = 0;
  for (let day = 1; day <= totalCalendarDays; day++) {
    const dStr = `${month}-${String(day).padStart(2, '0')}`;
    const check = isWorkingDay(dStr, staff, branchHolidays);
    if (check.isWorking) workingDaysInMonth++;
  }

  // 2. Filter canonical attendance for this employee in this month
  const empAttendance = attendanceRecords.filter(
    (a) => a.staffId === staff.id && a.date.startsWith(month)
  );

  let halfDayUnpaidDays = 0;
  let presentDays = 0;
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  let absentDays = 0;
  let missingPunchDays = 0;
  let unrecordedDays = 0;
  const exceptionDetails: string[] = [];
  const consumedAttendanceDates: string[] = [];
  let attendancePenaltyDeductions = 0;

  for (let day = 1; day <= totalCalendarDays; day++) {
    const dateStr = `${month}-${String(day).padStart(2, '0')}`;
    const check = isWorkingDay(dateStr, staff, branchHolidays);

    // If staff joined after this date, skip
    if (staff.joiningDate && staff.joiningDate > dateStr) {
      continue;
    }

    const att = empAttendance.find((a) => a.date === dateStr);

    if (check.isWorking) {
      if (!att) {
        // Missing attendance on scheduled working day -> treated as Absent
        absentDays++;
        unrecordedDays++;
      } else {
        consumedAttendanceDates.push(dateStr);
        if (att.status === 'MISSING_PUNCH' || (att.isMissingPunch && att.status !== 'PRESENT' && att.status !== 'HALF_DAY')) {
          absentDays++;
          missingPunchDays++;
        } else if (att.status === 'ABSENT') {
          absentDays++;
        } else if (att.status === 'PAID_LEAVE') {
          paidLeaveDays++;
        } else if (att.status === 'UNPAID_LEAVE') {
          unpaidLeaveDays++;
        } else {
          // PRESENT / ON_TIME / LATE / EARLY_EXIT
          presentDays += att.status === 'HALF_DAY' ? 0.5 : 1;
        if (att.status === 'HALF_DAY') halfDayUnpaidDays += 0.5;
          // Only add penalty deductions on days where employee actually worked
          if (att.calculationSnapshot?.totalDeductionAmount) {
            attendancePenaltyDeductions += (att.status === 'HALF_DAY' ? att.calculationSnapshot.lateDeductionAmount : att.calculationSnapshot.totalDeductionAmount) || 0;
          }
        }
      }
    } else {
      // Non-working day (Weekly off or Holiday)
      if (att) {
        consumedAttendanceDates.push(dateStr);
        if (att.status === 'PAID_LEAVE') {
          paidLeaveDays++;
        } else if (att.status === 'UNPAID_LEAVE') {
          unpaidLeaveDays++;
        } else if (
          att.status === 'PRESENT' ||
          att.status === 'ON_TIME' ||
          att.status === 'LATE' ||
          att.status === 'HALF_DAY' ||
          att.status === 'COMPLETED'
        ) {
          presentDays += att.status === 'HALF_DAY' ? 0.5 : 1;
        if (att.status === 'HALF_DAY') halfDayUnpaidDays += 0.5;
          if (att.calculationSnapshot?.totalDeductionAmount) {
            attendancePenaltyDeductions += (att.status === 'HALF_DAY' ? att.calculationSnapshot.lateDeductionAmount : att.calculationSnapshot.totalDeductionAmount) || 0;
          }
        }
      }
    }
  }

  // 3. Approved overtime for this employee in this month
  const empOvertime = overtimeRecords.filter(
    (ot) =>
      ot.staffId === staff.id &&
      ot.date.startsWith(month) &&
      ot.status === 'APPROVED' &&
      !ot.payrollId
  );

  let approvedOvertimeMinutes = 0;
  let approvedOvertimeAmount = 0;
  const consumedOvertimeIds: string[] = [];
  const hourlyRateSnapshot = staff.overtimeHourlyRate ?? 0;

  for (const ot of empOvertime) {
    approvedOvertimeMinutes += ot.approvedMinutes || ot.minutes || 0;
    const rate = ot.hourlyRate !== undefined && ot.hourlyRate !== null ? ot.hourlyRate : hourlyRateSnapshot;
    approvedOvertimeAmount += ot.amount !== undefined && ot.amount !== null
      ? ot.amount
      : roundCurrency(((ot.approvedMinutes || ot.minutes || 0) / 60) * rate);
    consumedOvertimeIds.push(ot.id);
  }
  approvedOvertimeAmount = roundCurrency(approvedOvertimeAmount);

  // 4. Resolve divisor for monthly deductions
  let divisorUsed: number;
  if (staff.compensationType.startsWith('MONTHLY')) divisorUsed = 30;
  else if (staff.payrollDivisor && staff.payrollDivisor > 0) {
    divisorUsed = staff.payrollDivisor;
  } else if (typeof policy.customDivisorDays === 'number' && policy.customDivisorDays > 0) {
    divisorUsed = policy.customDivisorDays;
  } else if (policy.monthlyAbsenceDivisor === 26 || policy.monthlyAbsenceDivisor === 30) {
    divisorUsed = policy.monthlyAbsenceDivisor;
  } else if (policy.monthlyAbsenceDivisor === 'WORKING_DAYS') {
    divisorUsed = workingDaysInMonth || 26;
  } else {
    // 'CALENDAR_DAYS'
    divisorUsed = totalCalendarDays;
  }

  // 5. Proration check for joining mid-month
  let isProrated = false;
  let prorationFormula = '';
  let baseEarnings = 0;
  let leaveEarnings = 0;
  let absenceDeductions = 0;

  const joinedMidMonth = staff.joiningDate && staff.joiningDate.startsWith(month) && staff.joiningDate > startDateStr;

  if (staff.compensationType === 'MONTHLY_SALARY' || staff.compensationType === 'MONTHLY_PLUS_COMMISSION') {
    const fullMonthlyBase = staff.baseSalary || 0;

    if (joinedMidMonth) {
      isProrated = true;
      const joinDay = parseInt(staff.joiningDate.slice(8, 10), 10);
      const daysEmployed = totalCalendarDays - joinDay + 1;

      baseEarnings = roundCurrency(Math.min(fullMonthlyBase, fullMonthlyBase / 30 * daysEmployed));
      prorationFormula = `PKR ${fullMonthlyBase} / 30 ? ${daysEmployed} eligible days = PKR ${baseEarnings}`;
    } else {
      // Full employed month: Monthly base salary is the FULL configured monthly amount.
      baseEarnings = fullMonthlyBase;
    }

    // Absence / Unpaid leave deduction
    const dailyDeductionRate = roundCurrency(fullMonthlyBase / divisorUsed);
    const unworkedDeductibleDays = absentDays + unpaidLeaveDays + halfDayUnpaidDays;
    absenceDeductions = roundCurrency(fullMonthlyBase / 30 * unworkedDeductibleDays);

  } else if (staff.compensationType === 'DAILY_SALARY' || staff.compensationType === 'DAILY_PLUS_COMMISSION') {
    const dailyRate = staff.dailySalaryRate || 0;
    const paidLeaveEligible = policy.dailyStaffPaidLeaveEligibility !== false;

    // Daily staff earn for present days and eligible paid leave
    baseEarnings = roundCurrency(dailyRate * presentDays);
    if (paidLeaveEligible && paidLeaveDays > 0) {
      leaveEarnings = roundCurrency(dailyRate * paidLeaveDays);
    }
    // Non-worked unpaid days / off days earn zero: do NOT deduct them again!
    absenceDeductions = 0;

  } else {
    // COMMISSION_ONLY
    baseEarnings = 0;
    leaveEarnings = 0;
    absenceDeductions = 0;
    // Overtime may still be payable if rate is configured
  }

  const grossPayable = roundCurrency(baseEarnings + leaveEarnings + approvedOvertimeAmount);
  const totalDeductions = roundCurrency(absenceDeductions + attendancePenaltyDeductions);
  const netPayable = roundCurrency(grossPayable - totalDeductions);

  // 6. Validation & Blocking Rules
  let canFinalize = true;
  let blockReason: string | undefined;

  const hasExceptions = exceptionDetails.length > 0;
  if (netPayable < 0) {
    canFinalize = false;
    blockReason = `Negative salary entitlement detected (PKR ${netPayable}). Deductions exceed gross earnings. Review penalties before finalization.`;
  }

  // Calculation details formula text
  let formula = '';
  if (staff.compensationType === 'MONTHLY_SALARY' || staff.compensationType === 'MONTHLY_PLUS_COMMISSION') {
    formula = `Base Salary (PKR ${baseEarnings.toLocaleString()}) - Absences (${absentDays + unpaidLeaveDays + halfDayUnpaidDays}d @ PKR ${roundCurrency((staff.baseSalary || 0) / divisorUsed).toLocaleString()}/d = PKR ${absenceDeductions.toLocaleString()}) - Penalties (PKR ${attendancePenaltyDeductions.toLocaleString()}) + Overtime (${approvedOvertimeMinutes}m @ PKR ${(staff.overtimeHourlyRate ?? 0).toLocaleString()}/hr = PKR ${approvedOvertimeAmount.toLocaleString()}) = Net PKR ${netPayable.toLocaleString()}`;
  } else if (staff.compensationType === 'DAILY_SALARY' || staff.compensationType === 'DAILY_PLUS_COMMISSION') {
    formula = `Daily Rate (PKR ${staff.dailySalaryRate} × ${presentDays} present days = PKR ${baseEarnings.toLocaleString()}) + Paid Leave (${paidLeaveDays}d = PKR ${leaveEarnings.toLocaleString()}) - Penalties (PKR ${attendancePenaltyDeductions.toLocaleString()}) + Overtime (PKR ${approvedOvertimeAmount.toLocaleString()}) = Net PKR ${netPayable.toLocaleString()}`;
  } else {
    formula = `Commission-Only Contract: Base Salary = PKR 0. Approved Overtime = PKR ${approvedOvertimeAmount.toLocaleString()}. Net PKR ${netPayable.toLocaleString()}. Commission earned is processed separately.`;
  }

  return {
    canFinalize,
    blockReason,
    payslip: {
      staffId: staff.id,
      staffName: staff.name,
      employeeCode: staff.employeeCode,
      designation: staff.designation || staff.roleTitle,
      branchId: staff.branchId,
      month,
      compensationType: staff.compensationType,
      effectiveBaseSalary: staff.baseSalary || 0,
      effectiveDailyRate: staff.dailySalaryRate || 0,
      workingDaysInMonth,
      calendarDaysInMonth: totalCalendarDays,
      presentDays,
      halfDayDays: halfDayUnpaidDays * 2,
      lateDays: empAttendance.filter(a => consumedAttendanceDates.includes(a.date) && a.isLate).length,
      earlyExitDays: empAttendance.filter(a => consumedAttendanceDates.includes(a.date) && a.isEarlyExit).length,
      paidLeaveDays,
      unpaidLeaveDays,
      absentDays,
      missingPunchDays,
      unrecordedDays,
      hasExceptions,
      exceptionDetails: hasExceptions ? exceptionDetails : undefined,
      baseEarnings,
      leaveEarnings,
      absenceDeductions,
      lateEarlyDeductions: attendancePenaltyDeductions,
      attendancePenaltyDeductions,
      approvedOvertimeMinutes,
      approvedOvertimeHourlyRate: hourlyRateSnapshot,
      approvedOvertimeAmount,
      consumedOvertimeIds,
      consumedAttendanceDates,
      grossPayable,
      totalDeductions,
      netPayable,
      paidAmount: 0,
      outstandingAmount: Math.max(0, netPayable),
      calculationDetails: {
        formula,
        divisorUsed,
        prorationApplied: isProrated,
        prorationFormula: isProrated ? prorationFormula : undefined,
        dailyRateUsed: roundCurrency((staff.baseSalary || 0) / divisorUsed),
        policyNotes: `Policy Divisor: /${divisorUsed}. Daily Leave Eligible: ${policy.dailyStaffPaidLeaveEligibility}. Proration: ${policy.prorationMethod}.`,
      },
    },
  };
}
