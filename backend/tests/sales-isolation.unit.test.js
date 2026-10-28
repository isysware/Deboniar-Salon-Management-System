import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => {
  const db = {};
  for (const name of ['invoice', 'invoiceRefund', 'branch', 'cashDrawer', 'paymentAccount', 'drawerMovement', 'accountMovement', 'client', 'appointment', 'invoicePayment', 'expense', 'settlement', 'systemSetting', 'user', 'staff']) {
    db[name] = { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), aggregate: vi.fn(), groupBy: vi.fn() };
  }
  db.$executeRaw = vi.fn();
  db.$transaction = vi.fn((fn) => fn(db));
  return { db };
});
vi.mock('../src/config/prisma.js', () => ({ default: db }));
vi.mock('../src/config/env.js', () => ({ env: { tz: 'Asia/Karachi' } }));
vi.mock('../src/modules/branches/branches.service.js', () => ({ toDTOs: async (rows) => rows }));
import { listInvoices, getInvoice, clientOutstanding, collectPayment, reverseCollection } from '../src/modules/pos/pos.service.js';
import { listRefunds } from '../src/modules/pos/pos.refund.js';
import { getGeneralLedger } from '../src/modules/ledger/ledger.service.js';
import { accountStatement } from '../src/modules/cash/cash.service.js';
import { paymentAccountsReport, operatingProfitReport, inventoryReport, salesInvoicesReport, detailedIncomeReport, taxReport } from '../src/modules/reports/reports.service.js';
import { accountantDashboard } from '../src/modules/dashboard/dashboard.service.js';
import { clientStats } from '../src/modules/clients/clients.service.js';
import { listPaymentAccounts, listOnlineAccounts } from '../src/modules/settings/settings.service.js';
import { resolveReadBranch } from '../src/lib/scope.js';

const seller = { id: 'seller', role: 'ACCOUNTANT', branchId: 'branch' };
const invoice = { id: 'invoice', branchId: 'branch', processedByUserId: 'other', date: new Date('2026-10-01'), lines: [], payments: [] };
const account = { id: 'account', branchId: 'branch', openingBalance: 9000, name: 'Bank', branches: [] };
beforeEach(() => {
  vi.clearAllMocks();
  for (const model of Object.values(db)) {
    model.findMany?.mockResolvedValue([]);
    model.groupBy?.mockResolvedValue([]);
    model.findFirst?.mockResolvedValue(null);
    model.aggregate?.mockResolvedValue({ _sum: { amount: 0, openingBalance: 9000 } });
  }
  db.invoice.findUnique.mockResolvedValue(invoice);
  db.paymentAccount.findUnique.mockResolvedValue(account);
  db.branch.findUnique.mockResolvedValue({ id: 'branch', name: 'Branch' });
});

describe('Sales ownership boundaries', () => {
  it('forces the seller and branch even when another seller or ALL is requested', async () => {
    for (const soldByUserId of ['other', 'ALL']) {
      await listInvoices(seller, { soldByUserId, branchId: 'elsewhere' });
      expect(db.invoice.findMany.mock.lastCall[0].where).toMatchObject({ branchId: 'branch', processedByUserId: 'seller' });
    }
    await clientOutstanding(seller, { clientIdOrPhone: '03001234567' });
    expect(db.invoice.findMany.mock.lastCall[0].where.processedByUserId).toBe('seller');
  });

  it('rejects another seller invoice details, refunds, collections and reversals', async () => {
    for (const action of [
      () => getInvoice(seller, 'invoice'), () => listRefunds(seller, 'invoice'),
      () => collectPayment({ invoiceId: 'invoice' }, seller),
      () => reverseCollection({ invoiceId: 'invoice' }, seller),
    ]) await expect(action()).rejects.toMatchObject({ status: 403, code: 'INVOICE_FORBIDDEN' });
    expect(db.invoiceRefund.findMany).not.toHaveBeenCalled();
  });

  it('allows own details and keeps admin and superadmin access to other sellers', async () => {
    for (const actor of [{ ...seller, id: 'other' }, { ...seller, role: 'ADMIN' }, { ...seller, role: 'SUPER_ADMIN' }]) {
      expect((await getInvoice(actor, 'invoice')).id).toBe('invoice');
    }
    await listInvoices({ ...seller, role: 'ADMIN' });
    expect(db.invoice.findMany.mock.lastCall[0].where).not.toHaveProperty('processedByUserId');
    await expect(getInvoice({ ...seller, role: 'ADMIN', branchId: 'elsewhere' }, 'invoice')).rejects.toMatchObject({ status: 403 });
  });

  it('fails closed for an unassigned sales user', () => {
    expect(() => resolveReadBranch({ ...seller, branchId: null })).toThrow();
  });

  it('restricts customer dues and visit statistics to own invoices', async () => {
    await clientStats(['client'], db, seller);
    expect(db.invoice.groupBy.mock.lastCall[0].where.processedByUserId).toBe('seller');
    expect(db.invoice.findMany.mock.lastCall[0].where.processedByUserId).toBe('seller');
    expect(db.appointment.findMany).not.toHaveBeenCalled();
  });
});

