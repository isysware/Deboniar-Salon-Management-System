import { describe, it, expect } from 'vitest';
import { as } from './helpers.js';
import prisma from '../src/config/prisma.js';

describe('Cash Drawer Report & Tender Breakdown API Contract', () => {
  it('blocks staff from accessing cash drawer reports', async () => {
    const res = await as('staff').get('/reports/cash-drawer');
    expect(res.status).toBe(403);
  });

  it('allows admin and accountant to retrieve cash drawer reports with tender breakdown', async () => {
    const res = await as('admin').get('/reports/cash-drawer?preset=THIS_MONTH');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');

    const data = res.body.data;
    expect(data).toHaveProperty('meta');
    expect(data).toHaveProperty('kpis');
    expect(data).toHaveProperty('tenderBreakdown');
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

  it('verifies sales invoices report also returns tender breakdown', async () => {
    const res = await as('admin').get('/reports/sales-invoices?preset=THIS_MONTH');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    const data = res.body.data;
    expect(data).toHaveProperty('tenderBreakdown');
    const tb = data.tenderBreakdown;
    expect(typeof tb.totalCash).toBe('number');
    expect(typeof tb.totalOnline).toBe('number');
    expect(typeof tb.grandTotal).toBe('number');
    expect(Array.isArray(tb.onlineAccounts)).toBe(true);
  });
});
