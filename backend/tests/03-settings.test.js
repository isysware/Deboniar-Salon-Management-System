// Step 4 — Branch Settings
import { describe, it, expect } from 'vitest';
import { as } from './helpers.js';

describe('Step 4 · Tax rules', () => {
  it('lists rules scoped to the caller branch', async () => {
    const res = await as('admin').get('/tax-rules?branchId=branch-2');
    expect(res.status).toBe(200);
    expect(res.body.data.every((r) => r.branchId === 'branch-1')).toBe(true);
    expect(res.body.data.find((r) => r.id === 'tax-lhe-std')).toMatchObject({ rate: 0.16, isBranchDefault: true });
  });

  it('creating a non-default rule does not change branch tax; 12.5% keeps precision', async () => {
    const res = await as('admin').post('/tax-rules', { name: 'Promo 12.5%', rate: 0.125 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ rate: 0.125, isBranchDefault: false, branchId: 'branch-1' });
    const b = await as('admin').get('/branches/branch-1');
    expect(b.body.data.taxRate).toBe(0.16);
  });

  it('rejects invalid rates and other-branch writes', async () => {
    expect((await as('admin').post('/tax-rules', { name: 'Bad', rate: 16 })).status).toBe(400);
    expect((await as('admin').post('/tax-rules', { name: 'X', rate: 0.1, branchId: 'branch-2' })).status).toBe(403);
    expect((await as('accountant').post('/tax-rules', { name: 'X', rate: 0.1 })).status).toBe(403);
    expect((await as('super').post('/tax-rules', { name: 'X', rate: 0.1 })).status).toBe(400); // SA must name a branch
  });

  it('switching the default syncs the branch; deactivating the default disables tax', async () => {
    const set = await as('admin').post('/tax-rules/branch-default', { ruleId: 'tax-lhe-reduced' });
    expect(set.status).toBe(200);
    expect(set.body.data).toMatchObject({ defaultTaxRuleId: 'tax-lhe-reduced', taxRate: 0.05, taxEnabled: true });

    const rules = await as('admin').get('/tax-rules');
    expect(rules.body.data.filter((r) => r.isBranchDefault).map((r) => r.id)).toEqual(['tax-lhe-reduced']);

    const off = await as('admin').post('/tax-rules/tax-lhe-reduced/toggle');
    expect(off.body.data).toMatchObject({ isActive: false, isBranchDefault: false });
    const b = await as('admin').get('/branches/branch-1');
    expect(b.body.data).toMatchObject({ taxEnabled: false, taxRate: 0 });

    const inactive = await as('admin').post('/tax-rules/branch-default', { ruleId: 'tax-lhe-reduced' });
    expect(inactive.status).toBe(400);

    // restore the standard default for later tests
    const restore = await as('admin').post('/tax-rules/branch-default', { ruleId: 'tax-lhe-std' });
    expect(restore.body.data).toMatchObject({ taxRate: 0.16, taxEnabled: true });
    await as('admin').post('/tax-rules/tax-lhe-reduced/toggle');
  });

  it('editing the default rule rate keeps the branch rate in sync', async () => {
    await as('admin').put('/tax-rules/tax-lhe-std', { rate: 0.15 });
    expect((await as('admin').get('/branches/branch-1')).body.data.taxRate).toBe(0.15);
    await as('admin').put('/tax-rules/tax-lhe-std', { rate: 0.16 });
    expect((await as('admin').get('/branches/branch-1')).body.data.taxRate).toBe(0.16);
  });
});

