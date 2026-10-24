// src/modules/expenses/expenses.service.js
// Expense vouchers: drafts → posted (money leaves a cash drawer or bank account) → reversed.
// Posted vouchers are never edited or deleted; a reversal is a separate dated REV voucher.

import prisma from '../../config/prisma.js';
import { auditLog } from '../../lib/audit.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/AppError.js';
import { assertBranchAccess, resolveReadBranch, resolveWriteBranch } from '../../lib/scope.js';
import { dateOnly, getBusinessDate, toTimeString, ymd } from '../../lib/dates.js';
import { round2 } from '../../lib/money.js';
import { nextSequence } from '../../lib/sequence.js';
import { num, opt, iso } from '../../lib/dto.js';
import { formatMinutesToTime, parseTimeToMinutes } from '../../lib/calculations/attendanceCalculations.js';
import { getActiveDrawer, postCashMovement, postAccountMovement } from '../cash/cash.service.js';

const clockTime = () => formatMinutesToTime(parseTimeToMinutes(toTimeString(new Date())));

export const toExpenseDTO = (e) => ({
  id: e.id, voucherNumber: e.voucherNumber, branchId: e.branchId,
  expenseDate: ymd(e.expenseDate), date: ymd(e.expenseDate), time: e.time,
  title: e.title, payee: e.payee, description: opt(e.description), category: e.category, amount: num(e.amount),
  paymentSource: e.paymentSource, paymentAccountId: opt(e.paymentAccountId), paymentAccountName: opt(e.paymentAccountName),
  createdByUserId: e.createdByUserId, createdByName: e.createdByName, paidByUserId: opt(e.paidByUserId), paidByName: opt(e.paidByName),
  status: e.status, externalReference: opt(e.externalReference), notes: opt(e.notes), idempotencyKey: opt(e.idempotencyKey),
  paidFromDrawerId: opt(e.paidFromDrawerId), receivingDrawerId: opt(e.receivingDrawerId),
  receivingCustodianUserId: opt(e.receivingCustodianUserId), receivingCustodianName: opt(e.receivingCustodianName),
  reversalOfVoucherNumber: opt(e.reversalOfVoucherNumber), reversalVoucherNumber: opt(e.reversalVoucherNumber),
  reversedByUserId: opt(e.reversedByUserId), reversedByName: opt(e.reversedByName), reversedAt: iso(e.reversedAt),
  reversalReason: opt(e.reversalReason), isReversalRecord: e.isReversalRecord,
  createdAt: iso(e.createdAt), updatedAt: iso(e.updatedAt),
});

const noStaff = (actor) => {
  if (actor.role === 'STAFF') throw forbidden('FORBIDDEN', 'Access Denied: Staff members cannot access expense management.');
};

/** Accountants only see vouchers they created or paid. */
const assertCanSee = (actor, e) => {
  assertBranchAccess(actor, e.branchId, 'Access Denied: Cannot access expenses from another branch.');
  if (actor.role === 'ACCOUNTANT' && e.createdByUserId !== actor.id && e.paidByUserId !== actor.id) {
    throw forbidden('FORBIDDEN', 'Access Denied: Accountants can only view their own expense vouchers.');
  }
};

const assertCanEditDraft = (actor, e) => {
  if (e.status !== 'DRAFT') throw conflict('NOT_DRAFT', `Cannot change expense with status '${e.status}'. Only DRAFT expenses can be edited or deleted.`);
  assertBranchAccess(actor, e.branchId, 'Access Denied: Cannot modify drafts for another branch.');
  if (actor.role === 'ACCOUNTANT' && e.createdByUserId !== actor.id) {
    throw forbidden('FORBIDDEN', 'Access Denied: Accountants can only modify their own draft expenses.');
  }
};

const assertCategory = async (tx, branchId, name) => {
  const cat = await tx.expenseCategory.findFirst({ where: { branchId, name: { equals: name, mode: 'insensitive' } } });
  if (!cat) throw badRequest('CATEGORY_INVALID', `Expense category '${name}' does not exist in this branch.`);
  if (!cat.isActive) throw badRequest('CATEGORY_INACTIVE', `Expense category '${cat.name}' is deactivated.`);
  return cat.name;
};

