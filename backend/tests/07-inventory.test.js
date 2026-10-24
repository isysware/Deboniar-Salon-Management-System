// Step 10 — Inventory & Suppliers
import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../src/config/prisma.js';
import { as } from './helpers.js';

const key = (k) => ({ 'Idempotency-Key': `inv-${k}` });

describe('Step 10 · Items, stock & batches', () => {
  beforeAll(async () => {
    await as('super').put('/system/date', { date: '2026-09-28' });
  });

  it('lists items available to the caller branch', async () => {
    const lhe = await as('admin').get('/inventory/items');
    expect(lhe.status).toBe(200);
    expect(lhe.body.data.map((i) => i.id)).toContain('item-3');
    const khi = await as('adminKhi').get('/inventory/items');
    expect(khi.body.data.map((i) => i.id)).not.toContain('item-3');
    expect(lhe.body.data.find((i) => i.id === 'item-1')).toMatchObject({ sku: 'PROD-LHE-001', code: 'PROD-LHE-001', sellingPrice: 7800, price: 7800 });
    expect((await as('staff').get('/inventory/items')).status).toBe(403);
  });

  it('stock snapshot values stock at historical cost layers', async () => {
    const res = await as('accountant').get('/inventory/stock-levels');
    const olaplex = res.body.data.find((s) => s.itemId === 'item-2' && s.branchId === 'branch-1');
    expect(olaplex).toMatchObject({ currentStock: 18, valuationCostBasis: 111600, potentialRetailValue: 160200, nearExpiryBatchesCount: 1 });
  });

  it('derives batch status (near expiry / expired)', async () => {
    const res = await as('admin').get('/inventory/batches');
    const byId = Object.fromEntries(res.body.data.map((b) => [b.id, b.status]));
    expect(byId).toMatchObject({ 'batch-1': 'VALID', 'batch-2': 'NEAR_EXPIRY', 'batch-4': 'EXPIRED' });
  });

  it('creates items; SKU unique; accountants cannot edit item master', async () => {
    const res = await as('admin').post('/inventory/items', { sku: 'prod-x-01', name: 'Argan Serum', itemType: 'RETAIL_PRODUCT', sellingPrice: 3000, defaultPurchaseCost: 1800 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ sku: 'PROD-X-01', branchAvailability: ['ALL'], trackBatch: true });
    expect((await as('admin').post('/inventory/items', { sku: 'PROD-X-01', name: 'Dup', itemType: 'BOTH' })).status).toBe(409);
    expect((await as('accountant').post('/inventory/items', { sku: 'Z-1', name: 'Z', itemType: 'BOTH' })).status).toBe(403);
    const upd = await as('admin').put(`/inventory/items/${res.body.data.id}`, { sellingPrice: 3200 });
    expect(upd.body.data).toMatchObject({ sellingPrice: 3200, trackBatch: true, category: 'General' });
  });
});

