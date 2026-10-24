import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextReference } from '../referenceSequence.ts';

test('demo references start at 0001 and persist independent counters', () => {
  const store = {};
  assert.equal(nextReference(store, 'INV'), 'INV-0001');
  assert.equal(nextReference(store, 'RCP'), 'RCP-0001');
  assert.equal(nextReference(store, 'SRV'), 'Svr-0001');
  const restored = JSON.parse(JSON.stringify(store));
  assert.equal(nextReference(restored, 'INV'), 'INV-0002');
  assert.equal(nextReference(restored, 'SVR'), 'Svr-0002');
});

test('nested payments and retained counters prevent collisions and deleted-number reuse', () => {
  const store = { invoices: [{ payments: [{ receiptNumber: 'RCP-0042' }] }], referenceSequenceCounters: { RCP: 90 } };
  assert.equal(nextReference(store, 'RCP'), 'RCP-0091');
  assert.equal(nextReference({ invoices: [{ invoiceNumber: 'INV-9999' }] }, 'INV'), 'INV-10000');
});

test('legacy branch/year references do not change compact numbering', () => {
  const store = { invoices: [{ invoiceNumber: 'INV-LHE-2026-0010' }] };
  assert.equal(nextReference(store, 'INV'), 'INV-0001');
});
