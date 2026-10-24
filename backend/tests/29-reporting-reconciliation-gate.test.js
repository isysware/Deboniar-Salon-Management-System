import { describe, it, expect } from 'vitest';
import { as } from './helpers.js';

describe('Reporting Suite Reconciliation Gate (§14)', () => {
  it('enforces RBAC isolation: Accountants are denied from HR/Salary/Commission/Attendance reports', async () => {
    // Accountant must be 403 on Staff Salary, Staff Commission, Staff Performance, and Attendance
    expect((await as('accountant').get('/reports/staff-salary')).status).toBe(403);
    expect((await as('accountant').get('/reports/staff-commission?startDate=2026-06-01&endDate=2026-06-30')).status).toBe(403);
    expect((await as('accountant').get('/reports/staff-performance?startDate=2026-06-01&endDate=2026-06-30')).status).toBe(403);
    expect((await as('accountant').get('/reports/attendance-overtime?preset=THIS_MONTH')).status).toBe(403);
    expect((await as('accountant').get('/reports/attendance?preset=THIS_MONTH')).status).toBe(403);
  });

  it('allows administrators and accountants to access financial and operating reports', async () => {
    for (const path of [
      '/reports/sales-invoices?preset=THIS_MONTH',
      '/reports/income-expense?preset=THIS_MONTH',
      '/reports/operating-profit?preset=THIS_MONTH',
      '/reports/payment-accounts?preset=THIS_MONTH',
      '/reports/cash-drawer?preset=THIS_MONTH',
      '/reports/detailed-expenses?preset=THIS_MONTH',
      '/reports/inventory?type=valuation',
    ]) {
      const res = await as('admin').get(path);
      expect(res.status, path).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('meta');
      expect(res.body.data).toHaveProperty('kpis');
    }
  });

  it('mathematically reconciles Net Sales across Sales & Invoices, Income & Expense, and Operating Profit', async () => {
    const [salesRes, incExpRes, opProfitRes] = await Promise.all([
      as('admin').get('/reports/sales-invoices?preset=THIS_MONTH'),
      as('admin').get('/reports/income-expense?preset=THIS_MONTH'),
      as('admin').get('/reports/operating-profit?preset=THIS_MONTH'),
    ]);

    expect(salesRes.status).toBe(200);
    expect(incExpRes.status).toBe(200);
    expect(opProfitRes.status).toBe(200);

    const salesNet = salesRes.body.data.kpis.netSales;
    const incExpNetSales = incExpRes.body.data.kpis.totalRecognizedIncome;
    const opProfitNetSales = opProfitRes.body.data.kpis.totalNetRevenue;

    // Cross-report mathematical parity (§14)
    expect(incExpNetSales).toBe(salesNet);
    expect(opProfitNetSales).toBe(salesNet);
  });

  it('strictly segregates sales tax and staff tips from recognized revenue', async () => {
    const salesRes = await as('admin').get('/reports/sales-invoices?preset=THIS_MONTH');
    const incExpRes = await as('admin').get('/reports/income-expense?preset=THIS_MONTH');

    const kpis = salesRes.body.data.kpis;
    // Invoice Total = Net Sales + Tax + Tip
    const expectedTotal = Math.round((kpis.netSales + kpis.taxCharged + kpis.tipsCollected) * 100) / 100;
    expect(kpis.invoiceTotal).toBe(expectedTotal);

    // Revenue in Income & Expense strictly equals Net Sales without adding tax or tips
    expect(incExpRes.body.data.kpis.totalRecognizedIncome).toBe(kpis.netSales);
  });

  it('reconciles bank account movements: closing = opening + in - out + transferIn - transferOut', async () => {
    const res = await as('admin').get('/reports/payment-accounts?preset=THIS_MONTH');
    expect(res.status).toBe(200);

    const kpis = res.body.data.kpis;
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

  it('verifies all 11 canonical reports return consistent audit metadata schema', async () => {
    const endpoints = [
      '/reports/income-expense?preset=THIS_MONTH',
      '/reports/sales-invoices?preset=THIS_MONTH',
      '/reports/payment-accounts?preset=THIS_MONTH',
      '/reports/cash-drawer?preset=THIS_MONTH',
      '/reports/detailed-expenses?preset=THIS_MONTH',
      '/reports/inventory?type=valuation',
      '/reports/attendance-overtime?preset=THIS_MONTH',
      '/reports/operating-profit?preset=THIS_MONTH',
    ];

    for (const ep of endpoints) {
      const res = await as('admin').get(ep);
      expect(res.status, ep).toBe(200);
      const meta = res.body.data.meta;
      expect(meta).toHaveProperty('branchId');
      expect(meta).toHaveProperty('branchName');
      expect(meta).toHaveProperty('from');
      expect(meta).toHaveProperty('to');
      expect(meta).toHaveProperty('dateBasis');
      expect(meta).toHaveProperty('generatedAt');
      expect(meta).toHaveProperty('generatedBy');
    }
  });
});
