// src/config/prisma.js
// Single PrismaClient instance — reused across the entire app.

import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: env.isDev ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV === 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
