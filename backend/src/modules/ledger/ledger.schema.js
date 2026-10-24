// src/modules/ledger/ledger.schema.js
import { z } from 'zod';

export const listLedgerQuery = z.object({
  branchId:  z.string().optional(),
  from:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD').optional(),
  to:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD').optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD').optional(),
  endDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD').optional(),
  channel:   z.enum(['ALL', 'CASH', 'BANK']).default('ALL'),
  source:    z.string().optional(),
  direction: z.enum(['IN', 'OUT']).optional(),
  drawerId:  z.string().optional(),
  accountId: z.string().optional(),
  search:    z.string().optional(),
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(500).default(100),
});
