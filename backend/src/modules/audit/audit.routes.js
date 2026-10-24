// src/modules/audit/audit.routes.js
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { notFound } from '../../lib/AppError.js';
import { listAuditQuery } from './audit.schema.js';
import * as service from './audit.service.js';

const router = Router();
router.use(authenticate);

// Audit events are restricted to Super Admin and Branch Admins (scoped)
router.get('/', authorize('SUPER_ADMIN', 'ADMIN'), validate(listAuditQuery, 'query'), asyncHandler(async (req, res) => {
  res.json({ data: await service.listAuditEvents(req.user, req.query) });
}));

router.get('/:id', authorize('SUPER_ADMIN', 'ADMIN'), asyncHandler(async (req, res) => {
  const event = await service.getAuditEvent(req.user, req.params.id);
  if (!event) throw notFound('AUDIT_NOT_FOUND', `Audit event '${req.params.id}' not found.`);
  res.json({ data: event });
}));

export default router;
