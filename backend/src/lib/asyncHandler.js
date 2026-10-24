// src/lib/asyncHandler.js
// Wraps an async route handler so any thrown error is forwarded to Express's
// next(err) — eliminating try/catch boilerplate in every controller.

/**
 * @param {(req, res, next) => Promise<void>} fn
 * @returns {(req, res, next) => void}
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
