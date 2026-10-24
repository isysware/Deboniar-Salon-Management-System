import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'node:child_process';
const connection = new URL(process.env.DATABASE_URL);
const name = 'salonos_test_audit_' + process.pid;
const admin = new PrismaClient();
let created = false;
try {
 await admin.$executeRawUnsafe('CREATE DATABASE "' + name + '"'); created = true; connection.pathname = '/' + name;
 const child = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.settings-isolation.config.js'], { env: { ...process.env, SALONOS_TEST_DATABASE_URL: connection.toString(), DIRECT_URL: connection.toString() }, stdio: 'inherit' });
 if (child.error) throw child.error; process.exitCode = child.status ?? 1;
} finally { if (created) await admin.$executeRawUnsafe('DROP DATABASE "' + name + '" WITH (FORCE)'); await admin.$disconnect(); }
