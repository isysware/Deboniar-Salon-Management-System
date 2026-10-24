// src/modules/auth/auth.schema.js
// Zod validation schemas for all auth endpoints.

import { z } from 'zod';

const portal = z.enum(['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'STAFF'], {
  message: 'Invalid portal. Must be SUPER_ADMIN, ADMIN, ACCOUNTANT, or STAFF',
});

// Frontend sends `identifier` (email or user id); `email` is accepted as an alias.
export const loginSchema = z
  .object({
    identifier: z.string().trim().min(1).optional(),
    email:      z.string().trim().min(1).optional(),
    password:   z.string().min(1, 'Password is required'),
    portal,
    rememberMe: z.boolean().optional(),
  })
  .refine((v) => v.identifier || v.email, { message: 'Login identifier is required', path: ['identifier'] })
  .transform((v) => ({
    identifier: (v.identifier || v.email).toLowerCase(),
    password:   v.password.trim(),
    portal:     v.portal,
  }));

export const forgotPasswordSchema = z
  .object({
    identifier: z.string().trim().min(1).optional(),
    email:      z.string().trim().min(1).optional(),
    portal:     portal.optional(),
  })
  .refine((v) => v.identifier || v.email, { message: 'Login identifier is required', path: ['identifier'] })
  .transform((v) => ({ identifier: (v.identifier || v.email).toLowerCase(), portal: v.portal }));

export const resetPasswordSchema = z.object({
  token:    z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});
