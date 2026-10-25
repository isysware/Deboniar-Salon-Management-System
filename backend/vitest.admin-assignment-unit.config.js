import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['tests/admin-assignment.unit.test.js'], testTimeout: 30000 } });
