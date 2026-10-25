import { it, expect } from 'vitest';
import { as, api } from './helpers.js';
import prisma from '../src/config/prisma.js';

it('preserves the first account and isolates additional branch credentials and access', async () => {
  const createBranch = async (name) => {
    const res = await as('super').post('/branches', { name });
    expect(res.status).toBe(201);
    return res.body.data;
  };
  const first = await createBranch('Assignment First');
  const second = await createBranch('Assignment Second');
  const account = await as('super').post('/users', {
    name: 'Independent Admin', role: 'ADMIN', branchId: first.id,
    email: 'assignment-first@example.com', password: 'FirstPassword123',
  });
  expect(account.status).toBe(201);
  const adminUserId = account.body.data.id;
  const original = await prisma.user.findUnique({ where: { id: adminUserId } });
  const originalBranch = await prisma.branch.findUnique({ where: { id: first.id } });
  const assign = (body) => as('super').post(`/branches/${second.id}/assign-admin`, { adminUserId, ...body });
  expect((await assign({})).status).toBe(400);
  expect((await assign({ email: 'invalid', password: 'short' })).status).toBe(400);
  expect((await assign({ email: original.email, password: 'SecondPassword123' })).status).toBe(409);
  expect(await prisma.user.count({ where: { branchId: second.id } })).toBe(0);
  const result = await assign({ email: ' Assignment-Second@example.com ', password: 'SecondPassword123' });
  expect(result.status).toBe(200);
  const secondId = result.body.data.assignedAdminId;
  expect(secondId).not.toBe(adminUserId);
  expect(await prisma.user.findUnique({ where: { id: adminUserId } })).toEqual(original);
  expect(await prisma.branch.findUnique({ where: { id: first.id } })).toEqual(originalBranch);
  const login = (identifier, password) => api().post('/api/v1/auth/login').send({ identifier, password, portal: 'ADMIN' });
  const firstLogin = await login(original.email, 'FirstPassword123');
  const secondLogin = await login('assignment-second@example.com', 'SecondPassword123');
  expect(firstLogin.status).toBe(200);
  expect(secondLogin.status).toBe(200);
  expect(firstLogin.body.data.user.branchId).toBe(first.id);
  expect(secondLogin.body.data.user.branchId).toBe(second.id);
  expect((await login(original.email, 'SecondPassword123')).status).toBe(401);
  expect((await login('assignment-second@example.com', 'FirstPassword123')).status).toBe(401);
  for (const [session, other] of [[firstLogin, second], [secondLogin, first]]) {
    const denied = await api().get(`/api/v1/branches/${other.id}`).set('Authorization', `Bearer ${session.body.data.token}`);
    expect(denied.status).toBe(403);
  }
  expect((await as('super').post(`/branches/${second.id}/unassign-admin`, { adminUserId: secondId })).status).toBe(200);
  expect((await login(original.email, 'FirstPassword123')).status).toBe(200);
  expect((await login('assignment-second@example.com', 'SecondPassword123')).status).toBe(403);
});
