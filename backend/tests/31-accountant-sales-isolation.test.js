import { describe, it, expect } from 'vitest';
import { as } from './helpers.js';

describe('Accountant Salesman & Reporting Scope Isolation', () => {
  it('enforces that accountants only retrieve their own sales in /reports/sales-invoices', async () => {
    const accountantRes = await as('accountant').get('/reports/sales-invoices?preset=THIS_MONTH');
    expect(accountantRes.status).toBe(200);
    const data = accountantRes.body.data;
    expect(Array.isArray(data.rows)).toBe(true);

    const accountantMe = (await as('accountant').get('/auth/me')).body.data;

    // Every single row returned to accountant must belong to that accountant
    for (const row of data.rows) {
      expect(row.soldByUserId).toBe(accountantMe.id);
    }
  });

  it('allows admins to see all sales and filter specifically by accountant in /reports/sales-invoices', async () => {
    const adminRes = await as('admin').get('/reports/sales-invoices?preset=THIS_MONTH');
    expect(adminRes.status).toBe(200);

    const accountantMe = (await as('accountant').get('/auth/me')).body.data;

    // Filter by this accountant
    const filteredRes = await as('admin').get(`/reports/sales-invoices?soldByUserId=${accountantMe.id}`);
    expect(filteredRes.status).toBe(200);
    for (const row of filteredRes.body.data.rows) {
      expect(row.soldByUserId).toBe(accountantMe.id);
      expect(row.soldByName).toBeTruthy();
    }
  });

  it('isolates accountant from salon payroll and other staff records in /reports/income-expense', async () => {
    const res = await as('accountant').get('/reports/income-expense?preset=THIS_MONTH');
    expect(res.status).toBe(200);
    const data = res.body.data;

    // Accountant should have 0 salary expenses and 0 commission expenses
    expect(data.kpis.salaryExpenses).toBe(0);
    expect(data.kpis.commissionExpenses).toBe(0);
    expect(data.kpis.inventoryLoss).toBe(0);

    // No rows should be of type SALARY_EXPENSE or COMMISSION_EXPENSE
    for (const row of data.rows) {
      expect(row.type).not.toBe('SALARY_EXPENSE');
      expect(row.type).not.toBe('COMMISSION_EXPENSE');
      expect(row.type).not.toBe('INVENTORY_WRITEOFF');
    }
  });

  it('isolates accountant cash drawers in /reports/cash-drawer', async () => {
    const accountantRes = await as('accountant').get('/reports/cash-drawer?preset=THIS_MONTH');
    expect(accountantRes.status).toBe(200);
    const accountantMe = (await as('accountant').get('/auth/me')).body.data;

    for (const row of accountantRes.body.data.rows) {
      if (row.custodianUserId) {
        expect(row.custodianUserId).toBe(accountantMe.id);
      }
    }
  });
});
