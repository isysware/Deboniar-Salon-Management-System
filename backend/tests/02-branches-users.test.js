// Step 2 — Branches · Step 3 — Users & Access
import { describe, it, expect } from 'vitest';
import { api, as } from './helpers.js';

describe('Step 2 · Branches', () => {
  it('lists branches with the frontend Branch shape', async () => {
    const res = await as('accountant').get('/branches');
    expect(res.status).toBe(200);
    const lhe = res.body.data.find((b) => b.id === 'branch-1');
    expect(lhe).toMatchObject({
      code: 'LHE-01', taxRate: 0.16, taxEnabled: true, defaultTaxRuleId: 'tax-lhe-std',
      openingCashFloat: 25000, assignedAdminId: 'usr-admin-01', assignedAdminName: 'Aamina Sheikh',
    });
  });

  it('only SUPER_ADMIN can create branches; new branch starts with tax off and zero float', async () => {
    const denied = await as('admin').post('/branches', { name: 'X', code: 'X-1' });
    expect(denied.status).toBe(403);

    const res = await as('super').post('/branches', {
      name: 'DHA Studio', code: 'lhe-03', city: 'Lahore', taxRate: 0.16, openingCashFloat: 25000,
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ code: 'LHE-03', taxEnabled: false, taxRate: 0, openingCashFloat: 0, isActive: true });

    const dup = await as('super').post('/branches', { name: 'Dup', code: 'LHE-03' });
    expect(dup.status).toBe(409);
  });

  it('updates a branch and rejects a duplicate code', async () => {
    const list = await as('super').get('/branches');
    const b = list.body.data.find((x) => x.code === 'LHE-03');
    const upd = await as('super').put(`/branches/${b.id}`, { phone: '+92 (42) 1111-222', email: '' });
    expect(upd.status).toBe(200);
    expect(upd.body.data.phone).toBe('+92 (42) 1111-222');
    expect(upd.body.data.email).toBeUndefined();

    const clash = await as('super').put(`/branches/${b.id}`, { code: 'LHE-01' });
    expect(clash.status).toBe(409);
  });

  it('blocks deactivation while users/staff are active, allows it for an empty branch', async () => {
    const blocked = await as('super').post('/branches/branch-2/deactivate');
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('BRANCH_HAS_BLOCKERS');

    const list = await as('super').get('/branches');
    const b = list.body.data.find((x) => x.code === 'LHE-03');
    const blockers = await as('super').get(`/branches/${b.id}/deactivation-blockers`);
    expect(blockers.body.data).toEqual({ canDeactivate: true, blockers: [] });

    const ok = await as('super').post(`/branches/${b.id}/deactivate`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.success).toBe(true);

    const re = await as('super').put(`/branches/${b.id}`, { isActive: true });
    expect(re.body.data.isActive).toBe(true);

    // Delete branch test on a dedicated branch
    const toDelete = await as('super').post('/branches', {
      name: 'To Delete Branch', code: 'DEL-01', phone: '+92 (42) 9999-999', city: 'Lahore', address: 'Delete Rd',
    });
    expect(toDelete.status).toBe(201);
    const del = await as('super').delete(`/branches/${toDelete.body.data.id}`);
    expect(del.status).toBe(200);
    expect(del.body.data.success).toBe(true);

    const getAfter = await as('super').get(`/branches/${toDelete.body.data.id}`);
    expect(getAfter.status).toBe(404);
  });
});

