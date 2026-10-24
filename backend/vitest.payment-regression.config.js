import { defineConfig } from 'vitest/config';
import { BaseSequencer } from 'vitest/node';
class AlphabeticalSequencer extends BaseSequencer {
  async sort(files) { return [...files].sort((a, b) => a.moduleId.localeCompare(b.moduleId)); }
}
export default defineConfig({ test: {
  environment: 'node', globalSetup: ['./tests/globalSetup.js'], setupFiles: ['./tests/setupEnv.js'],
  include: ['tests/*.test.js'], exclude: ['tests/31-payment-settlement.test.js'],
  fileParallelism: false, sequence: { sequencer: AlphabeticalSequencer },
  testTimeout: 30000, hookTimeout: 120000,
} });
