// src/modules/attendance/overtime.service.js
// Manual overtime: entered and approved by admins only. The hourly rate is snapshotted on approval;
// rejected/cancelled/unapproved minutes never reach payroll. Records consumed by a finalized payroll
// run are locked.

import prisma from '../../config/prisma.js';
import { auditLog } from '../../lib/audit.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/AppError.js';
import { assertBranchAccess, resolveReadBranch, resolveWriteBranch } from '../../lib/scope.js';
import { dateOnly, ymd } from '../../lib/dates.js';
import { round2, toDec } from '../../lib/money.js';
import { nextSequence } from '../../lib/sequence.js';
import { num, opt, iso } from '../../lib/dto.js';
import { lockStaffPayBranch, assertPayrollPeriodOpen } from '../../lib/hrTransactions.js';

export const toOvertimeDTO = (o, staff) => ({
  id: o.id, overtimeNumber: o.overtimeNumber, staffId: o.staffId, staffName: staff?.name ?? '', employeeCode: staff?.employeeCode,
  branchId: o.branchId, date: ymd(o.workDate), minutes: o.minutes, approvedMinutes: o.approvedMinutes,
  hourlyRate: o.hourlyRate === null ? undefined : num(o.hourlyRate), amount: o.amount === null ? undefined : num(o.amount),
  reason: o.reason, notes: opt(o.notes), status: o.status, enteredByUserId: o.enteredByUserId, enteredByName: o.enteredByName,
  enteredAt: iso(o.enteredAt), approvedByUserId: opt(o.approvedByUserId), approvedByName: opt(o.approvedByName), approvedAt: iso(o.approvedAt),
  rejectedByUserId: opt(o.rejectedByUserId), rejectedByName: opt(o.rejectedByName), rejectedAt: iso(o.rejectedAt),
  rejectionReason: opt(o.rejectionReason), cancelledByUserId: opt(o.cancelledByUserId), cancelledByName: opt(o.cancelledByName),
  cancelledAt: iso(o.cancelledAt), cancellationReason: opt(o.cancellationReason), payrollId: opt(o.payrollRunId), rateMultiplier: num(o.rateMultiplier),
});

const withStaff = async (rows) => {
  const staff = await prisma.staff.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.staffId))] } } });
  const map = new Map(staff.map((s) => [s.id, s]));
  return rows.map((r) => toOvertimeDTO(r, map.get(r.staffId)));
};

const estimate = (minutes, rate) => round2(toDec(minutes).dividedBy(60).times(rate));

export const listOvertime = async (actor, { branchId, staffId, date, startDate, endDate } = {}) => {
  if (actor.role === 'ACCOUNTANT') throw forbidden('FORBIDDEN', 'Access Denied: Accountants do not have permission to view overtime.');
  let sid = staffId;
  if (actor.role === 'STAFF') {
    if (!actor.staffId) throw forbidden('FORBIDDEN', 'Staff record associated with the authenticated user could not be found.');
    if (staffId && staffId !== actor.staffId) throw forbidden('FORBIDDEN', 'Access Denied: Staff members can only view their own overtime records.');
    sid = actor.staffId;
  }
  const b = actor.role === 'STAFF' ? null : resolveReadBranch(actor, branchId);
  const rows = await prisma.overtimeRecord.findMany({
    where: { ...(b ? { branchId: b } : {}), ...(sid ? { staffId: sid } : {}), ...(actor.role === 'STAFF' ? { status: 'APPROVED' } : {}),
      ...(date || startDate || endDate ? { workDate: { ...(date ? { equals: dateOnly(date) } : {}), ...(startDate ? { gte: dateOnly(startDate) } : {}), ...(endDate ? { lte: dateOnly(endDate) } : {}) } } : {}) },
    orderBy: [{ workDate: 'desc' }, { enteredAt: 'desc' }],
  });
  return withStaff(rows);
};

const load = async (tx, actor, id, verb) => {
  const header = await tx.overtimeRecord.findUnique({ where: { id } });
  if (!header) throw notFound('OVERTIME_NOT_FOUND', `Overtime record '${id}' not found.`);
  await lockStaffPayBranch(tx, header.branchId);
  const o = await tx.overtimeRecord.findUnique({ where: { id } });
  if (!o) throw notFound('OVERTIME_NOT_FOUND', `Overtime record '${id}' not found.`);
  assertBranchAccess(actor, o.branchId, `Access Denied: Cannot ${verb} overtime from another branch.`);
  if (o.payrollRunId) throw conflict('OVERTIME_LOCKED', `Cannot ${verb} overtime already linked to finalized payroll.`);
  await assertPayrollPeriodOpen(tx, o.staffId, ymd(o.workDate));
  return o;
};

const finish = async (tx, actor, action, o) => {
  await auditLog(tx, { userId: actor.id, userName: actor.name, action, entity: 'OvertimeRecord', entityId: o.id, branchId: o.branchId, after: { status: o.status, minutes: o.minutes, approvedMinutes: o.approvedMinutes } });
  return toOvertimeDTO(o, await tx.staff.findUnique({ where: { id: o.staffId } }));
};

