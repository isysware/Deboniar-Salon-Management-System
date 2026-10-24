// src/modules/expenses/expenses.routes.js

import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { idempotency } from '../../middleware/idempotency.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { notFound } from '../../lib/AppError.js';
import * as s from './expenses.service.js';

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const amount = z.number({ message: 'Expense amount must be a number.' }).positive('Expense amount must be a positive finite number.').finite();
const fields = {
  branchId:          z.string().optional(),
  expenseDate:       ymd.optional(),
  date:              ymd.optional(),
  category:          z.string().trim().min(1, 'Expense category is required.'),
  payee:             z.string().trim().min(1, 'Payee name is required.'),
  title:             z.string().trim().min(1, 'Expense title is required.'),
  description:       z.string().trim().optional(),
  amount,
  paymentSource:     z.enum(['CASH_DRAWER', 'ONLINE_ACCOUNT']),
  paymentAccountId:  z.string().optional(),
  externalReference: z.string().trim().optional(),
  notes:             z.string().trim().optional(),
  idempotencyKey:    z.string().optional(),
};
const draftSchema = z.object({ ...fields, paymentSource: fields.paymentSource.default('CASH_DRAWER') }).passthrough();
const updateSchema = z.object(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()]))).passthrough();
const postSchema = z.object({ ...fields, expenseId: z.string().optional() }).passthrough();
const reverseSchema = z.object({ reason: z.string().trim().min(1, 'A reversal reason is required.') });
const listQuery = z.object({
  branchId: z.string().optional(), status: z.string().optional(), category: z.string().optional(), startDate: ymd.optional(),
  endDate: ymd.optional(), paymentSource: z.string().optional(), search: z.string().optional(), userId: z.string().optional(),
});

const send = (fn, status = 200) => asyncHandler(async (req, res) => res.status(status).json({ data: await fn(req) }));

const router = Router();
router.use(authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'));
router.get('/', validate(listQuery, 'query'), send((req) => s.listExpenses(req.user, req.query)));
router.get('/:id', send(async (req) => {
  const e = await s.getExpense(req.user, req.params.id);
  if (!e) throw notFound('EXPENSE_NOT_FOUND', 'Expense not found.');
  return e;
}));
router.post('/drafts',        validate(draftSchema),  send((req) => s.createDraft(req.body, req.user), 201));
router.put('/drafts/:id',     validate(updateSchema), send((req) => s.updateDraft(req.params.id, req.body, req.user)));
router.delete('/drafts/:id',  send((req) => s.deleteDraft(req.params.id, req.user)));
router.post('/post',          idempotency, validate(postSchema), send((req) => s.postExpense(req.body, req.user, req.idempotencyKey), 201));
router.post('/:id/reverse',   authorize('SUPER_ADMIN', 'ADMIN'), validate(reverseSchema), send((req) => s.reverseExpense(req.params.id, req.body.reason, req.user)));

export default router;