describe('Step 10 · Purchases, supplier payable & returns', () => {
  let creditPurchase;

  it('credit purchase: landed cost includes the allocated header discount; payable rises; no money moves', async () => {
    const res = await as('admin').post('/purchases', {
      supplierId: 'sup-2', paymentMethod: 'CREDIT', discount: 700, supplierInvoiceNumber: 'SCH-881',
      lines: [
        { itemId: 'item-1', quantity: 10, unitPurchaseCost: 5000, expiryDate: '2027-12-31' },
        { itemId: 'item-4', quantity: 20, unitPurchaseCost: 1000, expiryDate: '2028-01-31' },
      ],
    }, key('po-1'));
    expect(res.status).toBe(201);
    creditPurchase = res.body.data;
    expect(creditPurchase).toMatchObject({
      purchaseNumber: 'PO-LHE-01-2026-0001', subtotal: 70000, discount: 700, netAmount: 69300, paidAmount: 0,
      balanceDue: 69300, paymentStatus: 'UNPAID', supplierName: 'Schwarzkopf Professional PK',
    });
    expect(creditPurchase.lines.map((l) => l.landedUnitCost)).toEqual([4950, 990]);

    const sup = await as('admin').get('/suppliers/sup-2');
    expect(sup.body.data).toMatchObject({ currentPayable: 69300, totalPurchases: 69300 });
    const stock = await as('admin').get('/inventory/items/item-1/stock');
    expect(stock.body.data.currentStock).toBe(22);
  });

  it('requires expiry for expiry-tracked items and validates partial payments', async () => {
    const noExp = await as('admin').post('/purchases', { supplierId: 'sup-2', paymentMethod: 'CREDIT', lines: [{ itemId: 'item-1', quantity: 1, unitCost: 1 }] }, key('po-bad1'));
    expect(noExp.status).toBe(400);
    const badPartial = await as('admin').post('/purchases', {
      supplierId: 'sup-2', paymentMethod: 'PARTIAL', paidAmount: 0, paymentAccountId: 'acc-1',
      lines: [{ itemId: 'item-6', quantity: 1, unitCost: 1000 }],
    }, key('po-bad2'));
    expect(badPartial.status).toBe(400);
    expect((await as('accountant').post('/purchases', {}, key('po-bad3'))).status).toBe(403);
  });

  it('cash purchase needs an open drawer with enough cash', async () => {
    const body = { supplierId: 'sup-1', paymentMethod: 'CASH', lines: [{ itemId: 'item-7', quantity: 1, unitCost: 4000, expiryDate: '2027-12-31' }] };
    const noDrawer = await as('admin').post('/purchases', body, key('po-cash-0'));
    expect(noDrawer.status).toBe(400);
    expect(noDrawer.body.error.code).toBe('NO_OPEN_DRAWER');

    await as('admin').post('/cash-drawers/open', {});
    await as('admin').post('/cash-transfers', { targetUserId: 'usr-admin-01', amount: 20000 }, { 'Idempotency-Key': 'inv-float' });
    const ok = await as('admin').post('/purchases', body, key('po-cash-1'));
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ paymentStatus: 'PAID', paidAmount: 4000, balanceDue: 0 });
    const drawer = await as('admin').get('/cash-drawers/mine');
    expect(drawer.body.data).toMatchObject({ expectedInDrawer: 16000, cashExpensesPaid: 4000 });
    // paid upfront → supplier payable unchanged
    const sup = await as('admin').get('/suppliers/sup-1');
    expect(sup.body.data.currentPayable).toBe(45000);
  });

  it('pays a supplier from a bank account (idempotent) — payable and account both reduce', async () => {
    const before = (await as('admin').get('/payment-accounts')).body.data.find((a) => a.id === 'acc-1').currentBalance;
    const body = { amount: 10000, paymentDate: '2026-09-28', method: 'ONLINE', paymentAccountId: 'acc-1', reference: 'IBFT-77' };
    const res = await as('accountant').post('/suppliers/sup-2/payments', body, key('pay-1'));
    expect(res.status).toBe(201);
    expect(res.body.data.updatedPayable).toBe(59300);
    expect(res.body.data.payment).toMatchObject({ method: 'ONLINE', amount: 10000, paymentAccountName: 'Meezan Corporate Checking' });
    const replay = await as('accountant').post('/suppliers/sup-2/payments', body, key('pay-1'));
    expect(replay.body.data.payment.id).toBe(res.body.data.payment.id);
    const after = (await as('admin').get('/payment-accounts')).body.data.find((a) => a.id === 'acc-1').currentBalance;
    expect(before - after).toBe(10000);
  });

  it('ledger runs credit − debit with totals', async () => {
    const res = await as('admin').get('/suppliers/sup-2/ledger');
    expect(res.body.data).toMatchObject({ closingPayable: 59300, totalPurchases: 69300, totalPayments: 10000 });
    expect(res.body.data.entries.map((e) => e.runningBalance)).toEqual([69300, 59300]);
  });

  it('supplier return (reduce payable) leaves from the purchase layer at its landed cost', async () => {
    const res = await as('admin').post('/supplier-returns', {
      supplierId: 'sup-2', purchaseId: creditPurchase.id, reason: 'Leaking bottles', refundTreatment: 'REDUCE_PAYABLE',
      lines: [{ itemId: 'item-1', quantity: 2 }],
    }, key('ret-1'));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ totalAmount: 9900, returnNumber: 'PR-LHE-01-2026-0001' });
    expect(res.body.data.lines[0].batchId).toBe(creditPurchase.lines[0].batchId);
    expect((await as('admin').get('/suppliers/sup-2')).body.data.currentPayable).toBe(49400);
    expect((await as('admin').get('/inventory/items/item-1/stock')).body.data.currentStock).toBe(20);
  });
});

