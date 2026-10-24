// Payroll engine (see payroll.md §3). Originally ported from frontend src/lib/payrollCalculations.ts;
// the backend version is now the source of truth and adds exit proration, daily holiday/weekly-off pay,
// allowances, one-off adjustments and salary-advance recovery. Output keeps the frontend PayslipRecord shape.
import { roundCurrency } from "./taxCalculations.js";
import { isWorkingDay } from "./attendanceCalculations.js";

const PRESENT_STATUSES = ["PRESENT", "ON_TIME", "LATE", "HALF_DAY", "COMPLETED"];

function getCalendarDaysInMonth(yearMonth) {
  const [yearStr, monthStr] = yearMonth.split("-");
  return new Date(parseInt(yearStr, 10), parseInt(monthStr, 10), 0).getDate();
}

const sum = (rows, f = (r) => r.amount) => roundCurrency(rows.reduce((s, r) => s + (Number(f(r)) || 0), 0));
const fmt = (n) => Number(n || 0).toLocaleString();

function getDatesInRange(startStr, endStr) {
  const dates = [];
  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  const curr = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));
  while (curr <= end) {
    dates.push(curr.toISOString().slice(0, 10));
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return dates;
}

/**
 * @param staff        StaffMember DTO (pay terms already resolved for the month; may carry `exitDate`)
 * @param month        'YYYY-MM'
 * @param policy       PayrollPolicy DTO
 * @param attendanceRecords / overtimeRecords / branchHolidays  frontend DTO shapes
 * @param extras       { allowances: [{id,name,amount}], adjustments: [{id,type,title,amount}],
 *                       advances: [{id,advanceNumber,balance,recoveryPerMonth,recoveredThisMonth}] }
 * @param options      { startDate, endDate, runType, alreadyFinalizedDates, alreadyFinalizedOvertimeIds }
 */
