// src/modules/staff/staff.mapper.js
// Staff row (+ branch, user) → frontend `StaffMember` type.

import { num, opt } from '../../lib/dto.js';
import { ymd } from '../../lib/dates.js';

const NO_DEDUCTION = { enabled: false, type: 'FIXED', amount: 0 };

/**
 * @param {object} s Staff row with optional `branch` and `user` relations
 * @param {{ redactPay?: boolean }} [opts] hide salary data (accountant view)
 */
export const toStaffDTO = (s, { redactPay = false } = {}) => ({
  id:                   s.id,
  employeeCode:         s.employeeCode,
  branchId:             s.branchId,
  branchName:           opt(s.branch?.name),
  name:                 s.name,
  phone:                s.phone,
  email:                opt(s.email),
  designation:          s.designation,
  roleTitle:            s.roleTitle,
  joiningDate:          ymd(s.joiningDate),

  compensationType:     s.compensationType,
  baseSalary:           redactPay ? 0 : num(s.baseSalary),
  dailySalaryRate:      redactPay ? 0 : num(s.dailySalaryRate),
  commissionRate:       num(s.commissionRate),
  overtimeHourlyRate:   redactPay ? 0 : num(s.overtimeHourlyRate),
  effectiveDate:        ymd(s.effectiveDate),
  requiresCompensationReview: s.requiresCompensationReview,

  startTime:            s.startTime,
  endTime:              s.endTime,
  lateGraceMinutes:     s.lateGraceMinutes,
  earlyGraceMinutes:    s.earlyGraceMinutes,
  isOvernightShift:     s.isOvernightShift,

  allowedLeaveDays:     s.allowedLeaveDays,
  leaveAllowancePeriod: s.leaveAllowancePeriod,

  lateInDeduction:      redactPay ? NO_DEDUCTION : (s.lateInDeduction ?? NO_DEDUCTION),
  earlyExitDeduction:   redactPay ? NO_DEDUCTION : (s.earlyExitDeduction ?? NO_DEDUCTION),
  payrollDivisor:       s.payrollDivisor,
  combinationPolicy:    s.combinationPolicy,

  isActive:             s.isActive,
  exitDate:             s.exitDate ? ymd(s.exitDate) : undefined,
  avatarUrl:            opt(s.avatarUrl),
  specialties:          s.specialties ?? [],
  hasPortalAccess:      s.hasPortalAccess,
  linkedUserId:         opt(s.user?.id),
  linkedUserEmail:      opt(s.user?.email),
  ...(redactPay ? { compensationRedacted: true } : {}),
});
