// src/modules/staff/staff.schema.js

import { z } from 'zod';

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const hhmm = z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:mm');
const nonNeg = (label) => z.number({ message: `${label} must be a number.` }).min(0, `${label} must be a non-negative number.`);

const deduction = z.object({
  enabled: z.boolean(),
  type:    z.enum(['FIXED', 'PERCENTAGE']),
  amount:  z.number().min(0, 'Deduction amount must be non-negative.'),
});

export const compensationType = z.enum([
  'MONTHLY_SALARY', 'DAILY_SALARY', 'MONTHLY_PLUS_COMMISSION', 'DAILY_PLUS_COMMISSION', 'COMMISSION_ONLY',
]);

const profileFields = {
  name:                 z.string().trim().min(1, 'Employee name is required.'),
  phone:                z.string().trim().min(1, 'Phone number is required.'),
  email:                z.string().trim().toLowerCase().email('Invalid email address').optional().or(z.literal('').transform(() => undefined)),
  designation:          z.string().trim().min(1, 'Designation is required.'),
  joiningDate:          ymd,
  compensationType,
  baseSalary:           nonNeg('Base salary'),
  dailySalaryRate:      nonNeg('Daily salary rate'),
  commissionRate:       z.number().min(0, 'Commission rate must be between 0% and 100%.').max(100, 'Commission rate must be between 0% and 100%.'),
  overtimeHourlyRate:   nonNeg('Overtime hourly rate'),
  effectiveDate:        ymd,
  startTime:            hhmm,
  endTime:              hhmm,
  lateGraceMinutes:     z.number().int().min(0, 'Grace periods must be non-negative minute values.'),
  earlyGraceMinutes:    z.number().int().min(0, 'Grace periods must be non-negative minute values.'),
  isOvernightShift:     z.boolean(),
  allowedLeaveDays:     z.number().int().min(0, 'Allowed leave days must be non-negative.'),
  leaveAllowancePeriod: z.enum(['MONTHLY', 'YEARLY']),
  lateInDeduction:      deduction,
  earlyExitDeduction:   deduction,
  payrollDivisor:       z.number().int().min(0),
  combinationPolicy:    z.enum(['BOTH', 'HIGHEST_ONLY']),
  specialties:          z.array(z.string().trim()).max(50),
};

const optionalized = Object.fromEntries(Object.entries(profileFields).map(([k, v]) => [k, v.optional()]));

export const createStaffSchema = z.object({
  ...optionalized,
  name:               profileFields.name,
  phone:              profileFields.phone,
  designation:        profileFields.designation,
  employeeCode:       z.string().trim().optional().transform((s) => (s ? s.toUpperCase() : undefined)),
  branchId:           z.string().optional(),
  enablePortalAccess: z.boolean().optional(),
  portalIdentifier:   z.string().trim().toLowerCase().optional(),
  portalPassword:     z.string().trim().min(6, 'Portal password must be at least 6 characters').optional(),
});

export const updateStaffSchema = z.object({
  ...optionalized,
  branchId: z.string().optional(),
  isActive: z.boolean().optional(),
  exitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Exit date must be YYYY-MM-DD').optional(),
}).passthrough();

export const portalAccessSchema = z.object({
  enable:     z.boolean(),
  identifier: z.string().trim().toLowerCase().optional(),
  password:   z.string().trim().min(6, 'Portal password must be at least 6 characters').optional(),
});

export const listStaffQuery = z.object({
  branchId: z.string().optional(),
  active:   z.enum(['true', 'false']).optional(),
  search:   z.string().optional(),
});