export const createOvertime = async (input, actor) => {
  const branchId = resolveWriteBranch(actor, input.branchId, 'Access Denied: Cannot enter overtime for another branch.');
  return prisma.$transaction(async (tx) => {
    await lockStaffPayBranch(tx, branchId);
    const staff = await tx.staff.findUnique({ where: { id: input.staffId } });
    if (!staff || !staff.isActive || staff.branchId !== branchId) throw badRequest('STAFF_INVALID', `Staff member '${input.staffId}' is inactive or not found in this branch.`);
    await assertPayrollPeriodOpen(tx, staff.id, input.date);
    const dup = await tx.overtimeRecord.findFirst({
      where: { staffId: staff.id, workDate: dateOnly(input.date), status: { notIn: ['CANCELLED', 'REJECTED'] } },
    });
    if (dup && !input.notes?.includes('INTENTIONAL_ADDITIONAL')) {
      throw conflict('OVERTIME_EXISTS', `An active overtime record already exists for ${staff.name} on ${input.date}. Please edit the existing record or specify notes for intentional additional overtime.`);
    }
    const branch = await tx.branch.findUnique({ where: { id: branchId } });
    const o = await tx.overtimeRecord.create({
      data: {
        overtimeNumber: await nextSequence(tx, branch.code, 'OT', Number(input.date.slice(0, 4))), branchId, staffId: staff.id,
        workDate: dateOnly(input.date), minutes: input.minutes, reason: input.reason, notes: input.notes || null,
        status: input.status || 'DRAFT', hourlyRate: staff.overtimeHourlyRate, amount: estimate(input.minutes, staff.overtimeHourlyRate),
        enteredByUserId: actor.id, enteredByName: actor.name,
      },
    });
    return finish(tx, actor, 'OVERTIME_ENTERED', o);
  });
};

export const updateOvertime = async (id, input, actor) =>
  prisma.$transaction(async (tx) => {
    const o = await load(tx, actor, id, 'edit');
    if (o.status === 'APPROVED') throw conflict('OVERTIME_APPROVED', 'Approved overtime cannot be edited directly. Please cancel and create a new record if needed.');
    if (['CANCELLED', 'REJECTED'].includes(o.status)) throw conflict('OVERTIME_CLOSED', `Cannot edit ${o.status.toLowerCase()} overtime.`);
    const data = {};
    if (input.minutes !== undefined) { data.minutes = input.minutes; data.amount = estimate(input.minutes, o.hourlyRate ?? 0); }
    if (input.reason !== undefined) data.reason = input.reason;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.status !== undefined) data.status = input.status;
    return finish(tx, actor, 'OVERTIME_UPDATED', await tx.overtimeRecord.update({ where: { id }, data }));
  });

export const approveOvertime = async (id, actor) =>
  prisma.$transaction(async (tx) => {
    const o = await load(tx, actor, id, 'approve');
    if (o.status === 'APPROVED') throw conflict('ALREADY_APPROVED', `Overtime record '${o.overtimeNumber}' is already approved.`);
    if (['CANCELLED', 'REJECTED'].includes(o.status)) throw conflict('OVERTIME_CLOSED', `Cannot approve ${o.status.toLowerCase()} overtime.`);
    const staff = await tx.staff.findUnique({ where: { id: o.staffId } });
    const rate = toDec(staff.overtimeHourlyRate).times(o.rateMultiplier);
    const updated = await tx.overtimeRecord.update({
      where: { id },
      data: {
        status: 'APPROVED', approvedMinutes: o.minutes, hourlyRate: round2(rate), amount: estimate(o.minutes, rate),
        approvedByUserId: actor.id, approvedByName: actor.name, approvedAt: new Date(),
      },
    });
    return finish(tx, actor, 'OVERTIME_APPROVED', updated);
  });

export const rejectOvertime = async (id, reason, actor) =>
  prisma.$transaction(async (tx) => {
    const o = await load(tx, actor, id, 'reject');
    if (o.status === 'CANCELLED') throw conflict('OVERTIME_CLOSED', 'Cancelled overtime cannot be rejected.');
    const updated = await tx.overtimeRecord.update({
      where: { id },
      data: { status: 'REJECTED', approvedMinutes: 0, rejectionReason: reason, rejectedByUserId: actor.id, rejectedByName: actor.name, rejectedAt: new Date() },
    });
    return finish(tx, actor, 'OVERTIME_REJECTED', updated);
  });

export const cancelOvertime = async (id, reason, actor) =>
  prisma.$transaction(async (tx) => {
    const o = await load(tx, actor, id, 'cancel');
    if (o.status === 'CANCELLED') throw conflict('ALREADY_CANCELLED', 'Overtime is already cancelled.');
    const updated = await tx.overtimeRecord.update({
      where: { id },
      data: { status: 'CANCELLED', approvedMinutes: 0, cancellationReason: reason, cancelledByUserId: actor.id, cancelledByName: actor.name, cancelledAt: new Date() },
    });
    return finish(tx, actor, 'OVERTIME_CANCELLED', updated);
  });

export const personalOvertime = async (actor) => {
  if (!actor.staffId) throw forbidden('FORBIDDEN', 'Staff record associated with the authenticated user could not be found.');
  const rows = await prisma.overtimeRecord.findMany({ where: { staffId: actor.staffId }, orderBy: { workDate: 'desc' } });
  const records = await withStaff(rows);
  const approved = records.filter((r) => r.status === 'APPROVED');
  return {
    records,
    approvedMinutes: approved.reduce((s, r) => s + r.approvedMinutes, 0),
    approvedPay: round2(approved.reduce((s, r) => s.plus(r.amount ?? 0), toDec(0))).toNumber(),
  };
};
