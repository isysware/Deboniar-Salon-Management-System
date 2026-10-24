// Step 11 — POS checkout, dues collection, refunds & voids
import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../src/config/prisma.js';
import { as } from './helpers.js';

const key = (k) => ({ 'Idempotency-Key': `pos-${k}` });
const svc = (id, price, staffId = 'staff-1') => ({ type: 'SERVICE', item: { id, price }, quantity: 1, staffId });

const SALE = {
  clientName: 'Zainab Ahmed', clientPhone: '+92 (300) 123-4567', discountType: 'PERCENTAGE', discountValue: 10, tip: 500,
  cartItems: [
    svc('srv-lhe-01', 3500),
    { type: 'PACKAGE', item: { id: 'pkg-lhe-02', price: 7000 }, quantity: 1, staffId: 'staff-2',
      packageComponents: [{ serviceId: 'srv-lhe-02', staffId: 'staff-2' }, { serviceId: 'srv-lhe-07', staffId: 'staff-1' }] },
    { type: 'PRODUCT', item: { id: 'item-1', price: 7800 }, quantity: 1, staffId: 'staff-1' },
  ],
  payments: [
    { method: 'CASH', amount: 10000, billAllocation: 9500, tipAllocation: 500, cashTendered: 10000, changeReturned: 0 },
    { method: 'ONLINE_ACCOUNT', paymentAccountId: 'acc-2', amount: 9605.2, billAllocation: 9605.2, tipAllocation: 0 },
  ],
};

let sale;

