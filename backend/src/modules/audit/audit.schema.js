// src/modules/audit/audit.schema.js
import { z } from 'zod';

export const listAuditQuery = z.object({
  branchId:  z.string().optional(),
  from:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD').optional(),
  to:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD').optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD').optional(),
  endDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD').optional(),
  userId:    z.string().optional(),
  entity:    z.string().optional(),
  action:    z.string().optional(),
  search:    z.string().optional(),
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(200).default(50),
});
