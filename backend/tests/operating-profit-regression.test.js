import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => {
  const db = {};
  for (const name of ['branch', 'staff', 'user', 'invoice', 'invoiceRefund', 'stockMovement', 'expense', 'payrollRun', 'commissionEvent', 'drawerMovement', 'accountMovement']) {
    db[name] = { findMany: vi.fn(), findUnique: vi.fn() };
  }
  db.payrollPayment = { findMany: vi.fn(() => { throw new Error('Payouts must not be recognized again'); }) };
  db.commissionPayment = { findMany: vi.fn(() => { throw new Error('Payouts must not be recognized again'); }) };
  return { db };
});
vi.mock('../src/config/prisma.js', () => ({ default: db }));
import { operatingProfitReport, incomeExpenseReport } from '../src/modules/reports/reports.service.js';
import { downloadReportCsv, formatSignedPKR, printReportWindow } from '../../frontend/src/features/reports/reportUtils.ts';

const query = { preset: 'CUSTOM', from: '2026-10-01', to: '2026-10-31' };
const actor = { role: 'ADMIN', branchId: 'branch-1', name: 'Admin' };

beforeEach(() => {
  vi.clearAllMocks();
  for (const model of Object.values(db)) model.findMany.mockResolvedValue([]);
  db.branch.findUnique.mockResolvedValue({ name: 'Test Branch' });
  const current = (args) => {
    const range = args.where.date || args.where.finalizedAt || args.where.eventDate || args.where.expenseDate;
    return range?.gte >= new Date('2026-09-30T19:00:00Z');
  };
  db.invoice.findMany.mockImplementation(async args => current(args) ? [{ lines: [{ type: 'SERVICE', netSales: 1000 }] }] : []);
  db.expense.findMany.mockImplementation(async args => current(args) ? [{ category: 'General', amount: 100 }] : []);
  db.payrollRun.findMany.mockImplementation(async args => current(args) ? [{ payslips: [{ netPayable: 2000, grossPayable: 2200, snapshot: { commissionPayable: 100 }, paidAmount: 2100 }] }] : []);
  db.commissionEvent.findMany.mockImplementation(async args => current(args) ? [{ type: 'EARN', amount: 100 }] : []);
});

