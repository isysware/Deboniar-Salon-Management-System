import { nextSequence } from '../../lib/sequence.js';
// src/modules/branches/branches.service.js
// Branch CRUD, admin assignment and safe deactivation.

import prisma from '../../config/prisma.js';
import { auditLog } from '../../lib/audit.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/AppError.js';
import { toDec } from '../../lib/money.js';
import { hashPassword } from '../auth/auth.service.js';
import { toBranchDTO } from './branches.mapper.js';
import { assignAdminSchema } from './branches.schema.js';

export const toDTOs = async (branches, tx = prisma) => {
  const branchIds = branches.map((b) => b.id);
  const explicitAdminIds = branches.map((b) => b.assignedAdminId).filter(Boolean);

  const adminUsers = await tx.user.findMany({
    where: {
      OR: [
        { branchId: { in: branchIds }, role: 'ADMIN', isActive: true },
        { id: { in: explicitAdminIds }, isActive: true },
      ],
    },
    select: { id: true, name: true, email: true, branchId: true },
    orderBy: { createdAt: 'asc' },
  });

  const branchAdminsMap = new Map();
  for (const b of branches) {
    branchAdminsMap.set(b.id, []);
  }

  for (const u of adminUsers) {
    if (u.branchId && branchAdminsMap.has(u.branchId)) {
      const list = branchAdminsMap.get(u.branchId);
      if (!list.some((existing) => existing.id === u.id)) {
        list.push(u);
      }
    }
  }

  for (const b of branches) {
    if (b.assignedAdminId) {
      const u = adminUsers.find((au) => au.id === b.assignedAdminId);
      if (u) {
        const list = branchAdminsMap.get(b.id);
        if (!list.some((existing) => existing.id === u.id)) {
          list.push(u);
        }
      }
    }
  }

  return branches.map((b) => toBranchDTO(b, branchAdminsMap.get(b.id) || []));
};

const getOrThrow = async (tx, id) => {
  const branch = await tx.branch.findUnique({ where: { id } });
  if (!branch) throw notFound('BRANCH_NOT_FOUND', `Branch '${id}' not found.`);
  return branch;
};

const assertCodeFree = async (tx, code, exceptId) => {
  const clash = await tx.branch.findFirst({ where: { code, ...(exceptId ? { NOT: { id: exceptId } } : {}) } });
  if (clash) throw conflict('BRANCH_CODE_TAKEN', `Branch code '${code}' is already registered to another branch.`);
};

const generateNextBranchCode = async (tx) => nextSequence(tx, '', 'BR');

// Branch metadata (names, codes, tax config): Super Admins can list all branches;
// branch managers and staff are scoped strictly to their own assigned branch.
export const listBranches = async (actor) => {
  if (actor && actor.role !== 'SUPER_ADMIN') {
    const branches = await prisma.branch.findMany({
      where: { id: actor.branchId },
      orderBy: [{ createdAt: 'asc' }, { code: 'asc' }],
    });
    return toDTOs(branches);
  }
  const branches = await prisma.branch.findMany({ orderBy: [{ createdAt: 'asc' }, { code: 'asc' }] });
  return toDTOs(branches);
};

export const getBranch = async (id, actor) => {
  if (actor && actor.role !== 'SUPER_ADMIN' && actor.branchId !== id) {
    throw forbidden('FORBIDDEN', 'Access Denied: You do not have permission to view other branches.');
  }
  const branch = await prisma.branch.findUnique({ where: { id } });
  if (!branch) return null;
  return (await toDTOs([branch]))[0];
};

export const createBranch = async (input, actor) => {
  return prisma.$transaction(async (tx) => {
    const code = input.code && !/^(?:BR)-\d+$/i.test(input.code.trim()) ? input.code.trim().toUpperCase() : await generateNextBranchCode(tx);
    await assertCodeFree(tx, code);

    // New branches start with ZERO opening float and tax disabled until explicitly configured.
    const branch = await tx.branch.create({
      data: {
        name:     input.name,
        code,
        address:  input.address || 'Address Pending',
        city:     input.city || 'Lahore',
        phone:    input.phone || '+92 (42) 0000-000',
        email:    input.email || null,
        timezone: input.timezone || 'Asia/Karachi',
        currency: input.currency || 'PKR',
        taxRegistrationNumber: input.taxRegistrationNumber || null,
        taxAuthority:          input.taxAuthority || null,
        logoUrl:               input.logoUrl || null,
        taxEnabled:       false,
        taxRate:          0,
        openingCashFloat: 0,
      },
    });

    await auditLog(tx, {
      userId: actor.id, userName: actor.name, action: 'BRANCH_CREATED', entity: 'Branch',
      entityId: branch.id, branchId: branch.id, after: branch,
    });
    return (await toDTOs([branch], tx))[0];
  });
};

