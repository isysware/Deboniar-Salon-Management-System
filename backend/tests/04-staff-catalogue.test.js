// Step 5 — Staff · Step 6 — Services & Packages
import { describe, it, expect } from 'vitest';
import prisma from '../src/config/prisma.js';
import { api, as } from './helpers.js';

const newStaff = (over = {}) => ({
  employeeCode: 'emp-lhe-010', name: 'Maham Raza', phone: '+92 (300) 999-0001', email: 'maham@isysware.com',
  designation: 'Junior Stylist', joiningDate: '2026-09-01', compensationType: 'MONTHLY_SALARY',
  baseSalary: 45000, dailySalaryRate: 999, commissionRate: 12, overtimeHourlyRate: 300, ...over,
});

describe('Step 5 · Staff', () => {
  it('returns the frontend StaffMember shape (commission as percent)', async () => {
    const res = await as('admin').get('/staff');
    expect(res.status).toBe(200);
    const zara = res.body.data.find((s) => s.id === 'staff-1');
    expect(zara).toMatchObject({
      employeeCode: 'EMP-LHE-001', commissionRate: 20, baseSalary: 85000, joiningDate: '2024-03-15',
      hasPortalAccess: true, linkedUserId: 'usr-staff-01', linkedUserEmail: 'zara.stylist@isysware.com',
      lateInDeduction: { enabled: false, type: 'FIXED', amount: 0 }, branchName: 'Gulberg Flagship Lounge',
    });
    expect(res.body.data.every((s) => s.branchId === 'branch-1')).toBe(true);
  });

  it('hides pay data from accountants', async () => {
    const res = await as('accountant').get('/staff');
    const zara = res.body.data.find((s) => s.id === 'staff-1');
    expect(zara.baseSalary).toBe(0);
    expect(zara.compensationRedacted).toBe(true);
    expect((await as('staff').get('/staff')).status).toBe(403);
  });

  it('creates staff, clears fields that do not belong to the compensation type, enforces unique code', async () => {
    const res = await as('admin').post('/staff', newStaff());
    expect(res.status).toBe(201);
    expect(res.body.data.staff).toMatchObject({
      employeeCode: 'EMP-LHE-010', branchId: 'branch-1', baseSalary: 45000, dailySalaryRate: 0, commissionRate: 0, hasPortalAccess: false,
    });
    const dup = await as('super').post('/staff', newStaff({ branchId: 'branch-2', employeeCode: 'EMP-LHE-010' }));
    expect(dup.status).toBe(409);
  });

  it('requires a payroll divisor for percentage deductions on monthly staff', async () => {
    const res = await as('admin').post('/staff', newStaff({
      employeeCode: 'EMP-LHE-011', email: 'x11@isysware.com', payrollDivisor: 0,
      lateInDeduction: { enabled: true, type: 'PERCENTAGE', amount: 5 },
    }));
    expect(res.status).toBe(400);
  });

  it('creates staff with portal access in one step', async () => {
    const res = await as('admin').post('/staff', newStaff({
      employeeCode: 'EMP-LHE-012', email: 'nimra@isysware.com', name: 'Nimra', enablePortalAccess: true, portalPassword: 'Nimra@2026',
    }));
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ role: 'STAFF', email: 'nimra@isysware.com' });
    const login = await api().post('/api/v1/auth/login').send({ identifier: 'nimra@isysware.com', password: 'Nimra@2026', portal: 'STAFF' });
    expect(login.status).toBe(200);
  });

  it('keeps compensation history when pay changes and blocks branch transfers', async () => {
    const upd = await as('admin').put('/staff/staff-3', { commissionRate: 17, effectiveDate: '2026-10-01' });
    expect(upd.status).toBe(200);
    expect(upd.body.data).toMatchObject({ commissionRate: 17, effectiveDate: '2026-10-01' });
    const history = await prisma.staffCompensationHistory.findMany({ where: { staffId: 'staff-3' } });
    expect(history).toHaveLength(1);
    expect(history[0].snapshot.commissionRate).toBe(15);

    const noPay = await as('admin').put('/staff/staff-3', { phone: '+92 (300) 456-7899' });
    expect(noPay.status).toBe(200);
    expect(await prisma.staffCompensationHistory.count({ where: { staffId: 'staff-3' } })).toBe(1);

    expect((await as('admin').put('/staff/staff-3', { branchId: 'branch-2' })).status).toBe(400);
    expect((await as('admin').put('/staff/staff-4', { phone: '1' })).status).toBe(403);
  });

  it('toggles portal access and deactivation revokes the login', async () => {
    const on = await as('admin').post('/staff/staff-3/portal-access', { enable: true, identifier: 'ayesha.nails@isysware.com', password: 'Ayesha@2026' });
    expect(on.status).toBe(200);
    expect(on.body.data.staff.hasPortalAccess).toBe(true);
    const login = () => api().post('/api/v1/auth/login').send({ identifier: 'ayesha.nails@isysware.com', password: 'Ayesha@2026', portal: 'STAFF' });
    expect((await login()).status).toBe(200);

    const off = await as('admin').post('/staff/staff-3/deactivate');
    expect(off.body.data.success).toBe(true);
    expect((await login()).status).toBe(403);

    const reenable = await as('admin').post('/staff/staff-3/portal-access', { enable: true });
    expect(reenable.status).toBe(400); // inactive employee
    await as('admin').put('/staff/staff-3', { isActive: true });
  });

  it('staff can read only their own profile', async () => {
    expect((await as('staff').get('/staff/staff-1')).status).toBe(200);
    expect((await as('staff').get('/staff/staff-2')).status).toBe(403);
  });
});

