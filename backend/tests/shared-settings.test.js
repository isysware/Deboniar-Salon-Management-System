import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
const db = vi.hoisted(() => ({ branch: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() }, taxRule: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() }, paymentAccount: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() }, $transaction: vi.fn() }));
vi.mock('../src/config/env.js', () => ({ env: { isDev: false } }));
vi.mock('../src/config/prisma.js', () => ({ default: db }));
vi.mock('../src/lib/audit.js', () => ({ auditLog: vi.fn() }));
vi.mock('../src/lib/balances.js', () => ({ accountBalances: vi.fn(async () => new Map()) }));
vi.mock('../src/middleware/authenticate.js', () => ({ authenticate: (req, res, next) => { req.user = { id: 'u', role: req.headers['x-role'] || 'ADMIN', branchId: 'b1' }; next(); } }));
import * as service from '../src/modules/settings/settings.service.js';
import { createPaymentAccountSchema } from '../src/modules/settings/settings.schema.js';
import { taxRuleRoutes, paymentAccountRoutes } from '../src/modules/settings/settings.routes.js';
const actor = { id: 'u', role: 'SUPER_ADMIN' };
beforeEach(() => { vi.clearAllMocks(); db.$transaction.mockImplementation((fn) => fn(db)); db.branch.findUnique.mockImplementation(async ({ where }) => where.id === 'missing' ? null : ({ id: where.id })); db.branch.findMany.mockResolvedValue([]); for (const model of [db.taxRule, db.paymentAccount]) { model.create.mockImplementation(async ({ data }) => ({ id: 'record', ...data })); model.findUnique.mockResolvedValue({ id: 'record', branchId: 'b1', branches: [{ id: 'b1' }, { id: 'b2' }], openingBalance: 0 }); } });
describe('shared settings', () => {
  for (const branchIds of [['b1'], ['b1', 'b2'], ['b1', 'b1', 'b2']]) {
    it('creates one payment account connected to ' + branchIds.join(','), async () => {
      await service.createPaymentAccount({ branchIds, name: 'Bank', accountType: 'BANK', providerName: 'Bank', accountHolder: 'Salon' }, actor);
      expect(db.paymentAccount.create).toHaveBeenCalledTimes(1);
      expect(db.paymentAccount.create.mock.calls[0][0].data.branches.connect).toEqual([...new Set(branchIds)].map((id) => ({ id })));
    });
    it('creates one tax connected to ' + branchIds.join(','), async () => {
      const result = await service.createTaxRule({ branchIds, name: 'Tax', rate: 0.13 }, actor);
      expect(db.taxRule.create).toHaveBeenCalledTimes(1);
      expect(db.taxRule.create.mock.calls[0][0].data.branches.connect).toEqual([...new Set(branchIds)].map((id) => ({ id })));
      expect(result.branchIds).toEqual(['b1', 'b2']);
    });
  }
  it('keeps legacy single branch creation', async () => { await service.createPaymentAccount({ branchId: 'b1', name: 'Legacy' }, actor); expect(db.paymentAccount.create.mock.calls[0][0].data.branchId).toBe('b1'); });
  it('rejects unknown branches before writing', async () => { await expect(service.createTaxRule({ branchIds: ['missing'] }, actor)).rejects.toThrow(); expect(db.taxRule.create).not.toHaveBeenCalled(); });
  it('rejects empty selection', () => { expect(createPaymentAccountSchema.safeParse({ branchIds: [], name: 'X', providerName: 'X', accountHolder: 'X' }).success).toBe(false); });
  it('filters by shared membership and returns associations', async () => { db.paymentAccount.findMany.mockResolvedValue([{ id: 'record', branchId: 'b1', branches: [{ id: 'b1' }, { id: 'b2' }] }]); const rows = await service.listPaymentAccounts(actor, 'b2'); expect(db.paymentAccount.findMany.mock.calls[0][0].where.OR).toContainEqual({ branches: { some: { id: 'b2' } } }); expect(rows[0].branchIds).toEqual(['b1', 'b2']); });
  it('denies Admin management reads and writes', async () => { const app = express(); app.use(express.json()); app.use('/tax-rules', taxRuleRoutes); app.use('/payment-accounts', paymentAccountRoutes); app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message })); for (const path of ['/tax-rules', '/payment-accounts']) { expect((await request(app).get(path)).status).toBe(403); expect((await request(app).post(path).send({})).status).toBe(403); expect((await request(app).put(path + '/record').send({})).status).toBe(403); } });
});
