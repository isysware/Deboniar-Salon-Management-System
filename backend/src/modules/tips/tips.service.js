// src/modules/tips/tips.service.js
// Tips are a staff LIABILITY, never salon income (spec §4.4). Receipts are created by POS;
// allocation binds a receipt to staff (no money moves); payouts move money; reversals are dated
// events that restore the liability without erasing the original payout date.
//   Closing liability = Opening + Net collected − Net payouts = Unallocated + Allocated-unpaid

import prisma from '../../config/prisma.js';
import { auditLog } from '../../lib/audit.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/AppError.js';
import { assertBranchAccess, resolveReadBranch } from '../../lib/scope.js';
import { dateOnly, getBusinessDate, toDateString, toTimeString, ymd } from '../../lib/dates.js';
import { round2, toDec } from '../../lib/money.js';
import { nextSequence } from '../../lib/sequence.js';
import { num, opt, iso } from '../../lib/dto.js';
import { formatMinutesToTime, parseTimeToMinutes } from '../../lib/calculations/attendanceCalculations.js';
import { payoutMoney, reverseMoney } from '../cash/cash.service.js';
import { lockStaffPayBranch, replayMoneyRequest, saveMoneyResponse } from '../../lib/hrTransactions.js';

const clockTime = () => formatMinutesToTime(parseTimeToMinutes(toTimeString(new Date())));
const managersOnly = (actor) => {
  if (actor.role === 'ACCOUNTANT') throw forbidden('FORBIDDEN', 'Access Denied: Accountants are not authorized to view or manage staff tips.');
  if (actor.role === 'STAFF') throw forbidden('FORBIDDEN', 'Access Denied: Staff members cannot access branch tip management.');
};

const branchNames = async () => new Map((await prisma.branch.findMany()).map((b) => [b.id, b.name]));

const toReceiptDTO = (r, branchName) => ({
  id: r.id, receiptNumber: r.receiptNumber, branchId: r.branchId, branchName, invoiceId: r.invoiceId, invoiceNumber: r.invoiceNumber,
  paymentId: r.paymentId, collectionDate: ymd(r.collectionDate), collectionTime: r.collectionTime, clientName: r.clientName, method: r.method,
  paymentAccountId: opt(r.paymentAccountId), paymentAccountName: opt(r.paymentAccountName), cashDrawerId: opt(r.cashDrawerId),
  collectedByUserId: r.collectedByUserId, collectedByName: r.collectedByName, collectedAmount: num(r.collectedAmount),
  directStaffId: opt(r.directStaffId), directStaffName: opt(r.directStaffName), allocatedAmount: num(r.allocatedAmount),
  unallocatedAmount: num(r.unallocatedAmount), status: r.status, createdAt: iso(r.createdAt),
});

const allocationTotals = (a) => {
  const paid = round2((a.payouts ?? []).filter((p) => p.status === 'COMPLETED').reduce((s, p) => s.plus(p.amount), toDec(0)));
  const outstanding = a.status === 'CANCELLED' ? toDec(0) : round2(toDec(a.amount).minus(paid));
  const status = a.status === 'CANCELLED' ? 'CANCELLED' : outstanding.lessThanOrEqualTo(0) ? 'PAID' : paid.greaterThan(0) ? 'PARTIALLY_PAID' : 'UNPAID';
  return { paid, outstanding, status };
};

const toAllocationDTO = (a) => {
  const t = allocationTotals(a);
  return {
    id: a.id, allocationNumber: a.allocationNumber, branchId: a.branchId, tipReceiptId: a.receiptId, tipReceiptNumber: a.receipt?.receiptNumber,
    invoiceId: a.receipt?.invoiceId, invoiceNumber: a.receipt?.invoiceNumber, paymentId: a.receipt?.paymentId, staffId: a.staffId,
    staffName: a.staffName, amount: num(a.amount), paidAmount: t.paid.toNumber(), outstandingAmount: t.outstanding.toNumber(),
    allocationType: a.allocationType, allocationDate: ymd(a.allocationDate), allocationTime: a.allocationTime,
    allocatedByUserId: a.allocatedByUserId, allocatedByName: a.allocatedByName, status: t.status, cancelledAt: iso(a.cancelledAt), cancellationDate: ymd(a.cancellationDate),
    cancelledByUserId: opt(a.cancelledByUserId), cancelledByName: opt(a.cancelledByName), cancelReason: opt(a.cancelReason), notes: opt(a.notes),
  };
};

