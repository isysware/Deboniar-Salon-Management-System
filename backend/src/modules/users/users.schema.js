// src/modules/users/users.schema.js

import { z } from 'zod';

const role = z.enum(['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'STAFF']);

export const listUsersQuery = z.object({ branchId: z.string().optional() });

export const createUserSchema = z.object({
  name:     z.string().trim().min(1, 'Name is required'),
  email:    z.string().trim().toLowerCase().email('Invalid email address'),
  role,
  branchId: z.string().optional(),
  staffId:  z.string().optional(),
  title:    z.string().trim().default(''),
  password: z.string().trim().min(6, 'Password must be at least 6 characters').optional(),
  phone:    z.string().trim().optional(),
});

// Role and branch are not editable here (same as the mock); use assign-admin / new account instead.
export const updateUserSchema = z.object({
  name:     z.string().trim().min(1).optional(),
  email:    z.string().trim().toLowerCase().email('Invalid email address').optional(),
  phone:    z.string().trim().nullable().optional(),
  title:    z.string().trim().optional(),
  isActive: z.boolean().optional(),
  role:     role.optional(),
  branchId: z.string().nullable().optional(),
}).passthrough();

export const resetPasswordSchema = z.object({
  password: z.string().trim().min(6, 'Password must be at least 6 characters').optional(),
});
