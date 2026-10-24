// src/lib/audit.js
// Writes an AuditEvent inside the current Prisma transaction.
// Always call this INSIDE the same transaction as the business write.

/**
 * @param {object}  tx         Prisma transaction client
 * @param {object}  opts
 * @param {string}  opts.userId
 * @param {string}  opts.userName
 * @param {string}  opts.action    e.g. 'LOGIN', 'INVOICE_CREATED'
 * @param {string}  opts.entity    e.g. 'User', 'Invoice'
 * @param {string}  [opts.entityId]
 * @param {string}  [opts.branchId]
 * @param {object}  [opts.before]  Snapshot before the change
 * @param {object}  [opts.after]   Snapshot after the change
 */
export const auditLog = async (tx, opts) => {
  await tx.auditEvent.create({
    data: {
      userId:   opts.userId,
      userName: opts.userName,
      action:   opts.action,
      entity:   opts.entity,
      entityId: opts.entityId ?? null,
      branchId: opts.branchId ?? null,
      before:   opts.before   ?? undefined,
      after:    opts.after    ?? undefined,
    },
  });
};
