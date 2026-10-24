// src/modules/cash/cash.service.js
// The money core. Every cash or bank movement in the system goes through this module:
//   • cash  → DrawerMovement on a holder (user DRAWER or branch VAULT)
//   • bank  → AccountMovement on a PaymentAccount
// Balances are always derived (Σ IN − Σ OUT). OUT movements are rejected if they would make
// the holder/account negative. Callers MUST pass their own transaction (`tx`) so the business
// record and the money movement commit or roll back together.

import prisma from '../../config/prisma.js';
import { auditLog } from '../../lib/audit.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/AppError.js';
import { assertBranchAccess, resolveReadBranch, resolveWriteBranch } from '../../lib/scope.js';
import { dateOnly, getBusinessDate } from '../../lib/dates.js';
import { round2, toDec } from '../../lib/money.js';
import { nextSequence } from '../../lib/sequence.js';
import { accountBalance } from '../../lib/balances.js';
import { toCashDrawerDTO, toDrawerMovementDTO, toCashTransferDTO, toAccountMovementDTO, summarizeMovements } from './cash.mapper.js';

// ═══ Holders (drawers & vault) ════════════════════════════════════════════════

/** Row-lock a cash holder for the rest of the transaction (serialises concurrent postings). */
export const lockHolder = async (tx, holderId) => {
  await tx.$executeRaw`SELECT 1 FROM "CashDrawer" WHERE id = ${holderId} FOR UPDATE`;
  const holder = await tx.cashDrawer.findUnique({ where: { id: holderId } });
  if (!holder) throw notFound('DRAWER_NOT_FOUND', `Cash drawer '${holderId}' not found.`);
  return holder;
};

/** Current balance of a holder (Σ IN − Σ OUT). */
export const holderBalance = async (tx, holderId) => {
  const sums = await tx.drawerMovement.groupBy({ by: ['direction'], where: { drawerId: holderId }, _sum: { amount: true } });
  const inSum = sums.find((s) => s.direction === 'IN')?._sum.amount ?? 0;
  const outSum = sums.find((s) => s.direction === 'OUT')?._sum.amount ?? 0;
  return toDec(inSum).minus(toDec(outSum));
};

/** The branch safe (admin custody). Created on first use. */
export const ensureVault = async (tx, branchId) => {
  const existing = await tx.cashDrawer.findFirst({ where: { branchId, kind: 'VAULT' } });
  if (existing) return existing;
  // Serialise vault creation per branch.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`vault:${branchId}`}::text))`;
  return (
    (await tx.cashDrawer.findFirst({ where: { branchId, kind: 'VAULT' } })) ??
    tx.cashDrawer.create({
      data: { kind: 'VAULT', branchId, custodianName: 'Branch Vault (Admin Safe)', date: dateOnly(await getBusinessDate(tx)) },
    })
  );
};

/**
 * The actor's active cash drawer in `branchId`.
 * A drawer awaiting settlement review is LOCKED: no cash may move through it.
 * With autoOpen (default) a new drawer is opened on the first cash transaction, like the mock.
 */
