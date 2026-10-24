// src/middleware/errorHandler.js
// Global Express error handler — must have 4 params to be recognised by Express.

import { AppError }  from '../lib/AppError.js';
import { env }       from '../config/env.js';

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  // Prisma unique constraint violation → 409
  if (err.code === 'P2002') {
    const field = err.meta?.target?.[0] ?? 'field';
    return res.status(409).json({
      error: { code: 'DUPLICATE_VALUE', message: `A record with this ${field} already exists` },
    });
  }

  // Prisma foreign key violation → 400
  if (err.code === 'P2003') {
    return res.status(400).json({
      error: { code: 'INVALID_REFERENCE', message: 'A referenced record does not exist' },
    });
  }

  // Malformed JSON body → 400
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
  }

  // Prisma record not found → 404
  if (err.code === 'P2025') {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Record not found' },
    });
  }

  if (err instanceof AppError) {
    const body = { error: { code: err.code, message: err.message } };
    if (err.details !== undefined) body.error.details = err.details;
    return res.status(err.status).json(body);
  }

  // Unknown error
  console.error('[Unhandled Error]', err);
  return res.status(500).json({
    error: {
      code:    'INTERNAL_ERROR',
      message: env.isDev ? err.message : 'An unexpected error occurred',
    },
  });
};

// src/middleware/notFound.js
export const notFound = (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
};
