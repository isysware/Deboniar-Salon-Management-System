import { beforeAll, describe, expect, it } from 'vitest';
import { as } from './helpers.js';
import prisma from '../src/config/prisma.js';

let newBranch;
let customer;
beforeAll(async () => {
  const created = await as('super').post('/branches', { name: 'Isolation Audit Branch', code: 'AUD-03', city: 'Islamabad' });
  expect(created.status).toBe(201);
  newBranch = created.body.data.id;
  const client = await as('super').post('/clients', { branchId: newBranch, name: 'Third Branch Customer', phone: '03001239876' });
  expect(client.status).toBe(201);
  customer = client.body.data;
});

describe('Adding a third branch preserves isolation', () => {
  it('keeps same-phone customers separate across branches', async () => {
    const res = await as('super').post('/clients', { branchId: 'branch-1', name: 'First Branch Customer', phone: customer.phone });
    expect(res.status).toBe(201);
    expect(res.body.data.id).not.toBe(customer.id);
    expect(res.body.data.branchId).toBe('branch-1');
    const third = await as('super').get(`/clients?branchId=${newBranch}`);
    expect(third.body.data.map(c => c.id)).toEqual([customer.id]);
  });

  it('rejects reading or editing another branch customer by ID', async () => {
    expect((await as('admin').get(`/clients/${customer.id}`)).status).toBe(403);
    expect((await as('accountant').get(`/clients/${customer.id}`)).status).toBe(403);
    expect((await as('admin').put(`/clients/${customer.id}`, { name: 'Wrong Branch Edit' })).status).toBe(403);
    const res = await as('super').get(`/clients/${customer.id}`);
    expect(res.body.data.name).toBe('Third Branch Customer');
  });

  it.each(['/clients', '/staff', '/users', '/appointments', '/invoices', '/expenses', '/stock-movements', '/payroll/runs', '/tips/receipts'])(
    '%s ignores forged branch selections for a branch admin', async path => {
      const own = await as('admin').get(`${path}?branchId=branch-1`);
      const foreign = await as('admin').get(`${path}?branchId=${newBranch}`);
      const all = await as('admin').get(`${path}?branchId=ALL`);
      expect(own.status, path).toBe(200);
      expect(foreign.status, path).toBe(200);
      expect(all.status, path).toBe(200);
      expect(foreign.body.data).toEqual(own.body.data);
      expect(all.body.data).toEqual(own.body.data);
    }
  );

  it.each(['operating-profit', 'sales-invoices', 'income-expense', 'payment-accounts', 'cash-drawer', 'detailed-expenses', 'attendance-overtime'])(
    '%s scopes reports to the selected branch and locks admins to their branch', async report => {
      const range = 'preset=CUSTOM&from=2026-01-01&to=2026-12-31';
      const fresh = await as('super').get(`/reports/${report}?branchId=${newBranch}&${range}`);
      expect(fresh.status, report).toBe(200);
      expect(fresh.body.data.meta.branchId).toBe(newBranch);
      if (report === 'operating-profit') {
        expect(fresh.body.data.rows.every(row => row.currentAmount === 0 && row.priorAmount === 0)).toBe(true);
      } else {
        expect(fresh.body.data.rows).toEqual([]);
      }
      const forged = await as('admin').get(`/reports/${report}?branchId=${newBranch}&${range}`);
      expect(forged.status, report).toBe(200);
      expect(forged.body.data.meta.branchId).toBe('branch-1');
      if (report === 'operating-profit') expect(fresh.body.data.totals.netProfit).toBe(0);
    }
  );

  it('keeps a third-branch expense out of other branches while consolidating it in ALL', async () => {
    const range = 'preset=CUSTOM&from=2026-01-01&to=2026-12-31';
    const read = branch => as('super').get(`/reports/operating-profit?branchId=${branch}&${range}`);
    const beforeOwn = await read('branch-1');
    const beforeAll = await read('ALL');
    // Only the independently created temporary test database is written here.
    await prisma.expense.create({ data: {
      voucherNumber: 'EXP-AUD-03-ISOLATION', branchId: newBranch,
      expenseDate: new Date('2026-10-12T00:00:00Z'), time: '12:00',
      title: 'Third Branch Isolation Fixture', payee: 'Audit Supplier', category: 'Isolation',
      amount: 321, paymentSource: 'ONLINE_ACCOUNT', status: 'POSTED',
      createdByUserId: 'usr-super-01', createdByName: 'Audit',
    } });
    const third = await read(newBranch);
    const afterOwn = await read('branch-1');
    const afterAll = await read('ALL');
    expect(third.body.data.totals.netProfit).toBe(-321);
    expect(afterOwn.body.data.totals).toEqual(beforeOwn.body.data.totals);
    expect(afterAll.body.data.totals.operatingExpenses).toBe(beforeAll.body.data.totals.operatingExpenses + 321);
    expect(afterAll.body.data.totals.netProfit).toBe(beforeAll.body.data.totals.netProfit - 321);
  });
});
