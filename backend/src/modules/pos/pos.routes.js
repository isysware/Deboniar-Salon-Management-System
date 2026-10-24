// src/modules/pos/pos.routes.js

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { idempotency } from '../../middleware/idempotency.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { notFound } from '../../lib/AppError.js';
import * as v from './pos.schema.js';
import * as pos from './pos.service.js';
import { postingRequest } from '../../lib/paymentPosting.js';
import * as refunds from './pos.refund.js';

const CASH_HANDLERS = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];
const send = (fn, status = 200) => asyncHandler(async (req, res) => res.status(status).json({ data: await fn(req) }));

// ── /pos ─────────────────────────────────────────────────────────────────────
export const posRoutes = Router();
posRoutes.use(authenticate, authorize(...CASH_HANDLERS));
posRoutes.post('/invoices/checkout', idempotency, validate(v.checkoutSchema), send((req) => pos.postInvoice(req.body, req.user, req.idempotencyKey, postingRequest(req)), 201));

// ── /invoices ────────────────────────────────────────────────────────────────
export const invoiceRoutes = Router();
invoiceRoutes.use(authenticate, authorize(...CASH_HANDLERS));
invoiceRoutes.get('/',            validate(v.listQuery, 'query'), send((req) => pos.listInvoices(req.user, req.query)));
invoiceRoutes.get('/outstanding', validate(v.outstandingQuery, 'query'), send((req) => pos.clientOutstanding(req.user, req.query)));
invoiceRoutes.get('/:id', send(async (req) => {
  const inv = await pos.getInvoice(req.user, req.params.id);
  if (!inv) throw notFound('INVOICE_NOT_FOUND', `Invoice '${req.params.id}' not found.`);
  return inv;
}));
invoiceRoutes.post('/:id/payments', idempotency, validate(v.collectSchema),
  send((req) => pos.collectPayment({ ...req.body, invoiceId: req.params.id }, req.user, postingRequest(req)), 201));
invoiceRoutes.post('/:id/payments/:paymentId/reverse', idempotency, validate(v.reverseCollectionSchema), send((req) => pos.reverseCollection({ ...req.body, invoiceId: req.params.id, paymentId: req.params.paymentId }, req.user, postingRequest(req)), 201));
invoiceRoutes.get('/:id/refunds', send((req) => refunds.listRefunds(req.user, req.params.id)));
invoiceRoutes.post('/:id/refunds', authorize('SUPER_ADMIN', 'ADMIN'), idempotency, validate(v.refundSchema),
  send((req) => refunds.refundInvoice({ ...req.body, invoiceId: req.params.id }, req.user), 201));