describe('Financial aggregates do not expose other sellers', () => {
  it('scopes dashboard outstanding counts and totals to own sales', async () => {
    await accountantDashboard(seller);
    expect(db.invoice.aggregate.mock.lastCall[0].where).toMatchObject({ branchId: 'branch', processedByUserId: 'seller' });
  });

  it.each([salesInvoicesReport, detailedIncomeReport, taxReport])('enforces seller scope on sales report queries', async (report) => {
    await report(seller, { from: '2026-10-01', to: '2026-10-31', preset: 'CUSTOM', soldByUserId: 'other', userId: 'other', branchId: 'elsewhere' });
    expect(db.invoice.findMany.mock.lastCall[0].where).toMatchObject({ branchId: 'branch', processedByUserId: 'seller' });
    for (const [args] of db.invoiceRefund.findMany.mock.calls) expect(args.where.invoice).toMatchObject({ processedByUserId: 'seller' });
  });

  it('retains POS payment account choices without exposing business balances', async () => {
    db.paymentAccount.findMany.mockResolvedValue([account]);
    db.accountMovement.groupBy.mockResolvedValue([{ accountId: 'account', direction: 'IN', _sum: { amount: 125 } }]);
    for (const list of [listPaymentAccounts, listOnlineAccounts]) {
      const choices = await list(seller, 'elsewhere');
      expect(choices).toHaveLength(1);
      expect(choices[0].currentBalance).toBe(125);
      expect(db.accountMovement.groupBy.mock.lastCall[0].where).toMatchObject({ branchId: 'branch', userId: 'seller' });
    }
  });

  it('scopes ledger rows and prior balances, excluding business opening balances', async () => {
    const result = await getGeneralLedger(seller, { from: '2026-10-01', accountId: 'account', search: 'Admin' });
    expect(result.summary.openingBalance).toBe(0);
    expect(db.paymentAccount.aggregate).not.toHaveBeenCalled();
    expect(db.accountMovement.findMany.mock.lastCall[0].where.userId).toBe('seller');
    for (const [args] of db.accountMovement.aggregate.mock.calls) expect(args.where.userId).toBe('seller');
  });

  it('keeps full opening balances available to admins', async () => {
    const result = await getGeneralLedger({ ...seller, role: 'ADMIN' }, {});
    expect(result.summary.openingBalance).toBe(9000);
    expect(db.accountMovement.findMany.mock.lastCall[0].where).not.toHaveProperty('userId');
  });

  it('computes account statements using only personal prior and current movements', async () => {
    db.accountMovement.groupBy.mockResolvedValue([{ direction: 'IN', _sum: { amount: 80 } }, { direction: 'OUT', _sum: { amount: 20 } }]);
    const result = await accountStatement(seller, 'account', { from: new Date('2026-10-01') });
    expect(result.openingBalance).toBe(60);
    expect(result.closingBalance).toBe(60);
    expect(db.accountMovement.groupBy.mock.lastCall[0].where.userId).toBe('seller');
    expect(db.accountMovement.findMany.mock.lastCall[0].where.userId).toBe('seller');
  });

  it('payment account report excludes global starting balances and scopes both periods', async () => {
    db.paymentAccount.findMany.mockResolvedValue([account]);
    const result = await paymentAccountsReport(seller, { from: '2026-10-01', to: '2026-10-31', preset: 'CUSTOM' });
    expect(result.kpis.totalOpeningBalance).toBe(0);
    expect(db.accountMovement.groupBy.mock.lastCall[0].where.userId).toBe('seller');
    expect(db.accountMovement.findMany.mock.lastCall[0].where.userId).toBe('seller');
  });

  it('rejects business-wide profit and inventory reports for sales users', async () => {
    await expect(operatingProfitReport(seller)).rejects.toMatchObject({ status: 403 });
    await expect(inventoryReport(seller)).rejects.toMatchObject({ status: 403 });
  });
});