function evaluateEmployeePayroll(staff, month, policy, attendanceRecords, overtimeRecords, branchHolidays = [], extras = {}, options = {}) {
  const totalCalendarDays = getCalendarDaysInMonth(month);
  const startDateStr = `${month}-01`;
  const endDateStr = `${month}-${String(totalCalendarDays).padStart(2, "0")}`;
  const exitDate = staff.exitDate || null;
  const employed = (d) => !(staff.joiningDate && staff.joiningDate > d) && !(exitDate && exitDate < d);

  const isMonthly = staff.compensationType === "MONTHLY_SALARY" || staff.compensationType === "MONTHLY_PLUS_COMMISSION";
  const isDaily = staff.compensationType === "DAILY_SALARY" || staff.compensationType === "DAILY_PLUS_COMMISSION";

  // Period range:
  const periodStartDate = options.startDate || startDateStr;
  const selectedEndDate = options.endDate || endDateStr;
  const periodEndDate = options.asOfDate && selectedEndDate > options.asOfDate ? options.asOfDate : selectedEndDate;
  const isPeriodRun = periodStartDate !== startDateStr || periodEndDate !== endDateStr;
  const runType = options.runType || (periodStartDate === periodEndDate ? 'DAILY' : isPeriodRun ? 'CUSTOM_RANGE' : 'MONTHLY');

  // Dates for working days in month (used for policy divisors and base references)
  const allMonthDates = Array.from({ length: totalCalendarDays }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
  const fullMonthStaff = { ...staff, joiningDate: undefined };
  const workingDaysInMonth = allMonthDates.filter((d) => isWorkingDay(d, fullMonthStaff, branchHolidays).isWorking).length;

  // The actual dates evaluated for attendance:
  // For Daily staff in a period run (single day or date range): ONLY evaluate dates in [periodStartDate, periodEndDate]!
  // Future dates outside this range are NOT evaluated, so they do NOT trigger unrecorded attendance exceptions.
  const datesToEvaluate = isPeriodRun
    ? getDatesInRange(periodStartDate, periodEndDate)
    : allMonthDates;

  // Filter attendance for this employee within the evaluation scope
  const empAttendance = attendanceRecords.filter((a) => {
    if (a.staffId !== staff.id) return false;
    if (isPeriodRun) {
      return a.date >= periodStartDate && a.date <= periodEndDate;
    }
    return a.date.startsWith(month);
  });

  let halfDayUnpaidDays = 0;
  let presentDays = 0, paidLeaveDays = 0, unpaidLeaveDays = 0, absentDays = 0, missingPunchDays = 0, unrecordedDays = 0;
  let paidHolidayDays = 0, paidWeeklyOffDays = 0;
  const exceptionDetails = [];
  const overlapDates = [];
  const consumedAttendanceDates = [];
  let attendancePenaltyDeductions = 0;

  for (const dateStr of datesToEvaluate) {
    if (!employed(dateStr)) continue;

    // Check if this date was ALREADY finalized in another payroll run
    if (options.alreadyFinalizedDates?.has(dateStr)) {
      overlapDates.push(dateStr);
      continue;
    }

    const check = isWorkingDay(dateStr, staff, branchHolidays);
    const att = empAttendance.find((a) => a.date === dateStr);
    if (check.isWorking) {
      if (!att) {
        absentDays++;
        unrecordedDays++;
        // No attendance record is an absence; only incomplete recorded punches need resolution.
        continue;
      }
      consumedAttendanceDates.push(dateStr);
      if (att.status === "MISSING_PUNCH" || (att.isMissingPunch && att.status !== 'PRESENT' && att.status !== 'HALF_DAY')) {
        absentDays++;
        missingPunchDays++;
        exceptionDetails.push(`Missing Punch on ${dateStr}.`);
      } else if (att.status === "ABSENT") absentDays++;
      else if (att.status === "PAID_LEAVE") paidLeaveDays++;
      else if (att.status === "UNPAID_LEAVE") unpaidLeaveDays++;
      else {
        presentDays += att.status === 'HALF_DAY' ? 0.5 : 1;
        if (att.status === 'HALF_DAY') halfDayUnpaidDays += 0.5;
        attendancePenaltyDeductions += (att.status === 'HALF_DAY' ? att.calculationSnapshot?.lateDeductionAmount : att.calculationSnapshot?.totalDeductionAmount) || 0;
      }
    } else if (att && att.status !== "HOLIDAY" && att.status !== "OFF_DAY") {
      // Worked (or took leave) on a holiday / weekly off.
      consumedAttendanceDates.push(dateStr);
      if (att.status === "PAID_LEAVE") paidLeaveDays++;
      else if (att.status === "UNPAID_LEAVE") unpaidLeaveDays++;
      else if (PRESENT_STATUSES.includes(att.status)) {
        presentDays += att.status === 'HALF_DAY' ? 0.5 : 1;
        if (att.status === 'HALF_DAY') halfDayUnpaidDays += 0.5;
        attendancePenaltyDeductions += (att.status === 'HALF_DAY' ? att.calculationSnapshot?.lateDeductionAmount : att.calculationSnapshot?.totalDeductionAmount) || 0;
      }
    } else if (check.reason?.startsWith("Holiday")) {
      if (policy.nonWorkedHolidayPaid) paidHolidayDays++;
    } else if (check.reason?.startsWith("Weekly off")) {
      if (policy.nonWorkedWeeklyOffPaid) paidWeeklyOffDays++;
    }
  }
  attendancePenaltyDeductions = roundCurrency(attendancePenaltyDeductions);

  // ── Overtime (approved, not yet locked by a finalized run, within period) ──
  const empOvertime = overtimeRecords.filter((ot) => {
    if (ot.staffId !== staff.id) return false;
    if (ot.status !== "APPROVED" || ot.payrollId || ot.payrollRunId) return false;
    if (!employed(ot.date)) return false;
    if (options.alreadyFinalizedOvertimeIds?.has(ot.id)) return false;
    if (isPeriodRun) {
      return ot.date >= periodStartDate && ot.date <= periodEndDate;
    }
    return ot.date.startsWith(month);
  });

  const hourlyRateSnapshot = staff.overtimeHourlyRate ?? 0;
  let approvedOvertimeMinutes = 0, approvedOvertimeAmount = 0;
  const consumedOvertimeIds = [];
  for (const ot of empOvertime) {
    const mins = ot.approvedMinutes || ot.minutes || 0;
    approvedOvertimeMinutes += mins;
    const rate = ot.hourlyRate ?? hourlyRateSnapshot;
    approvedOvertimeAmount += ot.amount ?? roundCurrency(mins / 60 * rate);
    consumedOvertimeIds.push(ot.id);
  }
  approvedOvertimeAmount = roundCurrency(approvedOvertimeAmount);

  // ── Divisor ──
  let divisorUsed;
  if (isMonthly) divisorUsed = 30;
  else if (staff.payrollDivisor && staff.payrollDivisor > 0) divisorUsed = staff.payrollDivisor;
  else if (typeof policy.customDivisorDays === "number" && policy.customDivisorDays > 0) divisorUsed = policy.customDivisorDays;
  else if (policy.monthlyAbsenceDivisor === 26 || policy.monthlyAbsenceDivisor === 30) divisorUsed = policy.monthlyAbsenceDivisor;
  else if (policy.monthlyAbsenceDivisor === "WORKING_DAYS") divisorUsed = workingDaysInMonth || 26;
  else divisorUsed = totalCalendarDays;

  // ── Basic pay ──
  let isProrated = false, prorationFormula = "";
  let baseEarnings = 0, leaveEarnings = 0, holidayEarnings = 0, absenceDeductions = 0;
  const joinedMidMonth = !!staff.joiningDate && staff.joiningDate > startDateStr && staff.joiningDate <= endDateStr;
  const leftMidMonth = !!exitDate && exitDate >= startDateStr && exitDate < endDateStr;
  const employedDates = datesToEvaluate.filter(employed);
  const effectiveStartDate = employedDates[0] || periodStartDate;
  const effectiveEndDate = employedDates.at(-1) || periodEndDate;
  const prorationDivisor = 30;
  const payableDays = employedDates.length;
  const excludedAttendanceDays = empAttendance.filter((a) => !employed(a.date)).length;

  if (isMonthly) {
    const fullMonthlyBase = staff.baseSalary || 0;
    isProrated = isPeriodRun || joinedMidMonth || leftMidMonth;
    const priorDates = options.alreadyFinalizedDates || new Set();
    const coveredDates = new Set([...priorDates, ...employedDates].filter((d) => d.startsWith(month) && employed(d)));
    const completesMonth = allMonthDates.every(employed) && allMonthDates.every((d) => coveredDates.has(d));
    const priorBase = Number(options.alreadyFinalizedBaseEarnings || 0);
    const target = completesMonth ? fullMonthlyBase : Math.min(fullMonthlyBase, roundCurrency(fullMonthlyBase / 30 * coveredDates.size));
    baseEarnings = roundCurrency(Math.max(0, target - priorBase));
    const rawBase = roundCurrency(fullMonthlyBase / 30 * payableDays);
    const reconciliation = roundCurrency(baseEarnings - rawBase);
    prorationFormula = `PKR ${fmt(fullMonthlyBase)} / 30 ? ${payableDays} eligible days = PKR ${fmt(rawBase)}; monthly reconciliation PKR ${fmt(reconciliation)}; earned base PKR ${fmt(baseEarnings)}`;
    absenceDeductions = roundCurrency(fullMonthlyBase / 30 * (absentDays + unpaidLeaveDays + halfDayUnpaidDays));
  } else if (isDaily) {
    const dailyRate = staff.dailySalaryRate || 0;
    baseEarnings = roundCurrency(dailyRate * presentDays);
    if (policy.dailyStaffPaidLeaveEligibility !== false && paidLeaveDays > 0) leaveEarnings = roundCurrency(dailyRate * paidLeaveDays);
    if (!policy.nonWorkedHolidayPaid) paidHolidayDays = 0;
    if (!policy.nonWorkedWeeklyOffPaid) paidWeeklyOffDays = 0;
    holidayEarnings = roundCurrency(dailyRate * (paidHolidayDays + paidWeeklyOffDays));
  }
  if (!isDaily) { paidHolidayDays = 0; paidWeeklyOffDays = 0; }

  // ── Allowances, one-off adjustments ──
  const daysInPeriod = datesToEvaluate.length;
  const isDailyRun = runType === 'DAILY' || (periodStartDate === periodEndDate);

  const allowanceLines = (extras.allowances || []).map((a) => {
    let amt = roundCurrency(Number(a.amount));
    if (isPeriodRun) {
      if (isMonthly) {
        const span = datesToEvaluate.filter(employed);
        const fraction = policy.prorationMethod === 'WORKING_DAYS'
          ? span.filter((d) => isWorkingDay(d, staff, branchHolidays).isWorking).length / (workingDaysInMonth || 1)
          : span.length / totalCalendarDays;
        amt = roundCurrency(amt * fraction);
      } else amt = roundCurrency((amt / (divisorUsed || 30)) * daysInPeriod);
    }
    return { id: a.id, name: a.name, amount: amt };
  });

  const adjustments = (extras.adjustments || []).map((a) => ({ id: a.id, type: a.type, title: a.title, amount: roundCurrency(Number(a.amount)) }));
  const recurringAllowances = sum(allowanceLines);
  const oneOffAllowances = sum(adjustments.filter((a) => a.type === "ALLOWANCE"));
  const bonusAmount = sum(adjustments.filter((a) => a.type === "BONUS"));
  const otherDeductions = sum(adjustments.filter((a) => a.type === "DEDUCTION"));
  const allowancesTotal = roundCurrency(recurringAllowances + oneOffAllowances + bonusAmount);

  const grossPayable = roundCurrency(baseEarnings + leaveEarnings + holidayEarnings + approvedOvertimeAmount + allowancesTotal);
  const preAdvanceDeductions = roundCurrency(absenceDeductions + attendancePenaltyDeductions + otherDeductions);

  // ── Advance recovery: planned installment, capped by monthly balance and already-recovered amounts ──
  let room = Math.max(0, roundCurrency(grossPayable - preAdvanceDeductions));
  const advanceRecoveries = [];
  for (const adv of extras.advances || []) {
    const recoveredThisMonth = Number(adv.recoveredThisMonth || 0);
    const maxMonthlyAllowance = Math.max(0, Number(adv.recoveryPerMonth) - recoveredThisMonth);
    if (maxMonthlyAllowance <= 0) continue; // Already fully recovered for this month!

    let planned;
    if (isDailyRun) {
      const dailyInstallment = roundCurrency(Number(adv.recoveryPerMonth) / (divisorUsed || 30));
      planned = Math.min(dailyInstallment, maxMonthlyAllowance, Number(adv.balance));
    } else if (isPeriodRun) {
      const rangeInstallment = roundCurrency((Number(adv.recoveryPerMonth) / (divisorUsed || 30)) * daysInPeriod);
      planned = Math.min(rangeInstallment, maxMonthlyAllowance, Number(adv.balance));
    } else {
      planned = Math.min(maxMonthlyAllowance, Number(adv.balance));
    }
    if (isPeriodRun && options.alreadyFinalizedDates?.size) {
      const covered = new Set([...options.alreadyFinalizedDates, ...employedDates].filter((d) => d.startsWith(month) && employed(d)));
      const complete = allMonthDates.every((d) => !employed(d) || covered.has(d));
      const scheduled = complete ? Number(adv.recoveryPerMonth)
        : roundCurrency(Number(adv.recoveryPerMonth) / 30 * covered.size);
      planned = Math.min(Math.max(0, scheduled - recoveredThisMonth), maxMonthlyAllowance, Number(adv.balance));
    }

    const amt = roundCurrency(Math.min(planned, room));
    if (amt > 0) {
      advanceRecoveries.push({
        advanceId: adv.id,
        advanceNumber: adv.advanceNumber,
        amount: amt,
        balanceBefore: Number(adv.balance),
        balanceAfter: roundCurrency(Number(adv.balance) - amt),
      });
      room = roundCurrency(room - amt);
    }
  }
  const advanceRecoveryAmount = sum(advanceRecoveries);

  const totalDeductions = roundCurrency(preAdvanceDeductions + advanceRecoveryAmount);
  const netPayable = roundCurrency(grossPayable - totalDeductions);
  const attendanceImpact = roundCurrency(-(absenceDeductions + attendancePenaltyDeductions));

  let canFinalize = true, blockReason;
  if (overlapDates.length) {
    canFinalize = false;
    blockReason = `Salary days have already been paid or reserved in an earlier finalized payroll run: ${overlapDates.join(', ')}.`;
  }
  const hasExceptions = exceptionDetails.length > 0;
  if (hasExceptions) {
    canFinalize = false;
    blockReason = `Unresolved attendance exceptions: ${exceptionDetails.join(' ')}`;
  }
  if (netPayable < 0) {
    canFinalize = false;
    blockReason = `Negative salary entitlement detected (PKR ${netPayable}). Deductions exceed gross earnings. Review penalties/adjustments before finalization.`;
  }

  const extrasText = ` + Allowances (PKR ${fmt(allowancesTotal)}) - Other Deductions (PKR ${fmt(otherDeductions)}) - Advance Recovery (PKR ${fmt(advanceRecoveryAmount)})`;
  let formula;
  if (isMonthly) {
    formula = `${prorationFormula}. Base Salary (PKR ${fmt(baseEarnings)}) - Absences (${absentDays + unpaidLeaveDays + halfDayUnpaidDays}d @ PKR ${fmt(roundCurrency((staff.baseSalary || 0) / divisorUsed))}/d = PKR ${fmt(absenceDeductions)}) - Penalties (PKR ${fmt(attendancePenaltyDeductions)}) + Overtime (${approvedOvertimeMinutes}m @ PKR ${fmt(hourlyRateSnapshot)}/hr = PKR ${fmt(approvedOvertimeAmount)})${extrasText} = Net PKR ${fmt(netPayable)}`;
  } else if (isDaily) {
    formula = `Daily Rate (PKR ${fmt(staff.dailySalaryRate)} × ${presentDays} present days = PKR ${fmt(baseEarnings)}) + Paid Leave (${paidLeaveDays}d = PKR ${fmt(leaveEarnings)}) + Holidays/Weekly Off (${paidHolidayDays + paidWeeklyOffDays}d = PKR ${fmt(holidayEarnings)}) - Penalties (PKR ${fmt(attendancePenaltyDeductions)}) + Overtime (PKR ${fmt(approvedOvertimeAmount)})${extrasText} = Net PKR ${fmt(netPayable)}`;
  } else {
    formula = `Commission-Only Contract: Base Salary = PKR 0. Approved Overtime = PKR ${fmt(approvedOvertimeAmount)}${extrasText}. Net PKR ${fmt(netPayable)}. Commission earned is processed separately.`;
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
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
      runType,
      daysInPeriod: employedDates.length,
      compensationType: staff.compensationType,
      effectiveBaseSalary: staff.baseSalary || 0,
      effectiveDailyRate: staff.dailySalaryRate || 0,
      termsEffectiveDate: staff.effectiveDate,
      joiningDate: staff.joiningDate,
      employmentNotes: excludedAttendanceDays > 0
        ? [`${excludedAttendanceDays} attendance record(s) outside employment dates excluded. Verify joining/exit dates before finalizing.`] : [],
      exitDate: exitDate || undefined,
      workingDaysInMonth,
      calendarDaysInMonth: totalCalendarDays,
      presentDays,
      halfDayDays: halfDayUnpaidDays * 2,
      lateDays: empAttendance.filter(a => consumedAttendanceDates.includes(a.date) && a.isLate).length,
      earlyExitDays: empAttendance.filter(a => consumedAttendanceDates.includes(a.date) && a.isEarlyExit).length,
      paidLeaveDays,
      unpaidLeaveDays,
      absentDays,
      paidHolidayDays,
      paidWeeklyOffDays,
      missingPunchDays,
      unrecordedDays,
      hasExceptions,
      exceptionDetails: hasExceptions ? exceptionDetails : void 0,
      baseEarnings,
      leaveEarnings,
      holidayEarnings,
      absenceDeductions,
      lateEarlyDeductions: attendancePenaltyDeductions,
      attendancePenaltyDeductions,
      attendanceImpact,
      approvedOvertimeMinutes,
      approvedOvertimeHourlyRate: hourlyRateSnapshot,
      approvedOvertimeAmount,
      consumedOvertimeIds,
      consumedAttendanceDates,
      allowanceLines,
      adjustments,
      recurringAllowances,
      oneOffAllowances,
      bonusAmount,
      allowancesTotal,
      otherDeductions,
      advanceRecoveries,
      advanceRecoveryAmount,
      grossPayable,
      totalDeductions,
      netPayable,
      paidAmount: 0,
      outstandingAmount: Math.max(0, netPayable),
      calculationDetails: {
        formula,
        monthlyCalculationVersion: isMonthly ? 2 : undefined,
        divisorUsed,
        payableDays: isMonthly ? payableDays : presentDays + paidLeaveDays + paidHolidayDays + paidWeeklyOffDays,
        prorationDivisor: isMonthly ? prorationDivisor : undefined,
        prorationDays: isMonthly ? payableDays : undefined,
        prorationApplied: isProrated,
        prorationFormula: isMonthly ? prorationFormula : void 0,
        dailyRateUsed: isDaily ? (staff.dailySalaryRate || 0) : roundCurrency((staff.baseSalary || 0) / divisorUsed),
        periodType: runType,
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
        policyNotes: `Policy Divisor: /${divisorUsed}. Daily Leave Eligible: ${policy.dailyStaffPaidLeaveEligibility}. Holiday Paid (daily): ${!!policy.nonWorkedHolidayPaid}. Weekly Off Paid (daily): ${!!policy.nonWorkedWeeklyOffPaid}. Proration: ${isMonthly ? "FIXED_30_WITH_MONTHLY_RECONCILIATION" : policy.prorationMethod}.`
      }
    }
  };
}

/**
 * Pay terms in force on `onDate` (YYYY-MM-DD). `history` rows hold the PREVIOUS terms with the date
 * those terms started; the current staff row holds terms starting at `staff.effectiveDate`.
 */
function resolveTermsAt(staff, history, onDate) {
  if (!staff.effectiveDate || staff.effectiveDate <= onDate || !history?.length) return staff;
  const older = [...history].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
  const hit = older.find((h) => h.effectiveDate <= onDate) || older[older.length - 1];
  return { ...staff, ...hit.snapshot, effectiveDate: hit.effectiveDate };
}

export {
  evaluateEmployeePayroll,
  getCalendarDaysInMonth,
  getDatesInRange,
  resolveTermsAt
};