describe('Signed report exports', () => {
  it('formats positive and negative amounts without discarding signs', () => {
    expect(formatSignedPKR(-1200)).toBe('-1,200.00');
    expect(formatSignedPKR(1200)).toBe('1,200.00');
  });

  it('preserves negative profit and margin in CSV', async () => {
    let blob;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(value => { blob = value; return 'blob:test'; });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const anchor = { click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('document', { createElement: () => anchor, body: { appendChild: vi.fn() } });
    downloadReportCsv('profit', [], [{ headers: ['Profit', 'Margin'], rows: [[(-1200).toFixed(2), '-120%']] }]);
    expect(await blob.text()).toContain('-1200.00,-120%');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('preserves signed detail values and totals in Print / Save as PDF', () => {
    const write = vi.fn();
    vi.stubGlobal('window', { open: () => ({ document: { write, close: vi.fn() } }) });
    printReportWindow({ title: 'Operating Profit', headers: ['Profit', 'Margin'], rows: [['-1200.00', '-120%']], totals: [formatSignedPKR(-1200), '-120%'] });
    const html = write.mock.calls[0][0];
    expect(html).toContain('-1200.00');
    expect(html).toContain('-1,200.00');
    expect(html).toContain('-120%');
    vi.unstubAllGlobals();
  });
});

describe('Operating Profit recognition', () => {
  it.each([['CASH', 'drawerMovement'], ['ONLINE_ACCOUNT', 'accountMovement']])('reconciles partial invoice and dues collection via %s once', async (method, model) => {
    for (const table of Object.values(db)) table.findMany.mockResolvedValue([]);
    db.invoice.findMany.mockResolvedValue([{
      id: 'partial', invoiceNumber: 'INV-0002', date: new Date('2026-10-01'),
      branchId: actor.branchId, netSales: 1000, subtotal: 1000, discount: 0,
      amountDue: 0, status: 'PARTIAL', paymentMethod: method,
      payments: [{ kind: 'POS', billAmountAllocated: 400 }, { kind: 'DUES_COLLECTION', billAmountAllocated: 600 }],
    }]);
    db[model].findMany.mockResolvedValue([{
      id: 'collection', createdAt: new Date('2026-10-15'), branchId: actor.branchId,
      sourceModule: 'POS', type: 'DUES_COLLECTION', direction: 'IN', amount: 600,
    }]);
    const report = await incomeExpenseReport(actor, query);
    expect(report.rows.find(r => r.reference === 'INV-0002')).toMatchObject({ income: 1000, paid: 1000, remaining: 0, status: 'PAID', collectionAmount: 400 });
    expect(report.rows.find(r => r.id === 'collection')).toMatchObject({ income: 0, expense: 0, cashFlow: 600, paymentEventType: 'DUES_COLLECTION', status: 'POSTED' });
    expect(report.totals).toMatchObject({ income: 1000, paid: 1000, collections: 1000, remaining: 0, net: 1000 });
    expect(db.invoice.findMany.mock.calls[0][0].select.payments.where).toEqual({ reversedAt: null });
  });

  it('keeps stored salary intact in Income & Expense when commission is reported separately', async () => {
    db.invoice.findMany.mockResolvedValue([]);
    db.expense.findMany.mockResolvedValue([]);
    db.payrollRun.findMany.mockResolvedValue([{ branchId: actor.branchId, month: '2026-10', finalizedAt: new Date('2026-10-15'), payslips: [{ id: 'slip', staffId: 'staff', netPayable: 2000, snapshot: { commissionPayable: 100 } }] }]);
    db.commissionEvent.findMany.mockResolvedValue([{ id: 'commission', branchId: actor.branchId, eventDate: new Date('2026-10-15'), type: 'EARN', amount: 100 }]);
    const report = await incomeExpenseReport(actor, { ...query, includeCommission: 'true' });
    expect(report.kpis.salaryExpenses).toBe(2000);
    expect(report.kpis.commissionExpenses).toBe(100);
    expect(report.kpis.totalOperatingExpenses).toBe(2100);
  });

  it('reports a signed 1,200 loss and -120% margin without adding combined commission twice', async () => {
    const report = await operatingProfitReport(actor, query);
    expect(report.kpis.salaryExpenses).toBe(2000);
    expect(report.kpis.commissionExpenses).toBe(100);
    expect(report.totals.netProfit).toBe(-1200);
    expect(report.kpis.operatingMarginPercent).toBe(-120);
    expect(report.statementRows.find(r => r.isFinalNet).currentAmount).toBe(-1200);
    expect(db.payrollPayment.findMany).not.toHaveBeenCalled();
    expect(db.commissionPayment.findMany).not.toHaveBeenCalled();
    expect(db.payrollRun.findMany.mock.calls[0][0].where.status).toBe('FINALIZED');
  });

  it('preserves zero salary and does not fall back to gross salary', async () => {
    db.payrollRun.findMany.mockResolvedValue([{ payslips: [{ netPayable: 0, grossPayable: 2000 }] }]);
    const report = await operatingProfitReport(actor, query);
    expect(report.kpis.salaryExpenses).toBe(0);
    expect(report.totals.netProfit).toBe(800);
    expect(report.kpis.operatingMarginPercent).toBe(80);
  });
});

describe('Refund and void reconciliation', () => {
  function installSale(lifecycle, reversed, saleDate = '2026-10-05') {
    for (const model of Object.values(db)) model.findMany.mockResolvedValue([]);
    const refund = { id: 'refund', refundNumber: 'RFD-1', refundDate: new Date('2026-10-10'), netReversed: reversed, taxReversed: reversed * 0.16, tipReversed: 0, cashOut: reversed * 1.16, method: 'CASH', invoice: { id: 'sale', branchId: actor.branchId }, lines: [{ lineId: 'line', net: reversed, tax: reversed * 0.16 }] };
    const sale = { id: 'sale', invoiceNumber: 'INV-1', date: new Date(saleDate), branchId: actor.branchId, lifecycle, status: 'PAID', subtotal: 1000, discount: 0, netSales: 1000, tax: 160, total: 1160, tip: 0, amountPaid: 1160 - refund.cashOut, amountDue: 0, payments: [{ amount: 1160, billAmountAllocated: 1160, kind: 'POS', method: 'CASH', date: new Date(saleDate) }], refunds: [refund], lines: [{ id: 'line', type: 'SERVICE', name: 'Service', quantity: 1, unitPrice: 1000, netSales: 1000, tax: 160, taxRate: 0.16, total: 1160, discountAllocated: 0 }] };
    const matches = (date, range) => !range || (date >= range.gte && date <= range.lte);
    db.invoice.findMany.mockImplementation(async ({ where }) => matches(sale.date, where.date) && where.lifecycle?.not !== lifecycle ? [sale] : []);
    db.invoiceRefund.findMany.mockImplementation(async ({ where }) => matches(refund.refundDate, where.refundDate) ? [refund] : []);
  }

  it.each([['REFUNDED', 1000, 0], ['VOIDED', 1000, 0], ['PARTIALLY_REFUNDED', 400, 600]])('%s reverses sale and tax exactly once', async (lifecycle, reversed, expected) => {
    installSale(lifecycle, reversed);
    const { salesInvoicesReport, taxReport } = await import('../src/modules/reports/reports.service.js');
    const income = await incomeExpenseReport(actor, query);
    const profit = await operatingProfitReport(actor, query);
    const sales = await salesInvoicesReport(actor, query);
    const tax = await taxReport(actor, query);
    expect(income.kpis.totalRecognizedIncome).toBe(expected);
    expect(profit.kpis.totalNetRevenue).toBe(expected);
    expect(sales.kpis.netSales).toBe(expected);
    expect(sales.kpis.netTaxLiability).toBe(expected * 0.16);
    expect(sales.kpis.totalCashCollected).toBeCloseTo(expected * 1.16);
    expect(tax.kpis.netTaxLiability).toBe(expected * 0.16);
  });

  it('retains historical sale and recognizes a later void on its reversal date', async () => {
    installSale('VOIDED', 1000, '2026-09-05');
    const { taxReport } = await import('../src/modules/reports/reports.service.js');
    const earlier = { ...query, from: '2026-09-01', to: '2026-09-30' };
    expect((await incomeExpenseReport(actor, earlier)).kpis.totalRecognizedIncome).toBe(1000);
    expect((await taxReport(actor, earlier)).kpis.netTaxLiability).toBe(160);
    expect((await incomeExpenseReport(actor, query)).kpis.totalRecognizedIncome).toBe(-1000);
    expect((await taxReport(actor, query)).kpis.netTaxLiability).toBe(-160);
  });
});
