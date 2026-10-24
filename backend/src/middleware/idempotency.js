// src/middleware/idempotency.js
// Prevents duplicate money/stock writes on network retries.
// Reads the 'Idempotency-Key' header; replays the saved response if the key was seen before.
// Only successful (2xx) responses are stored, so a failed attempt can be retried with the same key.

import prisma      from '../config/prisma.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { paymentRequestHash } from '../lib/paymentPosting.js';

export const idempotency = asyncHandler(async (req, res, next) => {
  const rawKey = req.headers['idempotency-key'] || req.body?.idempotencyKey;
  if (!rawKey) {
    throw new AppError(400, 'MISSING_IDEMPOTENCY_KEY', 'Idempotency-Key header is required for this operation');
  }
  // Scope keys per user so two users can never collide on the same key.
  const key = `${req.user.id}:${rawKey}`;
  req.idempotencyKey = String(rawKey);
  req.paymentRequestHash = paymentRequestHash(req.body);

  const existing = await prisma.idempotencyKey.findUnique({ where: { key } });
  if (existing) {
    if (existing.route !== `${req.method} ${req.originalUrl}`) throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'This request key was already used for a different operation.');
    if (existing.requestHash && existing.requestHash !== req.paymentRequestHash) throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'This request key was already used with different payment details.');
    res.setHeader('Idempotent-Replay', 'true');
    return res.status(existing.statusCode).json(JSON.parse(existing.responseJson));
  }

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (!req.atomicPaymentPosting && res.statusCode >= 200 && res.statusCode < 300) {
      prisma.idempotencyKey
        .upsert({
          where: { key },
          create: {
            key,
            userId:       req.user.id,
            route:        `${req.method} ${req.originalUrl}`,
            statusCode:   res.statusCode,
            responseJson: JSON.stringify(body),
          },
          update: {},
        })
        .catch(() => {
          // Race: safe to ignore.
        });
    }
    return originalJson(body);
  };

  next();
});