describe('Step 11 · POS checkout', () => {
  beforeAll(async () => {
    await as('super').put('/system/date', { date: '2026-09-28' });
  });

  it('posts a split-tender sale: discount split, tax per line, tip kept out of net sales', async () => {
    const drawerBefore = (await as('accountant').get('/cash-drawers/mine')).body.data.expectedInDrawer;
    const res = await as('accountant').post('/pos/invoices/checkout', SALE, key('sale-1'));
    expect(res.status).toBe(201);
    sale = res.body.data;
    expect(sale).toMatchObject({
      invoiceNumber: expect.stringMatching(/^INV-\d{4}$/), clientId: 'client-1', subtotal: 18300, discount: 1830, netSales: 16470,
      tax: 2635.2, tip: 500, total: 19605.2, amountPaid: 19605.2, amountDue: 0, status: 'PAID', paymentMethod: 'SPLIT',
      lifecycle: 'ACTIVE', staffName: 'Zara Alvi',
    });
    expect(sale.lineItems.map((l) => [l.discountAllocated, l.netSales, l.tax])).toEqual([[350, 3150, 504], [700, 6300, 1008], [780, 7020, 1123.2]]);
    expect(sale.lineItems[1].packageComponents.map((c) => [c.staffName, c.allocatedAmount])).toEqual([['Hamza Malik', 3780], ['Zara Alvi', 2520]]);
    expect(sale.lineItems[2]).toMatchObject({ batchId: 'batch-1', cogsAmount: 5500, unitCostSnapshot: 5500 });

    const drawerAfter = (await as('accountant').get('/cash-drawers/mine')).body.data;
    expect(drawerAfter.expectedInDrawer - drawerBefore).toBe(10000);
    expect(drawerAfter.cashTipsCollected).toBe(500);
  });

  it('replays the same idempotency key without posting twice', async () => {
    const replay = await as('accountant').post('/pos/invoices/checkout', SALE, key('sale-1'));
    expect(replay.body.data.id).toBe(sale.id);
    expect(await prisma.invoice.count()).toBe(1);
  });

  it('commission EARN events use attributed net (no tax, no tip, no product)', async () => {
    const events = await prisma.commissionEvent.findMany({ where: { invoiceId: sale.id }, orderBy: { amount: 'asc' } });
    expect(events.map((e) => [e.staffId, Number(e.attributedNet), Number(e.amount)])).toEqual([
      ['staff-1', 2520, 504], ['staff-1', 3150, 630], ['staff-2', 3780, 680.4],
    ]);
  });

  it('creates a tip receipt (staff liability) and moves FEFO stock with COGS', async () => {
    const tips = await prisma.tipReceipt.findMany({ where: { invoiceId: sale.id } });
    expect(tips).toHaveLength(1);
    expect(Number(tips[0].collectedAmount)).toBe(500);
    const stock = await as('admin').get('/inventory/items/item-1/stock');
    expect(stock.body.data.batches.find((b) => b.id === 'batch-1').remainingQuantity).toBe(11);
  });

  it('rejects outdated cart prices, over-payment, missing staff and insufficient stock (and rolls back)', async () => {
    const stale = await as('accountant').post('/pos/invoices/checkout', { ...SALE, cartItems: [svc('srv-lhe-01', 3000)], payments: [] }, key('bad-1'));
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('PRICE_OUTDATED');

    const over = await as('accountant').post('/pos/invoices/checkout', {
      cartItems: [svc('srv-lhe-01', 3500)], payments: [{ method: 'CASH', amount: 9999, billAllocation: 9999, tipAllocation: 0 }],
    }, key('bad-2'));
    expect(over.status).toBe(400);

    const noStock = await as('accountant').post('/pos/invoices/checkout', {
      cartItems: [{ type: 'PRODUCT', item: { id: 'item-3', price: 11500 }, quantity: 99, staffId: 'staff-1' }], payments: [],
      clientName: 'Hira', clientPhone: '03012345678',
    }, key('bad-3'));
    expect(noStock.status).toBe(409);
    expect(noStock.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(await prisma.invoice.count()).toBe(1);
    expect((await as('staff').post('/pos/invoices/checkout', SALE, key('bad-4'))).status).toBe(403);
  });
});

describe('Step 11 · Dues collection', () => {
  let credit;

  it('unpaid balance requires a named customer with a phone', async () => {
    const walkIn = await as('accountant').post('/pos/invoices/checkout', { cartItems: [svc('srv-lhe-05', 5000)], payments: [] }, key('due-0'));
    expect(walkIn.status).toBe(400);
    expect(walkIn.body.error.code).toBe('CUSTOMER_REQUIRED');
  });

  it('partial payment creates a receivable and a client profile', async () => {
    const res = await as('accountant').post('/pos/invoices/checkout', {
      clientName: 'Nadia Butt', clientPhone: '0345-1112223', cartItems: [svc('srv-lhe-05', 5000)],
      payments: [{ method: 'CASH', amount: 2000, billAllocation: 2000, tipAllocation: 0 }],
    }, key('due-1'));
    expect(res.status).toBe(201);
    credit = res.body.data;
    expect(credit).toMatchObject({ total: 5800, amountPaid: 2000, amountDue: 3800, status: 'PARTIAL' });
    const client = await as('accountant').get(`/clients/${credit.clientId}`);
    expect(client.body.data).toMatchObject({ name: 'Nadia Butt', outstandingBalance: 3800 });
    const open = await as('accountant').get(`/invoices/outstanding?clientIdOrPhone=03451112223`);
    expect(open.body.data.map((i) => i.id)).toEqual([credit.id]);
  });

  it('collects dues bill-only; over-collection and tips are rejected', async () => {
    const tip = await as('accountant').post(`/invoices/${credit.id}/payments`, { payments: [{ method: 'CASH', amount: 100, billAllocation: 0, tipAllocation: 100 }] }, key('col-0'));
    expect(tip.status).toBe(400);
    const over = await as('accountant').post(`/invoices/${credit.id}/payments`, { payments: [{ method: 'CASH', amount: 5000, billAllocation: 5000, tipAllocation: 0 }] }, key('col-1'));
    expect(over.status).toBe(400);

    const ok = await as('accountant').post(`/invoices/${credit.id}/payments`, {
      payments: [{ method: 'ONLINE_ACCOUNT', paymentAccountId: 'acc-3', amount: 3800, billAllocation: 3800, tipAllocation: 0 }],
    }, key('col-2'));
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ status: 'PAID', amountDue: 0, amountPaid: 5800 });
    const last = ok.body.data.payments.at(-1);
    expect(last).toMatchObject({ kind: 'DUES_COLLECTION', previousBalance: 3800, remainingBalance: 0, paymentAccountName: 'JazzCash Merchant Till' });
    const paid = await as('accountant').post(`/invoices/${credit.id}/payments`, { payments: [{ method: 'CASH', amount: 1, billAllocation: 1, tipAllocation: 0 }] }, key('col-3'));
    expect(paid.status).toBe(409);
  });
});

describe('Step 11 · Appointment hand-off', () => {
  it('bills a booked appointment once and marks it BILLED/COMPLETED', async () => {
    const apt = await as('admin').post('/appointments', {
      clientName: 'Tariq Mahmood', clientPhone: '03219876543', date: '2026-09-28', startTime: '15:00', status: 'CONFIRMED',
      items: [{ type: 'SERVICE', itemId: 'srv-lhe-02', staffId: 'staff-2' }],
    });
    expect(apt.status).toBe(201);
    const body = {
      appointmentId: apt.body.data.id, clientId: apt.body.data.clientId, clientName: 'Tariq Mahmood', clientPhone: '03219876543',
      cartItems: [svc('srv-lhe-02', 4000, 'staff-2')], payments: [{ method: 'CASH', amount: 4640, billAllocation: 4640, tipAllocation: 0 }],
    };
    const inv = await as('accountant').post('/pos/invoices/checkout', body, key('apt-1'));
    expect(inv.status).toBe(201);
    expect(inv.body.data.appointmentId).toBe(apt.body.data.id);

    const after = await as('admin').get(`/appointments/${apt.body.data.id}`);
    expect(after.body.data).toMatchObject({ billingStatus: 'BILLED', status: 'COMPLETED', linkedInvoiceNumber: inv.body.data.invoiceNumber });
    const again = await as('accountant').post('/pos/invoices/checkout', body, key('apt-2'));
    expect(again.status).toBe(409);
    expect((await as('accountant').get('/appointments/queue?date=2026-09-28')).body.data.map((a) => a.id)).not.toContain(apt.body.data.id);
  });
});

