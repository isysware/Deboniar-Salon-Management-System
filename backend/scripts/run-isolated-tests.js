// Give simultaneous local test runs independent databases; never touch the live database.
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'node:child_process';

const config = dotenv.config({ path: '.env.test' }).parsed;
if (!config?.DATABASE_URL || !new URL(config.DATABASE_URL).pathname.endsWith('_test')) throw new Error('An existing *_test database is required.');
const connection = new URL(config.DATABASE_URL);
const name = `salonos_test_audit_${process.pid}`;
const admin = new PrismaClient({ datasources: { db: { url: connection.toString() } } });
let exitCode = 1;
let created = false;
try {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  created = true;
  connection.pathname = `/${name}`;
  const child = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...process.argv.slice(2)], {
    env: { ...process.env, SALONOS_TEST_DATABASE_URL: connection.toString(), DIRECT_URL: connection.toString() }, stdio: 'inherit',
  });
  if (child.error) throw child.error;
  exitCode = child.status ?? 1;
} finally {
  if (created) await admin.$executeRawUnsafe(`DROP DATABASE "${name}" WITH (FORCE)`);
  await admin.$disconnect();
}
process.exitCode = exitCode;
