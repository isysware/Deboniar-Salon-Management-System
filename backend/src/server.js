// src/server.js
// Entry point — loads env, connects to DB, and starts HTTP server.

import 'dotenv/config';
import app    from './app.js';
import prisma from './config/prisma.js';
import { env } from './config/env.js';

const start = async () => {
  try {
    // Verify DB connectivity before accepting traffic
    await prisma.$connect();
    console.log('✅  Database connected');

    app.listen(env.port, () => {
      console.log(`🚀  SalonOS API running on http://localhost:${env.port}/api/v1`);
      console.log(`📌  Environment: ${env.nodeEnv}`);
    });
  } catch (err) {
    console.error('❌  Failed to start server:', err.message);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received — shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

start();
