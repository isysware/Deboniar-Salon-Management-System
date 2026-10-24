import prisma from '../config/prisma.js';
import { conflict } from './AppError.js';
import { createHash } from 'node:crypto';

export const paymentRequestHash = (body) => {
  const canonical = (value) => Array.isArray(value) ? value.map(canonical) :
    value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().filter((k) => k !== 'idempotencyKey').map((k) => [k, canonical(value[k])])) : value;
  return createHash('sha256').update(JSON.stringify(canonical(body))).digest('hex');
};

// The saved response and all financial writes share one transaction. The advisory lock
// serializes concurrent retries, including requests arriving before the first commit.
export const paymentPosting = (actor, request, work) => prisma.$transaction(async (tx) => {
  if (!request) return work(tx);
  const key = `${actor.id}:${request.key}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}::text))`;
  const saved = await tx.idempotencyKey.findUnique({ where: { key } });
  if (saved) {
    if (saved.route !== request.route) throw conflict('IDEMPOTENCY_CONFLICT', 'This request key belongs to another operation.');
    if (saved.requestHash && saved.requestHash !== request.hash) throw conflict('IDEMPOTENCY_CONFLICT', 'This request key was already used with different payment details.');
    return JSON.parse(saved.responseJson).data;
  }
  const result = await work(tx);
  await tx.idempotencyKey.create({ data: {
    key, userId: actor.id, route: request.route, requestHash: request.hash, statusCode: 201,
    responseJson: JSON.stringify({ data: result }),
  } });
  return result;
});

export const postingRequest = (req) => {
  req.atomicPaymentPosting = true;
  return { key: req.idempotencyKey, route: `${req.method} ${req.originalUrl}`, hash: req.paymentRequestHash };
};
