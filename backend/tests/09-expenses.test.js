// Step 12 — Expenses
import { describe, it, expect } from 'vitest';
import { as } from './helpers.js';

const key = (k) => ({ 'Idempotency-Key': `exp-${k}` });
const base = { category: 'Utilities', payee: 'LESCO', title: 'Electricity bill', amount: 1200, paymentSource: 'CASH_DRAWER' };

describe('Step 12 · Expenses', () => {
  let draft;
  let posted;

  it('drafts have no money effect and can be edited/deleted by their creator', async () => {
    const before = (await as('accountant').get('/cash-drawers/mine')).body.data.expectedInDrawer;
    const res = await as('accountant').post('/expenses/drafts', base);
    expect(res.status).toBe(201);
    draft = res.body.data;
    expect(draft).toMatchObject({ status: 'DRAFT', voucherNumber: expect.stringMatching(/^DFT-LHE-01-2026-/), amount: 1200 });
    expect((await as('accountant').get('/cash-drawers/mine')).body.data.expectedInDrawer).toBe(before);

    const upd = await as('accountant').put(`/expenses/drafts/${draft.id}`, { amount: 1500 });
    expect(upd.body.data.amount).toBe(1500);
    expect((await as('accountant').post('/expenses/drafts', { ...base, category: 'Nope' })).status).toBe(400);
  });

  it('posting a draft pays from the actor drawer and issues an EXP voucher', async () => {
    const before = (await as('accountant').get('/cash-drawers/mine')).body.data;
    const res = await as('accountant').post('/expenses/post', { ...base, amount: 1500, expenseId: draft.id }, key('p1'));
    expect(res.status).toBe(201);
    posted = res.body.data;
    expect(posted).toMatchObject({ id: draft.id, status: 'POSTED', voucherNumber: 'EXP-LHE-01-2026-0001', paidByName: 'Usman Farooq' });
    const after = (await as('accountant').get('/cash-drawers/mine')).body.data;
    expect(before.expectedInDrawer - after.expectedInDrawer).toBe(1500);
    expect(after.cashExpensesPaid - before.cashExpensesPaid).toBe(1500);

    expect((await as('accountant').put(`/expenses/drafts/${draft.id}`, { amount: 1 })).status).toBe(409);
    expect((await as('accountant').delete(`/expenses/drafts/${draft.id}`)).status).toBe(409);
  });

  it('online expense debits the bank account; insufficient cash is rejected', async () => {
    const acc = async () => (await as('admin').get('/payment-accounts')).body.data.find((a) => a.id === 'acc-1').currentBalance;
    const before = await acc();
    const res = await as('admin').post('/expenses/post', { ...base, payee: 'PTCL', amount: 3000, paymentSource: 'ONLINE_ACCOUNT', paymentAccountId: 'acc-1' }, key('p2'));
    expect(res.status).toBe(201);
    expect(res.body.data.paymentAccountName).toBe('Meezan Corporate Checking');
    expect(before - (await acc())).toBe(3000);

    const tooMuch = await as('accountant').post('/expenses/post', { ...base, amount: 99999999 }, key('p3'));
    expect(tooMuch.status).toBe(409);
    expect(tooMuch.body.error.code).toBe('INSUFFICIENT_DRAWER_CASH');
    const noAccount = await as('admin').post('/expenses/post', { ...base, paymentSource: 'ONLINE_ACCOUNT' }, key('p4'));
    expect(noAccount.status).toBe(400);
  });

  it('accountants only see their own vouchers', async () => {
    const res = await as('accountant').get('/expenses');
    expect(res.body.data.every((e) => e.createdByUserId === 'usr-acc-01' || e.paidByUserId === 'usr-acc-01')).toBe(true);
    const admin = await as('admin').get('/expenses?status=POSTED');
    expect(admin.body.data.length).toBeGreaterThanOrEqual(2);
    expect((await as('staff').get('/expenses')).status).toBe(403);
  });

  it('reversal is admin-only, creates a REV voucher and brings cash back without rewriting history', async () => {
    expect((await as('accountant').post(`/expenses/${posted.id}/reverse`, { reason: 'x' })).status).toBe(403);
    const before = (await as('admin').get('/cash-drawers/mine')).body.data.expectedInDrawer;
    const res = await as('admin').post(`/expenses/${posted.id}/reverse`, { reason: 'Duplicate bill' });
    expect(res.status).toBe(200);
    expect(res.body.data.originalExpense).toMatchObject({ status: 'REVERSED', reversalVoucherNumber: 'REV-LHE-01-2026-0001' });
    expect(res.body.data.reversalExpense).toMatchObject({ reversalOfVoucherNumber: 'EXP-LHE-01-2026-0001', amount: 1500, receivingCustodianName: 'Aamina Sheikh' });
    expect((await as('admin').get('/cash-drawers/mine')).body.data.expectedInDrawer - before).toBe(1500);
    expect((await as('admin').post(`/expenses/${posted.id}/reverse`, { reason: 'again' })).status).toBe(409);
  });
});