describe('Step 6 · Services & Packages', () => {
  it('lists the catalogue in the frontend shape', async () => {
    const srv = await as('accountant').get('/services');
    const hydra = srv.body.data.find((s) => s.id === 'srv-lhe-06');
    expect(hydra).toMatchObject({ category: 'Skin & HydraFacial', price: 12000, taxTreatment: 'SPECIFIC_RULE', specificTaxRuleId: 'tax-lhe-reduced' });

    const pkg = await as('admin').get('/packages');
    const bridal = pkg.body.data.find((p) => p.id === 'pkg-lhe-01');
    expect(bridal.components.map((c) => c.allocationPercentage)).toEqual([45, 45, 10]);
    expect(bridal.components[0]).toMatchObject({ serviceCode: 'SRV-LHE-003', unitPrice: 18500 });

    const cats = await as('admin').get('/service-categories');
    expect(cats.body.data).toHaveLength(5);
  });

  it('creates a service with a new category name and validates tax rule / code', async () => {
    const res = await as('admin').post('/services', {
      code: 'srv-lhe-020', name: 'Lash Lift', category: 'Lashes & Brows', durationMinutes: 50, price: 6000,
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ code: 'SRV-LHE-020', category: 'Lashes & Brows', taxTreatment: 'BRANCH_DEFAULT' });

    const dup = await as('admin').post('/services', { code: 'SRV-LHE-020', name: 'X', durationMinutes: 10, price: 1 });
    expect(dup.status).toBe(409);
    const badRule = await as('admin').post('/services', { code: 'S-21', name: 'X', durationMinutes: 10, price: 1, taxTreatment: 'SPECIFIC_RULE', specificTaxRuleId: 'tax-khi-std' });
    expect(badRule.status).toBe(400);
    const badPrice = await as('admin').post('/services', { code: 'S-22', name: 'X', durationMinutes: 10, price: -1 });
    expect(badPrice.status).toBe(400);
    expect((await as('accountant').post('/services', { code: 'S-23', name: 'X', durationMinutes: 10, price: 1 })).status).toBe(403);
  });

  it('packages must total exactly 100% with active same-branch services', async () => {
    const base = { code: 'PKG-LHE-010', name: 'Glow Duo', price: 15000 };
    const bad = await as('admin').post('/packages', { ...base, components: [
      { serviceId: 'srv-lhe-01', allocationPercentage: 50 }, { serviceId: 'srv-lhe-06', allocationPercentage: 40 },
    ] });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('ALLOCATION_NOT_100');

    const otherBranch = await as('admin').post('/packages', { ...base, components: [
      { serviceId: 'srv-lhe-01', allocationPercentage: 50 }, { serviceId: 'srv-khi-02', allocationPercentage: 50 },
    ] });
    expect(otherBranch.status).toBe(400);

    const ok = await as('admin').post('/packages', { ...base, components: [
      { serviceId: 'srv-lhe-01', allocationPercentage: 33.33 }, { serviceId: 'srv-lhe-06', allocationPercentage: 66.67 },
    ] });
    expect(ok.status).toBe(201);
    expect(ok.body.data.components).toHaveLength(2);

    const upd = await as('admin').put(`/packages/${ok.body.data.id}`, { components: [{ serviceId: 'srv-lhe-01', allocationPercentage: 100 }] });
    expect(upd.body.data.components).toHaveLength(1);
  });

  it('cannot re-activate a package whose component service was deactivated', async () => {
    await as('admin').post('/packages/pkg-lhe-02/toggle'); // deactivate package
    await as('admin').post('/services/srv-lhe-07/toggle'); // deactivate component service
    const res = await as('admin').post('/packages/pkg-lhe-02/toggle');
    expect(res.status).toBe(400);
    await as('admin').post('/services/srv-lhe-07/toggle');
    expect((await as('admin').post('/packages/pkg-lhe-02/toggle')).body.data.isActive).toBe(true);
  });

  it('supports bulk import of services via /services/bulk-import', async () => {
    const res = await as('admin').post('/services/bulk-import', {
      rows: [
        { code: 'SRV-BLK-001', name: 'Bulk Pedicure', category: 'Nails', durationMinutes: 40, price: 2500 },
        { code: 'SRV-BLK-002', name: 'Bulk Manicure', category: 'Nails', durationMinutes: 30, price: 2000 },
        { code: 'SRV-BLK-001', name: 'Duplicate Pedicure', category: 'Nails', durationMinutes: 40, price: 2500 },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.acceptedRows).toBe(2);
    expect(res.body.data.duplicateRows).toBe(1);
    expect(res.body.data.totalRows).toBe(3);
  });

  it('supports bulk import of packages via /packages/bulk-import', async () => {
    const res = await as('admin').post('/packages/bulk-import', {
      rows: [
        {
          code: 'PKG-BLK-001',
          name: 'Bulk Nail Combo',
          price: 4000,
          components: [
            { serviceCode: 'SRV-BLK-001', allocationPercentage: 50 },
            { serviceCode: 'SRV-BLK-002', allocationPercentage: 50 },
          ],
        },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.acceptedRows).toBe(1);
    expect(res.body.data.totalRows).toBe(1);
  });
});
