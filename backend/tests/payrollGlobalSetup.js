import { execFileSync } from 'node:child_process';
import dotenv from 'dotenv';

export default function setup() {
  const env = { ...process.env, ...dotenv.config({ path: '.env.test' }).parsed };
  env.DATABASE_URL = process.env.SALONOS_TEST_DATABASE_URL;
  env.DIRECT_URL = env.DATABASE_URL;
  if (!env.DATABASE_URL || !new URL(env.DATABASE_URL).pathname.startsWith('/salonos_test_audit_')) {
    throw new Error('Payroll integration tests require a disposable isolated database.');
  }
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'], { env, stdio: 'pipe' });
  execFileSync(process.execPath, ['prisma/seed.js'], { env, stdio: 'pipe' });
}
