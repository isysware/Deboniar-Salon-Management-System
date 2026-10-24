// src/lib/AppError.js
// Structured application error — carries HTTP status + machine-readable code.

export class AppError extends Error {
  /**
   * @param {number} status  HTTP status code
   * @param {string} code    Machine-readable error code (e.g. 'INVALID_CREDENTIALS')
   * @param {string} message Human-readable message
   * @param {any}    [details] Optional extra data (validation errors, etc.)
   */
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name      = 'AppError';
    this.status    = status;
    this.code      = code;
    this.details   = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ── Common factory helpers ────────────────────────────────────────────────────

export const badRequest  = (code, msg, details) => new AppError(400, code, msg, details);
export const unauthorized = (code, msg)          => new AppError(401, code, msg);
export const forbidden   = (code, msg)           => new AppError(403, code, msg);
export const notFound    = (code, msg)           => new AppError(404, code, msg);
export const conflict    = (code, msg, details)  => new AppError(409, code, msg, details);
export const serverError = (msg)                 => new AppError(500, 'INTERNAL_ERROR', msg);
