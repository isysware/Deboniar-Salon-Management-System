// src/modules/settings/settings.mapper.js

import { num, opt, iso } from '../../lib/dto.js';

export const toTaxRuleDTO = (r) => ({
  id:              r.id,
  branchId:        r.branchId,
  name:            r.name,
  rate:            num(r.rate),
  description:     opt(r.description),
  isActive:        r.isActive,
  isBranchDefault: r.isBranchDefault,
});

/** @param balance Decimal computed from the account movement ledger */
export const toPaymentAccountDTO = (a, balance) => ({
  id:                a.id,
  branchId:          a.branchId,
  name:              a.name,
  accountType:       a.accountType,
  providerName:      a.providerName,
  bankName:          a.providerName,
  accountHolder:     a.accountHolder,
  accountIdentifier: opt(a.accountIdentifier),
  currentBalance:    num(balance ?? a.openingBalance),
  isActive:          a.isActive,
  createdAt:         iso(a.createdAt)?.slice(0, 10),
});

const ONLINE_TYPE = { BANK: 'BANK_CHECKING', OTHER: 'TERMINAL_POS', EASYPAISA: 'DIGITAL_WALLET', JAZZCASH: 'DIGITAL_WALLET' };

/** Legacy `OnlineAccount` view used by dashboards — derived from PaymentAccount. */
export const toOnlineAccountDTO = (a, balance) => ({
  id:                  a.id,
  branchId:            a.branchId,
  accountName:         a.name,
  bankName:            a.providerName,
  type:                ONLINE_TYPE[a.accountType] ?? 'BANK_CHECKING',
  accountNumberMasked: a.accountIdentifier ? `····${a.accountIdentifier.slice(-4)}` : '····',
  currentBalance:      num(balance ?? a.openingBalance),
  lastSyncTime:        'Live',
  accountType:         a.accountType,
  accountHolder:       a.accountHolder,
  isActive:            a.isActive,
});

export const toExpenseCategoryDTO = (c) => ({
  id:          c.id,
  branchId:    c.branchId,
  name:        c.name,
  description: opt(c.description),
  isActive:    c.isActive,
  createdAt:   iso(c.createdAt)?.slice(0, 10),
});

/** monthlyAbsenceDivisor is stored as text; 26/30 go back to numbers like the frontend type. */
export const toPayrollPolicyDTO = (p) => ({
  id:                             p.id,
  branchId:                       p.branchId,
  monthlyAbsenceDivisor:          /^\d+$/.test(p.monthlyAbsenceDivisor) ? Number(p.monthlyAbsenceDivisor) : p.monthlyAbsenceDivisor,
  customDivisorDays:              opt(p.customDivisorDays),
  dailyStaffPaidLeaveEligibility: p.dailyStaffPaidLeaveEligibility,
  nonWorkedWeeklyOffPaid:         p.nonWorkedWeeklyOffPaid,
  nonWorkedHolidayPaid:           p.nonWorkedHolidayPaid,
  prorationMethod:                p.prorationMethod,
  updatedAt:                      iso(p.updatedAt),
  updatedByUserId:                p.updatedByUserId,
});
