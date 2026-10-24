// Tips against the spec: §4.4 cross-date reversal, §12.1 full refund returns the tip,
// §13.1 opening + movement = closing, §14 tip reconciliation under every filter.
import { describe, it, expect, afterAll } from 'vitest';
import { as } from './helpers.js';

const key = (k) => ({ 'Idempotency-Key': `tipspec-${k}` });
const round = (n) => Math.round(n * 100) / 100;
const setDate = (date) => as('super').put('/system/date', { date });

const statement = async (q) => (await as('admin').get(`/tips/statement?${new URLSearchParams(q)}`)).body.data.summary;
const reconciles = (st) => {
  expect(st.variance).toBe(0);
  expect(st.closingLiability).toBe(round(st.openingLiability + st.netTipsCollected - st.netPayouts));
  expect(st.closingLiability).toBe(round(st.unallocatedTips + st.allocatedUnpaidTips));
};
const paidTips = async (from, to) =>
  (await as('admin').get(`/reports/staff-performance?startDate=${from}&endDate=${to}&staffId=staff-1`)).body.data[0].paidTips;

const receiptFor = async (invoiceId) => (await as('admin').get('/tips/receipts')).body.data.find((r) => r.invoiceId === invoiceId);

describe('Tips · spec rules', () => {
  let payout;
  let septPaidBefore;

  afterAll(async () => { await setDate('2026-09-28'); });

  it('Sep 30 payout reversed on Oct 1: September keeps the payout, October gets the reversal (§4.4)', async () => {
    await setDate('2026-09-30');
    const inv = await sellExact('cross', 400);
    const receipt = await receiptFor(inv.id);
    expect(receipt).toMatchObject({ collectedAmount: 400, collectionDate: '2026-09-30' });
    const alloc = (await as('admin').post('/tips/allocate', { tipReceiptId: receipt.id, allocationType: 'DIRECT', recipients: [{ staffId: 'staff-1', amount: 400 }] })).body.data.allocations[0];
    const paid = await as('admin').post('/tips/payouts', { allocationId: alloc.id, amount: 400, method: 'CASH' }, key('cross-pay'));
    expect(paid.status).toBe(201);
    payout = paid.body.data.payout;
    septPaidBefore = await paidTips('2026-09-01', '2026-09-30');
    const septBefore = await statement({ startDate: '2026-09-01', endDate: '2026-09-30' });

    await setDate('2026-10-01');
    const rev = await as('admin').post(`/tips/payouts/${payout.id}/reverse`, { reversalReason: 'Paid twice' });
    expect(rev.status).toBe(200);

    // September is unchanged by the October reversal.
    const sept = await statement({ startDate: '2026-09-01', endDate: '2026-09-30' });
    expect(sept).toMatchObject({ netPayouts: septBefore.netPayouts, closingLiability: septBefore.closingLiability });
    expect(await paidTips('2026-09-01', '2026-09-30')).toBe(septPaidBefore);
    reconciles(sept);

    // October carries the reversal as a dated event that restores the liability.
    const oct = await statement({ startDate: '2026-10-01', endDate: '2026-10-31' });
    expect(oct.openingLiability).toBe(sept.closingLiability);
    expect(oct.netPayouts).toBe(-400);
    expect(oct.closingLiability).toBe(round(sept.closingLiability + 400));
    expect(await paidTips('2026-10-01', '2026-10-31')).toBe(-400);
    reconciles(oct);
  });

  it('statement reconciles under staff and payment-source filters (§14)', async () => {
    for (const q of [
      {}, { staffId: 'staff-1' }, { staffId: 'staff-2' }, { paymentSource: 'CASH' }, { paymentSource: 'ONLINE' },
      { paymentSource: 'ONLINE_ACCOUNT' }, { staffId: 'staff-1', paymentSource: 'CASH' },
      { startDate: '2026-09-29', endDate: '2026-10-01', staffId: 'staff-1' },
    ]) reconciles(await statement(q));
    const staff = await statement({ staffId: 'staff-1' });
    expect(staff).toMatchObject({ liabilityBasis: 'STAFF_ALLOCATIONS', unallocatedTips: 0 });
    // The reversed payout is owed to staff-1 again.
    expect(staff.allocatedUnpaidTips).toBeGreaterThanOrEqual(400);
  });

  it('full refund returns an unallocated tip to the customer (§12.1)', async () => {
    const inv = await sellExact('full', 300);
    const before = await statement({});
    const res = await as('admin').post(`/invoices/${inv.id}/refunds`, {
      reason: 'Client unhappy', refundMethod: 'CASH', lines: [{ lineId: inv.lineItems[0].id, quantity: 1 }],
    }, key('full-rf'));
    expect(res.status).toBe(201);
    expect(res.body.data.refund.tipReversed).toBe(300);
    expect(res.body.data.refund.cashOut).toBe(round(inv.total));
    expect(res.body.data.invoice.lifecycle).toBe('REFUNDED');
    expect((await receiptFor(inv.id)).unallocatedAmount).toBe(0);
    const after = await statement({});
    expect(after.closingLiability).toBe(round(before.closingLiability - 300));
    reconciles(after);
  });

  it('full refund is blocked while the tip is allocated to staff; partial refund keeps the tip', async () => {
    const inv = await sellExact('alloc', 250, 2);
    const receipt = await receiptFor(inv.id);
    await as('admin').post('/tips/allocate', { tipReceiptId: receipt.id, allocationType: 'DIRECT', recipients: [{ staffId: 'staff-1', amount: 250 }] });
    const partial = await as('admin').post(`/invoices/${inv.id}/refunds`, {
      reason: 'One service redone', refundMethod: 'CASH', lines: [{ lineId: inv.lineItems[0].id, quantity: 1 }],
    }, key('alloc-rf1'));
    expect(partial.status).toBe(201);
    expect(partial.body.data.refund.tipReversed).toBe(0);
    const full = await as('admin').post(`/invoices/${inv.id}/refunds`, {
      reason: 'Rest', refundMethod: 'CASH', lines: [{ lineId: inv.lineItems[1].id, quantity: 1 }],
    }, key('alloc-rf2'));
    expect(full.status).toBe(409);
    expect(full.body.error?.code ?? full.body.code).toBe('TIPS_ALLOCATED');
    reconciles(await statement({}));
  });

  it('accountant and staff stay blocked from tip management and the statement', async () => {
    for (const who of ['accountant', 'staff']) {
      expect((await as(who).get('/tips/statement')).status).toBe(403);
      expect((await as(who).post('/tips/payouts', { allocationId: 'x', amount: 1, method: 'CASH' }, key(`deny-${who}`))).status).toBe(403);
    }
  });
});

/** Cash checkout paying the exact bill + tip; `services` lines of PKR 3,500 (16% tax → 4,060 each). */
async function sellExact(k, tip, services = 1) {
  const cartItems = Array.from({ length: services }, () => ({ type: 'SERVICE', item: { id: 'srv-lhe-01', price: 3500 }, quantity: 1, staffId: 'staff-1' }));
  const bill = 4060 * services;
  const res = await as('admin').post('/pos/invoices/checkout', {
    clientName: 'Tip Spec Client', clientPhone: '03001112233', cartItems, tip,
    payments: [{ method: 'CASH', amount: bill + tip, billAllocation: bill, tipAllocation: tip, cashTendered: bill + tip, changeReturned: 0 }],
  }, key(`${k}-sale`));
  if (res.status !== 201) throw new Error(`checkout ${k}: ${res.status} ${JSON.stringify(res.body)}`);
  expect(res.body.data).toMatchObject({ total: bill + tip, amountDue: 0 });
  return res.body.data;
}
