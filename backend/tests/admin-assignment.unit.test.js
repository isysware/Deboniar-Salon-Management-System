import { it, expect, vi } from 'vitest';
import bcrypt from 'bcrypt';

const { db, users, branches } = vi.hoisted(() => {
  const users = [];
  const branches = [];
  const db = { user: {}, branch: {}, refreshToken: { create: vi.fn() } };
  return { db, users, branches };
});
vi.mock('../src/config/prisma.js', () => ({ default: db }));
vi.mock('../src/config/env.js', () => ({ env: { jwtAccessSecret: 'test-access-secret', jwtRefreshSecret: 'test-refresh-secret', jwtAccessExpires: '15m', jwtRefreshExpires: '7d' } }));
vi.mock('../src/lib/audit.js', () => ({ auditLog: vi.fn() }));
import { assignBranchAdmin } from '../src/modules/branches/branches.service.js';
import { hashPassword, login } from '../src/modules/auth/auth.service.js';

it('requires unique validated credentials and preserves original account and login', async () => {
  branches.push({ id: 'first', name: 'First', isActive: true, assignedAdminId: 'original' }, { id: 'second', name: 'Second', isActive: true });
  users.push({ id: 'original', name: 'Admin', role: 'ADMIN', isActive: true, email: 'first@example.com', branchId: 'first', passwordHash: await hashPassword('FirstPassword') });
  db.$transaction = async (fn) => fn(db);
  db.branch.findUnique = async ({ where }) => branches.find((b) => b.id === where.id);
  db.branch.findFirst = async ({ where }) => branches.find((b) => b.assignedAdminId === where.assignedAdminId && b.id !== where.NOT.id);
  db.branch.update = async ({ where, data }) => Object.assign(branches.find((b) => b.id === where.id), data);
  db.user.findUnique = async ({ where }) => users.find((u) => where.id ? u.id === where.id : u.email === where.email);
  db.user.findMany = async () => users;
  db.user.update = vi.fn();
  db.user.create = async ({ data }) => { const user = { id: 'new-account', isActive: true, ...data }; users.push(user); return user; };
  db.user.findFirst = async ({ where }) => {
    const user = users.find((u) => where.OR.some((condition) => condition.email === u.email || condition.id === u.id));
    return user && { ...user, branch: branches.find((b) => b.id === user.branchId) };
  };
  const original = structuredClone(users[0]);
  const actor = { id: 'super', name: 'Super', role: 'SUPER_ADMIN' };
  for (const credentials of [{}, { email: 'invalid', password: 'short' }]) {
    await expect(assignBranchAdmin('second', 'original', actor, credentials)).rejects.toMatchObject({ code: 'BRANCH_CREDENTIALS_REQUIRED' });
  }
  await expect(assignBranchAdmin('second', 'original', actor, { email: original.email, password: 'SecondPassword' })).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
  expect(users).toHaveLength(1);
  await assignBranchAdmin('second', 'original', actor, { email: ' SECOND@example.com ', password: 'SecondPassword' });
  expect(users[0]).toEqual(original);
  expect(branches[0].assignedAdminId).toBe(original.id);
  expect(branches[1].assignedAdminId).toBe('new-account');
  expect(db.user.update).not.toHaveBeenCalled();
  expect(await bcrypt.compare('SecondPassword', users[1].passwordHash)).toBe(true);
  const res = { cookie: vi.fn() };
  for (const [identifier, password, branchId] of [[original.email, 'FirstPassword', 'first'], ['second@example.com', 'SecondPassword', 'second']]) {
    expect((await login({ identifier, password, portal: 'ADMIN' }, res)).user.branchId).toBe(branchId);
  }
  for (const [identifier, password] of [[original.email, 'SecondPassword'], ['second@example.com', 'FirstPassword']]) {
    await expect(login({ identifier, password, portal: 'ADMIN' }, res)).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  }
});
