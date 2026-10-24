import { describe, it, expect } from 'vitest';
import { as } from './helpers.js';

describe('Financial Reports Suite API Contract (Sales, Income/Expense, Operating Profit, Payment Accounts)', () => {
  describe('Sales & Invoices Report (/reports/sales-invoices)', () => {
    it('blocks staff and allows admin and accountant', async () => {
      expect((await as('staff').get('/reports/sales-invoices')).status).toBe(403);
      expect((await as('admin').get('/reports/sales-invoices?preset=THIS_MONTH')).status).toBe(200);
      expect((await as('accountant').get('/reports/sales-invoices?preset=THIS_MONTH')).status).toBe(200);
    });

    it('returns complete sales and invoices payload structure', async () => {
      const res = await as('admin').get('/reports/sales-invoices?preset=THIS_MONTH');
      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data).toHaveProperty('meta');
      expect(data).toHaveProperty('kpis');
      expect(data).toHaveProperty('tenderBreakdown');
      expect(data).toHaveProperty('rows');
      expect(data).toHaveProperty('totals');

      const kpis = data.kpis;
      expect(typeof kpis.totalInvoices).toBe('number');
      expect(typeof kpis.grossSales).toBe('number');
      expect(typeof kpis.totalDiscounts).toBe('number');
      expect(typeof kpis.netSales).toBe('number');
      expect(typeof kpis.taxCharged).toBe('number');
      expect(typeof kpis.tipsCollected).toBe('number');
      expect(typeof kpis.invoiceTotal).toBe('number');
      expect(typeof kpis.totalPaid).toBe('number');
      expect(typeof kpis.totalOutstanding).toBe('number');
    });

    it('supports status and lifecycle filtering', async () => {
      const paidRes = await as('admin').get('/reports/sales-invoices?paymentStatus=PAID');
      expect(paidRes.status).toBe(200);
      for (const row of paidRes.body.data.rows) {
        expect(row.paymentStatus).toBe('PAID');
      }

      const activeRes = await as('admin').get('/reports/sales-invoices?lifecycle=ACTIVE');
      expect(activeRes.status).toBe(200);
      for (const row of activeRes.body.data.rows) {
        expect(row.lifecycle).toBe('ACTIVE');
      }
    });
  });

  describe('Income & Expense Report (/reports/income-expense)', () => {
    it('blocks staff and allows admin and accountant', async () => {
      expect((await as('staff').get('/reports/income-expense')).status).toBe(403);
      expect((await as('admin').get('/reports/income-expense?preset=THIS_MONTH')).status).toBe(200);
      expect((await as('accountant').get('/reports/income-expense?preset=THIS_MONTH')).status).toBe(200);
    });

    it('returns standardized income and expense schema with P&L segregation', async () => {
      const res = await as('admin').get('/reports/income-expense?preset=THIS_MONTH');
      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data).toHaveProperty('meta');
      expect(data).toHaveProperty('kpis');
      expect(data).toHaveProperty('categories');
      expect(data).toHaveProperty('rows');
      expect(data).toHaveProperty('totals');

      const kpis = data.kpis;
      expect(typeof kpis.totalRecognizedIncome).toBe('number');
      expect(typeof kpis.directExpenses).toBe('number');
      expect(typeof kpis.salaryExpenses).toBe('number');
      expect(typeof kpis.commissionExpenses).toBe('number');
      expect(typeof kpis.inventoryLoss).toBe('number');
      expect(typeof kpis.totalOperatingExpenses).toBe('number');
      expect(typeof kpis.netOperatingPosition).toBe('number');
    });
  });

  describe('Operating Profit Report (/reports/operating-profit)', () => {
    it('blocks staff and allows admin and accountant', async () => {
      expect((await as('staff').get('/reports/operating-profit')).status).toBe(403);
      expect((await as('admin').get('/reports/operating-profit?preset=THIS_MONTH')).status).toBe(200);
      expect((await as('accountant').get('/reports/operating-profit?preset=THIS_MONTH')).status).toBe(200);
    });

    it('returns structured 5-section statement rows and detailed rows', async () => {
      const res = await as('admin').get('/reports/operating-profit?preset=THIS_MONTH');
      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data).toHaveProperty('meta');
      expect(data).toHaveProperty('kpis');
      expect(data).toHaveProperty('statementRows');
      expect(data).toHaveProperty('rows');
      expect(data).toHaveProperty('totals');

      const statementRows = data.statementRows;
      expect(statementRows.length).toBeGreaterThan(0);
      const sections = new Set(statementRows.map((r) => r.section));
      expect(sections.has('REVENUE')).toBe(true);
      expect(sections.has('COGS')).toBe(true);
      expect(sections.has('GROSS_PROFIT')).toBe(true);
      expect(sections.has('EXPENSE')).toBe(true);
      expect(sections.has('NET_PROFIT')).toBe(true);
    });
  });

  describe('Payment Accounts Report (/reports/payment-accounts)', () => {
    it('blocks staff and allows admin and accountant', async () => {
      expect((await as('staff').get('/reports/payment-accounts')).status).toBe(403);
      expect((await as('admin').get('/reports/payment-accounts?preset=THIS_MONTH')).status).toBe(200);
      expect((await as('accountant').get('/reports/payment-accounts?preset=THIS_MONTH')).status).toBe(200);
    });

    it('returns accounts summary and reconciles closing balance', async () => {
      const res = await as('admin').get('/reports/payment-accounts?preset=THIS_MONTH');
      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data).toHaveProperty('meta');
      expect(data).toHaveProperty('kpis');
      expect(data).toHaveProperty('accountsSummary');
      expect(data).toHaveProperty('rows');
      expect(data).toHaveProperty('totals');

      const kpis = data.kpis;
      expect(typeof kpis.totalOpeningBalance).toBe('number');
      expect(typeof kpis.totalMoneyIn).toBe('number');
      expect(typeof kpis.totalMoneyOut).toBe('number');
      expect(typeof kpis.totalTransfersIn).toBe('number');
      expect(typeof kpis.totalTransfersOut).toBe('number');
      expect(typeof kpis.totalClosingBalance).toBe('number');

      // Verify mathematical reconciliation
      const computedClosing =
        Math.round(
          (kpis.totalOpeningBalance +
            kpis.totalMoneyIn -
            kpis.totalMoneyOut +
            kpis.totalTransfersIn -
            kpis.totalTransfersOut) *
            100
        ) / 100;
      expect(kpis.totalClosingBalance).toBe(computedClosing);
    });
  });
});