export const getActiveDrawer = async (tx, actor, branchId, { autoOpen = true } = {}) => {
  const drawers = await tx.cashDrawer.findMany({
    where: { branchId, kind: 'DRAWER', custodianUserId: actor.id, status: { in: ['OPEN', 'SETTLEMENT_PENDING'] } },
  });
  if (drawers.some((d) => d.status === 'SETTLEMENT_PENDING')) {
    throw conflict(
      'DRAWER_LOCKED',
      'Your cash drawer is locked pending settlement review. Cannot post cash transactions until approved or unlocked.'
    );
  }
  if (drawers[0]) return drawers[0];
  if (!autoOpen) throw badRequest('NO_OPEN_DRAWER', 'You do not have an open cash drawer in this branch.');

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`drawer:${actor.id}:${branchId}`}::text))`;
  const raced = await tx.cashDrawer.findFirst({ where: { branchId, kind: 'DRAWER', custodianUserId: actor.id, status: 'OPEN' } });
  if (raced) return raced;
  return tx.cashDrawer.create({
    data: {
      kind: 'DRAWER', branchId, custodianUserId: actor.id, custodianName: actor.name,
      date: dateOnly(await getBusinessDate(tx)),
    },
  });
};

/**
 * Post one cash movement. OUT movements may never exceed the holder's balance.
 * @param {object} tx
 * @param {{ holderId: string, type: string, direction: 'IN'|'OUT', amount: any, sourceModule: string,
 *           sourceId?: string, reference?: string, description?: string, actor: {id,name},
 *           allowLocked?: boolean }} m
 */
export const postCashMovement = async (tx, m) => {
  const amount = round2(m.amount);
  if (amount.lessThanOrEqualTo(0)) throw badRequest('INVALID_AMOUNT', 'Cash movement amount must be positive.');

  const holder = await lockHolder(tx, m.holderId);
  if (holder.status === 'SETTLED') throw conflict('DRAWER_CLOSED', 'This cash drawer has already been settled and closed.');
  if (holder.status === 'SETTLEMENT_PENDING' && !m.allowLocked) {
    throw conflict('DRAWER_LOCKED', 'This cash drawer is locked pending settlement review.');
  }

  if (m.direction === 'OUT') {
    const balance = await holderBalance(tx, holder.id);
    if (balance.lessThan(amount)) {
      throw conflict(
        'INSUFFICIENT_DRAWER_CASH',
        `Insufficient cash in ${holder.kind === 'VAULT' ? 'the branch vault' : `${holder.custodianName}'s drawer`}: ` +
          `available PKR ${balance.toFixed(2)}, required PKR ${amount.toFixed(2)}.`
      );
    }
  }

  return tx.drawerMovement.create({
    data: {
      drawerId: holder.id, branchId: holder.branchId, type: m.type, direction: m.direction, amount,
      ...(m.transactionDate ? { createdAt: new Date(m.transactionDate.toISOString().slice(0, 10) + "T12:00:00+05:00") } : {}),
      sourceModule: m.sourceModule, sourceId: m.sourceId ?? null, reference: m.reference ?? null,
      description: m.description ?? null, userId: m.actor.id, userName: m.actor.name,
    },
  });
};

// ═══ Payment (bank/online) accounts ═══════════════════════════════════════════

/**
 * Post one bank/online account movement after validating the account belongs to the branch and
 * is active. OUT movements may not overdraw the account.
 */
export const postAccountMovement = async (tx, m) => {
  const amount = round2(m.amount);
  if (amount.lessThanOrEqualTo(0)) throw badRequest('INVALID_AMOUNT', 'Account movement amount must be positive.');

  await tx.$executeRaw`SELECT 1 FROM "PaymentAccount" WHERE id = ${m.accountId} FOR UPDATE`;
  const account = await tx.paymentAccount.findUnique({ where: { id: m.accountId }, include: { branches: true } });
  if (!account || (account.branchId !== m.branchId && !account.branches.some((b) => b.id === m.branchId)) || !account.isActive) {
    throw badRequest('ACCOUNT_INVALID', `Payment account '${m.accountId}' is invalid or deactivated for this branch.`);
  }
  if (m.direction === 'OUT') {
    const balance = await accountBalance(account.id, { tx, branchIds: [m.branchId] });
    if (balance.lessThan(amount)) {
      throw conflict(
        'INSUFFICIENT_ACCOUNT_BALANCE',
        `Insufficient balance in '${account.name}': available PKR ${balance.toFixed(2)}, required PKR ${amount.toFixed(2)}.`
      );
    }
  }
  const movement = await tx.accountMovement.create({
    data: {
      accountId: account.id, branchId: m.branchId, type: m.type, direction: m.direction, amount,
      ...(m.transactionDate ? { createdAt: new Date(m.transactionDate.toISOString().slice(0, 10) + "T12:00:00+05:00") } : {}),
      sourceModule: m.sourceModule, sourceId: m.sourceId ?? null, reference: m.reference ?? null,
      description: m.description ?? null, userId: m.actor.id, userName: m.actor.name,
    },
  });
  return { movement, account };
};

// ═══ Staff payouts (payroll, commission, tips) ════════════════════════════════

/**
 * Pay money out to staff from the actor's own OPEN drawer (CASH) or a named branch account (ONLINE).
 * Payouts never auto-open a drawer. Returns where the money came from.
 */
export const payoutMoney = async (tx, actor, { branchId, method, onlineAccountId, amount, type, sourceModule, sourceId, reference, description }) => {
  if (method === 'CASH') {
    let drawer;
    try {
      drawer = await getActiveDrawer(tx, actor, branchId, { autoOpen: false });
    } catch (e) {
      if (e.code === 'NO_OPEN_DRAWER') throw badRequest('NO_OPEN_DRAWER', 'Cash payout requires an OPEN cash drawer assigned to you in this branch.');
      throw e;
    }
    await postCashMovement(tx, { holderId: drawer.id, type, direction: 'OUT', amount, sourceModule, sourceId, reference, description, actor });
    return { cashDrawerId: drawer.id, onlineAccountId: null, onlineAccountName: null };
  }
  if (!onlineAccountId) throw badRequest('ACCOUNT_REQUIRED', 'Payment account must be selected for online payment.');
  const { account } = await postAccountMovement(tx, { accountId: onlineAccountId, branchId, type, direction: 'OUT', amount, sourceModule, sourceId, reference, description, actor });
  return { cashDrawerId: null, onlineAccountId: account.id, onlineAccountName: account.name };
};

/**
 * Bring a reversed payout back as a dated IN movement. Cash returns to the reversing actor's active
 * drawer (the original drawer may already be settled — its history is never rewritten).
 */
export const reverseMoney = async (tx, actor, { branchId, method, onlineAccountId, receivingDrawerId, amount, sourceModule, sourceId, reference, description }) => {
  if (method === 'CASH') {
    const drawer = receivingDrawerId ? await lockHolder(tx, receivingDrawerId) : await getActiveDrawer(tx, actor, branchId);
    assertBranchAccess(actor, drawer.branchId);
    if (drawer.branchId !== branchId || drawer.status !== 'OPEN' || drawer.kind !== 'DRAWER') throw badRequest('INVALID_RECEIVING_DRAWER', 'Receiving drawer must be open and belong to the payment branch.');
    await postCashMovement(tx, { holderId: drawer.id, type: 'REVERSAL', direction: 'IN', amount, sourceModule, sourceId, reference, description, actor });
    return { receivingDrawerId: drawer.id };
  }
  await postAccountMovement(tx, { accountId: onlineAccountId, branchId, type: 'REVERSAL', direction: 'IN', amount, sourceModule, sourceId, reference, description, actor });
  return { receivingDrawerId: null };
};

// ═══ Queries ══════════════════════════════════════════════════════════════════

/** DTOs for a list of holders with totals derived from their movements. */
export const drawerDTOs = async (tx, holders) => {
  if (!holders.length) return [];
  const sums = await tx.drawerMovement.groupBy({
    by: ['drawerId', 'type', 'direction'],
    where: { drawerId: { in: holders.map((h) => h.id) } },
    _sum: { amount: true },
  });
  return holders.map((h) => toCashDrawerDTO(h, summarizeMovements(sums.filter((s) => s.drawerId === h.id))));
};

export const listDrawers = async (actor, { branchId, userId, status } = {}) => {
  const b = resolveReadBranch(actor, branchId);
  // Accountants only ever see their own drawers.
  const custodian = actor.role === 'ACCOUNTANT' ? actor.id : userId;
  const holders = await prisma.cashDrawer.findMany({
    where: { kind: 'DRAWER', ...(b ? { branchId: b } : {}), ...(custodian ? { custodianUserId: custodian } : {}), ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
  });
  return drawerDTOs(prisma, holders);
};

export const myDrawer = async (actor, branchId) => {
  const b = resolveWriteBranch(actor, branchId);
  const holder = await prisma.cashDrawer.findFirst({
    where: { kind: 'DRAWER', branchId: b, custodianUserId: actor.id, status: { in: ['OPEN', 'SETTLEMENT_PENDING'] } },
  });
  return holder ? (await drawerDTOs(prisma, [holder]))[0] : null;
};

export const openDrawer = async (actor, branchId) => {
  const b = resolveWriteBranch(actor, branchId, 'Access Denied: Cannot open a cash drawer in another branch.');
  return prisma.$transaction(async (tx) => {
    const branch = await tx.branch.findUnique({ where: { id: b } });
    if (!branch?.isActive) throw badRequest('BRANCH_INACTIVE', 'Cannot open a cash drawer in an inactive branch.');
    const drawer = await getActiveDrawer(tx, actor, b);
    return (await drawerDTOs(tx, [drawer]))[0];
  });
};

export const drawerMovements = async (actor, holderId) => {
  const holder = await prisma.cashDrawer.findUnique({ where: { id: holderId } });
  if (!holder) throw notFound('DRAWER_NOT_FOUND', `Cash drawer '${holderId}' not found.`);
  assertBranchAccess(actor, holder.branchId);
  if (actor.role === 'ACCOUNTANT' && holder.custodianUserId !== actor.id) {
    throw forbidden('FORBIDDEN', 'Access Denied: You can only view your own cash drawer.');
  }
  const movements = await prisma.drawerMovement.findMany({ where: { drawerId: holderId }, orderBy: { createdAt: 'asc' } });
  let running = toDec(0);
  return movements.map((m) => {
    running = m.direction === 'IN' ? running.plus(m.amount) : running.minus(m.amount);
    return toDrawerMovementDTO(m, running);
  });
};

export const vaultStatus = async (actor, branchId) => {
  const b = resolveWriteBranch(actor, branchId);
  const vault = await prisma.$transaction((tx) => ensureVault(tx, b));
  return { id: vault.id, branchId: b, balance: (await holderBalance(prisma, vault.id)).toNumber() };
};

/** Bank/online account statement: opening, every movement with running balance, closing. */
export const accountStatement = async (actor, accountId, { from, to } = {}) => {
  const account = await prisma.paymentAccount.findUnique({ where: { id: accountId }, include: { branches: true } });
  if (!account) throw notFound('ACCOUNT_NOT_FOUND', `Payment account '${accountId}' not found.`);
  const branchId = actor.role === 'SUPER_ADMIN' ? null : actor.branchId;
  if (branchId && account.branchId !== branchId && !account.branches.some((b) => b.id === branchId)) throw forbidden('BRANCH_FORBIDDEN', 'Cannot access another branch account.');

  const opening = from ? await accountBalance(accountId, { asOf: from, ...(branchId ? { branchIds: [branchId] } : {}) }) : toDec(!branchId || branchId === account.branchId ? account.openingBalance : 0);
  const movements = await prisma.accountMovement.findMany({
    where: { accountId, ...(branchId ? { branchId } : {}), ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) },
    orderBy: { createdAt: 'asc' },
  });
  let running = opening;
  const rows = movements.map((m) => {
    running = m.direction === 'IN' ? running.plus(m.amount) : running.minus(m.amount);
    return toAccountMovementDTO(m, running, account.name);
  });
  return {
    accountId, accountName: account.name, branchId: branchId ?? account.branchId,
    openingBalance: opening.toNumber(), closingBalance: running.toNumber(),
    moneyIn: rows.filter((r) => r.direction === 'IN').reduce((s, r) => s + r.amount, 0),
    moneyOut: rows.filter((r) => r.direction === 'OUT').reduce((s, r) => s + r.amount, 0),
    movements: rows,
  };
};

// ═══ Commands ═════════════════════════════════════════════════════════════════

/**
 * Admin float transfer: branch vault → a cash handler's open drawer.
 * Pure custody move (vault OUT + drawer IN) — never income or expense.
 */
export const transferFloat = async (actor, { branchId, targetUserId, amount, notes }) => {
  const b = resolveWriteBranch(actor, branchId, 'Access Denied: Cannot transfer cash float to another branch.');
  return prisma.$transaction(async (tx) => {
    const branch = await tx.branch.findUnique({ where: { id: b } });
    if (!branch?.isActive) throw badRequest('BRANCH_INACTIVE', `Branch '${b}' is invalid or deactivated.`);
    const target = await tx.user.findUnique({ where: { id: targetUserId } });
    if (!target?.isActive) throw badRequest('USER_INVALID', 'Target custodian user is invalid or inactive.');

    const drawers = await tx.cashDrawer.findMany({
      where: { kind: 'DRAWER', branchId: b, custodianUserId: target.id, status: { in: ['OPEN', 'SETTLEMENT_PENDING'] } },
    });
    if (drawers.some((d) => d.status === 'SETTLEMENT_PENDING')) {
      throw conflict('DRAWER_LOCKED', 'Target custodian drawer is currently locked pending settlement review.');
    }
    const drawer = drawers[0];
    if (!drawer) {
      throw badRequest(
        'NO_OPEN_DRAWER',
        `Target user ${target.name} does not have an active open cash drawer in branch '${branch.name}'. A cash drawer must be opened before float funds can be transferred.`
      );
    }

    const vault = await ensureVault(tx, b);
    const transferNumber = await nextSequence(tx, branch.code, 'CXF');
    const common = { sourceModule: 'TRANSFER', reference: transferNumber, actor, description: notes || 'Internal cash float replenishment' };
    await postCashMovement(tx, { ...common, holderId: vault.id, type: 'TRANSFER_OUT', direction: 'OUT', amount });
    await postCashMovement(tx, { ...common, holderId: drawer.id, type: 'TRANSFER_IN', direction: 'IN', amount });

    const transfer = await tx.cashTransfer.create({
      data: {
        transferNumber, branchId: b, fromSource: 'BRANCH_VAULT', fromDrawerId: vault.id, toDrawerId: drawer.id,
        toCustodianUserId: target.id, toCustodianName: target.name, amount: round2(amount),
        notes: notes || 'Internal cash float replenishment', transferredByUserId: actor.id, transferredByName: actor.name,
      },
    });
    await tx.drawerMovement.updateMany({ where: { reference: transferNumber }, data: { sourceId: transfer.id } });
    await auditLog(tx, {
      userId: actor.id, userName: actor.name, action: 'CASH_FLOAT_TRANSFERRED', entity: 'CashTransfer',
      entityId: transfer.id, branchId: b, after: { transferNumber, amount, to: target.name },
    });
    return toCashTransferDTO(transfer);
  });
};

export const listTransfers = async (actor, { branchId } = {}) => {
  const b = resolveReadBranch(actor, branchId);
  const rows = await prisma.cashTransfer.findMany({
    where: { ...(b ? { branchId: b } : {}), ...(actor.role === 'ACCOUNTANT' ? { toCustodianUserId: actor.id } : {}) },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toCashTransferDTO);
};
