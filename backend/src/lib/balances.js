// src/lib/balances.js
// Balances are always DERIVED from movement ledgers — never stored.
//   account balance = openingBalance + Σ IN − Σ OUT   (AccountMovement)

import prisma from '../config/prisma.js';
import { toDec } from './money.js';

/**
 * @param {string[]} accountIds
 * @param {{ asOf?: Date, tx?: object }} [opts]  asOf = only movements strictly before this instant
 * @returns {Promise<Map<string, import('decimal.js').Decimal>>} accountId → balance
 */
export const accountBalances = async (accountIds, { asOf, tx = prisma } = {}) => {
  const result = new Map();
  if (!accountIds.length) return result;

  const accounts = await tx.paymentAccount.findMany({
    where:  { id: { in: accountIds } },
    select: { id: true, openingBalance: true },
  });
  const sums = await tx.accountMovement.groupBy({
    by:    ['accountId', 'direction'],
    where: { accountId: { in: accountIds }, ...(asOf ? { createdAt: { lt: asOf } } : {}) },
    _sum:  { amount: true },
  });

  for (const a of accounts) {
    const inSum = sums.find((s) => s.accountId === a.id && s.direction === 'IN')?._sum.amount ?? 0;
    const outSum = sums.find((s) => s.accountId === a.id && s.direction === 'OUT')?._sum.amount ?? 0;
    result.set(a.id, toDec(a.openingBalance).plus(toDec(inSum)).minus(toDec(outSum)));
  }
  return result;
};

export const accountBalance = async (accountId, opts) =>
  (await accountBalances([accountId], opts)).get(accountId) ?? toDec(0);
