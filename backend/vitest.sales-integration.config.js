import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/globalSetup.js'],
    setupFiles: ['./tests/setupEnv.js'],
    include: ['tests/31-accountant-sales-isolation.test.js', 'tests/30-financial-reports-suite.test.js'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
  },
});
