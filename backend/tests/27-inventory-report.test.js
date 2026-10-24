import { describe, it, expect } from 'vitest';
import { as } from './helpers.js';

describe('Inventory & Supply Chain Reports Suite API Contract', () => {
  it('blocks staff from accessing inventory reports', async () => {
    const res = await as('staff').get('/reports/inventory');
    expect(res.status).toBe(403);
  });

  it('allows admin and accountant to retrieve valuation report', async () => {
    const res = await as('admin').get('/reports/inventory?type=valuation&preset=THIS_MONTH');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');

    const data = res.body.data;
    expect(data).toHaveProperty('meta');
    expect(data).toHaveProperty('kpis');
    expect(data).toHaveProperty('rows');
    expect(data).toHaveProperty('totals');

    const k = data.kpis;
    expect(typeof k.totalCostValue).toBe('number');
    expect(typeof k.totalRetailValue).toBe('number');
    expect(typeof k.potentialGrossProfit).toBe('number');
    expect(typeof k.totalBatchesCount).toBe('number');
    expect(Array.isArray(data.rows)).toBe(true);
  });

  it('allows retrieving stock movements report', async () => {
    const res = await as('admin').get('/reports/inventory?type=movements&preset=THIS_MONTH');
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data).toHaveProperty('kpis');
    expect(typeof data.kpis.totalMovementsCount).toBe('number');
    expect(typeof data.kpis.totalInQuantity).toBe('number');
    expect(typeof data.kpis.totalOutQuantity).toBe('number');
    expect(Array.isArray(data.rows)).toBe(true);
  });

  it('allows retrieving purchases report with cash vs online tender breakdown', async () => {
    const res = await as('admin').get('/reports/inventory?type=purchases&preset=THIS_MONTH');
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data).toHaveProperty('kpis');
    expect(data).toHaveProperty('tenderBreakdown');

    const tb = data.tenderBreakdown;
    expect(typeof tb.totalCash).toBe('number');
    expect(typeof tb.totalOnline).toBe('number');
    expect(typeof tb.grandTotal).toBe('number');
    expect(Array.isArray(tb.onlineAccounts)).toBe(true);
    expect(Math.round((tb.totalCash + tb.totalOnline) * 100) / 100).toBe(tb.grandTotal);
  });

  it('allows retrieving supplier ledger report', async () => {
    const res = await as('admin').get('/reports/inventory?type=supplier-ledger&preset=THIS_MONTH');
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data).toHaveProperty('kpis');
    expect(typeof data.kpis.openingPayable).toBe('number');
    expect(typeof data.kpis.closingPayable).toBe('number');
    expect(Array.isArray(data.rows)).toBe(true);
    expect(Array.isArray(data.suppliers)).toBe(true);
  });

  it('allows retrieving consumption and expiry reports', async () => {
    const consRes = await as('accountant').get('/reports/inventory?type=consumption&preset=THIS_MONTH');
    expect(consRes.status).toBe(200);
    expect(consRes.body.data).toHaveProperty('kpis');
    expect(typeof consRes.body.data.kpis.totalMaterialCost).toBe('number');

    const expRes = await as('admin').get('/reports/inventory?type=expiry');
    expect(expRes.status).toBe(200);
    expect(expRes.body.data).toHaveProperty('kpis');
    expect(typeof expRes.body.data.kpis.totalTrackedBatches).toBe('number');
  });
});
