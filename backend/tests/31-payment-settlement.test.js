import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../src/config/prisma.js';
import { as } from './helpers.js';
import { holderBalance } from '../src/modules/cash/cash.service.js';
import { accountBalance } from '../src/lib/balances.js';
import { postAccountMovement } from '../src/modules/cash/cash.service.js';

const key = (id) => ({ 'Idempotency-Key': `settlement-${id}` });
const date = '2026-09-28';
let supplier, purchase, drawer, invoice;
describe('Supplier and client settlement end-to-end', () => {
  beforeAll(async () => {
    await as('super').put('/system/date', { date });
    await prisma.cashDrawer.updateMany({
      where: { custodianUserId: 'usr-admin-01', status: 'OPEN' },
      data: { status: 'SETTLED', closedAt: new Date(), settledAt: new Date() },
    });
    supplier = (await as('admin').post('/suppliers', { name: 'Settlement supplier', phone: '03001234567' })).body.data;
    const result = await as('admin').post('/purchases', { supplierId: supplier.id, paymentMethod: 'CREDIT', lines: [{ itemId: 'item-6', quantity: 1, unitCost: 1000 }] }, key('purchase'));
    expect(result.status).toBe(201);
    purchase = result.body.data;
  });

  it('starts unpaid and rejects cash without the actor drawer', async () => {
    expect(purchase).toMatchObject({ paidAmount: 0, balanceDue: 1000, paymentStatus: 'UNPAID' });
    const result = await as('admin').post(`/suppliers/${supplier.id}/payments`, { amount: 500, method: 'CASH', paymentDate: date }, key('no-drawer'));
    expect(result.body.error.code).toBe('NO_OPEN_DRAWER');
    drawer = (await as('admin').post('/cash-drawers/open', {})).body.data;
  });

  it('rejects insufficient cash without inventing funds or changing payable', async () => {
    const result = await as('admin').post(`/suppliers/${supplier.id}/payments`, { amount: 500, method: 'CASH', paymentDate: date }, key('insufficient'));
    expect(result.body.error.code).toBe('INSUFFICIENT_DRAWER_CASH');
    expect((await holderBalance(prisma, drawer.id)).toNumber()).toBe(0);
    expect((await as('admin').get(`/purchases/${purchase.id}`)).body.data.balanceDue).toBe(1000);
    expect(await prisma.supplierPayment.count({ where: { supplierId: supplier.id } })).toBe(0);
    await as('admin').post('/cash-transfers', { targetUserId: 'usr-admin-01', amount: 2000 }, key('float'));
  });

  it('requires date and source and rolls back insufficient, inactive and wrong-branch online accounts', async () => {
    const empty = await prisma.paymentAccount.create({ data: { branchId: 'branch-1', name: 'Empty account', accountType: 'BANK', providerName: 'Test bank', accountHolder: 'Salon' } });
    const otherBranch = await prisma.paymentAccount.create({ data: { branchId: 'branch-2', name: 'Other branch', accountType: 'BANK', providerName: 'Test bank', accountHolder: 'Salon', openingBalance: 10000 } });
    const body = { amount: 500, method: 'ONLINE', paymentDate: date, paymentAccountId: empty.id };
    const path = `/suppliers/${supplier.id}/payments`;
    expect((await as('admin').post(path, { ...body, paymentDate: undefined }, key('missing-date'))).status).toBe(400);
    expect((await as('admin').post(path, { amount: 500, paymentDate: date }, key('missing-method'))).status).toBe(400);
    expect((await as('admin').post(path, body, key('empty-account'))).body.error.code).toBe('INSUFFICIENT_ACCOUNT_BALANCE');
    expect((await as('admin').post(path, { ...body, paymentAccountId: otherBranch.id }, key('other-account'))).body.error.code).toBe('ACCOUNT_INVALID');
    await prisma.paymentAccount.update({ where: { id: empty.id }, data: { isActive: false } });
    expect((await as('admin').post(path, body, key('inactive-account'))).body.error.code).toBe('ACCOUNT_INVALID');
    expect(await prisma.accountMovement.count({ where: { accountId: { in: [empty.id, otherBranch.id] } } })).toBe(0);
    expect((await as('admin').get(`/purchases/${purchase.id}`)).body.data.balanceDue).toBe(1000);
  });

  it('posts one partial cash payment under concurrent duplicate submissions and reverses once', async () => {
    const body = { amount: 500, method: 'CASH', paymentDate: date, notes: 'Partial payment' };
    const responses = await Promise.all([as('admin').post(`/suppliers/${supplier.id}/payments`, body, key('partial')), as('admin').post(`/suppliers/${supplier.id}/payments`, body, key('partial'))]);
    expect(responses.map((r) => r.status)).toEqual([201, 201]);
    expect(responses[0].body.data.payment.id).toBe(responses[1].body.data.payment.id);
    expect((await as('admin').post(`/suppliers/${supplier.id}/payments`, { ...body, amount: 400 }, key('partial'))).body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    expect((await holderBalance(prisma, drawer.id)).toNumber()).toBe(1500);
    expect((await as('admin').get(`/purchases/${purchase.id}`)).body.data).toMatchObject({ paidAmount: 500, balanceDue: 500, paymentStatus: 'PARTIAL' });
    const payment = responses[0].body.data.payment;
    expect(payment.allocations).toEqual([{ purchaseId: purchase.id, invoiceNumber: purchase.purchaseNumber, amount: 500 }]);
    const path = `/suppliers/${supplier.id}/payments/${payment.id}/reverse`;
    expect((await as('admin').post(path, { reason: 'Payment entered in error', reversalDate: date }, key('reverse-supplier'))).status).toBe(201);
    expect((await as('admin').post(path, { reason: 'Payment entered in error', reversalDate: date }, key('reverse-supplier'))).status).toBe(201);
    expect((await as('admin').post(path, { reason: 'Second reversal', reversalDate: date }, key('reverse-again'))).status).toBe(409);
    expect((await holderBalance(prisma, drawer.id)).toNumber()).toBe(2000);
    expect((await as('admin').get(`/purchases/${purchase.id}`)).body.data).toMatchObject({ paidAmount: 0, balanceDue: 1000, paymentStatus: 'UNPAID' });
  });

  it('validates online funds and branch, prevents overpayment, settles fully and restores account', async () => {
    const body = { amount: 1000, method: 'ONLINE', paymentAccountId: 'acc-1', paymentDate: date };
    expect((await as('admin').post(`/suppliers/${supplier.id}/payments`, { ...body, amount: 1001 }, key('overpay'))).body.error.code).toBe('OVERPAYMENT');
    const before = await accountBalance('acc-1', { tx: prisma });
    const result = await as('admin').post(`/suppliers/${supplier.id}/payments`, body, key('online'));
    expect(result.status).toBe(201);
    expect((await accountBalance('acc-1', { tx: prisma })).toNumber()).toBe(before.minus(1000).toNumber());
    expect((await as('admin').get(`/purchases/${purchase.id}`)).body.data).toMatchObject({ paidAmount: 1000, balanceDue: 0, paymentStatus: 'PAID' });
    expect((await as('admin').post(`/suppliers/${supplier.id}/payments/${result.body.data.payment.id}/reverse`, { reason: 'Reverse online payment', reversalDate: date }, key('reverse-online'))).status).toBe(201);
    expect((await accountBalance('acc-1', { tx: prisma })).toNumber()).toBe(before.toNumber());
  });

  it('creates an unpaid client invoice', async () => {
    const result = await as('admin').post('/pos/invoices/checkout', { branchId: 'branch-1', clientId: 'client-1', clientName: 'Ayesha Khan', clientPhone: '03001234567', cartItems: [{ type: 'SERVICE', item: { id: 'srv-lhe-01', price: 3500 }, quantity: 1, staffId: 'staff-1' }], payments: [] }, key('invoice'));
    expect(result.status, JSON.stringify(result.body)).toBe(201);
    invoice = result.body.data;
    expect(invoice.status).toBe('UNPAID');
  });

  it('collects partial cash once, full online, then reverses both with exact balances', async () => {
    const before = await holderBalance(prisma, drawer.id);
    const partial = { payments: [{ method: 'CASH', amount: 500, billAllocation: 500, tipAllocation: 0 }] };
    const results = await Promise.all([as('admin').post(`/invoices/${invoice.id}/payments`, partial, key('collect-partial')), as('admin').post(`/invoices/${invoice.id}/payments`, partial, key('collect-partial'))]);
    expect(results.map((r) => r.status)).toEqual([201, 201]);
    let updated = results[0].body.data;
    expect(updated).toMatchObject({ status: 'PARTIAL', amountPaid: 500, amountDue: invoice.amountDue - 500 });
    expect((await holderBalance(prisma, drawer.id)).toNumber()).toBe(before.plus(500).toNumber());
    expect((await as('admin').post(`/invoices/${invoice.id}/payments`, { payments: [{ method: 'CASH', amount: invoice.amountDue, billAllocation: invoice.amountDue }] }, key('overcollect'))).body.error.code).toBe('OVER_COLLECTION');
    const accountBefore = await accountBalance('acc-1', { tx: prisma });
    const full = await as('admin').post(`/invoices/${invoice.id}/payments`, { payments: [{ method: 'ONLINE_ACCOUNT', paymentAccountId: 'acc-1', amount: updated.amountDue, billAllocation: updated.amountDue }] }, key('collect-full'));
    expect(full.status).toBe(201);
    expect(full.body.data).toMatchObject({ status: 'PAID', amountDue: 0, amountPaid: invoice.amountDue });
    updated = full.body.data;
    for (const payment of updated.payments) {
      const path = `/invoices/${invoice.id}/payments/${payment.id}/reverse`;
      const body = { reason: 'Collection entered in error', reversalDate: date };
      expect((await as('admin').post(path, body, key(`reverse-${payment.id}`))).status).toBe(201);
      expect((await as('admin').post(path, body, key(`reverse-${payment.id}`))).status).toBe(201);
      expect((await as('admin').post(path, body, key(`reverse-second-${payment.id}`))).status).toBe(409);
    }
    expect((await holderBalance(prisma, drawer.id)).toNumber()).toBe(before.toNumber());
    expect((await accountBalance('acc-1', { tx: prisma })).toNumber()).toBe(accountBefore.toNumber());
    expect((await as('admin').get(`/invoices/${invoice.id}`)).body.data).toMatchObject({ status: 'UNPAID', amountPaid: 0, amountDue: invoice.amountDue });
  });

  it('reconciles dated payments and later reversals without recognizing income twice', async () => {
    const collectionDate = '2026-09-25';
    const reversalDate = '2026-09-26';
    const result = await as('admin').post(`/invoices/${invoice.id}/payments`, { paymentDate: collectionDate, payments: [{ method: 'CASH', amount: 500, billAllocation: 500 }] }, key('dated-collection'));
    expect(result.status).toBe(201);
    const payment = result.body.data.payments.find((p) => p.kind === 'DUES_COLLECTION' && !p.reversedAt);
    expect((await prisma.drawerMovement.findFirst({ where: { sourceId: payment.id } })).amount.toNumber()).toBe(500);
    const query = `startDate=${collectionDate}&endDate=${collectionDate}`;
    const reports = await Promise.all([
      as('admin').get(`/reports/income-expense?${query}`),
      as('admin').get(`/reports/cash-drawer?${query}`),
      as('admin').get('/clients/client-1'),
    ]);
    expect(reports.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(reports[2].body.data.outstandingBalance).toBe(invoice.amountDue - 500);
    expect(reports[0].body.data.totals).toMatchObject({ income: 0, expense: 0, paid: 500, net: 0 });
    expect(reports[0].body.data.rows.find((r) => r.id)).toMatchObject({ type: 'SETTLEMENT', cashFlow: 500, date: collectionDate });
    expect(reports[1].body.data.tenderBreakdown.totalCash).toBe(500);
    expect(reports[1].body.data.transactions.find((r) => r.sourceId === payment.id)).toMatchObject({ direction: 'IN', amount: 500, date: collectionDate });
    expect((await as('admin').post(`/invoices/${invoice.id}/payments/${payment.id}/reverse`, { reversalDate, reason: 'Dated collection correction' }, key('dated-reversal'))).status).toBe(201);
    const after = await as('admin').get(`/reports/cash-drawer?${query}`);
    expect(after.body.data.tenderBreakdown.totalCash).toBe(500);
    const reversed = await as('admin').get(`/reports/income-expense?startDate=${reversalDate}&endDate=${reversalDate}`);
    expect(reversed.body.data.totals).toMatchObject({ income: 0, expense: 0, paid: -500, net: 0 });
    const reversedCash = await as('admin').get(`/reports/cash-drawer?startDate=${reversalDate}&endDate=${reversalDate}`);
    expect(reversedCash.body.data.tenderBreakdown.totalCash).toBe(-500);
    const original = await prisma.invoicePayment.findUnique({ where: { id: payment.id } });
    expect(original.amount.toNumber()).toBe(500);
    expect(original.reversalReason).toBe('Dated collection correction');
    expect(await prisma.auditEvent.count({ where: { action: 'COLLECTION_REVERSED', entityId: payment.id, userId: 'usr-admin-01' } })).toBe(1);
  });

  it('supports multiple supplier installments, partial online then full cash, and retains both reversals', async () => {
    const before = await holderBalance(prisma, drawer.id);
    const accountBefore = await accountBalance('acc-1', { tx: prisma });
    const path = `/suppliers/${supplier.id}/payments`;
    const partial = await as('admin').post(path, { amount: 500, method: 'ONLINE', paymentAccountId: 'acc-1', paymentDate: date }, key('multi-online'));
    expect(partial.status).toBe(201);
    expect((await as('admin').get(`/purchases/${purchase.id}`)).body.data).toMatchObject({ paidAmount: 500, balanceDue: 500, paymentStatus: 'PARTIAL' });
    const full = await as('admin').post(path, { amount: 500, method: 'CASH', paymentDate: date, paidById: 'usr-accountant-01', payerDrawerId: 'spoofed-drawer' }, key('multi-cash'));
    expect(full.status).toBe(201);
    expect(full.body.data.payment).toMatchObject({ cashDrawerId: drawer.id, paidById: 'usr-admin-01' });
    expect((await as('admin').get(`/purchases/${purchase.id}`)).body.data).toMatchObject({ paidAmount: 1000, balanceDue: 0, paymentStatus: 'PAID' });
    expect((await as('admin').get(`/suppliers/${supplier.id}/ledger`)).body.data).toMatchObject({ closingPayable: 0, totalPayments: 1000 });
    for (const payment of [partial.body.data.payment, full.body.data.payment]) {
      const reversed = await as('admin').post(`${path}/${payment.id}/reverse`, { reason: 'Reverse installment', reversalDate: date }, key(`multi-reverse-${payment.id}`));
      expect(reversed.status).toBe(201);
    }
    expect((await holderBalance(prisma, drawer.id)).toNumber()).toBe(before.toNumber());
    expect((await accountBalance('acc-1', { tx: prisma })).toNumber()).toBe(accountBefore.toNumber());
    expect((await as('admin').get(`/suppliers/${supplier.id}/ledger`)).body.data).toMatchObject({ closingPayable: 1000, totalPayments: 0 });
  });

  it('records upfront purchase payment with allocation and reverses the settlement without reversing stock', async () => {
    const created = await as('admin').post('/purchases', { supplierId: supplier.id, paymentMethod: 'CASH', lines: [{ itemId: 'item-6', quantity: 1, unitCost: 300 }] }, key('upfront-purchase'));
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ paidAmount: 300, balanceDue: 0, paymentStatus: 'PAID' });
    const payment = await prisma.supplierPayment.findUnique({ where: { paymentNumber: created.body.data.purchaseNumber } });
    expect(payment.allocations).toEqual([{ purchaseId: created.body.data.id, invoiceNumber: created.body.data.purchaseNumber, amount: 300 }]);
    expect((await as('admin').post(`/suppliers/${supplier.id}/payments/${payment.id}/reverse`, { reason: 'Correct upfront payment', reversalDate: date }, key('reverse-upfront'))).status).toBe(201);
    expect((await as('admin').get(`/purchases/${created.body.data.id}`)).body.data).toMatchObject({ paidAmount: 0, balanceDue: 300, paymentStatus: 'UNPAID' });
    expect(await prisma.stockMovement.count({ where: { sourceReferenceId: created.body.data.id } })).toBe(1);
  });

  it('rolls back collection reversal when funds were spent, then reverses once when funds are available', async () => {
    const account = await prisma.paymentAccount.create({ data: { branchId: 'branch-1', name: 'Reversal funds', accountType: 'BANK', providerName: 'Test bank', accountHolder: 'Salon' } });
    const collected = await as('admin').post(`/invoices/${invoice.id}/payments`, { payments: [{ method: 'ONLINE_ACCOUNT', paymentAccountId: account.id, amount: 500, billAllocation: 500 }] }, key('reversal-funds-collection'));
    expect(collected.status).toBe(201);
    const payment = collected.body.data.payments.find((p) => p.paymentAccountId === account.id);
    const actor = { id: 'usr-admin-01', name: 'Test administrator' };
    const common = { accountId: account.id, branchId: 'branch-1', amount: 500, sourceModule: 'TEST', actor };
    await prisma.$transaction((tx) => postAccountMovement(tx, { ...common, type: 'EXPENSE', direction: 'OUT' }));
    const path = `/invoices/${invoice.id}/payments/${payment.id}/reverse`;
    const body = { reason: 'Reverse after money was spent', reversalDate: date };
    expect((await as('admin').post(path, body, key('insufficient-reversal'))).body.error.code).toBe('INSUFFICIENT_ACCOUNT_BALANCE');
    expect((await prisma.invoicePayment.findUnique({ where: { id: payment.id } })).reversedAt).toBeNull();
    expect((await as('admin').get(`/invoices/${invoice.id}`)).body.data.amountPaid).toBe(500);
    await prisma.$transaction((tx) => postAccountMovement(tx, { ...common, type: 'ADJUSTMENT', direction: 'IN' }));
    expect((await as('admin').post(path, body, key('insufficient-reversal'))).status).toBe(201);
    expect((await accountBalance(account.id, { tx: prisma })).toNumber()).toBe(0);
  });

  it('reconciles supplier settlement and reversal on their dates in Payment Accounts and Income & Expense', async () => {
    const before = await accountBalance('acc-1', { tx: prisma });
    const paid = await as('admin').post(`/suppliers/${supplier.id}/payments`, { amount: 200, method: 'ONLINE', paymentAccountId: 'acc-1', paymentDate: '2026-09-29' }, key('dated-supplier'));
    expect(paid.status).toBe(201);
    const payment = paid.body.data.payment;
    const accounts = await as('admin').get('/reports/payment-accounts?accountId=acc-1&startDate=2026-09-29&endDate=2026-09-29');
    expect(accounts.status).toBe(200);
    expect(accounts.body.data.totals).toMatchObject({ moneyOut: 200, moneyIn: 0 });
    const report = await as('admin').get('/reports/income-expense?startDate=2026-09-29&endDate=2026-09-29');
    expect(report.body.data.rows.find((row) => row.reference === payment.paymentNumber)).toMatchObject({ income: 0, expense: 0, cashFlow: -200, date: '2026-09-29' });
    expect((await as('admin').post(`/suppliers/${supplier.id}/payments/${payment.id}/reverse`, { reason: 'Dated supplier correction', reversalDate: '2026-09-30' }, key('dated-supplier-reversal'))).status).toBe(201);
    const reversal = await as('admin').get('/reports/payment-accounts?accountId=acc-1&startDate=2026-09-30&endDate=2026-09-30');
    expect(reversal.body.data.totals).toMatchObject({ moneyOut: 0, moneyIn: 200 });
    expect((await accountBalance('acc-1', { tx: prisma })).toNumber()).toBe(before.toNumber());
  });
});
