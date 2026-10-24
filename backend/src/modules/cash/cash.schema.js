// src/modules/cash/cash.schema.js

import { z } from 'zod';

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

export const listDrawersQuery = z.object({
  branchId: z.string().optional(),
  userId:   z.string().optional(),
  status:   z.enum(['OPEN', 'SETTLEMENT_PENDING', 'SETTLED']).optional(),
});

export const branchQuery = z.object({ branchId: z.string().optional() });

export const openDrawerSchema = z.object({ branchId: z.string().optional() });

export const transferSchema = z.object({
  branchId:     z.string().optional(),
  targetUserId: z.string().min(1, 'Target custodian is required'),
  amount:       z.number().positive('Transfer amount must be a positive finite number.').finite(),
  notes:        z.string().trim().optional(),
});

export const statementQuery = z.object({
  from:      ymd.optional(),
  to:        ymd.optional(),
  startDate: ymd.optional(),
  endDate:   ymd.optional(),
});
