// src/modules/cash/cash.controller.js

import * as s from './cash.service.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { parseDateRange } from '../../lib/dates.js';

const send = (fn, status = 200) => asyncHandler(async (req, res) => {
  res.status(status).json({ data: await fn(req) });
});

export const listDrawers   = send((req) => s.listDrawers(req.user, req.query));
export const myDrawer      = send((req) => s.myDrawer(req.user, req.query.branchId));
export const openDrawer    = send((req) => s.openDrawer(req.user, req.body.branchId), 201);
export const movements     = send((req) => s.drawerMovements(req.user, req.params.id));
export const vault         = send((req) => s.vaultStatus(req.user, req.query.branchId));
export const transfer      = send((req) => s.transferFloat(req.user, req.body), 201);
export const listTransfers = send((req) => s.listTransfers(req.user, req.query));
export const accountStatement = send((req) => s.accountStatement(req.user, req.params.id, parseDateRange(req.query)));