// ── Queries ──────────────────────────────────────────────────────────────────

export const listExpenses = async (actor, q = {}) => {
  noStaff(actor);
  const b = resolveReadBranch(actor, q.branchId);
  const where = {
    ...(b ? { branchId: b } : {}),
    ...(actor.role === 'ACCOUNTANT' ? { OR: [{ createdByUserId: actor.id }, { paidByUserId: actor.id }] } : {}),
    ...(q.status ? { status: q.status === 'PAID' ? 'POSTED' : q.status } : {}),
    ...(q.category ? { category: { equals: q.category, mode: 'insensitive' } } : {}),
    ...(q.paymentSource ? { paymentSource: q.paymentSource } : {}),
    ...(q.userId ? { AND: [{ OR: [{ createdByUserId: q.userId }, { paidByUserId: q.userId }] }] } : {}),
    ...(q.startDate || q.endDate ? { expenseDate: { ...(q.startDate ? { gte: dateOnly(q.startDate) } : {}), ...(q.endDate ? { lte: dateOnly(q.endDate) } : {}) } } : {}),
  };
  if (q.search) {
    where.AND = [...(where.AND ?? []), {
      OR: ['voucherNumber', 'payee', 'title', 'description', 'notes', 'paymentAccountName'].map((f) => ({ [f]: { contains: q.search, mode: 'insensitive' } })),
    }];
  }
  const rows = await prisma.expense.findMany({ where, orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }] });
  return rows.map(toExpenseDTO);
};

export const getExpense = async (actor, id) => {
  noStaff(actor);
  const e = await prisma.expense.findUnique({ where: { id } });
  if (!e) return null;
  assertCanSee(actor, e);
  return toExpenseDTO(e);
};

// ── Drafts ───────────────────────────────────────────────────────────────────

export const createDraft = async (input, actor) => {
  noStaff(actor);
  const branchId = resolveWriteBranch(actor, input.branchId, 'Access Denied: Cannot create expense drafts for another branch.');
  return prisma.$transaction(async (tx) => {
    const branch = await tx.branch.findUnique({ where: { id: branchId } });
    if (!branch?.isActive) throw badRequest('BRANCH_INACTIVE', `Branch '${branchId}' is invalid or deactivated.`);
    const date = input.expenseDate || input.date || (await getBusinessDate(tx));
    const e = await tx.expense.create({
      data: {
        voucherNumber: await nextSequence(tx, branch.code, 'DFT', Number(date.slice(0, 4))), branchId,
        expenseDate: dateOnly(date), time: clockTime(), title: input.title, payee: input.payee,
        description: input.description || input.title, category: await assertCategory(tx, branchId, input.category),
        amount: round2(input.amount), paymentSource: input.paymentSource || 'CASH_DRAWER',
        paymentAccountId: input.paymentAccountId || null, externalReference: input.externalReference || null, notes: input.notes || null,
        createdByUserId: actor.id, createdByName: actor.name,
      },
    });
    await auditLog(tx, { userId: actor.id, userName: actor.name, action: 'EXPENSE_DRAFTED', entity: 'Expense', entityId: e.id, branchId });
    return toExpenseDTO(e);
  });
};

export const updateDraft = async (id, input, actor) => {
  noStaff(actor);
  return prisma.$transaction(async (tx) => {
    const e = await tx.expense.findUnique({ where: { id } });
    if (!e) throw notFound('EXPENSE_NOT_FOUND', 'Expense draft not found.');
    assertCanEditDraft(actor, e);
    const data = {};
    for (const f of ['title', 'payee', 'description', 'paymentSource', 'externalReference', 'notes']) if (input[f] !== undefined) data[f] = input[f];
    if (input.paymentAccountId !== undefined) data.paymentAccountId = input.paymentAccountId || null;
    if (input.amount !== undefined) data.amount = round2(input.amount);
    if (input.category !== undefined) data.category = await assertCategory(tx, e.branchId, input.category);
    const d = input.expenseDate || input.date;
    if (d) data.expenseDate = dateOnly(d);
    return toExpenseDTO(await tx.expense.update({ where: { id }, data }));
  });
};

