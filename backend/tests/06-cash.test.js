// Step 9 — Cash drawers, vault & account ledger
import { describe, it, expect } from 'vitest';
import prisma from '../src/config/prisma.js';
import { postCashMovement, postAccountMovement, getActiveDrawer } from '../src/modules/cash/cash.service.js';
import { as } from './helpers.js';

const accountant = { id: 'usr-acc-01', name: 'Usman Farooq', role: 'ACCOUNTANT', branchId: 'branch-1' };

describe('Step 9 · Cash drawers & vault', () => {
  it('vault starts with the seeded opening cash', async () => {
    const res = await as('admin').get('/cash-drawers/vault');
    expect(res.status).toBe(200);
    expect(res.body.data.balance).toBe(150000);
    expect((await as('accountant').get('/cash-drawers/vault')).status).toBe(403);
  });

  it('accountant opens a drawer (one per user) — reopening returns the same drawer', async () => {
    const a = await as('accountant').post('/cash-drawers/open', {});
    expect(a.status).toBe(201);
    expect(a.body.data).toMatchObject({ status: 'OPEN', custodianUserId: 'usr-acc-01', expectedInDrawer: 0, branchId: 'branch-1' });
    const b = await as('accountant').post('/cash-drawers/open', {});
    expect(b.body.data.id).toBe(a.body.data.id);
    const mine = await as('accountant').get('/cash-drawers/mine');
    expect(mine.body.data.id).toBe(a.body.data.id);
  });

  it('float transfer moves custody vault → drawer (requires idempotency key)', async () => {
    const noKey = await as('admin').post('/cash-transfers', { targetUserId: 'usr-acc-01', amount: 10000 });
    expect(noKey.status).toBe(400);

    const res = await as('admin').post('/cash-transfers', { targetUserId: 'usr-acc-01', amount: 10000, notes: 'Morning float' }, { 'Idempotency-Key': 'xf-1' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ transferNumber: 'CXF-LHE-01-2026-0001', amount: 10000, fromSource: 'BRANCH_VAULT', toCustodianName: 'Usman Farooq' });

    const replay = await as('admin').post('/cash-transfers', { targetUserId: 'usr-acc-01', amount: 10000 }, { 'Idempotency-Key': 'xf-1' });
    expect(replay.body.data.id).toBe(res.body.data.id);
    expect(replay.headers['idempotent-replay']).toBe('true');

    expect((await as('admin').get('/cash-drawers/vault')).body.data.balance).toBe(140000);
    const mine = await as('accountant').get('/cash-drawers/mine');
    expect(mine.body.data).toMatchObject({ openingCash: 10000, expectedInDrawer: 10000 });
  });

  it('cannot transfer more than the vault holds or to a user without an open drawer', async () => {
    const tooMuch = await as('admin').post('/cash-transfers', { targetUserId: 'usr-acc-01', amount: 999999 }, { 'Idempotency-Key': 'xf-2' });
    expect(tooMuch.status).toBe(409);
    expect(tooMuch.body.error.code).toBe('INSUFFICIENT_DRAWER_CASH');
    const noDrawer = await as('admin').post('/cash-transfers', { targetUserId: 'usr-admin-01', amount: 100 }, { 'Idempotency-Key': 'xf-3' });
    expect(noDrawer.status).toBe(400);
  });

  it('cash OUT can never exceed what the drawer holds', async () => {
    const drawer = await prisma.$transaction((tx) => getActiveDrawer(tx, accountant, 'branch-1'));
    await expect(prisma.$transaction((tx) => postCashMovement(tx, {
      holderId: drawer.id, type: 'EXPENSE', direction: 'OUT', amount: 10000.01, sourceModule: 'TEST', actor: accountant,
    }))).rejects.toMatchObject({ code: 'INSUFFICIENT_DRAWER_CASH' });

    await prisma.$transaction((tx) => postCashMovement(tx, {
      holderId: drawer.id, type: 'EXPENSE', direction: 'OUT', amount: 2500, sourceModule: 'TEST', reference: 'T-1', actor: accountant,
    }));
    const mine = await as('accountant').get('/cash-drawers/mine');
    expect(mine.body.data).toMatchObject({ expectedInDrawer: 7500, cashExpensesPaid: 2500 });

    const moves = await as('accountant').get(`/cash-drawers/${drawer.id}/movements`);
    expect(moves.body.data.map((m) => m.runningBalance)).toEqual([10000, 7500]);
  });

  it('accountants only see their own drawers', async () => {
    const res = await as('accountant').get('/cash-drawers');
    expect(res.body.data.every((d) => d.custodianUserId === 'usr-acc-01')).toBe(true);
    const all = await as('super').get('/cash-drawers');
    expect(all.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('branch deactivation is blocked while a drawer holds cash', async () => {
    const res = await as('super').get('/branches/branch-1/deactivation-blockers');
    expect(res.body.data.blockers.some((b) => b.includes('active cash drawers'))).toBe(true);
  });
});

describe('Step 9 · Payment account ledger', () => {
  it('posts IN/OUT, blocks overdraft and wrong-branch accounts, statement reconciles', async () => {
    await prisma.$transaction((tx) => postAccountMovement(tx, {
      accountId: 'acc-3', branchId: 'branch-1', type: 'CASH_SALE', direction: 'IN', amount: 1500, sourceModule: 'TEST', actor: accountant,
    }));
    await expect(prisma.$transaction((tx) => postAccountMovement(tx, {
      accountId: 'acc-3', branchId: 'branch-1', type: 'EXPENSE', direction: 'OUT', amount: 999999, sourceModule: 'TEST', actor: accountant,
    }))).rejects.toMatchObject({ code: 'INSUFFICIENT_ACCOUNT_BALANCE' });
    await expect(prisma.$transaction((tx) => postAccountMovement(tx, {
      accountId: 'acc-4', branchId: 'branch-1', type: 'CASH_SALE', direction: 'IN', amount: 1, sourceModule: 'TEST', actor: accountant,
    }))).rejects.toMatchObject({ code: 'ACCOUNT_INVALID' });

    const st = await as('accountant').get('/account-statements/acc-3');
    expect(st.body.data).toMatchObject({ openingBalance: 148500, moneyIn: 1500, moneyOut: 0, closingBalance: 150000 });
    const list = await as('accountant').get('/payment-accounts');
    expect(list.body.data.find((a) => a.id === 'acc-3').currentBalance).toBe(150000);
    expect((await as('accountant').get('/account-statements/acc-4')).status).toBe(403);
  });
});
