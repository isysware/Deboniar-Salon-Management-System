// src/middleware/branchScope.js
// Forces non-SUPER_ADMIN users to their own branch.
// Attaches req.branchId for use in controllers/services.

import { AppError } from '../lib/AppError.js';

export const branchScope = (req, _res, next) => {
  const { user } = req;

  if (user.role === 'SUPER_ADMIN') {
    // SA may pass ?branchId= or 'ALL'; mutations must provide an explicit branch.
    req.branchId = req.query.branchId || req.body?.branchId || 'ALL';
  } else {
    // All other roles are always locked to their own branch.
    req.branchId = user.branchId;
  }

  next();
};

/**
 * For mutation routes: ensure SUPER_ADMIN has named an explicit branch.
 * Use this after branchScope on POST/PUT/DELETE handlers.
 */
export const requireExplicitBranch = (req, _res, next) => {
  if (req.branchId === 'ALL') {
    throw new AppError(400, 'BRANCH_REQUIRED', 'branchId is required for this operation');
  }
  next();
};
