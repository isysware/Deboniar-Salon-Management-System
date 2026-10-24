import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['tests/shared-settings-integration.test.js', 'tests/branch-isolation.test.js', 'tests/31-payment-settlement.test.js'], globalSetup: ['./tests/globalSetup.js'], setupFiles: ['./tests/setupEnv.js'], fileParallelism: false, testTimeout: 30000, hookTimeout: 120000 } });
