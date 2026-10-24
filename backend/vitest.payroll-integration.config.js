import { BaseSequencer } from 'vitest/node';

class PayrollSequencer extends BaseSequencer {
  async sort(files) {
    return [...files].sort((a, b) => a.moduleId.localeCompare(b.moduleId));
  }
}

export default { test: {
  include: [
    'tests/0*.test.js', 'tests/10-settlements.test.js', 'tests/11-attendance-overtime.test.js',
    'tests/12-payroll-commission.test.js', 'tests/15-payroll-engine.test.js',
    'tests/16-payroll-extras.test.js', 'tests/17-staff-loans-flow.test.js',
    'tests/19-daily-payroll.test.js', 'tests/20-payroll-combined-commission.test.js',
    'tests/24-payroll-fixed-divisor.test.js', 'tests/32-manual-deduction.test.js',
  ],
  environment: 'node', globalSetup: ['./tests/payrollGlobalSetup.js'],
  setupFiles: ['./tests/setupEnv.js'], fileParallelism: false,
  sequence: { sequencer: PayrollSequencer }, testTimeout: 30000, hookTimeout: 120000,
} };