const toPayoutDTO = (p) => ({
  id: p.id, payoutNumber: p.payoutNumber, branchId: p.branchId, staffId: p.staffId, staffName: p.staffName, allocationId: p.allocationId,
  allocationNumber: p.allocation?.allocationNumber, tipReceiptId: p.allocation?.receiptId, amount: num(p.amount), method: p.method,
  cashDrawerId: opt(p.cashDrawerId), onlineAccountId: opt(p.onlineAccountId), onlineAccountName: opt(p.onlineAccountName),
  collectionMethod: p.allocation?.receipt?.method ?? 'CASH', collectionPaymentAccountName: opt(p.allocation?.receipt?.paymentAccountName),
  payoutDate: ymd(p.payoutDate), payoutTime: p.payoutTime, paidByUserId: p.paidByUserId, paidByName: p.paidByName, status: p.status,
  reversalReason: opt(p.reversalReason), reversedAt: iso(p.reversedAt), reversalDate: ymd(p.reversalDate), reversedByUserId: opt(p.reversedByUserId),
  reversedByName: opt(p.reversedByName), reversalReceivingDrawerId: opt(p.reversalReceivingDrawerId), reference: opt(p.reference), notes: opt(p.notes),
});

const allocInclude = { receipt: true, payouts: true };
const payoutInclude = { allocation: { include: { receipt: true } } };
const dateRange = (field, startDate, endDate) =>
  startDate || endDate ? { [field]: { ...(startDate ? { gte: dateOnly(startDate) } : {}), ...(endDate ? { lte: dateOnly(endDate) } : {}) } } : {};

// ═══ QUERIES ══════════════════════════════════════════════════════════════════

export const listReceipts = async (actor, f = {}) => {
  managersOnly(actor);
  const b = resolveReadBranch(actor, f.branchId);
  const rows = await prisma.tipReceipt.findMany({
    where: {
      ...(b ? { branchId: b } : {}), ...dateRange('collectionDate', f.startDate, f.endDate),
      ...(f.method && f.method !== 'ALL' ? { method: f.method } : {}), ...(f.status && f.status !== 'ALL' ? { status: f.status } : {}),
      ...(f.staffId && f.staffId !== 'ALL' ? { directStaffId: f.staffId } : {}),
      ...(f.search ? { OR: ['receiptNumber', 'invoiceNumber', 'clientName', 'directStaffName'].map((k) => ({ [k]: { contains: f.search, mode: 'insensitive' } })) } : {}),
    },
    orderBy: [{ collectionDate: 'desc' }, { receiptNumber: 'desc' }],
  });
  const names = await branchNames();
  return rows.map((r) => toReceiptDTO(r, names.get(r.branchId)));
};

export const listAllocations = async (actor, f = {}) => {
  managersOnly(actor);
  const b = resolveReadBranch(actor, f.branchId);
  const rows = await prisma.tipAllocation.findMany({
    where: {
      ...(b ? { branchId: b } : {}), ...dateRange('allocationDate', f.startDate, f.endDate),
      ...(f.staffId && f.staffId !== 'ALL' ? { staffId: f.staffId } : {}),
      ...(f.search ? { OR: [{ allocationNumber: { contains: f.search, mode: 'insensitive' } }, { staffName: { contains: f.search, mode: 'insensitive' } }] } : {}),
    },
    include: allocInclude, orderBy: [{ allocationDate: 'desc' }, { allocationNumber: 'desc' }],
  });
  const dtos = rows.map(toAllocationDTO);
  return f.status && f.status !== 'ALL' ? dtos.filter((a) => a.status === f.status) : dtos;
};

export const listPayouts = async (actor, f = {}) => {
  managersOnly(actor);
  const b = resolveReadBranch(actor, f.branchId);
  const rows = await prisma.tipPayout.findMany({
    where: {
      ...(b ? { branchId: b } : {}), ...dateRange('payoutDate', f.startDate, f.endDate),
      ...(f.staffId && f.staffId !== 'ALL' ? { staffId: f.staffId } : {}), ...(f.method && f.method !== 'ALL' ? { method: f.method } : {}),
      ...(f.status && f.status !== 'ALL' ? { status: f.status } : {}),
    },
    include: payoutInclude, orderBy: [{ payoutDate: 'desc' }, { payoutNumber: 'desc' }],
  });
  return rows.map(toPayoutDTO);
};

