// src/modules/ledger/ledger.routes.js
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { listLedgerQuery } from './ledger.schema.js';
import * as service from './ledger.service.js';

const router = Router();
router.use(authenticate);

// General Ledger is accessible by Super Admin, Branch Admins, and Accountants (branch-scoped)
router.get('/', authorize('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'), validate(listLedgerQuery, 'query'), asyncHandler(async (req, res) => {
  res.json({ data: await service.getGeneralLedger(req.user, req.query) });
}));

export default router;