export const deleteDraft = async (id, actor) => {
  noStaff(actor);
  return prisma.$transaction(async (tx) => {
    const e = await tx.expense.findUnique({ where: { id } });
    if (!e) throw notFound('EXPENSE_NOT_FOUND', 'Expense draft not found.');
    assertCanEditDraft(actor, e);
    await tx.expense.delete({ where: { id } }); // drafts have no financial effect, so deletion is allowed
    await auditLog(tx, { userId: actor.id, userName: actor.name, action: 'EXPENSE_DRAFT_DELETED', entity: 'Expense', entityId: id, branchId: e.branchId });
    return { success: true, message: `Draft expense ${e.voucherNumber} has been deleted.` };
  });
};

// ── Post & reverse ───────────────────────────────────────────────────────────

export const postExpense = async (input, actor, idempotencyKey) => {
  noStaff(actor);
  const branchId = resolveWriteBranch(actor, input.branchId, 'Access Denied: Cannot perform operations for another branch.');
  return prisma.$transaction(async (tx) => {
    const branch = await tx.branch.findUnique({ where: { id: branchId } });
    if (!branch?.isActive) throw badRequest('BRANCH_INACTIVE', `Branch '${branchId}' is invalid or deactivated.`);

    let draft = null;
    if (input.expenseId) {
      draft = await tx.expense.findUnique({ where: { id: input.expenseId } });
      if (!draft) throw notFound('EXPENSE_NOT_FOUND', `Existing expense draft '${input.expenseId}' not found.`);
      assertCanEditDraft(actor, draft);
    }

    const date = input.expenseDate || (await getBusinessDate(tx));
    const amount = round2(input.amount);
    const voucherNumber = await nextSequence(tx, branch.code, 'EXP', Number(date.slice(0, 4)));
    const category = await assertCategory(tx, branchId, input.category);
    const money = { sourceModule: 'EXPENSE', reference: voucherNumber, actor, description: `${category}: ${input.title} (${input.payee})` };

    let paidFromDrawerId = null;
    let paymentAccountName = null;
    if (input.paymentSource === 'CASH_DRAWER') {
      // Cash is paid out of the actor's own open drawer — never auto-opened for a payout.
      const drawer = await getActiveDrawer(tx, actor, branchId, { autoOpen: false }).catch((err) => {
        if (err.code === 'NO_OPEN_DRAWER') {
          throw badRequest('NO_OPEN_DRAWER', `Cash expense posting requires an active open cash drawer for ${actor.name} in branch '${branch.name}'.`);
        }
        throw err;
      });
      await postCashMovement(tx, { ...money, holderId: drawer.id, type: 'EXPENSE', direction: 'OUT', amount });
      paidFromDrawerId = drawer.id;
    } else {
      if (!input.paymentAccountId) throw badRequest('ACCOUNT_REQUIRED', 'A payment account must be selected when payment method is Online Account.');
      const { account } = await postAccountMovement(tx, { ...money, accountId: input.paymentAccountId, branchId, type: 'EXPENSE', direction: 'OUT', amount });
      paymentAccountName = account.name;
    }

    const data = {
      voucherNumber, branchId, expenseDate: dateOnly(date), time: clockTime(), title: input.title, payee: input.payee,
      description: input.description || input.title, category, amount, paymentSource: input.paymentSource,
      paymentAccountId: input.paymentSource === 'ONLINE_ACCOUNT' ? input.paymentAccountId : null, paymentAccountName,
      externalReference: input.externalReference || null, notes: input.notes || null, idempotencyKey: idempotencyKey ?? input.idempotencyKey ?? null,
      paidByUserId: actor.id, paidByName: actor.name, paidFromDrawerId, status: 'POSTED',
    };
    const e = draft
      ? await tx.expense.update({ where: { id: draft.id }, data })
      : await tx.expense.create({ data: { ...data, createdByUserId: actor.id, createdByName: actor.name } });

    await tx.drawerMovement.updateMany({ where: { reference: voucherNumber }, data: { sourceId: e.id } });
    await tx.accountMovement.updateMany({ where: { reference: voucherNumber }, data: { sourceId: e.id } });
    await auditLog(tx, { userId: actor.id, userName: actor.name, action: 'EXPENSE_POSTED', entity: 'Expense', entityId: e.id, branchId, after: { voucherNumber, amount: amount.toNumber() } });
    return toExpenseDTO(e);
  });
};