describe('Step 4 · Payment accounts', () => {
  it('lists accounts with balances derived from opening + movements', async () => {
    const res = await as('accountant').get('/payment-accounts');
    expect(res.status).toBe(200);
    expect(res.body.data.map((a) => a.id)).toEqual(['acc-1', 'acc-2', 'acc-3']);
    expect(res.body.data[0]).toMatchObject({ currentBalance: 1845000, accountType: 'BANK', bankName: 'Meezan Bank Ltd' });
  });

  it('new accounts start at zero and the balance cannot be edited', async () => {
    const res = await as('admin').post('/payment-accounts', {
      name: 'UBL Business', accountType: 'BANK', providerName: 'UBL', accountHolder: 'Salon LHE', currentBalance: 999999,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.currentBalance).toBe(0);

    const upd = await as('admin').put(`/payment-accounts/${res.body.data.id}`, { name: 'UBL Biz', currentBalance: 5 });
    expect(upd.body.data).toMatchObject({ name: 'UBL Biz', currentBalance: 0 });

    const tog = await as('admin').post(`/payment-accounts/${res.body.data.id}/toggle`);
    expect(tog.body.data.isActive).toBe(false);

    // Delete unused account -> permanently removed
    const del = await as('admin').delete(`/payment-accounts/${res.body.data.id}`);
    expect(del.status).toBe(200);
    expect(del.body.data.deleted).toBe(true);

    // Delete account with historical movements -> archives it to preserve ledger integrity
    const delExisting = await as('admin').delete('/payment-accounts/acc-1');
    expect(delExisting.status).toBe(200);
    expect(delExisting.body.data.archived).toBe(true);
    // Restore acc-1 back to active for subsequent tests
    await as('admin').post('/payment-accounts/acc-1/toggle');
  });

  it('validates required fields and denies accountants', async () => {
    expect((await as('admin').post('/payment-accounts', { name: 'X' })).status).toBe(400);
    expect((await as('accountant').post('/payment-accounts', { name: 'X', providerName: 'Y', accountHolder: 'Z' })).status).toBe(403);
    expect((await as('accountant').delete('/payment-accounts/acc-1')).status).toBe(403);
  });

  it('exposes the legacy online-account view', async () => {
    const res = await as('super').get('/online-accounts?branchId=branch-2');
    expect(res.body.data[0]).toMatchObject({ id: 'acc-4', accountName: 'Bank Alfalah Premier Business', type: 'BANK_CHECKING', accountNumberMasked: '····2201' });
  });
});

describe('Step 4 · Expense categories, payroll policy, system date', () => {
  it('manages expense categories with per-branch unique names', async () => {
    const list = await as('accountant').get('/expense-categories');
    expect(list.body.data).toHaveLength(5);

    const dup = await as('admin').post('/expense-categories', { name: 'supplies' });
    expect(dup.status).toBe(409);

    const c = await as('admin').post('/expense-categories', { name: 'Laundry', description: 'Towels' });
    expect(c.status).toBe(201);
    const t = await as('admin').post(`/expense-categories/${c.body.data.id}/toggle`);
    expect(t.body.data.isActive).toBe(false);
    expect((await as('accountant').post('/expense-categories', { name: 'X' })).status).toBe(403);
  });

  it('returns default payroll policy, saves updates, hides it from accountants', async () => {
    const def = await as('admin').get('/payroll-policy');
    expect(def.body.data).toMatchObject({ branchId: 'branch-1', monthlyAbsenceDivisor: 30, prorationMethod: 'CALENDAR_DAYS' });

    const upd = await as('admin').put('/payroll-policy', { monthlyAbsenceDivisor: 26, nonWorkedWeeklyOffPaid: true });
    expect(upd.body.data).toMatchObject({ monthlyAbsenceDivisor: 26, nonWorkedWeeklyOffPaid: true });

    const wd = await as('super').put('/payroll-policy', { branchId: 'branch-2', monthlyAbsenceDivisor: 'WORKING_DAYS' });
    expect(wd.body.data.monthlyAbsenceDivisor).toBe('WORKING_DAYS');

    expect((await as('accountant').get('/payroll-policy')).status).toBe(403);
  });

  it('gets and sets the business date (super admin only)', async () => {
    expect((await as('staff').get('/system/date')).body.data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((await as('admin').put('/system/date', { date: '2026-09-28' })).status).toBe(403);
    const set = await as('super').put('/system/date', { date: '2026-09-28' });
    expect(set.body.data.date).toBe('2026-09-28');
    expect((await as('admin').get('/system/date')).body.data.date).toBe('2026-09-28');
  });
});
