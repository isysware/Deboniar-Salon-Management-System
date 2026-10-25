// src/modules/branches/branches.schema.js

import { z } from 'zod';

const optText = z.string().trim().optional();

export const createBranchSchema = z.object({
  name:     z.string().trim().min(1, 'Branch name and unique branch code are required.'),
  code:     optText.transform((s) => (s ? s.toUpperCase() : undefined)),
  address:  optText,
  city:     optText,
  phone:    optText,
  email:    z.string().trim().email('Invalid email address').optional().or(z.literal('').transform(() => undefined)),
  timezone: optText,
  currency: optText,
  taxRegistrationNumber: optText,
  taxAuthority:          optText,
  logoUrl:               z.string().nullable().optional(),
}).passthrough(); // frontend also sends taxRate/openingCashFloat/isActive — ignored on create by design

export const updateBranchSchema = z.object({
  name:     optText,
  code:     optText.transform((s) => (s ? s.toUpperCase() : s)),
  address:  optText,
  city:     optText,
  phone:    optText,
  email:    z.string().trim().email('Invalid email address').optional().or(z.literal('').transform(() => undefined)),
  timezone: optText,
  taxRegistrationNumber: z.string().trim().nullable().optional(),
  taxAuthority:          z.string().trim().nullable().optional(),
  logoUrl:               z.string().nullable().optional(),
  isActive: z.boolean().optional(),
}).passthrough();

export const assignAdminSchema = z.object({
  adminUserId: z.string().min(1, 'adminUserId is required'),
  email: z.string().trim().toLowerCase().email('Invalid login email address').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').max(72, 'Password must be at most 72 characters').optional(),
});
