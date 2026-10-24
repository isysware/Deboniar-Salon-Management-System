import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({ resolve: { alias: { 'react': fileURLToPath(new URL('../frontend/node_modules/react', import.meta.url)), '@': fileURLToPath(new URL('../frontend/src', import.meta.url)) } }, test: { environment: 'node', include: ['tests/action-branches.test.tsx'] } });
