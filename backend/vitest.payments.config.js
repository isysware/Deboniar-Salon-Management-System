import { defineConfig } from 'vitest/config';
export default defineConfig({ test: {
  environment: 'node', globalSetup: ['./tests/globalSetup.js'],
  setupFiles: ['./tests/setupEnv.js'], fileParallelism: false,
  include: ['tests/31-payment-settlement.test.js'], testTimeout: 30000, hookTimeout: 120000,
} });