export const reverseExpense = async (id, reason, actor) => {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(actor.role)) {
    throw forbidden('FORBIDDEN', 'Access Denied: Only Super Admin and Branch Admin can reverse posted expenses.');
  }
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT 1 FROM "Expense" WHERE id = ${id} FOR UPDATE`;
    const e = await tx.expense.findUnique({ where: { id } });
    if (!e) throw notFound('EXPENSE_NOT_FOUND', 'Expense not found.');
    assertBranchAccess(actor, e.branchId, 'Access Denied: Cannot reverse expenses from another branch.');
    if (e.status === 'REVERSED') throw conflict('ALREADY_REVERSED', `Expense voucher '${e.voucherNumber}' has already been reversed.`);
    if (e.status === 'DRAFT') throw badRequest('IS_DRAFT', 'Draft expenses cannot be reversed; they can be deleted.');

    const branch = await tx.branch.findUnique({ where: { id: e.branchId } });
    const today = await getBusinessDate(tx);
    const revNumber = await nextSequence(tx, branch.code, 'REV', Number(today.slice(0, 4)));
    const money = { sourceModule: 'EXPENSE', reference: revNumber, actor, description: `Reversal of ${e.voucherNumber}: ${reason}` };

    // Refunded money comes back as a dated IN movement — the original drawer history is never rewritten.
    let receiving = {};
    if (e.paymentSource === 'CASH_DRAWER') {
      const drawer = await getActiveDrawer(tx, actor, e.branchId);
      await postCashMovement(tx, { ...money, holderId: drawer.id, type: 'EXPENSE_REVERSAL', direction: 'IN', amount: e.amount });
      receiving = { receivingDrawerId: drawer.id, receivingCustodianUserId: actor.id, receivingCustodianName: actor.name };
    } else {
      await postAccountMovement(tx, { ...money, accountId: e.paymentAccountId, branchId: e.branchId, type: 'EXPENSE_REVERSAL', direction: 'IN', amount: e.amount });
    }

    const now = new Date();
    const original = await tx.expense.update({
      where: { id },
      data: { status: 'REVERSED', reversalVoucherNumber: revNumber, reversalReason: reason, reversedByUserId: actor.id, reversedByName: actor.name, reversedAt: now },
    });
    const reversal = await tx.expense.create({
      data: {
        voucherNumber: revNumber, branchId: e.branchId, expenseDate: dateOnly(today), time: clockTime(),
        title: `Reversal: ${e.title}`, payee: e.payee, description: `Reversal of ${e.voucherNumber}. Reason: ${reason}`,
        category: e.category, amount: e.amount, paymentSource: e.paymentSource, paymentAccountId: e.paymentAccountId,
        paymentAccountName: e.paymentAccountName, status: 'REVERSED', isReversalRecord: true, reversalOfVoucherNumber: e.voucherNumber,
        reversalReason: reason, createdByUserId: actor.id, createdByName: actor.name, paidByUserId: actor.id, paidByName: actor.name,
        paidFromDrawerId: e.paidFromDrawerId, ...receiving,
      },
    });
    await auditLog(tx, { userId: actor.id, userName: actor.name, action: 'EXPENSE_REVERSED', entity: 'Expense', entityId: id, branchId: e.branchId, after: { revNumber, reason } });
    return { originalExpense: toExpenseDTO(original), reversalExpense: toExpenseDTO(reversal) };
  });
};
