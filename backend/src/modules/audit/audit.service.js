// src/modules/audit/audit.service.js
import prisma from '../../config/prisma.js';
import { resolveReadBranch, assertBranchAccess } from '../../lib/scope.js';
import { dateOnly } from '../../lib/dates.js';

export const listAuditEvents = async (actor, query) => {
  const branchId = resolveReadBranch(actor, query.branchId);
  const fromDate = query.from || query.startDate;
  const toDate = query.to || query.endDate;

  const where = {};
  if (branchId) {
    where.branchId = branchId;
  }
  if (query.userId) {
    where.userId = query.userId;
  }
  if (query.entity) {
    where.entity = query.entity;
  }
  if (query.action) {
    where.action = query.action;
  }
  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) {
      where.createdAt.gte = dateOnly(fromDate);
    }
    if (toDate) {
      const end = dateOnly(toDate);
      end.setDate(end.getDate() + 1);
      where.createdAt.lt = end;
    }
  }
  if (query.search) {
    const s = query.search.trim();
    where.OR = [
      { userName: { contains: s, mode: 'insensitive' } },
      { action:   { contains: s, mode: 'insensitive' } },
      { entity:   { contains: s, mode: 'insensitive' } },
      { entityId: { contains: s, mode: 'insensitive' } },
    ];
  }

  const page = query.page || 1;
  const limit = query.limit || 50;
  const skip = (page - 1) * limit;

  const [total, events, branches] = await Promise.all([
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.branch.findMany({ select: { id: true, name: true, code: true } }),
  ]);

  const branchMap = new Map(branches.map((b) => [b.id, b]));

  const rows = events.map((e) => {
    const b = e.branchId ? branchMap.get(e.branchId) : null;
    return {
      id: e.id,
      branchId: e.branchId,
      branchName: b ? b.name : (e.branchId ? 'Unknown Branch' : 'System Wide'),
      branchCode: b ? b.code : null,
      userId: e.userId,
      userName: e.userName,
      action: e.action,
      entity: e.entity,
      entityId: e.entityId,
      before: e.before,
      after: e.after,
      createdAt: e.createdAt.toISOString(),
    };
  });

  return {
    events: rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

export const getAuditEvent = async (actor, id) => {
  const event = await prisma.auditEvent.findUnique({ where: { id } });
  if (!event) return null;
  if (event.branchId) {
    assertBranchAccess(actor, event.branchId);
  }
  return event;
};