export const updateBranch = async (id, input, actor) => {
  if (actor && actor.role !== 'SUPER_ADMIN' && actor.branchId !== id) {
    throw forbidden('FORBIDDEN', 'Access Denied: You do not have permission to modify other branches.');
  }

  if (input.isActive === false) {
    // Deactivation must go through the blocker check.
    await deactivateBranch(id, actor);
  }

  return prisma.$transaction(async (tx) => {
    const existing = await getOrThrow(tx, id);
    if (input.code) await assertCodeFree(tx, input.code, id);

    const data = {};
    for (const f of ['name', 'code', 'address', 'city', 'phone', 'timezone']) {
      if (input[f]) data[f] = input[f];
    }
    if (input.email !== undefined) data.email = input.email || null;
    if (input.taxRegistrationNumber !== undefined) data.taxRegistrationNumber = input.taxRegistrationNumber || null;
    if (input.taxAuthority !== undefined) data.taxAuthority = input.taxAuthority || null;
    if (input.logoUrl !== undefined) {
      data.logoUrl = (input.logoUrl && typeof input.logoUrl === 'string' && input.logoUrl.trim().length > 0)
        ? input.logoUrl.trim()
        : null;
    }
    if (input.isActive === true) data.isActive = true;

    const branch = await tx.branch.update({ where: { id }, data });
    await auditLog(tx, {
      userId: actor.id, userName: actor.name,
      action: input.isActive === true && !existing.isActive ? 'BRANCH_REACTIVATED' : 'BRANCH_UPDATED',
      entity: 'Branch', entityId: id, branchId: id, before: existing, after: branch,
    });
    return (await toDTOs([branch], tx))[0];
  });
};

export const assignBranchAdmin = async (branchId, adminUserId, actor, credentials = {}) => {
  return prisma.$transaction(async (tx) => {
    const branch = await getOrThrow(tx, branchId);
    const user = await tx.user.findUnique({ where: { id: adminUserId } });
    if (!user) throw notFound('USER_NOT_FOUND', `Administrator '${adminUserId}' not found.`);
    if (user.role !== 'ADMIN') throw badRequest('NOT_ADMIN', `User '${user.name}' does not have the ADMIN role.`);
    if (!user.isActive) throw badRequest('USER_INACTIVE', `Cannot assign inactive administrator '${user.name}' to a branch.`);

    let assignedUser = user;
    // A login belongs to one branch. Additional branches get independent accounts.
    const otherAssignment = user.branchId && user.branchId !== branchId
      || await tx.branch.findFirst({ where: { assignedAdminId: user.id, NOT: { id: branchId } } });
    if (otherAssignment) {
      const input = assignAdminSchema.safeParse({ adminUserId, email: credentials.email, password: credentials.password });
      if (!input.success || !input.data.email || !input.data.password) {
        throw badRequest('BRANCH_CREDENTIALS_REQUIRED', 'A valid new login email and password (6–72 characters) are required for this branch.');
      }
      const { email, password } = input.data;
      if (await tx.user.findUnique({ where: { email } })) {
        throw conflict('EMAIL_TAKEN', 'This login email is already registered. Use a new email for this branch.');
      }
      assignedUser = await tx.user.create({ data: {
        name: user.name, role: 'ADMIN', branchId, email,
        passwordHash: await hashPassword(password),
        title: user.title, phone: user.phone, avatarUrl: user.avatarUrl,
      } });
    } else if (user.branchId !== branchId) {
      await tx.user.update({ where: { id: user.id }, data: { branchId } });
    }

    const updated = await tx.branch.update({
      where: { id: branchId },
      data: { assignedAdminId: assignedUser.id },
    });

    await auditLog(tx, {
      userId: actor.id, userName: actor.name, action: 'BRANCH_ADMIN_ASSIGNED', entity: 'Branch',
      entityId: branchId, branchId, before: { assignedAdminId: branch.assignedAdminId },
      after: { assignedAdminId: assignedUser.id, adminName: user.name },
    });
    return (await toDTOs([updated], tx))[0];
  });
};