describe('Step 3 · Users & Access', () => {
  it('ADMIN only sees users of their own branch', async () => {
    const res = await as('admin').get('/users');
    expect(res.status).toBe(200);
    expect(res.body.data.every((u) => u.branchId === 'branch-1')).toBe(true);
    expect(res.body.data.some((u) => u.passwordHash)).toBe(false);

    const all = await as('super').get('/users');
    expect(all.body.data.length).toBeGreaterThan(res.body.data.length);
  });

  it('ACCOUNTANT and STAFF cannot manage users', async () => {
    expect((await as('accountant').get('/users')).status).toBe(403);
    expect((await as('staff').get('/users')).status).toBe(403);
  });

  it('ADMIN creates an accountant in their own branch only, cannot create admins', async () => {
    const res = await as('admin').post('/users', {
      name: 'Nida Cashier', email: 'Nida.Cashier@isysware.com', role: 'ACCOUNTANT', branchId: 'branch-2', title: 'Cashier', password: 'Cashier@2026',
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ email: 'nida.cashier@isysware.com', branchId: 'branch-1', role: 'ACCOUNTANT' });

    const login = await api().post('/api/v1/auth/login').send({ identifier: 'nida.cashier@isysware.com', password: 'Cashier@2026', portal: 'ACCOUNTANT' });
    expect(login.status).toBe(200);

    const admin = await as('admin').post('/users', { name: 'X', email: 'x.admin@isysware.com', role: 'ADMIN', title: 'X' });
    expect(admin.status).toBe(403);

    const dup = await as('super').post('/users', { name: 'Dup', email: 'nida.cashier@isysware.com', role: 'ACCOUNTANT', branchId: 'branch-1', title: 'X' });
    expect(dup.status).toBe(409);
  });

  it('creates a STAFF login linked to an employee and enables portal access', async () => {
    const res = await as('super').post('/users', {
      name: 'Hamza Malik', email: 'hamza.barber@isysware.com', role: 'STAFF', branchId: 'branch-1', staffId: 'staff-2', title: 'Barber', password: 'Hamza@2026',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.staffId).toBe('staff-2');

    const login = await api().post('/api/v1/auth/login').send({ identifier: 'hamza.barber@isysware.com', password: 'Hamza@2026', portal: 'STAFF' });
    expect(login.status).toBe(200);

    const wrongBranch = await as('super').post('/users', {
      name: 'Sana', email: 'sana.x@isysware.com', role: 'STAFF', branchId: 'branch-1', staffId: 'staff-4', title: 'X',
    });
    expect(wrongBranch.status).toBe(400);
  });

  it('deactivating a staff login revokes portal access and blocks login', async () => {
    const users = await as('super').get('/users?branchId=branch-1');
    const hamza = users.body.data.find((u) => u.staffId === 'staff-2');
    const res = await as('admin').post(`/users/${hamza.id}/deactivate`);
    expect(res.status).toBe(200);

    const login = await api().post('/api/v1/auth/login').send({ identifier: 'hamza.barber@isysware.com', password: 'Hamza@2026', portal: 'STAFF' });
    expect(login.status).toBe(403);
  });

  it('cannot deactivate the super admin or another branch user', async () => {
    expect((await as('admin').post('/users/usr-super-01/deactivate')).status).toBe(400);
    expect((await as('admin').post('/users/usr-admin-02/deactivate')).status).toBe(403);
  });

  it('updates profile fields and resets password to a working temporary one', async () => {
    const users = await as('admin').get('/users');
    const nida = users.body.data.find((u) => u.email === 'nida.cashier@isysware.com');
    const upd = await as('admin').put(`/users/${nida.id}`, { title: 'Senior Cashier', role: 'ADMIN' });
    expect(upd.body.data).toMatchObject({ title: 'Senior Cashier', role: 'ACCOUNTANT' });

    const reset = await as('admin').post(`/users/${nida.id}/reset-password`);
    expect(reset.body.data.temporaryPassword).toMatch(/^Temp@\d{4}$/);
    const login = await api().post('/api/v1/auth/login').send({ identifier: nida.email, password: reset.body.data.temporaryPassword, portal: 'ACCOUNTANT' });
    expect(login.status).toBe(200);
  });

  it('assigns a branch admin (super admin only)', async () => {
    const created = await as('super').post('/users', { name: 'Faisal Admin', email: 'faisal.admin@isysware.com', role: 'ADMIN', branchId: 'branch-1', title: 'GM' });
    const list = await as('super').get('/branches');
    const b = list.body.data.find((x) => x.code === 'LHE-03');
    const res = await as('super').post(`/branches/${b.id}/assign-admin`, { adminUserId: created.body.data.id });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ assignedAdminId: created.body.data.id, assignedAdminName: 'Faisal Admin' });

    const notAdmin = await as('super').post(`/branches/${b.id}/assign-admin`, { adminUserId: 'usr-acc-01' });
    expect(notAdmin.status).toBe(400);
  });
});
