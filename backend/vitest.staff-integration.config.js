import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/globalSetup.js'],
    setupFiles: ['./tests/setupEnv.js'],
    include: ['tests/04-staff-catalogue.test.js'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
  },
});