// ═══ ALLOCATION ═══════════════════════════════════════════════════════════════

const refreshReceipt = async (tx, receiptId) => {
  const r = await tx.tipReceipt.findUnique({ where: { id: receiptId }, include: { allocations: true } });
  const allocated = round2(r.allocations.filter((a) => a.status !== 'CANCELLED').reduce((s, a) => s.plus(a.amount), toDec(0)));
  const tipRefunded = await tipRefundedFor(tx, r.invoiceId, r.id);
  const unallocated = Decimal_max0(round2(toDec(r.collectedAmount).minus(allocated).minus(tipRefunded)));
  return tx.tipReceipt.update({
    where: { id: receiptId },
    data: {
      allocatedAmount: allocated, unallocatedAmount: unallocated,
      status: unallocated.lessThanOrEqualTo(0) ? 'FULLY_ALLOCATED' : allocated.greaterThan(0) ? 'PARTIALLY_ALLOCATED' : 'UNALLOCATED',
    },
  });
};

/** Tip money refunded to the customer on a voided invoice (POS void zeroes the unallocated balance). */
const tipRefundedFor = async (tx, invoiceId, receiptId) => {
  const refunds = await tx.invoiceRefund.findMany({ where: { invoiceId, tipReversed: { gt: 0 } } });
  if (!refunds.length) return toDec(0);
  const receipts = await tx.tipReceipt.findMany({ where: { invoiceId } });
  const total = refunds.reduce((s, r) => s.plus(r.tipReversed), toDec(0));
  // Spread the refunded tip over the invoice's receipts in collection order.
  let remaining = total;
  for (const rc of receipts.sort((a, b) => a.createdAt - b.createdAt)) {
    const take = remaining.lessThan(rc.collectedAmount) ? remaining : toDec(rc.collectedAmount);
    if (rc.id === receiptId) return take;
    remaining = remaining.minus(take);
  }
  return toDec(0);
};

const Decimal_max0 = (d) => (d.lessThan(0) ? toDec(0) : d);

export const allocateTips = async (actor, input) => {
  managersOnly(actor);
  return prisma.$transaction(async (tx) => {
    const header = await tx.tipReceipt.findUnique({ where: { id: input.tipReceiptId } });
    if (!header) throw notFound('TIP_RECEIPT_NOT_FOUND', `Tip receipt '${input.tipReceiptId}' not found.`);
    await lockStaffPayBranch(tx, header.branchId);
    await tx.$executeRaw`SELECT 1 FROM "TipReceipt" WHERE id = ${input.tipReceiptId} FOR UPDATE`;
    const receipt = await refreshReceipt(tx, input.tipReceiptId).catch(() => null);
    if (!receipt) throw notFound('TIP_RECEIPT_NOT_FOUND', `Tip receipt '${input.tipReceiptId}' not found.`);
    assertBranchAccess(actor, receipt.branchId, 'Access Denied: Cannot allocate tips for another branch.');
    if (toDec(receipt.unallocatedAmount).lessThanOrEqualTo(0)) throw conflict('FULLY_ALLOCATED', `Tip receipt '${receipt.receiptNumber}' is already fully allocated.`);

    const amounts = input.recipients.map((r) => round2(r.amount));
    if (!amounts.length || amounts.some((amount) => amount.lessThanOrEqualTo(0))) throw badRequest('INVALID_AMOUNT', 'Each allocated tip must be greater than zero after rounding.');
    const total = round2(amounts.reduce((s, amount) => s.plus(amount), toDec(0)));
    if (total.greaterThan(receipt.unallocatedAmount)) {
      throw badRequest('OVER_ALLOCATION', `Total allocation amount (${total}) exceeds available unallocated tip balance (${toDec(receipt.unallocatedAmount)}).`);
    }
    const staffRows = await tx.staff.findMany({ where: { id: { in: input.recipients.map((r) => r.staffId) } } });
    const branch = await tx.branch.findUnique({ where: { id: receipt.branchId } });
    const today = await getBusinessDate(tx);
    const time = clockTime();
    const created = [];
    for (const r of input.recipients) {
      const s = staffRows.find((x) => x.id === r.staffId);
      if (!s || !s.isActive || s.branchId !== receipt.branchId) throw badRequest('STAFF_INVALID', `Staff recipient '${r.staffId}' is invalid, inactive, or belongs to another branch.`);
      created.push(await tx.tipAllocation.create({
        data: {
          allocationNumber: await nextSequence(tx, branch.code, 'TA', Number(today.slice(0, 4))), branchId: receipt.branchId, receiptId: receipt.id,
          staffId: s.id, staffName: s.name, amount: round2(r.amount), allocationType: input.allocationType, allocationDate: dateOnly(today),
          allocationTime: time, allocatedByUserId: actor.id, allocatedByName: actor.name, notes: input.notes || null,
        },
        include: allocInclude,
      }));
    }
    const updated = await refreshReceipt(tx, receipt.id);
    await auditLog(tx, { userId: actor.id, userName: actor.name, action: 'TIPS_ALLOCATED', entity: 'TipReceipt', entityId: receipt.id, branchId: receipt.branchId, after: { total: total.toNumber(), recipients: input.recipients.length } });
    const names = await branchNames();
    return { tipReceipt: toReceiptDTO(updated, names.get(updated.branchId)), allocations: created.map(toAllocationDTO) };
  });
};

