// src/modules/branches/branches.mapper.js
// Branch row → frontend `Branch` type.

import { num, opt } from '../../lib/dto.js';

/** @param {object} b Branch row; @param {Array<object>|Map<string,string>} [admins] */
export const toBranchDTO = (b, admins = []) => {
  let adminList = [];
  if (Array.isArray(admins)) {
    adminList = admins;
  } else if (admins instanceof Map && b.assignedAdminId) {
    const name = admins.get(b.assignedAdminId);
    if (name) adminList = [{ id: b.assignedAdminId, name }];
  }

  const primaryAdmin = adminList[0];
  const adminNames = adminList.map((a) => a.name).filter(Boolean);

  return {
    id:               b.id,
    name:             b.name,
    code:             b.code,
    address:          b.address,
    city:             b.city,
    phone:            b.phone,
    email:            opt(b.email),
    timezone:         b.timezone,
    taxRate:          num(b.taxRate),
    taxEnabled:       b.taxEnabled,
    defaultTaxRuleId: opt(b.defaultTaxRuleId),
    currency:         b.currency,
    openingCashFloat: num(b.openingCashFloat),
    isActive:         b.isActive,
    assignedAdminId:  primaryAdmin ? primaryAdmin.id : opt(b.assignedAdminId),
    assignedAdminName: adminNames.length > 0 ? adminNames.join(', ') : undefined,
    assignedAdmins:   adminList.map((a) => ({ id: a.id, name: a.name, email: a.email })),
    taxRegistrationNumber: opt(b.taxRegistrationNumber),
    taxAuthority:          opt(b.taxAuthority),
    logoUrl:               opt(b.logoUrl),
  };
};
