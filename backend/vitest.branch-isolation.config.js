import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/branch-isolation.test.js'],
    globalSetup: ['./tests/globalSetup.js'],
    setupFiles: ['./tests/setupEnv.js'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
  },
});
