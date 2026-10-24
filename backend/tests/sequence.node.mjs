import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextSequence, nextPeriodSequence } from '../src/lib/sequence.js';

function transaction(records = {}, initial = {}) {
  const counters = new Map(Object.entries(initial));
  const tx = { $queryRaw: async (_sql, key, start) => {
    const value = Math.max((counters.get(key) || 0) + 1, start);
    counters.set(key, value);
    return [{ lastValue: value }];
  } };
  for (const name of ['invoice', 'invoicePayment', 'service', 'staff', 'payrollRun', 'payslip']) {
    tx[name] = { findMany: async () => records[name] || [] };
  }
  return tx;
}

test('short references are independent of branch/year and start at 0001', async () => {
  const tx = transaction();
  assert.equal(await nextSequence(tx, 'KHI-01', 'INV', 2026), 'INV-0001');
  assert.equal(await nextSequence(tx, 'LHE-01', 'INV', 2027), 'INV-0002');
  assert.equal(await nextSequence(tx, '', 'RCP'), 'RCP-0001');
  assert.equal(await nextSequence(tx, '', 'SRV'), 'Svr-0001');
});

test('continues stored numbers without reusing deleted numbers or truncating large numbers', async () => {
  const tx = transaction({ invoice: [{ invoiceNumber: 'INV-0042' }, { invoiceNumber: 'INV-KHI-2026-9999' }] }, { INV: 80 });
  assert.equal(await nextSequence(tx, '', 'INV'), 'INV-0081');
  assert.equal(await nextSequence(transaction({ invoice: [{ invoiceNumber: 'INV-9999' }] }), '', 'INV'), 'INV-10000');
});

test('period references also use one lifetime sequence per type', async () => {
  const tx = transaction();
  assert.equal(await nextPeriodSequence(tx, 'BR-01', 'PAY', '2026-09'), 'PAY-0001');
  assert.equal(await nextPeriodSequence(tx, 'BR-02', 'PAY', '2026-10'), 'PAY-0002');
});

test('concurrent allocations request distinct sequence values', async () => {
  const tx = transaction();
  const values = await Promise.all(Array.from({ length: 30 }, () => nextSequence(tx, '', 'RCP')));
  assert.equal(new Set(values).size, 30);
});
