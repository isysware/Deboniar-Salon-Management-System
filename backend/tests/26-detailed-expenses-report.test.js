import { describe, it, expect } from 'vitest';
import { as } from './helpers.js';

describe('Detailed Operational Expenses Report API Contract', () => {
  it('blocks staff from accessing detailed expenses report', async () => {
    const res = await as('staff').get('/reports/detailed-expenses');
    expect(res.status).toBe(403);
  });

  it('allows admin and accountant to retrieve detailed expenses report with tender and category breakdowns', async () => {
    const res = await as('admin').get('/reports/detailed-expenses?preset=THIS_MONTH');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');

    const data = res.body.data;
    expect(data).toHaveProperty('meta');
    expect(data).toHaveProperty('kpis');
    expect(data).toHaveProperty('tenderBreakdown');
    expect(data).toHaveProperty('categoryBreakdown');
    expect(data).toHaveProperty('categories');
    expect(data).toHaveProperty('rows');
    expect(data).toHaveProperty('totals');

    // Verify Tender Breakdown structure (Cash vs Online accounts)
    const tb = data.tenderBreakdown;
    expect(typeof tb.totalCash).toBe('number');
    expect(typeof tb.totalOnline).toBe('number');
    expect(typeof tb.grandTotal).toBe('number');
    expect(Array.isArray(tb.onlineAccounts)).toBe(true);

    // Verify grandTotal equals cash + online
    expect(Math.round((tb.totalCash + tb.totalOnline) * 100) / 100).toBe(tb.grandTotal);
  });

  it('filters expenses by payment source and status', async () => {
    const cashRes = await as('admin').get('/reports/detailed-expenses?paymentSource=CASH_DRAWER');
    expect(cashRes.status).toBe(200);
    for (const row of cashRes.body.data.rows) {
      expect(row.paymentSource).toBe('CASH_DRAWER');
    }

    const onlineRes = await as('admin').get('/reports/detailed-expenses?paymentSource=ONLINE_ACCOUNT');
    expect(onlineRes.status).toBe(200);
    for (const row of onlineRes.body.data.rows) {
      expect(row.paymentSource).toBe('ONLINE_ACCOUNT');
    }
  });
});
