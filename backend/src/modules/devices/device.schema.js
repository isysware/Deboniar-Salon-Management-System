// src/modules/devices/device.schema.js
// Zod schemas for Device and Hardware Integration module.

import { z } from 'zod';

export const deviceTypeEnum = z.enum([
  'BIOMETRIC_ATTENDANCE',
  'POS_PRINTER',
  'BARCODE_SCANNER',
  'PAYMENT_TERMINAL',
  'CASH_DRAWER',
]);

export const connectionTypeEnum = z.enum([
  'ETHERNET_LAN',
  'WIFI',
  'USB',
  'SERIAL_COM',
  'BLUETOOTH',
  'CLOUD_API',
]);

export const deviceStatusEnum = z.enum([
  'ONLINE',
  'OFFLINE',
  'SYNCING',
  'ERROR',
]);

export const deviceQuerySchema = z.object({
  branchId:   z.string().optional(),
  deviceType: deviceTypeEnum.optional(),
  status:     deviceStatusEnum.optional(),
  search:     z.string().trim().optional(),
}).passthrough();

export const createDeviceSchema = z.object({
  branchId:         z.string().optional(),
  name:             z.string().trim().min(1, 'Device name is required.').max(100),
  deviceType:       deviceTypeEnum,
  brand:            z.string().trim().min(1, 'Device brand or manufacturer is required.').max(100),
  model:            z.string().trim().min(1, 'Device model is required.').max(100),
  serialNumber:     z.string().trim().max(100).optional().nullable(),
  connectionType:   connectionTypeEnum.default('ETHERNET_LAN'),
  ipAddress:        z.string().trim().max(45).optional().nullable(),
  port:             z.coerce.number().int().min(1).max(65535).optional().nullable(),
  macAddress:       z.string().trim().max(30).optional().nullable(),
  baudRate:         z.coerce.number().int().optional().nullable(),
  communicationKey: z.string().trim().max(100).optional().nullable(),
  isActive:         z.boolean().optional().default(true),
  config:           z.record(z.any()).optional().nullable(),
});

export const updateDeviceSchema = z.object({
  name:             z.string().trim().min(1).max(100).optional(),
  deviceType:       deviceTypeEnum.optional(),
  brand:            z.string().trim().min(1).max(100).optional(),
  model:            z.string().trim().min(1).max(100).optional(),
  serialNumber:     z.string().trim().max(100).nullable().optional(),
  connectionType:   connectionTypeEnum.optional(),
  ipAddress:        z.string().trim().max(45).nullable().optional(),
  port:             z.coerce.number().int().min(1).max(65535).nullable().optional(),
  macAddress:       z.string().trim().max(30).nullable().optional(),
  baudRate:         z.coerce.number().int().nullable().optional(),
  communicationKey: z.string().trim().max(100).nullable().optional(),
  status:           deviceStatusEnum.optional(),
  isActive:         z.boolean().optional(),
  config:           z.record(z.any()).nullable().optional(),
}).passthrough();

export const testConnectionSchema = z.object({
  timeoutMs: z.coerce.number().int().min(500).max(30000).optional().default(3000),
  ipAddress: z.string().trim().max(45).optional(),
  port:      z.coerce.number().int().min(1).max(65535).optional(),
}).passthrough();

export const syncDeviceSchema = z.object({
  startDate: z.string().optional(),
  endDate:   z.string().optional(),
  limit:     z.coerce.number().int().min(1).max(1000).optional().default(500),
  autoCreatePunches: z.boolean().optional().default(true),
}).passthrough();
