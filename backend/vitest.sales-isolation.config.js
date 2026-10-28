import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/sales-isolation.unit.test.js', 'tests/operating-profit-regression.test.js'],
  },
});