export const cancelAllocation = async (actor, allocationId, reason) => {
  managersOnly(actor);
  return prisma.$transaction(async (tx) => {
    const header = await tx.tipAllocation.findUnique({ where: { id: allocationId } });
    if (!header) throw notFound('ALLOCATION_NOT_FOUND', `Tip allocation '${allocationId}' not found.`);
    await lockStaffPayBranch(tx, header.branchId);
    await tx.$executeRaw`SELECT 1 FROM "TipAllocation" WHERE id = ${allocationId} FOR UPDATE`;
    const a = await tx.tipAllocation.findUnique({ where: { id: allocationId }, include: allocInclude });
    if (!a) throw notFound('ALLOCATION_NOT_FOUND', `Tip allocation '${allocationId}' not found.`);
    assertBranchAccess(actor, a.branchId, 'Access Denied: Cannot cancel allocation for another branch.');
    if (a.status === 'CANCELLED') throw conflict('ALREADY_CANCELLED', 'This tip allocation is already cancelled.');
    const t = allocationTotals(a);
    if (t.paid.greaterThan(0)) throw conflict('HAS_PAYOUTS', `Cannot cancel tip allocation with active payouts (${t.paid} PKR paid). Linked payouts must be reversed first.`);
    const cancelled = await tx.tipAllocation.update({
      where: { id: allocationId },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationDate: dateOnly(await getBusinessDate(tx)), cancelledByUserId: actor.id, cancelledByName: actor.name, cancelReason: reason },
      include: allocInclude,
    });
    const receipt = await refreshReceipt(tx, a.receiptId);
    await auditLog(tx, { userId: actor.id, userName: actor.name, action: 'TIP_ALLOCATION_CANCELLED', entity: 'TipAllocation', entityId: allocationId, branchId: a.branchId, after: { reason } });
    return { cancelledAllocation: toAllocationDTO(cancelled), tipReceipt: toReceiptDTO(receipt, (await branchNames()).get(receipt.branchId)) };
  });
};

// ═══ PAYOUTS ══════════════════════════════════════════════════════════════════

