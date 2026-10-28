import { beforeAll, describe, it, expect } from 'vitest';
import { as } from './helpers.js';
import prisma from '../src/config/prisma.js';
import { randomUUID } from 'node:crypto';

let ownInvoice, otherInvoice, seller;
beforeAll(async () => {
  seller = (await as('accountant').get('/auth/me')).body.data;
  const admin = (await as('admin').get('/auth/me')).body.data;
  const create = (user, amount) => prisma.invoice.create({ data: {
    invoiceNumber: `ISOLATION-${randomUUID()}`, branchId: seller.branchId,
    date: new Date('2026-10-15'), time: '12:00', clientName: 'Isolation Customer', clientPhone: '03009998877',
    subtotal: amount, netSales: amount, total: amount, amountDue: amount,
    processedByUserId: user.id, processedByName: user.name,
  } });
  ownInvoice = await create(seller, 125);
  otherInvoice = await create(admin, 975);
});

describe('Accountant Salesman & Reporting Scope Isolation', () => {
  it('returns only own seeded sales even with forged seller filters, while admins see both', async () => {
    for (const endpoint of ['/invoices', '/reports/sales-invoices']) {
      const query = `startDate=2026-10-01&endDate=2026-10-31&soldByUserId=${otherInvoice.processedByUserId}&userId=${otherInvoice.processedByUserId}`;
      const res = await as('accountant').get(`${endpoint}?${query}`);
      expect(res.status).toBe(200);
      const rows = res.body.data.rows ?? res.body.data;
      expect(rows.some((r) => r.id === ownInvoice.id || r.invoiceId === ownInvoice.id)).toBe(true);
      expect(rows.some((r) => r.id === otherInvoice.id || r.invoiceId === otherInvoice.id)).toBe(false);
      for (const role of ['admin', 'super']) {
        const all = await as(role).get(`${endpoint}?startDate=2026-10-01&endDate=2026-10-31`);
        expect(all.status).toBe(200);
        const allRows = all.body.data.rows ?? all.body.data;
        for (const invoice of [ownInvoice, otherInvoice]) expect(allRows.some((r) => r.id === invoice.id || r.invoiceId === invoice.id)).toBe(true);
      }
    }
  });

  it('blocks direct invoice and refund URLs and scopes POS outstanding dues', async () => {
    expect((await as('accountant').get(`/invoices/${otherInvoice.id}`)).status).toBe(403);
    expect((await as('accountant').get(`/invoices/${otherInvoice.id}/refunds`)).status).toBe(403);
    expect((await as('accountant').get(`/invoices/${ownInvoice.id}`)).status).toBe(200);
    const res = await as('accountant').get('/invoices/outstanding?clientIdOrPhone=03009998877');
    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => r.id)).toContain(ownInvoice.id);
    expect(res.body.data.map((r) => r.id)).not.toContain(otherInvoice.id);
  });

  it('blocks business-wide financial endpoints but retains POS catalog reads', async () => {
    for (const path of ['/reports/operating-profit', '/reports/inventory', '/inventory/cogs-report', '/inventory/summary', '/stock-movements', '/purchases']) {
      expect((await as('accountant').get(path)).status, path).toBe(403);
    }
    for (const path of ['/services', '/packages', '/inventory/items', '/inventory/batches', '/payment-accounts']) {
      expect((await as('accountant').get(path)).status, path).toBe(200);
    }
  });
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
