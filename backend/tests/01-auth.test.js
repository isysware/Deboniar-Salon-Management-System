// Step 1 — Authentication
import { describe, it, expect } from 'vitest';
import { api, as, ACCOUNTS } from './helpers.js';

describe('Step 1 · Auth', () => {
  it('logs in all 4 demo roles and returns the frontend Session shape', async () => {
    for (const who of ['super', 'admin', 'accountant', 'staff']) {
      const res = await api().post('/api/v1/auth/login').send(ACCOUNTS[who]);
      expect(res.status, who).toBe(200);
      const s = res.body.data;
      expect(s.token).toBeTypeOf('string');
      expect(s.user.role).toBe(ACCOUNTS[who].portal);
      expect(s.user).not.toHaveProperty('passwordHash');
      expect(res.headers['set-cookie']?.[0]).toMatch(/refreshToken=.*HttpOnly/i);
    }
  });

  it('super admin session is consolidated (ALL)', async () => {
    const res = await api().post('/api/v1/auth/login').send(ACCOUNTS.super);
    expect(res.body.data.activeBranchId).toBe('ALL');
    expect(res.body.data.user.branchId).toBe('ALL');
    expect(res.body.data.user.branchName).toBe('All Branches (Consolidated)');
  });

  it('accepts the user id as identifier (same as the mock)', async () => {
    const res = await api().post('/api/v1/auth/login').send({ ...ACCOUNTS.admin, identifier: 'usr-admin-01' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.branchId).toBe('branch-1');
  });

  it('rejects a portal mismatch with 403', async () => {
    const res = await api().post('/api/v1/auth/login').send({ ...ACCOUNTS.staff, portal: 'SUPER_ADMIN' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PORTAL_MISMATCH');
  });

  it('rejects a wrong password with 401 and a generic message', async () => {
    const res = await api().post('/api/v1/auth/login').send({ ...ACCOUNTS.admin, password: 'nope' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('validates the request body', async () => {
    const res = await api().post('/api/v1/auth/login').send({ password: 'x', portal: 'ADMIN' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('protects routes without a token', async () => {
    const res = await api().get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user from /auth/me', async () => {
    const res = await as('accountant').get('/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(ACCOUNTS.accountant.identifier);
    expect(res.body.data.branchName).toBe('Gulberg Flagship Lounge');
  });

  it('rotates the refresh token and rejects reuse of the old one', async () => {
    const login = await api().post('/api/v1/auth/login').send(ACCOUNTS.admin);
    const oldCookie = login.headers['set-cookie'][0].split(';')[0];

    const r1 = await api().post('/api/v1/auth/refresh').set('Cookie', oldCookie);
    expect(r1.status).toBe(200);
    expect(r1.body.data.token).toBeTypeOf('string');

    const reuse = await api().post('/api/v1/auth/refresh').set('Cookie', oldCookie);
    expect(reuse.status).toBe(401);

    const newCookie = r1.headers['set-cookie'][0].split(';')[0];
    const out = await api().post('/api/v1/auth/logout').set('Cookie', newCookie);
    expect(out.status).toBe(200);
    const afterLogout = await api().post('/api/v1/auth/refresh').set('Cookie', newCookie);
    expect(afterLogout.status).toBe(401);
  });

  it('forgot-password returns the PasswordResetResponse shape', async () => {
    const ok = await api().post('/api/v1/auth/forgot-password').send({ identifier: ACCOUNTS.admin.identifier, portal: 'ADMIN' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.success).toBe(true);
    expect(ok.body.data.simulatedToken).toBeTypeOf('string');

    const miss = await api().post('/api/v1/auth/forgot-password').send({ identifier: 'nobody@x.com', portal: 'ADMIN' });
    expect(miss.body.data.success).toBe(false);
  });
});