export const unassignBranchAdmin = async (branchId, adminUserId, actor) => {
  return prisma.$transaction(async (tx) => {
    const branch = await getOrThrow(tx, branchId);
    const user = await tx.user.findUnique({ where: { id: adminUserId } });
    if (!user) throw notFound('USER_NOT_FOUND', `Administrator '${adminUserId}' not found.`);

    if (user.branchId === branchId) {
      await tx.user.update({
        where: { id: user.id },
        data: { branchId: null },
      });
    }

    let nextAdminId = branch.assignedAdminId;
    if (branch.assignedAdminId === user.id) {
      const remainingAdmin = await tx.user.findFirst({
        where: { branchId, role: 'ADMIN', isActive: true, NOT: { id: user.id } },
      });
      nextAdminId = remainingAdmin ? remainingAdmin.id : null;
      await tx.branch.update({
        where: { id: branchId },
        data: { assignedAdminId: nextAdminId },
      });
    }

    await auditLog(tx, {
      userId: actor.id, userName: actor.name, action: 'BRANCH_ADMIN_UNASSIGNED', entity: 'Branch',
      entityId: branchId, branchId, before: { assignedAdminId: branch.assignedAdminId },
      after: { assignedAdminId: nextAdminId, unassignedUser: user.name },
    });

    const refreshed = await tx.branch.findUnique({ where: { id: branchId } });
    return (await toDTOs([refreshed], tx))[0];
  });
};

/** Everything that must be closed/moved before a branch can be deactivated. */
export const checkDeactivationBlockers = async (id, tx = prisma) => {
  await getOrThrow(tx, id);
  const blockers = [];

  const activeUsers = await tx.user.findMany({ where: { branchId: id, isActive: true }, select: { name: true } });
  if (activeUsers.length) {
    blockers.push(
      `Branch has ${activeUsers.length} active login account(s) (${activeUsers.map((u) => u.name).join(', ')}). Deactivate or reassign them first.`
    );
  }

  const activeStaff = await tx.staff.count({ where: { branchId: id, isActive: true } });
  if (activeStaff) blockers.push(`Branch has ${activeStaff} active staff member(s). Deactivate or transfer them first.`);

  // Cash drawers (not the vault) still holding cash: expected cash = Σ IN − Σ OUT.
  const openDrawers = await tx.cashDrawer.findMany({
    where: { branchId: id, kind: 'DRAWER', status: { not: 'SETTLED' } }, select: { id: true },
  });
  if (openDrawers.length) {
    const sums = await tx.drawerMovement.groupBy({
      by: ['direction'],
      where: { drawerId: { in: openDrawers.map((d) => d.id) } },
      _sum: { amount: true },
    });
    const inSum = sums.find((s) => s.direction === 'IN')?._sum.amount ?? 0;
    const outSum = sums.find((s) => s.direction === 'OUT')?._sum.amount ?? 0;
    const total = toDec(inSum).minus(toDec(outSum));
    if (total.greaterThan(0)) {
      blockers.push(
        `Branch holds PKR ${total.toNumber().toLocaleString('en-PK')} in active cash drawers. Perform shift close & custody transfer first.`
      );
    }
  }

  const pendingSettlements = await tx.settlement.count({ where: { branchId: id, status: 'SUBMITTED' } });
  if (pendingSettlements) blockers.push(`Branch has ${pendingSettlements} cash settlement(s) awaiting verification.`);

  return { canDeactivate: blockers.length === 0, blockers };
};

export const deactivateBranch = async (id, actor) => {
  if (actor.role !== 'SUPER_ADMIN') {
    throw forbidden('FORBIDDEN', 'Access Denied: Only Super Administrators can deactivate salon branches.');
  }
  return prisma.$transaction(async (tx) => {
    const { canDeactivate, blockers } = await checkDeactivationBlockers(id, tx);
    if (!canDeactivate) {
      throw conflict('BRANCH_HAS_BLOCKERS', `Cannot deactivate branch due to active dependencies:\n• ${blockers.join('\n• ')}`, blockers);
    }
    const branch = await tx.branch.update({ where: { id }, data: { isActive: false } });
    await auditLog(tx, {
      userId: actor.id, userName: actor.name, action: 'BRANCH_DEACTIVATED', entity: 'Branch', entityId: id, branchId: id,
    });
    return { success: true, message: `Branch '${branch.name}' has been deactivated.` };
  });
};