describe('Step 10 · Stock out, quarantine & physical count', () => {
  it('salon consumption follows FEFO across layers and splits movements', async () => {
    const res = await as('admin').post('/stock-movements/manual-out', {
      itemId: 'item-2', quantity: 9, reasonType: 'SALON_CONSUMPTION', reason: 'Bridal prep',
    }, key('out-1'));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ movementType: 'SALON_CONSUMPTION_OUT', batchId: 'batch-2', quantity: 8, totalCostImpact: 49600 });
    expect(res.body.data.splitMovements[0]).toMatchObject({ batchId: 'batch-3', quantity: 1 });
  });

  it('expired and quarantined layers are never consumed', async () => {
    const tooMuch = await as('admin').post('/stock-movements/manual-out', { itemId: 'item-3', quantity: 6, reason: 'x' }, key('out-2'));
    expect(tooMuch.status).toBe(409); // 5 valid units (2 more are expired)

    await as('admin').post('/inventory/batches/batch-5/quarantine', { reason: 'Supplier recall' });
    const blocked = await as('admin').post('/stock-movements/manual-out', { itemId: 'item-3', quantity: 1, reason: 'x' }, key('out-3'));
    expect(blocked.status).toBe(409);
    await as('admin').post('/inventory/batches/batch-5/release');
    const ok = await as('admin').post('/stock-movements/manual-out', { itemId: 'item-3', quantity: 1, reasonType: 'DAMAGE', reason: 'Broken' }, key('out-4'));
    expect(ok.body.data).toMatchObject({ movementType: 'DAMAGED_OUT', batchId: 'batch-5' });
  });

  it('physical count needs a reason for discrepancies and posts adjustments at layer cost', async () => {
    const noReason = await as('admin').post('/stock-settlements', { lines: [{ itemId: 'item-6', batchId: 'batch-8', countedQuantity: 3 }] }, key('st-0'));
    expect(noReason.status).toBe(400);
    const res = await as('admin').post('/stock-settlements', {
      notes: 'Monthly count', lines: [{ itemId: 'item-6', batchId: 'batch-8', countedQuantity: 3, reason: 'MISSING' }],
    }, key('st-1'));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ totalSystemQuantity: 4, totalCountedQuantity: 3, totalDiscrepancyQuantity: -1, totalNetCostImpact: -1800 });
    expect((await as('accountant').get('/stock-settlements')).status).toBe(403);
  });

  it('movement history is searchable and every batch reconciles to its movements', async () => {
    const list = await as('admin').get('/stock-movements?search=PO-LHE-01-2026-0001');
    // Matches the 2 receipt movements plus the return that left from a batch named after the PO.
    expect(list.body.data.filter((m) => m.sourceReferenceNumber === 'PO-LHE-01-2026-0001')).toHaveLength(2);
    expect(list.body.data.some((m) => m.movementType === 'SUPPLIER_RETURN_OUT')).toBe(true);

    const batches = await prisma.inventoryBatch.findMany();
    const sums = await prisma.stockMovement.groupBy({ by: ['batchId', 'direction'], _sum: { quantity: true } });
    for (const b of batches) {
      const inQ = Number(sums.find((s) => s.batchId === b.id && s.direction === 'IN')?._sum.quantity ?? 0);
      const outQ = Number(sums.find((s) => s.batchId === b.id && s.direction === 'OUT')?._sum.quantity ?? 0);
      expect(Number(b.remainingQuantity), b.batchNumber).toBe(inQ - outQ);
    }
  });

  it('summary totals payable from the ledger and value from cost layers', async () => {
    const res = await as('admin').get('/inventory/summary');
    expect(res.status).toBe(200);
    expect(res.body.data.totalSupplierPayable).toBe(45000 + 49400 + 18500);
    expect(res.body.data.expiredCount).toBe(1);
  });
});
