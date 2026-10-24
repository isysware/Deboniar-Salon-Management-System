// Step 13 — Custody statement & settlements
import { describe, it, expect } from 'vitest';
import { as } from './helpers.js';

const key = (k) => ({ 'Idempotency-Key': `set-${k}` });

describe('Step 13 · Custody statement', () => {
  it('statement closing balance equals the drawer expected cash', async () => {
    const mine = (await as('accountant').get('/cash-drawers/mine')).body.data;
    const res = await as('accountant').get('/custody/statement');
    expect(res.status).toBe(200);
    const { summary, transactions } = res.body.data;
    expect(summary.expectedCashInCustody).toBe(mine.expectedInDrawer);
    expect(transactions.at(-1).runningBalance).toBe(mine.expectedInDrawer);
    expect(summary.cashSalesTotal).toBeGreaterThan(0);
    expect(summary.onlineCollectionsBreakdown.length).toBeGreaterThan(0);
    expect(summary.user.id).toBe('usr-acc-01');
  });

  it('accountant cannot read someone else statement', async () => {
    const res = await as('accountant').get('/custody/statement?userId=usr-admin-01');
    expect(res.body.data.summary.user.id).toBe('usr-acc-01');
  });
});

describe('Step 13 · Settlement submit → approve', () => {
  let drawer;
  let settlement;

  it('variance needs an explanation; submission locks the drawer', async () => {
    drawer = (await as('accountant').get('/cash-drawers/mine')).body.data;
    const counted = drawer.expectedInDrawer - 100;
    const body = { drawerId: drawer.id, countedCash: counted, handoverAmount: counted - 1000, retainedFloat: 1000 };
    expect((await as('accountant').post('/settlements', body, key('s0'))).status).toBe(400);
    expect((await as('accountant').post('/settlements', { ...body, retainedFloat: 5 }, key('s0b'))).status).toBe(400);

    const res = await as('accountant').post('/settlements', { ...body, varianceExplanation: 'Short by 100 — change error' }, key('s1'));
    expect(res.status).toBe(201);
    settlement = res.body.data;
    expect(settlement).toMatchObject({ status: 'SUBMITTED', variance: -100, expectedCash: drawer.expectedInDrawer, countedCash: counted });

    const locked = (await as('accountant').get('/cash-drawers/mine')).body.data;
    expect(locked.status).toBe('SETTLEMENT_PENDING');
    const sale = await as('accountant').post('/pos/invoices/checkout', {
      cartItems: [{ type: 'SERVICE', item: { id: 'srv-lhe-01', price: 3500 }, quantity: 1, staffId: 'staff-1' }],
      payments: [{ method: 'CASH', amount: 4060, billAllocation: 4060, tipAllocation: 0 }],
    }, key('locked-sale'));
    expect(sale.status).toBe(409);
    expect(sale.body.error.code).toBe('DRAWER_LOCKED');
  });

  it('only an independent admin approves; variance must be accepted explicitly', async () => {
    expect((await as('accountant').put(`/settlements/${settlement.id}/approve`, {})).status).toBe(403);
    const noAccept = await as('admin').put(`/settlements/${settlement.id}/approve`, {});
    expect(noAccept.status).toBe(400);
    const disputed = await as('admin').put(`/settlements/${settlement.id}/approve`, { acceptVariance: true, actualCashReceived: 1 });
    expect(disputed.status).toBe(409);

    const vaultBefore = (await as('admin').get('/cash-drawers/vault')).body.data.balance;
    const res = await as('admin').put(`/settlements/${settlement.id}/approve`, { acceptVariance: true, notes: 'Verified' });
    expect(res.status).toBe(200);
    expect(res.body.data.settlement).toMatchObject({ status: 'APPROVED', receivedByName: 'Aamina Sheikh' });
    expect(res.body.data.varianceAdjustment).toMatchObject({ varianceAmount: -100 });
    expect(res.body.data.successorDrawer).toMatchObject({ openingCash: 1000, expectedInDrawer: 1000, status: 'OPEN' });

    expect((await as('admin').get('/cash-drawers/vault')).body.data.balance - vaultBefore).toBe(settlement.handoverAmount);
    const old = (await as('admin').get(`/cash-drawers/${drawer.id}/movements`)).body.data;
    expect(old.at(-1).runningBalance).toBe(0);
    const mine = (await as('accountant').get('/cash-drawers/mine')).body.data;
    expect(mine.id).toBe(res.body.data.successorDrawer.id);
  });
});

describe('Step 13 · Reject & self-approval', () => {
  it('nobody approves their own drawer; reject unlocks without moving money', async () => {
    const drawer = (await as('admin').get('/cash-drawers/mine')).body.data;
    const res = await as('admin').post('/settlements', {
      drawerId: drawer.id, countedCash: drawer.expectedInDrawer, handoverAmount: drawer.expectedInDrawer, retainedFloat: 0,
    }, key('s2'));
    expect(res.status).toBe(201);
    const self = await as('admin').put(`/settlements/${res.body.data.id}/approve`, {});
    expect(self.status).toBe(403);
    expect(self.body.error.code).toBe('SELF_APPROVAL_NOT_ALLOWED');

    const rej = await as('super').put(`/settlements/${res.body.data.id}/reject`, { reason: 'Recount please' });
    expect(rej.body.data).toMatchObject({ status: 'REJECTED', rejectionReason: 'Recount please' });
    const after = (await as('admin').get('/cash-drawers/mine')).body.data;
    expect(after).toMatchObject({ status: 'OPEN', expectedInDrawer: drawer.expectedInDrawer });
  });

  it('accountants list only their own settlements', async () => {
    const res = await as('accountant').get('/settlements');
    expect(res.body.data.every((s) => s.submittedByUserId === 'usr-acc-01')).toBe(true);
    expect((await as('admin').get('/settlements')).body.data.length).toBe(2);
  });
});
