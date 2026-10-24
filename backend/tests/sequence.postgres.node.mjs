import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { nextSequence } from '../src/lib/sequence.js';

test('Postgres: concurrent allocation, existing references and rollback', async () => {
  const env = dotenv.parse(readFileSync('.env.test'));
  const url = new URL(env.DATABASE_URL);
  assert.ok(url.pathname.endsWith('_test'), 'Only a dedicated test database is allowed');
  const schema = `numbering_${process.pid}`;
  url.searchParams.set('schema', schema);
  const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  try {
    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await prisma.$executeRawUnsafe(`CREATE TABLE "${schema}"."Sequence" (id TEXT PRIMARY KEY, "branchCode" TEXT NOT NULL, prefix TEXT NOT NULL, year INTEGER NOT NULL, "lastValue" INTEGER NOT NULL, UNIQUE("branchCode", prefix, year))`);
    await prisma.$executeRawUnsafe(`CREATE TABLE "${schema}"."Invoice" (id TEXT PRIMARY KEY, "invoiceNumber" TEXT NOT NULL UNIQUE)`);
    await prisma.$executeRawUnsafe(`CREATE TABLE "${schema}"."InvoicePayment" (id TEXT PRIMARY KEY, "receiptNumber" TEXT UNIQUE)`);
    await prisma.$executeRawUnsafe(`CREATE TABLE "${schema}"."Service" (id TEXT PRIMARY KEY, code TEXT NOT NULL)`);
    await prisma.$executeRawUnsafe(`INSERT INTO "${schema}"."Invoice" VALUES ('legacy', 'INV-LHE-2026-9999'), ('compact', 'INV-0012')`);
    assert.equal(await prisma.$transaction(tx => nextSequence(tx, 'A', 'INV', 2026)), 'INV-0013');
    assert.equal(await prisma.$transaction(tx => nextSequence(tx, 'B', 'INV', 2027)), 'INV-0014');
    const receipts = await Promise.all(Array.from({ length: 20 }, () => prisma.$transaction(tx => nextSequence(tx, 'A', 'RCP'), { maxWait: 15000, timeout: 15000 })));
    assert.equal(new Set(receipts).size, 20);
    assert.ok(receipts.includes('RCP-0001'));
    assert.ok(receipts.includes('RCP-0020'));
    await assert.rejects(prisma.$transaction(async tx => {
      assert.equal(await nextSequence(tx, '', 'RCP'), 'RCP-0021');
      throw new Error('Rollback receipt');
    }), /Rollback receipt/);
    assert.equal(await prisma.$transaction(tx => nextSequence(tx, '', 'RCP')), 'RCP-0021');
    assert.equal(await prisma.$transaction(tx => nextSequence(tx, '', 'SRV')), 'Svr-0001');
  } finally {
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await prisma.$disconnect();
  }
});
