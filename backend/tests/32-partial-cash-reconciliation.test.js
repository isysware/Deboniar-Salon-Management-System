import { describe, it, expect } from 'vitest';
import prisma from '../src/config/prisma.js';
import { as } from './helpers.js';
import { drawerDebits, drawerMoney } from '../../frontend/src/features/reports/cashDrawerUtils.ts';

describe('Partial cash collection reconciliation', () => {
  it('posts initial and later payments once and reconciles drawer, statement and settlement custody', async () => {
    await as('super').put('/system/date', { date: '2026-10-15' });
    await prisma.cashDrawer.updateMany({
      where: { custodianUserId: 'usr-admin-01', status: 'OPEN' },
      data: { lastCountedCash: null, lastVariance: null, settledAt: null },
    });
    const before = (await as('admin').get('/cash-drawers/mine')).body.data;
    const sale = await as('admin').post('/pos/invoices/checkout', {
      branchId: 'branch-1', clientId: 'client-1', clientName: 'Ayesha Khan', clientPhone: '03001234567',
      applyTax: false, discountType: 'FIXED', discountValue: 2500,
      cartItems: [{ type: 'SERVICE', item: { id: 'srv-lhe-01', price: 3500 }, quantity: 1, staffId: 'staff-1' }],
      payments: [{ method: 'CASH', amount: 500, billAllocation: 500 }],
    }, { 'Idempotency-Key': 'partial-cash-initial' });
    expect(sale.status, JSON.stringify(sale.body)).toBe(201);
    const invoice = sale.body.data;
    expect(invoice).toMatchObject({ total: 1000, amountPaid: 500, amountDue: 500 });
    const body = { payments: [{ method: 'CASH', amount: 500, billAllocation: 500 }] };
    for (let i = 0; i < 2; i++) {
      expect((await as('admin').post(`/invoices/${invoice.id}/payments`, body, { 'Idempotency-Key': 'partial-cash-dues' })).status).toBe(201);
    }
    const payments = await prisma.invoicePayment.findMany({ where: { invoiceId: invoice.id } });
    expect(payments).toHaveLength(2);
    expect(new Set(payments.map(p => p.drawerId)).size).toBe(1);
    const drawerId = payments[0].drawerId;
    const ledger = await prisma.drawerMovement.findMany({ where: { sourceId: { in: payments.map(p => p.id) } } });
    expect(ledger).toHaveLength(2);
    expect(ledger.map(m => [m.type, Number(m.amount)])).toEqual(expect.arrayContaining([['CASH_SALE', 500], ['DUES_COLLECTION', 500]]));
    for (const m of ledger) expect(m).toMatchObject({ drawerId, branchId: 'branch-1', userId: 'usr-admin-01', direction: 'IN' });
    const report = (await as('admin').get('/reports/cash-drawer?startDate=2026-10-15&endDate=2026-10-15&custodianUserId=usr-admin-01')).body.data;
    const row = report.rows.find(r => r.id === drawerId);
    expect(row.expectedCash - (before?.expectedInDrawer || 0)).toBe(1000);
    expect(row.openingFloat + drawerDebits(row) - row.totalCashOut).toBe(row.expectedCash);
    expect(row).toMatchObject({ countedCash: null, variance: null });
    const statement = (await as('admin').get(`/custody/statement?drawerId=${drawerId}`)).body.data;
    const mine = (await as('admin').get('/cash-drawers/mine')).body.data;
    expect(statement.summary.expectedCashInCustody).toBe(row.expectedCash);
    expect(mine.expectedInDrawer).toBe(row.expectedCash);
    expect(statement.transactions.filter(t => ledger.some(m => m.id === t.id)).reduce((sum, t) => sum + t.debit, 0)).toBe(1000);
    const income = (await as('admin').get(`/reports/income-expense?startDate=2026-10-15&endDate=2026-10-15&search=${invoice.invoiceNumber}`)).body.data;
    expect(income.totals).toMatchObject({ income: 1000, paid: 1000 });
    const settlement = await as('admin').post('/settlements', {
      drawerId, countedCash: row.expectedCash, handoverAmount: row.expectedCash, retainedFloat: 0,
    }, { 'Idempotency-Key': 'partial-cash-count' });
    expect(settlement.status, JSON.stringify(settlement.body)).toBe(201);
    expect(settlement.body.data.settlement ?? settlement.body.data).toMatchObject({ expectedCash: row.expectedCash, countedCash: row.expectedCash, variance: 0 });
  });

  it('keeps opening separate and formats uncounted and zero cash correctly', () => {
    expect(drawerDebits({ openingFloat: 200, totalCashIn: 1200 })).toBe(1000);
    expect(drawerMoney(null)).toBe('\u2014');
    expect(drawerMoney(-0.001, true)).toBe('0.00');
    expect(drawerMoney(-500, true)).toBe('-500.00');
  });
});
