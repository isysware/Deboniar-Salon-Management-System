// src/middleware/authorize.js
// Role-based access control — must be placed AFTER authenticate.

import { AppError } from '../lib/AppError.js';

/**
 * Middleware factory — allows only the specified roles.
 * @param {...string} roles  e.g. authorize('SUPER_ADMIN', 'ADMIN')
 */
export const authorize = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) {
    throw new AppError(403, 'FORBIDDEN', `This action requires one of these roles: ${roles.join(', ')}`);
  }
  next();
};
