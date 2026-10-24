import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import app from '../src/app.js';
import { as } from './helpers.js';

// Check registered Express handlers without issuing any mutating requests.
function hasRoute(stack, method, path) {
  for (const layer of stack) {
    const match = layer.matchers?.map((matcher) => matcher(path)).find(Boolean);
    if (!match) continue;
    if (layer.route?.methods[method]) return true;
    if (layer.handle?.stack) {
      const rest = path.slice(match.path === '/' ? 0 : match.path.length) || '/';
      if (hasRoute(layer.handle.stack, method, rest)) return true;
    }
  }
  return false;
}

describe('Frontend API route contract', () => {
  it('registers every literal/template API call made by the HTTP services', () => {
    const missing = [];
    let checked = 0;
    for (const file of ['httpSalonService.ts', 'httpAuthService.ts']) {
      const source = readFileSync(new URL(`../../frontend/src/services/http/${file}`, import.meta.url), 'utf8');
      const calls = source.matchAll(/api\.(get|post|put|patch|delete)(?:<[^\n]*?>)?\(\s*(['"`])([\s\S]*?)\2/g);
      for (const [, method, , template] of calls) {
        const path = `/api/v1${template.replace(/\$\{[^}]+\}/g, 'contract-id').split('?')[0]}`;
        checked++;
        if (!hasRoute(app.router.stack, method, path)) missing.push(`${method.toUpperCase()} ${path}`);
      }
    }
    expect(checked).toBeGreaterThan(100);
    expect(missing).toEqual([]);
  });

  it('loads payroll page data and related commission endpoints as an administrator', async () => {
    for (const path of [
      '/payroll/runs?month=2026-06', '/staff', '/online-accounts', '/cash-drawers', '/payroll-policy',
      '/payroll/monthly-summary?month=2026-06', '/payroll/allowances',
      '/payroll/adjustments?month=2026-06', '/payroll/advances', '/commission/runs',
    ]) {
      const response = await as('admin').get(path);
      expect(response.status, path).toBe(200);
      expect(response.body).toHaveProperty('data');
    }
  });

  it('validates payroll list filters and preserves confidential payroll access', async () => {
    expect((await as('admin').get('/payroll/runs?month=invalid')).status).toBe(400);
    expect((await as('accountant').get('/payroll/runs')).status).toBe(403);
    expect((await as('staff').get('/payroll/runs')).status).toBe(403);
    const response = await as('admin').get('/payroll/runs?month=2026-06');
    expect(response.status).toBe(200);
    for (const run of response.body.data) {
      expect(run.month).toBe('2026-06');
      expect(run.branchId).toBe('branch-1');
    }
  });

  it('validates payroll period and compensation inputs through Express', async () => {
    for (const body of [
      { month: '2026-13' },
      { month: '2026-06', startDate: '2026-06-31' },
      { month: '2026-06', compensationType: 'INVALID' },
      { month: '2026-06', runType: 'DAILY', startDate: '2026-06-10', endDate: '2026-06-11' },
      { month: '2026-06', runType: 'CUSTOM_RANGE', startDate: '2026-06-10', endDate: '2026-07-01' },
    ]) expect((await as('admin').post('/payroll/preview', body)).status).toBe(400);
  });
});
