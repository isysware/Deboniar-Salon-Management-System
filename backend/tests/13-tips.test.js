// Step 18 — Tips (staff liability)
import { describe, it, expect } from 'vitest';
import { as } from './helpers.js';

const key = (k) => ({ 'Idempotency-Key': `tip-${k}` });

describe('Step 18 · Tips', () => {
  let receipt, allocs, payout;

  it('lists POS tip receipts; accountants and staff are blocked', async () => {
    expect((await as('accountant').get('/tips/receipts')).status).toBe(403);
    expect((await as('staff').get('/tips/receipts')).status).toBe(403);
    const res = await as('admin').get('/tips/receipts');
    expect(res.status).toBe(200);
    receipt = res.body.data.find((r) => r.unallocatedAmount > 0);
    expect(receipt).toMatchObject({ collectedAmount: 500, status: 'UNALLOCATED' });
  });

  it('allocates to branch staff and blocks over-allocation / foreign staff', async () => {
    const over = await as('admin').post('/tips/allocate', { tipReceiptId: receipt.id, allocationType: 'POOLED_CUSTOM', recipients: [{ staffId: 'staff-1', amount: 600 }] });
    expect(over.status).toBe(400);
    const foreign = await as('admin').post('/tips/allocate', { tipReceiptId: receipt.id, allocationType: 'DIRECT', recipients: [{ staffId: 'staff-4', amount: 100 }] });
    expect(foreign.status).toBe(400);
    const res = await as('admin').post('/tips/allocate', {
      tipReceiptId: receipt.id, allocationType: 'POOLED_CUSTOM', recipients: [{ staffId: 'staff-1', amount: 300 }, { staffId: 'staff-2', amount: 150 }],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.tipReceipt).toMatchObject({ allocatedAmount: 450, unallocatedAmount: 50, status: 'PARTIALLY_ALLOCATED' });
    allocs = res.body.data.allocations;
    expect(allocs[0].allocationNumber).toMatch(/^TA-LHE-01-2026-/);
  });

  it('cancels an unpaid allocation, restoring the unallocated balance', async () => {
    const res = await as('admin').post(`/tips/allocations/${allocs[1].id}/cancel`, { reason: 'Wrong stylist' });
    expect(res.body.data.cancelledAllocation.status).toBe('CANCELLED');
    expect(res.body.data.tipReceipt).toMatchObject({ allocatedAmount: 300, unallocatedAmount: 200 });
  });

  it('pays out from the drawer, rejects over-payout, blocks cancel while paid, reversal restores', async () => {
    const before = (await as('admin').get('/cash-drawers/mine')).body.data.expectedInDrawer;
    const res = await as('admin').post('/tips/payouts', { allocationId: allocs[0].id, amount: 200, method: 'CASH' }, key('1'));
    expect(res.status).toBe(201);
    payout = res.body.data.payout;
    expect(payout.payoutNumber).toMatch(/^TP-LHE-01-2026-/);
    expect(res.body.data.allocation).toMatchObject({ paidAmount: 200, outstandingAmount: 100, status: 'PARTIALLY_PAID' });
    expect((await as('admin').get('/cash-drawers/mine')).body.data.expectedInDrawer).toBe(before - 200);
    expect((await as('admin').post('/tips/payouts', { allocationId: allocs[0].id, amount: 101, method: 'CASH' }, key('2'))).status).toBe(400);
    expect((await as('admin').post(`/tips/allocations/${allocs[0].id}/cancel`, { reason: 'x' })).status).toBe(409);

    const st = (await as('admin').get('/tips/statement')).body.data.summary;
    expect(st.closingLiability).toBe(round(st.unallocatedTips + st.allocatedUnpaidTips));

    const rev = await as('admin').post(`/tips/payouts/${payout.id}/reverse`, { reversalReason: 'Paid wrong person' });
    expect(rev.body.data.reversedPayout.status).toBe('REVERSED');
    expect(rev.body.data.allocation).toMatchObject({ paidAmount: 0, outstandingAmount: 300, status: 'UNPAID' });
    expect((await as('admin').get('/cash-drawers/mine')).body.data.expectedInDrawer).toBe(before);
  });

  it('staff see their own tips', async () => {
    const me = await as('staff').get('/tips/me');
    expect(me.status).toBe(200);
    expect(me.body.data.summary).toMatchObject({ totalAllocated: 300, totalPaid: 0, totalOutstanding: 300 });
  });
});

const round = (n) => Math.round(n * 100) / 100;
