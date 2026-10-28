import assert from 'node:assert/strict';
import { test } from 'node:test';
import { saveStaffEdit } from './saveStaffEdit';
import type { StaffMember } from '@/types/salon';
import type { User } from '@/types/auth';

const actor = { id: 'admin', role: 'ADMIN' } as User;
const staff = { id: 'staff', isActive: true, hasPortalAccess: false } as StaffMember;
const portal = { enable: true, identifier: ' Staff@Example.com ', password: 'Staff@2026' };

function fixture(current = staff, failPortal = false) {
  const calls: unknown[][] = [];
  return {
    calls,
    service: {
      async updateStaffMember(id: string, profile: Partial<StaffMember>) {
        calls.push(['profile', id]);
        return { ...current, ...profile, ...(profile.isActive === false ? { hasPortalAccess: false } : {}) };
      },
      async setStaffPortalAccess(id: string, enable: boolean, credentials?: { identifier: string; password?: string }) {
        calls.push(['portal', id, enable, credentials]);
        if (failPortal) throw new Error('Identifier already registered.');
        return { staff: { ...current, hasPortalAccess: enable, linkedUserEmail: credentials?.identifier } };
      },
    },
  };
}

test('saving an edit assigns portal access and normalizes the login', async () => {
  const { service, calls } = fixture();
  const result = await saveStaffEdit(service, staff, { name: 'Staff' }, portal, actor);
  assert.equal(result.hasPortalAccess, true);
  assert.deepEqual(calls, [['profile', 'staff'], ['portal', 'staff', true, { identifier: 'staff@example.com', password: 'Staff@2026' }]]);
});

test('saving an unchecked portal checkbox revokes access', async () => {
  const current = { ...staff, hasPortalAccess: true };
  const { service, calls } = fixture(current);
  await saveStaffEdit(service, current, {}, { ...portal, enable: false }, actor);
  assert.deepEqual(calls[1], ['portal', 'staff', false, undefined]);
});

test('unchanged credentials do not reset the account; changed email is saved', async () => {
  const current = { ...staff, hasPortalAccess: true, linkedUserEmail: 'staff@example.com' };
  const { service, calls } = fixture(current);
  await saveStaffEdit(service, current, {}, { ...portal, password: '' }, actor);
  assert.equal(calls.length, 1);
  await saveStaffEdit(service, current, {}, { ...portal, identifier: 'new@example.com', password: '' }, actor);
  assert.deepEqual(calls[2], ['portal', 'staff', true, { identifier: 'new@example.com', password: undefined }]);
});

test('deactivation does not re-enable portal access', async () => {
  const { service, calls } = fixture({ ...staff, hasPortalAccess: true });
  await saveStaffEdit(service, staff, { isActive: false }, portal, actor);
  assert.equal(calls.length, 1);
});

test('invalid credentials are rejected before saving the profile', async () => {
  const { service, calls } = fixture();
  await assert.rejects(saveStaffEdit(service, staff, {}, { ...portal, identifier: ' ' }, actor), /identifier is required/);
  await assert.rejects(saveStaffEdit(service, staff, {}, { ...portal, password: 'short' }, actor), /at least 6/);
  assert.equal(calls.length, 0);
});

test('portal failure reports the partial save without claiming success', async () => {
  const { service } = fixture(staff, true);
  await assert.rejects(saveStaffEdit(service, staff, {}, portal, actor), /Employee details saved, but portal settings could not be saved: Identifier already registered/);
});
