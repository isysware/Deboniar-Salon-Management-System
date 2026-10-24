// scripts/new-migration.js
// Creates a migration from the current schema diff and applies it — works in non-interactive
// shells where `prisma migrate dev` refuses to run (e.g. CI, agents).
// Usage: npm run db:new-migration -- <name>

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const name = (process.argv[2] || 'change').replace(/[^a-z0-9_]/gi, '_').toLowerCase();
const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const dir = path.join('prisma', 'migrations', `${stamp}_${name}`);

const sql = execSync(
  'npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script',
  { encoding: 'utf8' }
);

if (!sql.trim() || /^-- This is an empty migration/m.test(sql)) {
  console.log('No schema changes — nothing to migrate.');
  process.exit(0);
}

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'migration.sql'), sql);
console.log(`Created ${dir}`);

execSync('npx prisma migrate deploy', { stdio: 'inherit' });
execSync('npx prisma generate', { stdio: 'inherit' });