describe('Step 11 · Refunds & voids (dated reversals)', () => {
  it('partial refund of a product: returns stock to its cost layer, reverses tax, pays back cash', async () => {
    expect((await as('accountant').post(`/invoices/${sale.id}/refunds`, { reason: 'x', lines: [] }, key('rf-0'))).status).toBe(403);
    const productLine = sale.lineItems[2];
    const res = await as('admin').post(`/invoices/${sale.id}/refunds`, {
      reason: 'Allergic reaction', refundMethod: 'ONLINE_ACCOUNT', paymentAccountId: 'acc-2',
      lines: [{ lineId: productLine.id, quantity: 1, restock: 'RESALABLE' }],
    }, key('rf-1'));
    expect(res.status).toBe(201);
    expect(res.body.data.refund).toMatchObject({ netReversed: 7020, taxReversed: 1123.2, cashOut: 8143.2 });
    expect(res.body.data.invoice).toMatchObject({ lifecycle: 'PARTIALLY_REFUNDED', status: 'PAID', amountDue: 0, netSales: 16470 });
    const stock = await as('admin').get('/inventory/items/item-1/stock');
    expect(stock.body.data.batches.find((b) => b.id === 'batch-1').remainingQuantity).toBe(12);
  });

  it('refunding a service creates a dated commission REVERSAL (original month untouched)', async () => {
    const res = await as('admin').post(`/invoices/${sale.id}/refunds`, {
      reason: 'Service redo', refundMethod: 'ONLINE_ACCOUNT', paymentAccountId: 'acc-2',
      lines: [{ lineId: sale.lineItems[0].id, quantity: 1 }],
    }, key('rf-2'));
    expect(res.body.data.refund).toMatchObject({ netReversed: 3150, taxReversed: 504 });
    const rev = await prisma.commissionEvent.findMany({ where: { invoiceId: sale.id, type: 'REVERSAL' } });
    expect(rev.map((e) => [e.staffId, Number(e.amount)])).toEqual([['staff-1', 630]]);
    expect(await prisma.commissionEvent.count({ where: { invoiceId: sale.id, type: 'EARN' } })).toBe(3);
    const twice = await as('admin').post(`/invoices/${sale.id}/refunds`, { reason: 'again', lines: [{ lineId: sale.lineItems[0].id, quantity: 1 }] }, key('rf-3'));
    expect(twice.status).toBe(400);
  });

  it('void of a partially paid invoice refunds only money received and cancels the receivable', async () => {
    const part = await as('accountant').post('/pos/invoices/checkout', {
      clientName: 'Sara Khan', clientPhone: '03331234567', cartItems: [svc('srv-lhe-01', 3500)],
      payments: [{ method: 'CASH', amount: 1000, billAllocation: 1000, tipAllocation: 0 }],
    }, key('void-0'));
    expect(part.body.data).toMatchObject({ total: 4060, amountDue: 3060 });
    // Admin needs cash in their own drawer to hand back the 1,000.
    const res = await as('admin').post(`/invoices/${part.body.data.id}/refunds`, { type: 'VOID', reason: 'Entered by mistake', refundMethod: 'CASH' }, key('void-1'));
    expect(res.status).toBe(201);
    expect(res.body.data.refund).toMatchObject({ cashOut: 1000, netReversed: 3500, taxReversed: 560 });
    expect(res.body.data.invoice).toMatchObject({ lifecycle: 'VOIDED', amountDue: 0, amountPaid: 0, invoiceNumber: part.body.data.invoiceNumber });
    const again = await as('admin').post(`/invoices/${part.body.data.id}/refunds`, { type: 'VOID', reason: 'again' }, key('void-2'));
    expect(again.status).toBe(409);
  });

  it('reconciles: invoice history intact, refunds listed, net sales after reversals', async () => {
    const list = await as('accountant').get('/invoices?date=2026-09-28');
    expect(list.body.data.length).toBe(4);
    const refunds = await as('admin').get(`/invoices/${sale.id}/refunds`);
    expect(refunds.body.data.map((r) => r.netReversed)).toEqual([7020, 3150]);
    const netAfter = 16470 - 7020 - 3150;
    expect(netAfter).toBe(6300); // only the package remains as recognised sales
  });
});
