// tests/14-audit-ledger.test.js
// Step 22 — Audit Log & General Ledger
import { describe, it, expect } from 'vitest';
import { as } from './helpers.js';

describe('Step 22 · Audit Events & General Ledger', () => {
  let sampleAuditEventId;

  describe('Audit Events (/audit-events)', () => {
    it('blocks STAFF and ACCOUNTANT from accessing audit logs with 403', async () => {
      expect((await as('staff').get('/audit-events')).status).toBe(403);
      expect((await as('accountant').get('/audit-events')).status).toBe(403);
    });

    it('allows ADMIN to view audit events scoped to their own branch', async () => {
      const res = await as('admin').get('/audit-events');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('events');
      expect(Array.isArray(res.body.data.events)).toBe(true);
      expect(res.body.data.events.length).toBeGreaterThan(0);

      // Verify all events belong to admin's branch (branch-1)
      for (const ev of res.body.data.events) {
        if (ev.branchId) {
          expect(ev.branchId).toBe('branch-1');
        }
      }

      sampleAuditEventId = res.body.data.events[0].id;
    });

    it('allows SUPER_ADMIN to view all audit events or filter by branch', async () => {
      const allRes = await as('super').get('/audit-events');
      expect(allRes.status).toBe(200);
      expect(allRes.body.data.events.length).toBeGreaterThan(0);

      const branchRes = await as('super').get('/audit-events?branchId=branch-1');
      expect(branchRes.status).toBe(200);
      for (const ev of branchRes.body.data.events) {
        if (ev.branchId) {
          expect(ev.branchId).toBe('branch-1');
        }
      }
    });

    it('filters audit events by entity, action, and search', async () => {
      const filtered = await as('super').get('/audit-events?limit=10&page=1');
      expect(filtered.status).toBe(200);
      expect(filtered.body.data).toHaveProperty('total');
      expect(filtered.body.data).toHaveProperty('totalPages');
      expect(filtered.body.data.limit).toBe(10);
    });

    it('retrieves single audit event by id', async () => {
      if (sampleAuditEventId) {
        const res = await as('admin').get(`/audit-events/${sampleAuditEventId}`);
        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(sampleAuditEventId);
      }
    });
  });

  describe('General Ledger (/ledger)', () => {
    it('blocks STAFF from accessing the general ledger with 403', async () => {
      expect((await as('staff').get('/ledger')).status).toBe(403);
    });

    it('allows ACCOUNTANT, ADMIN, and SUPER_ADMIN to access the general ledger', async () => {
      expect((await as('accountant').get('/ledger')).status).toBe(200);
      expect((await as('admin').get('/ledger')).status).toBe(200);
      expect((await as('super').get('/ledger')).status).toBe(200);
    });

    it('returns unified movements with summary and running balance', async () => {
      const res = await as('admin').get('/ledger');
      expect(res.status).toBe(200);
      const data = res.body.data;

      expect(data).toHaveProperty('movements');
      expect(data).toHaveProperty('summary');
      expect(data).toHaveProperty('pagination');

      const { summary } = data;
      expect(typeof summary.openingBalance).toBe('number');
      expect(typeof summary.totalIn).toBe('number');
      expect(typeof summary.totalOut).toBe('number');
      expect(typeof summary.netMovement).toBe('number');
      expect(typeof summary.closingBalance).toBe('number');

      // Equation: closingBalance = round(openingBalance + netMovement)
      expect(Math.round(summary.closingBalance * 100)).toBe(
        Math.round((summary.openingBalance + summary.netMovement) * 100)
      );

      // Verify each movement has standard unified ledger fields
      if (data.movements.length > 0) {
        const first = data.movements[0];
        expect(first).toHaveProperty('channel');
        expect(['CASH', 'BANK']).toContain(first.channel);
        expect(first).toHaveProperty('direction');
        expect(['IN', 'OUT']).toContain(first.direction);
        expect(first).toHaveProperty('signedAmount');
        expect(first).toHaveProperty('balanceAfter');
      }
    });

    it('supports channel filtering (CASH vs BANK)', async () => {
      const cashRes = await as('admin').get('/ledger?channel=CASH');
      expect(cashRes.status).toBe(200);
      for (const m of cashRes.body.data.movements) {
        expect(m.channel).toBe('CASH');
      }

      const bankRes = await as('admin').get('/ledger?channel=BANK');
      expect(bankRes.status).toBe(200);
      for (const m of bankRes.body.data.movements) {
        expect(m.channel).toBe('BANK');
      }
    });
  });
});
