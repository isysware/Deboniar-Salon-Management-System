// src/middleware/validate.js
// Zod schema validation middleware — returns structured 400 errors.

import { ZodError }  from 'zod';
import { AppError }  from '../lib/AppError.js';

/**
 * @param {import('zod').ZodSchema} schema  Zod schema to validate against
 * @param {'body'|'query'|'params'} [target]  Defaults to 'body'
 */
export const validate = (schema, target = 'body') => (req, _res, next) => {
  try {
    const parsed = schema.parse(req[target] ?? {});
    // Express 5 exposes req.query as a getter, so redefine it instead of assigning.
    Object.defineProperty(req, target, { value: parsed, writable: true, configurable: true, enumerable: true });
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      const details = err.issues.map((e) => ({
        field:   e.path.join('.'),
        message: e.message,
      }));
      const first = details[0];
      const message = first ? `${first.field ? `${first.field}: ` : ''}${first.message}` : 'Request validation failed';
      throw new AppError(400, 'VALIDATION_ERROR', message, details);
    }
    throw err;
  }
};
