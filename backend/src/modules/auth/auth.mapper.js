// src/modules/auth/auth.mapper.js
// Maps DB User rows to the Session/User DTO shapes the frontend expects (src/types/auth.ts).

import { opt, iso } from '../../lib/dto.js';

/**
 * Maps a User row (optionally with `branch` included) to the frontend User type.
 * SUPER_ADMIN users have branchId 'ALL' on the frontend. Never exposes passwordHash.
 */
export const toUserDTO = (user) => {
  const isSuper = user.role === 'SUPER_ADMIN';
  return {
    id:         user.id,
    name:       user.name,
    email:      user.email,
    role:       user.role,
    branchId:   isSuper ? (user.branchId ?? 'ALL') : user.branchId,
    branchName: isSuper && !user.branchId ? 'All Branches (Consolidated)' : opt(user.branch?.name),
    staffId:    opt(user.staffId),
    title:      user.title ?? '',
    phone:      opt(user.phone),
    avatarUrl:  opt(user.avatarUrl),
    isActive:   user.isActive,
    createdAt:  iso(user.createdAt)?.slice(0, 10),
  };
};

/** Session shape returned on login (matches frontend `Session`). */
export const toSessionDTO = (user, accessToken) => ({
  user:           toUserDTO(user),
  token:          accessToken,
  loginTime:      new Date().toISOString(),
  activeBranchId: user.role === 'SUPER_ADMIN' ? 'ALL' : user.branchId,
});
