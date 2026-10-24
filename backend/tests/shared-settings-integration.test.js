import { beforeAll, describe, expect, it } from 'vitest';
import { as } from './helpers.js';
import prisma from '../src/config/prisma.js';
import { postAccountMovement, accountStatement } from '../src/modules/cash/cash.service.js';
import { paymentAccountsReport } from '../src/modules/reports/reports.service.js';
import { computeBranchMetrics } from '../src/modules/dashboard/dashboard.service.js';
import { accountBalances } from '../src/lib/balances.js';
import { listPaymentAccounts } from '../src/modules/settings/settings.service.js';
let third, shared, tax;
const superActor = { id: 'usr-super-01', name: 'Audit', role: 'SUPER_ADMIN' };
const admin = { id: 'usr-admin-01', name: 'Admin', role: 'ADMIN', branchId: 'branch-1' };
const account = { name: 'Isolation Shared Bank', accountType: 'BANK', providerName: 'Audit Bank', accountHolder: 'Salon' };
beforeAll(async () => { const res = await as('super').post('/branches', { name: 'Shared Settings Audit', code: 'SHR-03', city: 'Test' }); expect(res.status).toBe(201); third = res.body.data.id; });
describe('real database settings branch isolation', () => {
  it('creates a single-branch account and excludes it everywhere else', async () => {
    const res = await as('super').post('/payment-accounts', { ...account, branchIds: [third] }); expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.data.branchIds).toEqual([third]);
    for (const branchId of ['branch-1', 'branch-2']) { const rows = await as('super').get('/payment-accounts?branchId=' + branchId); expect(rows.body.data.some((a) => a.id === res.body.data.id)).toBe(false); }
  });
  it('creates one shared account, available only in assigned branches', async () => {
    const res = await as('super').post('/payment-accounts', { ...account, branchIds: ['branch-1', 'branch-2', 'branch-2'] }); expect(res.status, JSON.stringify(res.body)).toBe(201); shared = res.body.data;
    expect(new Set(shared.branchIds)).toEqual(new Set(['branch-1', 'branch-2'])); expect(await prisma.paymentAccount.count({ where: { id: shared.id } })).toBe(1);
    for (const branchId of ['branch-1', 'branch-2', third]) { const rows = await as('super').get('/payment-accounts?branchId=' + branchId); expect(rows.body.data.some((a) => a.id === shared.id)).toBe(branchId !== third); }
  });
  it('saves shared tax and keeps defaults branch-specific', async () => {
    const res = await as('super').post('/tax-rules', { name: 'Shared Audit Tax', rate: 0.125, branchIds: ['branch-1', 'branch-2'] }); expect(res.status, JSON.stringify(res.body)).toBe(201); tax = res.body.data;
    expect(new Set(tax.branchIds)).toEqual(new Set(['branch-1', 'branch-2']));
    expect((await as('super').post('/tax-rules/branch-default', { branchId: 'branch-2', ruleId: tax.id })).status).toBe(200);
    for (const branchId of ['branch-1', 'branch-2', third]) { const res = await as('super').get('/tax-rules?branchId=' + branchId); const row = res.body.data.find((a) => a.id === tax.id); if (branchId === third) expect(row).toBeUndefined(); else expect(row.isBranchDefault).toBe(branchId === 'branch-2'); }
    expect((await as('super').post('/tax-rules/branch-default', { branchId: third, ruleId: tax.id })).status).toBe(404);
  });
  it('rejects invalid branch selections atomically', async () => { const before = await prisma.paymentAccount.count(); for (const branchIds of [[], ['branch-1', 'missing-branch']]) expect((await as('super').post('/payment-accounts', { ...account, branchIds })).status).toBeGreaterThanOrEqual(400); expect(await prisma.paymentAccount.count()).toBe(before); });
  it('blocks every Admin management method and scopes operational options despite forged branch', async () => {
    for (const resource of ['tax-rules', 'payment-accounts']) { expect((await as('admin').get('/' + resource)).status).toBe(403); expect((await as('admin').post('/' + resource, {})).status).toBe(403); expect((await as('admin').put('/' + resource + '/fake', {})).status).toBe(403); expect((await as('admin').post('/' + resource + '/fake/toggle')).status).toBe(403); const own = await as('admin').get('/' + resource + '/options'); const forged = await as('admin').get('/' + resource + '/options?branchId=' + third); expect(own.status).toBe(200); expect(forged.body.data).toEqual(own.body.data); }
  });
  it('posts movements to their real branch and rejects unassigned branches', async () => {
    for (const [branchId, amount] of [['branch-1', 111], ['branch-2', 222]]) await prisma.$transaction((tx) => postAccountMovement(tx, { accountId: shared.id, branchId, amount, type: 'ADJUSTMENT', direction: 'IN', sourceModule: 'AUDIT', actor: superActor }));
    await expect(prisma.$transaction((tx) => postAccountMovement(tx, { accountId: shared.id, branchId: third, amount: 999, type: 'ADJUSTMENT', direction: 'IN', sourceModule: 'AUDIT', actor: superActor }))).rejects.toThrow();
    const rows = await prisma.accountMovement.findMany({ where: { accountId: shared.id } }); expect(rows.map((m) => [m.branchId, Number(m.amount)]).sort()).toEqual([['branch-1', 111], ['branch-2', 222]]);
  });
  it('never mixes shared account balances, statements or report rows across branches', async () => {
    for (const [branchId, amount] of [['branch-1', 111], ['branch-2', 222]]) {
      const rows = await listPaymentAccounts(superActor, branchId); expect(rows.find((a) => a.id === shared.id).currentBalance).toBe(amount);
      const statement = await accountStatement({ ...admin, branchId }, shared.id); expect(statement.branchId).toBe(branchId); expect(statement.closingBalance).toBe(amount); expect(statement.movements.every((m) => m.branchId === branchId)).toBe(true);
      const report = await paymentAccountsReport(superActor, { branchId, accountId: shared.id, preset: 'CUSTOM', from: '2020-01-01', to: '2030-12-31' }); expect(report.accountsSummary.find((a) => a.accountId === shared.id).branchId).toBe(branchId); expect(report.rows.length).toBe(1); expect(report.rows[0].branchId).toBe(branchId); expect(report.rows[0].amount).toBe(amount);
    }
    const all = await listPaymentAccounts(superActor, 'ALL'); expect(all.find((a) => a.id === shared.id).currentBalance).toBe(333);
  });
  it('prevents spending another branch funds', async () => { await expect(prisma.$transaction((tx) => postAccountMovement(tx, { accountId: shared.id, branchId: 'branch-1', amount: 112, type: 'ADJUSTMENT', direction: 'OUT', sourceModule: 'AUDIT', actor: superActor }))).rejects.toThrow(); });
  it('creates a single-branch tax and excludes it from other branches', async () => {
    const res = await as('super').post('/tax-rules', { name: 'Single Branch Tax', rate: 0.07, branchIds: [third] }); expect(res.status).toBe(201); expect(res.body.data.branchIds).toEqual([third]);
    const other = await as('super').get('/tax-rules?branchId=branch-1'); expect(other.body.data.some((r) => r.id === res.body.data.id)).toBe(false);
  });
  it('keeps dashboard account totals scoped and avoids double counting consolidated accounts', async () => {
    for (const branchId of ['branch-1', 'branch-2', third]) {
      const branch = await prisma.branch.findUnique({ where: { id: branchId } });
      const accounts = await listPaymentAccounts(superActor, branchId);
      const metrics = await computeBranchMetrics([branchId], '2026-10-24', branch);
      expect(metrics.onlineBalancesTotal).toBeCloseTo(accounts.reduce((sum, a) => sum + a.currentBalance, 0), 2);
    }
    const metrics = await computeBranchMetrics(['branch-1', 'branch-2', third], '2026-10-24', { id: 'ALL', name: 'All' });
    const accounts = await listPaymentAccounts(superActor, 'ALL');
    expect(metrics.onlineBalancesTotal).toBeCloseTo(accounts.reduce((sum, a) => sum + a.currentBalance, 0), 2);
  });
  it('keeps pre-period balances scoped and legacy opening balance owned by its original branch', async () => {
    const old = await prisma.paymentAccount.findFirst({ where: { branchId: 'branch-1', openingBalance: { gt: 0 } } });
    if (old) { const map = await accountBalances([old.id], { branchIds: ['branch-2'] }); expect(Number(map.get(old.id))).toBe(0); }
    const statement = await accountStatement(admin, shared.id, { from: new Date('2030-01-01') }); expect(statement.openingBalance).toBe(111); expect(statement.movements).toEqual([]);
  });
  it('rejects statement access to an unassigned branch', async () => {
    await expect(accountStatement({ ...admin, branchId: third }, shared.id)).rejects.toThrow();
  });
  it('syncs shared default rates and disables tax in every affected branch when deactivated', async () => {
    expect((await as('super').post('/tax-rules/branch-default', { branchId: 'branch-1', ruleId: tax.id })).status).toBe(200);
    expect((await as('super').put('/tax-rules/' + tax.id, { rate: 0.09 })).status).toBe(200);
    for (const id of ['branch-1', 'branch-2']) expect(Number((await prisma.branch.findUnique({ where: { id } })).taxRate)).toBe(0.09);
    expect((await as('super').post('/tax-rules/' + tax.id + '/toggle')).status).toBe(200);
    for (const id of ['branch-1', 'branch-2']) { const branch = await prisma.branch.findUnique({ where: { id } }); expect(branch.taxEnabled).toBe(false); expect(branch.defaultTaxRuleId).toBeNull(); }
  });
  it('reassigns an unused account without leaking into its previous branch', async () => {
    const created = await as('super').post('/payment-accounts', { ...account, branchIds: ['branch-1'] });
    const id = created.body.data.id;
    expect((await as('super').put('/payment-accounts/' + id, { branchIds: [third] })).status).toBe(200);
    expect((await listPaymentAccounts(superActor, 'branch-1')).some((a) => a.id === id)).toBe(false);
    expect((await listPaymentAccounts(superActor, third)).some((a) => a.id === id)).toBe(true);
  });

});
