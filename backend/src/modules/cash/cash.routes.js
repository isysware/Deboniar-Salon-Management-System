// src/modules/cash/cash.routes.js

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { idempotency } from '../../middleware/idempotency.js';
import * as v from './cash.schema.js';
import * as c from './cash.controller.js';

const ADMINS = ['SUPER_ADMIN', 'ADMIN'];
const CASH_HANDLERS = [...ADMINS, 'ACCOUNTANT'];

// ── /cash-drawers ────────────────────────────────────────────────────────────
export const drawerRoutes = Router();
drawerRoutes.use(authenticate, authorize(...CASH_HANDLERS));
drawerRoutes.get('/',               validate(v.listDrawersQuery, 'query'), c.listDrawers);
drawerRoutes.get('/mine',           validate(v.branchQuery, 'query'), c.myDrawer);
drawerRoutes.get('/vault',          authorize(...ADMINS), validate(v.branchQuery, 'query'), c.vault);
drawerRoutes.post('/open',          validate(v.openDrawerSchema), c.openDrawer);
drawerRoutes.get('/:id/movements',  c.movements);

// ── /cash-transfers (vault → drawer float) ──────────────────────────────────
export const transferRoutes = Router();
transferRoutes.use(authenticate);
transferRoutes.get('/',  authorize(...CASH_HANDLERS), validate(v.branchQuery, 'query'), c.listTransfers);
transferRoutes.post('/', authorize(...ADMINS), idempotency, validate(v.transferSchema), c.transfer);

// ── /account-statements/:id (bank/online account ledger) ────────────────────
export const accountLedgerRoutes = Router();
accountLedgerRoutes.use(authenticate, authorize(...CASH_HANDLERS));
accountLedgerRoutes.get('/:id', validate(v.statementQuery, 'query'), c.accountStatement);