export const recordPayout = async (actor, input) => {
  managersOnly(actor);
  return prisma.$transaction(async (tx) => {
    const replay = await replayMoneyRequest(tx, actor, input.idempotencyKey, 'POST /api/v1/tips/payouts');
    if (replay) return replay;
    const header = await tx.tipAllocation.findUnique({ where: { id: input.allocationId } });
    if (!header) throw notFound('ALLOCATION_NOT_FOUND', `Tip allocation '${input.allocationId}' not found.`);
    await lockStaffPayBranch(tx, header.branchId);
    await tx.$executeRaw`SELECT 1 FROM "TipAllocation" WHERE id = ${input.allocationId} FOR UPDATE`;
    const a = await tx.tipAllocation.findUnique({ where: { id: input.allocationId }, include: allocInclude });
    if (!a) throw notFound('ALLOCATION_NOT_FOUND', `Tip allocation '${input.allocationId}' not found.`);
    assertBranchAccess(actor, a.branchId, 'Access Denied: Cannot record tip payout for another branch.');
    const t = allocationTotals(a);
    if (t.status === 'CANCELLED') throw conflict('ALLOCATION_CANCELLED', 'Cannot disburse payout against a cancelled tip allocation.');
    if (t.status === 'PAID') throw conflict('ALREADY_PAID', `Tip allocation '${a.allocationNumber}' is already fully paid.`);
    const amount = round2(input.amount);
    if (amount.lessThanOrEqualTo(0)) throw badRequest('INVALID_AMOUNT', 'Tip payout must be greater than zero after rounding.');
    if (amount.greaterThan(t.outstanding)) throw badRequest('OVERPAYMENT', `Payout amount (${amount}) exceeds outstanding allocation balance (${t.outstanding}).`);

    const branch = await tx.branch.findUnique({ where: { id: a.branchId } });
    const today = await getBusinessDate(tx);
    const payoutNumber = await nextSequence(tx, branch.code, 'TP', Number(today.slice(0, 4)));
    const source = await payoutMoney(tx, actor, {
      branchId: a.branchId, method: input.method, onlineAccountId: input.onlineAccountId, amount, type: 'TIP_PAYOUT',
      sourceModule: 'TIPS', sourceId: a.id, reference: payoutNumber, description: `Tip payout to ${a.staffName} (${a.allocationNumber})`,
    });
    const payout = await tx.tipPayout.create({
      data: {
        payoutNumber, branchId: a.branchId, allocationId: a.id, staffId: a.staffId, staffName: a.staffName, amount, method: input.method,
        cashDrawerId: source.cashDrawerId, onlineAccountId: source.onlineAccountId, onlineAccountName: source.onlineAccountName,
        payoutDate: dateOnly(today), payoutTime: clockTime(), paidByUserId: actor.id, paidByName: actor.name,
        reference: input.reference || null, notes: input.notes || null,
      },
      include: payoutInclude,
    });
    await auditLog(tx, { userId: actor.id, userName: actor.name, action: 'TIP_PAID_OUT', entity: 'TipPayout', entityId: payout.id, branchId: a.branchId, after: { amount: amount.toNumber() } });
    const fresh = await tx.tipAllocation.findUnique({ where: { id: a.id }, include: allocInclude });
    return saveMoneyResponse(tx, actor, input.idempotencyKey, 'POST /api/v1/tips/payouts', { payout: toPayoutDTO(payout), allocation: toAllocationDTO(fresh) });
  });
};

export const reversePayout = async (actor, { payoutId, reversalReason, receivingDrawerId }) => {
  managersOnly(actor);
  return prisma.$transaction(async (tx) => {
    const header = await tx.tipPayout.findUnique({ where: { id: payoutId } });
    if (!header) throw notFound('PAYOUT_NOT_FOUND', `Tip payout '${payoutId}' not found.`);
    await lockStaffPayBranch(tx, header.branchId);
    await tx.$executeRaw`SELECT 1 FROM "TipPayout" WHERE id = ${payoutId} FOR UPDATE`;
    const p = await tx.tipPayout.findUnique({ where: { id: payoutId } });
    if (!p) throw notFound('PAYOUT_NOT_FOUND', `Tip payout '${payoutId}' not found.`);
    assertBranchAccess(actor, p.branchId, 'Access Denied: Cannot reverse tip payout for another branch.');
    if (p.status === 'REVERSED') throw conflict('ALREADY_REVERSED', 'This tip payout is already reversed.');
    const back = await reverseMoney(tx, actor, {
      branchId: p.branchId, method: p.method, onlineAccountId: p.onlineAccountId, receivingDrawerId, amount: p.amount, sourceModule: 'TIPS',
      sourceId: p.id, reference: p.payoutNumber, description: `Reversal of tip payout ${p.payoutNumber}: ${reversalReason}`,
    });
    const today = await getBusinessDate(tx);
    const updated = await tx.tipPayout.update({
      where: { id: payoutId },
      data: {
        status: 'REVERSED', reversalReason, reversedAt: new Date(), reversalDate: dateOnly(today),
        reversedByUserId: actor.id, reversedByName: actor.name, reversalReceivingDrawerId: back.receivingDrawerId,
      },
      include: payoutInclude,
    });
    await auditLog(tx, { userId: actor.id, userName: actor.name, action: 'TIP_PAYOUT_REVERSED', entity: 'TipPayout', entityId: payoutId, branchId: p.branchId, after: { reversalReason } });
    const a = await tx.tipAllocation.findUnique({ where: { id: p.allocationId }, include: allocInclude });
    return { reversedPayout: toPayoutDTO(updated), allocation: toAllocationDTO(a) };
  });
};

