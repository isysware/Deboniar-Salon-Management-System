// src/modules/tips/tips.routes.js — Accountants have no access; staff only see their own tips.

import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { idempotency } from '../../middleware/idempotency.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import * as s from './tips.service.js';
import { isYmd } from '../../lib/dates.js';

const ymd = z.string().refine(isYmd, 'Date must be a valid YYYY-MM-DD calendar date');
const filters = z.object({
  branchId: z.string().optional(), startDate: ymd.optional(), endDate: ymd.optional(), method: z.string().optional(),
  status: z.string().optional(), staffId: z.string().optional(), search: z.string().optional(), paymentSource: z.string().optional(),
});
const send = (fn, status = 200) => asyncHandler(async (req, res) => res.status(status).json({ data: await fn(req) }));

const router = Router();
router.get('/me', authenticate, authorize('STAFF'), send((req) => s.personalTips(req.user)));

router.use(authenticate, authorize('SUPER_ADMIN', 'ADMIN'));
router.get('/receipts',    validate(filters, 'query'), send((req) => s.listReceipts(req.user, req.query)));
router.get('/allocations', validate(filters, 'query'), send((req) => s.listAllocations(req.user, req.query)));
router.get('/payouts',     validate(filters, 'query'), send((req) => s.listPayouts(req.user, req.query)));
router.get('/statement',   validate(filters, 'query'), send((req) => s.statement(req.user, req.query)));
router.post('/allocate', validate(z.object({
  tipReceiptId: z.string().min(1), allocationType: z.enum(['DIRECT', 'POOLED_EQUAL', 'POOLED_CUSTOM']),
  recipients: z.array(z.object({ staffId: z.string().min(1), amount: z.number().positive('Every recipient allocation amount must be a positive finite number.') }))
    .min(1, 'At least one recipient staff member must be selected for tip allocation.'),
  notes: z.string().optional(),
})), send((req) => s.allocateTips(req.user, req.body), 201));
router.post('/allocations/:id/cancel', validate(z.object({ reason: z.string().trim().min(1, 'A cancellation reason is required.') })),
  send((req) => s.cancelAllocation(req.user, req.params.id, req.body.reason)));
router.post('/payouts', idempotency, validate(z.object({
  allocationId: z.string().min(1), amount: z.number().positive('Payout amount must be greater than zero.'), method: z.enum(['CASH', 'ONLINE']),
  cashDrawerId: z.string().optional(), onlineAccountId: z.string().optional(), idempotencyKey: z.string().optional(),
  reference: z.string().optional(), notes: z.string().optional(),
})), send((req) => s.recordPayout(req.user, { ...req.body, idempotencyKey: req.idempotencyKey }), 201));
router.post('/payouts/:id/reverse', validate(z.object({ reversalReason: z.string().trim().min(1, 'A reversal reason is required.'), receivingDrawerId: z.string().optional() })),
  send((req) => s.reversePayout(req.user, { payoutId: req.params.id, ...req.body })));

export default router;