export const deleteBranch = async (id, actor) => {
  if (actor.role !== 'SUPER_ADMIN') {
    throw forbidden('FORBIDDEN', 'Access Denied: Only Super Administrators can delete salon branches.');
  }

  return prisma.$transaction(async (tx) => {
    const totalBranches = await tx.branch.count();
    if (totalBranches <= 1) {
      throw badRequest('CANNOT_DELETE_LAST_BRANCH', 'Cannot delete the only remaining branch in the system.');
    }

    const branch = await getOrThrow(tx, id);

    // 1. Unassign users linked to this branch
    await tx.user.updateMany({ where: { branchId: id }, data: { branchId: null } });

    // 2. Refunds & Invoices
    await tx.refundLine.deleteMany({ where: { refund: { invoice: { branchId: id } } } }).catch(() => {});
    await tx.invoiceRefund.deleteMany({ where: { invoice: { branchId: id } } }).catch(() => {});
    await tx.invoiceLineBatch.deleteMany({ where: { line: { invoice: { branchId: id } } } }).catch(() => {});
    await tx.invoiceLineComponent.deleteMany({ where: { line: { invoice: { branchId: id } } } }).catch(() => {});
    await tx.invoiceLine.deleteMany({ where: { invoice: { branchId: id } } }).catch(() => {});
    await tx.invoicePayment.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.commissionEvent.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.invoice.deleteMany({ where: { branchId: id } }).catch(() => {});

    // 3. Appointments
    await tx.appointmentPackageComponent.deleteMany({ where: { appointmentItem: { appointment: { branchId: id } } } }).catch(() => {});
    await tx.appointmentItem.deleteMany({ where: { appointment: { branchId: id } } }).catch(() => {});
    await tx.appointmentReschedule.deleteMany({ where: { appointment: { branchId: id } } }).catch(() => {});
    await tx.appointment.deleteMany({ where: { branchId: id } }).catch(() => {});

    // 4. Tips & Commissions
    await tx.tipPayout.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.tipAllocation.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.tipReceipt.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.commissionPayment.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.commissionStatement.deleteMany({ where: { run: { branchId: id } } }).catch(() => {});
    await tx.commissionRun.deleteMany({ where: { branchId: id } }).catch(() => {});

    // 5. Staff Loans & Payroll
    await tx.advanceRecovery.deleteMany({ where: { advance: { branchId: id } } }).catch(() => {});
    await tx.salaryAdvance.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.payrollAdjustment.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.payrollPayment.deleteMany({ where: { payslip: { run: { branchId: id } } } }).catch(() => {});
    await tx.payslip.deleteMany({ where: { run: { branchId: id } } }).catch(() => {});
    await tx.payrollRun.deleteMany({ where: { branchId: id } }).catch(() => {});

    // 6. Attendance & Overtime
    await tx.attendanceCorrection.deleteMany({ where: { record: { branchId: id } } }).catch(() => {});
    await tx.attendancePunch.deleteMany({ where: { record: { branchId: id } } }).catch(() => {});
    await tx.attendanceRecord.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.leaveRecord.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.overtimeRecord.deleteMany({ where: { branchId: id } }).catch(() => {});

    // 7. Inventory & Purchases
    await tx.stockSettlementLine.deleteMany({ where: { settlement: { branchId: id } } }).catch(() => {});
    await tx.stockSettlement.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.supplierReturnLine.deleteMany({ where: { return: { branchId: id } } }).catch(() => {});
    await tx.supplierReturn.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.purchaseLine.deleteMany({ where: { purchase: { branchId: id } } }).catch(() => {});
    await tx.purchase.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.supplierPayment.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.supplierLedger.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.supplier.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.stockMovement.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.inventoryBatch.deleteMany({ where: { branchId: id } }).catch(() => {});

    // 8. Expenses, Cash Drawers & Accounts
    await tx.expense.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.expenseCategory.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.cashVarianceAdjustment.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.settlement.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.cashTransfer.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.drawerMovement.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.cashDrawer.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.accountMovement.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.paymentAccount.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.taxRule.deleteMany({ where: { branchId: id } }).catch(() => {});

    // 9. Catalogue & Packages
    await tx.packageComponent.deleteMany({ where: { package: { branchId: id } } }).catch(() => {});
    await tx.package.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.service.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.serviceCategory.deleteMany({ where: { branchId: id } }).catch(() => {});

    // 10. Staff
    await tx.staffCompensationHistory.deleteMany({ where: { staff: { branchId: id } } }).catch(() => {});
    await tx.staffAllowance.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.staff.deleteMany({ where: { branchId: id } }).catch(() => {});

    // 11. Clients & Sequences
    await tx.client.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.auditEvent.deleteMany({ where: { branchId: id } }).catch(() => {});
    await tx.sequence.deleteMany({
      where: {
        OR: [
          { branchCode: branch.code },
          { branchCode: { startsWith: `${branch.code}:` } },
        ],
      },
    }).catch(() => {});

    // 12. Delete Branch itself
    await tx.branch.delete({ where: { id } });

    await auditLog(tx, {
      userId: actor.id,
      userName: actor.name,
      action: 'BRANCH_DELETED',
      entity: 'Branch',
      entityId: id,
      branchId: null,
      before: branch,
    });

    return { success: true, message: `Branch '${branch.name}' (${branch.code}) has been permanently deleted.` };
  });
};
