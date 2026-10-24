// src/modules/cash/cash.mapper.js

import { num, opt, iso } from '../../lib/dto.js';
import { toDec } from '../../lib/money.js';
import { ymd, toTimeString, toDateString } from '../../lib/dates.js';

const PAYOUT_TYPES = ['EXPENSE', 'PAYROLL_PAYOUT', 'SALARY_ADVANCE', 'COMMISSION_PAYOUT', 'TIP_PAYOUT', 'SUPPLIER_PAYMENT', 'CASH_REFUND'];

/**
 * Collapse grouped movement sums (by type+direction) into the drawer totals the UI shows.
 * @param {Array<{type,direction,_sum:{amount}}>} rows
 */
export const summarizeMovements = (rows) => {
  const sum = (pred) => rows.filter(pred).reduce((s, r) => s.plus(toDec(r._sum.amount ?? 0)), toDec(0));
  const inTotal = sum((r) => r.direction === 'IN');
  const outTotal = sum((r) => r.direction === 'OUT');
  return {
    openingCash:       sum((r) => r.direction === 'IN' && ['OPENING_FLOAT', 'TRANSFER_IN'].includes(r.type)),
    cashSales:         sum((r) => r.direction === 'IN' && ['CASH_SALE', 'DUES_COLLECTION'].includes(r.type)),
    cashTipsCollected: sum((r) => r.direction === 'IN' && r.type === 'CASH_TIP'),
    cashExpensesPaid:  sum((r) => r.direction === 'OUT' && PAYOUT_TYPES.includes(r.type))
      .minus(sum((r) => r.direction === 'IN' && ['EXPENSE_REVERSAL', 'REVERSAL'].includes(r.type))),
    settledOut:        sum((r) => r.direction === 'OUT' && r.type === 'SETTLEMENT_OUT'),
    expected:          inTotal.minus(outTotal),
  };
};

/** Holder → frontend `CashDrawer`. */
export const toCashDrawerDTO = (h, t) => {
  const expected = num(t.expected);
  return {
    id:                 h.id,
    branchId:           h.branchId,
    date:               ymd(h.date),
    openingCash:        num(t.openingCash),
    cashSales:          num(t.cashSales),
    cashTipsCollected:  num(t.cashTipsCollected),
    cashExpensesPaid:   num(t.cashExpensesPaid),
    expectedInDrawer:   expected,
    currentCashBalance: expected,
    actualInDrawer:     h.lastCountedCash !== null && h.lastCountedCash !== undefined ? num(h.lastCountedCash) : expected,
    variance:           num(h.lastVariance),
    custodianUserId:    h.custodianUserId ?? '',
    custodianName:      h.custodianName,
    drawerName:         h.custodianName,
    status:             h.status,
    closedAt:           iso(h.closedAt),
    settledAt:          iso(h.settledAt),
    successorDrawerId:  opt(h.successorDrawerId),
    kind:               h.kind,
  };
};

export const toDrawerMovementDTO = (m, running) => ({
  id:           m.id,
  drawerId:     m.drawerId,
  date:         toDateString(m.createdAt),
  time:         toTimeString(m.createdAt),
  type:         m.type,
  direction:    m.direction,
  amount:       num(m.amount),
  debit:        m.direction === 'IN' ? num(m.amount) : 0,
  credit:       m.direction === 'OUT' ? num(m.amount) : 0,
  cashIn:       m.direction === 'IN' ? num(m.amount) : 0,
  cashOut:      m.direction === 'OUT' ? num(m.amount) : 0,
  runningBalance: num(running),
  sourceModule: m.sourceModule,
  sourceId:     opt(m.sourceId),
  reference:    opt(m.reference),
  description:  opt(m.description),
  actorUserId:  m.userId,
  actorName:    m.userName,
  createdAt:    iso(m.createdAt),
});

export const toAccountMovementDTO = (m, running, accountName) => ({
  id:             m.id,
  accountId:      m.accountId,
  accountName,
  date:           toDateString(m.createdAt),
  time:           toTimeString(m.createdAt),
  type:           m.type,
  direction:      m.direction,
  amount:         num(m.amount),
  debit:          m.direction === 'IN' ? num(m.amount) : 0,
  credit:         m.direction === 'OUT' ? num(m.amount) : 0,
  moneyIn:        m.direction === 'IN' ? num(m.amount) : 0,
  moneyOut:       m.direction === 'OUT' ? num(m.amount) : 0,
  runningBalance: num(running),
  sourceModule:   m.sourceModule,
  sourceId:       opt(m.sourceId),
  reference:      opt(m.reference),
  description:    opt(m.description),
  userId:         m.userId,
  userName:       m.userName,
  createdAt:      iso(m.createdAt),
});

/** → frontend `CashTransferRecord`. */
export const toCashTransferDTO = (t) => ({
  id:                  t.id,
  transferNumber:      t.transferNumber,
  branchId:            t.branchId,
  date:                toDateString(t.createdAt),
  time:                toTimeString(t.createdAt),
  amount:              num(t.amount),
  fromSource:          t.fromSource,
  toSource:            'DRAWER',
  toDrawerId:          t.toDrawerId,
  toCustodianUserId:   t.toCustodianUserId,
  toCustodianName:     t.toCustodianName,
  transferredByUserId: t.transferredByUserId,
  transferredByName:   t.transferredByName,
  notes:               opt(t.notes),
});
