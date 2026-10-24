// src/modules/appointments/appointments.schema.js

import { z } from 'zod';
import { customerSource } from '../clients/clients.schema.js';

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const time = z.string().trim().regex(/^\d{1,2}:\d{2}(\s?[AaPp][Mm])?$/, 'Time must be HH:MM or HH:MM AM/PM');

const item = z.object({
  lineInstanceId: z.string().optional(),
  type:           z.enum(['SERVICE', 'PACKAGE']),
  itemId:         z.string().min(1),
  staffId:        z.string().optional(),
  assignedStaff:  z.array(z.object({ staffId: z.string(), staffName: z.string().optional(), staffCommissionRate: z.number().optional() }).passthrough()).optional(),
  packageComponents: z.array(z.object({
    componentInstanceId: z.string().optional(),
    serviceId:           z.string().min(1),
    staffId:             z.string().optional(),
  })).optional(),
});

export const listQuery = z.object({
  branchId:  z.string().optional(),
  date:      ymd.optional(),
  startDate: ymd.optional(),
  endDate:   ymd.optional(),
  status:    z.string().optional(),
  staffId:   z.string().optional(),
  clientId:  z.string().optional(),
  search:    z.string().optional(),
});

export const createSchema = z.object({
  branchId:              z.string().optional(),
  clientId:              z.string().optional(),
  clientName:            z.string().trim().min(1, 'Customer name is required for appointment booking.'),
  clientPhone:           z.string().trim().min(1, 'Customer phone number is required for appointment booking.'),
  clientEmail:           z.string().trim().toLowerCase().email().optional().or(z.literal('').transform(() => undefined)),
  customerSource:        customerSource.optional(),
  customerSourceDetails: z.string().trim().optional(),
  date:                  ymd,
  startTime:             time.optional().default('10:00 AM'),
  items:                 z.array(item).min(1, 'At least one service or package must be selected.'),
  notes:                 z.string().trim().optional(),
  status:                z.enum(['PENDING', 'CONFIRMED']).optional(),
});

export const updateSchema = z.object({
  date:                  ymd.optional(),
  startTime:             time.optional(),
  items:                 z.array(item).optional(),
  notes:                 z.string().trim().optional(),
  clientName:            z.string().trim().min(1).optional(),
  clientPhone:           z.string().trim().min(1).optional(),
  clientEmail:           z.string().trim().optional(),
  customerSource:        customerSource.optional(),
  customerSourceDetails: z.string().trim().optional(),
});

export const statusSchema = z.object({
  status:       z.enum(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_SERVICE', 'COMPLETED', 'CANCELLED', 'NO_SHOW']),
  cancelReason: z.string().trim().optional(),
});

export const rescheduleSchema = z.object({
  date:      ymd,
  startTime: time.optional().default('10:00 AM'),
  reason:    z.string().trim().optional(),
});

export const queueQuery = z.object({
  branchId: z.string().optional(),
  date:     ymd,
});
