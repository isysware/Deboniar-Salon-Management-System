// src/modules/clients/clients.schema.js

import { z } from 'zod';

export const customerSource = z.enum([
  'WALK_IN', 'REFERRAL', 'SOCIAL_MEDIA', 'OTHER', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'GOOGLE', 'WORD_OF_MOUTH', 'INFLUENCER', 'RETURNING',
]);

const optEmail = z.string().trim().toLowerCase().email('Invalid email address').optional().or(z.literal('').transform(() => undefined));

export const listClientsQuery = z.object({
  branchId:        z.string().optional(),
  search:          z.string().optional(),
  includeArchived: z.enum(['true', 'false']).optional(),
});

export const searchQuery = z.object({
  branchId: z.string().optional(),
  q:        z.string().default(''),
});

export const outstandingQuery = z.object({
  branchId: z.string().optional(),
  clientIdOrPhone: z.string().min(1),
});

export const createClientSchema = z.object({
  branchId:      z.string().optional(),
  name:          z.string().trim().min(1, 'Customer name is required.'),
  phone:         z.string().trim().min(1, 'Customer phone number is required.'),
  email:         optEmail,
  source:        customerSource.optional(),
  sourceDetails: z.string().trim().optional(),
  loyaltyPoints: z.number().int().min(0).optional(),
  notes:         z.string().trim().optional(),
}).passthrough();

export const updateClientSchema = z.object({
  name:          z.string().trim().min(1).optional(),
  phone:         z.string().trim().min(1).optional(),
  email:         z.string().trim().toLowerCase().optional(),
  source:        customerSource.optional(),
  sourceDetails: z.string().trim().optional(),
  notes:         z.string().trim().optional(),
}).passthrough();

export const archiveSchema = z.object({ isArchived: z.boolean() });
