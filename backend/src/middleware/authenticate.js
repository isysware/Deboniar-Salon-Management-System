// src/middleware/authenticate.js
// Verifies the Bearer JWT and attaches req.user.
// Session eligibility (inactive user/branch, revoked staff portal) is re-checked on every request.

import jwt         from 'jsonwebtoken';
import { env }     from '../config/env.js';
import prisma      from '../config/prisma.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { sessionBlockReason } from '../modules/auth/auth.service.js';

export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'MISSING_TOKEN', 'Authentication token required');
  }

  let payload;
  try {
    payload = jwt.verify(header.slice(7), env.jwtAccessSecret);
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    throw new AppError(401, 'INVALID_TOKEN', msg);
  }

  const user = await prisma.user.findUnique({
    where:   { id: payload.sub },
    include: { branch: { select: { name: true, isActive: true } }, staff: { select: { name: true, isActive: true, hasPortalAccess: true, branchId: true } } },
  });

  const blocked = sessionBlockReason(user);
  if (blocked) throw new AppError(401, 'USER_INACTIVE', blocked);

  req.user = {
    id:       user.id,
    name:     user.name,
    email:    user.email,
    role:     user.role,
    branchId: user.branchId,
    staffId:  user.staffId,
  };
  next();
});