// ═══ STATEMENT ════════════════════════════════════════════════════════════════

/** Customer tip refunds spread over the invoice's receipts in collection order (same rule as tipRefundedFor). */
const refundTipEvents = (refunds, receipts) => {
  const out = [];
  for (const rf of refunds) {
    let remaining = toDec(rf.tipReversed);
    for (const rc of receipts.filter((x) => x.invoiceId === rf.invoiceId).sort((a, b) => a.createdAt - b.createdAt)) {
      if (remaining.lessThanOrEqualTo(0)) break;
      const take = remaining.lessThan(rc.collectedAmount) ? remaining : toDec(rc.collectedAmount);
      out.push({ receipt: rc, date: ymd(rf.refundDate), amount: take });
      remaining = remaining.minus(take);
    }
  }
  return out;
};

/**
 * Tip liability statement (spec §4.4, §13.1, §14). Every figure is a dated event, so a payout
 * reversed in a later period stays in its own period and the reversal lands on its own date.
 * Filters apply to every event, so opening + movement = closing = unallocated + allocated-unpaid
 * holds for any filter. paymentSource = how the tip was collected (CASH | ONLINE_ACCOUNT).
 * With a staff filter the liability is that staff member's: allocated − cancelled − paid + reversed.
 */
export const statement = async (actor, { branchId, startDate, endDate, staffId, paymentSource } = {}) => {
  managersOnly(actor);
  const b = resolveReadBranch(actor, branchId);
  const s = startDate || '2000-01-01';
  const e = endDate || '2099-12-31';
  const where = b ? { branchId: b } : {};
  const [allReceipts, allAllocations, allPayouts, refunds] = await Promise.all([
    prisma.tipReceipt.findMany({ where }),
    prisma.tipAllocation.findMany({ where, include: allocInclude }),
    prisma.tipPayout.findMany({ where, include: payoutInclude }),
    prisma.invoiceRefund.findMany({ where: { tipReversed: { gt: 0 }, ...(b ? { invoice: { branchId: b } } : {}) } }),
  ]);
  const d = (x) => ymd(x);
  const cancelDay = (a) => (a.cancellationDate ? ymd(a.cancellationDate) : a.cancelledAt ? toDateString(a.cancelledAt) : null);
  const sum = (arr, f) => round2(arr.reduce((t, x) => t.plus(f(x)), toDec(0)));
  const before = (day) => day < s;
  const inRange = (day) => day >= s && day <= e;
  const asOf = (day) => day <= e;

  const source = paymentSource === 'ONLINE' ? 'ONLINE_ACCOUNT' : paymentSource;
  const bySource = !source || source === 'ALL' ? () => true : (r) => r.method === source;
  const byStaff = staffId && staffId !== 'ALL';
  const receipts = allReceipts.filter(bySource);
  const receiptIds = new Set(receipts.map((r) => r.id));
  const allocations = allAllocations.filter((a) => receiptIds.has(a.receiptId) && (!byStaff || a.staffId === staffId));
  const payouts = allPayouts.filter((p) => receiptIds.has(p.allocation.receiptId) && (!byStaff || p.staffId === staffId));
  const refundEvents = refundTipEvents(refunds, allReceipts).filter((x) => receiptIds.has(x.receipt.id));
  const cancelled = allocations.filter((a) => cancelDay(a));

  // Liability increases: tips collected (branch view) or allocated to the staff member (staff view).
  const inflow = byStaff
    ? (pick) => round2(sum(allocations.filter((a) => pick(d(a.allocationDate))), (a) => a.amount).minus(sum(cancelled.filter((a) => pick(cancelDay(a))), (a) => a.amount)))
    : (pick) => round2(sum(receipts.filter((r) => pick(d(r.collectionDate))), (r) => r.collectedAmount).minus(sum(refundEvents.filter((x) => pick(x.date)), (x) => x.amount)));
  const outflow = (pick) => round2(sum(payouts.filter((p) => pick(d(p.payoutDate))), (p) => p.amount).minus(sum(payouts.filter((p) => p.reversalDate && pick(d(p.reversalDate))), (p) => p.amount)));

  const openingLiability = round2(inflow(before).minus(outflow(before)));
  const netTipsCollected = inflow(inRange);
  const netPayouts = outflow(inRange);
  const closingLiability = round2(openingLiability.plus(netTipsCollected).minus(netPayouts));

  // Independent check as of the end date: unallocated + allocated-unpaid.
  const activeAlloc = allocations.filter((a) => asOf(d(a.allocationDate)) && !(cancelDay(a) && asOf(cancelDay(a))));
  const allocatedUnpaidTips = sum(activeAlloc, (a) => {
    const paid = a.payouts.filter((p) => asOf(d(p.payoutDate))).reduce((t, p) => t.plus(p.amount), toDec(0))
      .minus(a.payouts.filter((p) => p.reversalDate && asOf(d(p.reversalDate))).reduce((t, p) => t.plus(p.amount), toDec(0)));
    return Decimal_max0(toDec(a.amount).minus(paid));
  });
  const unallocatedTips = byStaff ? toDec(0) : Decimal_max0(round2(
    sum(receipts.filter((r) => asOf(d(r.collectionDate))), (r) => r.collectedAmount)
      .minus(sum(activeAlloc, (a) => a.amount)).minus(sum(refundEvents.filter((x) => asOf(x.date)), (x) => x.amount))
  ));

  const periodReceipts = receipts.filter((r) => inRange(d(r.collectionDate)) && (!byStaff || r.directStaffId === staffId));
  const periodAllocations = allocations.filter((a) => inRange(d(a.allocationDate)));
  const shownPayouts = payouts.filter((p) => inRange(d(p.payoutDate)) || (p.reversalDate && inRange(d(p.reversalDate))));
  const names = await branchNames();
  return {
    summary: {
      liabilityBasis: byStaff ? 'STAFF_ALLOCATIONS' : 'TIP_COLLECTIONS',
      openingLiability: openingLiability.toNumber(), netTipsCollected: netTipsCollected.toNumber(), netPayouts: netPayouts.toNumber(),
      closingLiability: closingLiability.toNumber(), unallocatedTips: unallocatedTips.toNumber(), allocatedUnpaidTips: allocatedUnpaidTips.toNumber(),
      variance: round2(closingLiability.minus(unallocatedTips).minus(allocatedUnpaidTips)).toNumber(),
      receiptsCount: periodReceipts.length, allocationsCount: periodAllocations.length, payoutsCount: shownPayouts.length,
    },
    receipts: periodReceipts.sort((x, y) => y.collectionDate - x.collectionDate).map((r) => toReceiptDTO(r, names.get(r.branchId))),
    allocations: periodAllocations.sort((x, y) => y.allocationDate - x.allocationDate).map(toAllocationDTO),
    payouts: shownPayouts.sort((x, y) => y.payoutDate - x.payoutDate).map(toPayoutDTO),
  };
};

export const personalTips = async (actor) => {
  if (!actor.staffId) throw forbidden('FORBIDDEN', 'Staff record associated with the authenticated user could not be found.');
  const allocations = (await prisma.tipAllocation.findMany({ where: { staffId: actor.staffId, status: { not: 'CANCELLED' } }, include: allocInclude, orderBy: { allocationDate: 'desc' } })).map(toAllocationDTO);
  const payouts = (await prisma.tipPayout.findMany({ where: { staffId: actor.staffId }, include: payoutInclude, orderBy: { payoutDate: 'desc' } })).map(toPayoutDTO);
  const totalAllocated = round2(allocations.reduce((s, a) => s.plus(a.amount), toDec(0)));
  const totalPaid = round2(allocations.reduce((s, a) => s.plus(a.paidAmount), toDec(0)));
  return {
    summary: { totalAllocated: totalAllocated.toNumber(), totalPaid: totalPaid.toNumber(), totalOutstanding: round2(totalAllocated.minus(totalPaid)).toNumber() },
    allocations, payouts,
  };
};
