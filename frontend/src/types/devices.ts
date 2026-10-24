// src/types/devices.ts
// Hardware and Device Integration TypeScript interfaces.

export type DeviceType =
  | 'BIOMETRIC_ATTENDANCE'
  | 'POS_PRINTER'
  | 'BARCODE_SCANNER'
  | 'PAYMENT_TERMINAL'
  | 'CASH_DRAWER';

export type DeviceConnectionType =
  | 'ETHERNET_LAN'
  | 'WIFI'
  | 'USB'
  | 'SERIAL_COM'
  | 'BLUETOOTH'
  | 'CLOUD_API';

export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'ERROR';

export interface Device {
  id: string;
  branchId: string;
  branchName?: string;
  branchCode?: string;
  name: string;
  deviceType: DeviceType;
  brand: string;
  model: string;
  serialNumber?: string | null;
  connectionType: DeviceConnectionType;
  ipAddress?: string | null;
  port?: number | null;
  macAddress?: string | null;
  baudRate?: number | null;
  communicationKey?: string | null;
  status: DeviceStatus;
  isActive: boolean;
  lastPingAt?: string | null;
  lastSyncAt?: string | null;
  lastSyncStatus?: string | null;
  config?: Record<string, any> | null;
  logsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceLog {
  id: string;
  deviceId: string;
  branchId: string;
  eventType: string; // HEARTBEAT | PUNCH_SYNC | PRINT_JOB | TEST_PING | ERROR | CONFIG_UPDATE
  status: string;    // SUCCESS | FAILED | WARNING
  message: string;
  payload?: any;
  createdAt: string;
}

export interface CreateDeviceInput {
  branchId?: string;
  name: string;
  deviceType: DeviceType;
  brand: string;
  model: string;
  serialNumber?: string | null;
  connectionType?: DeviceConnectionType;
  ipAddress?: string | null;
  port?: number | null;
  macAddress?: string | null;
  baudRate?: number | null;
  communicationKey?: string | null;
  isActive?: boolean;
  config?: Record<string, any> | null;
}

export interface UpdateDeviceInput {
  name?: string;
  deviceType?: DeviceType;
  brand?: string;
  model?: string;
  serialNumber?: string | null;
  connectionType?: DeviceConnectionType;
  ipAddress?: string | null;
  port?: number | null;
  macAddress?: string | null;
  baudRate?: number | null;
  communicationKey?: string | null;
  status?: DeviceStatus;
  isActive?: boolean;
  config?: Record<string, any> | null;
}

export interface TestConnectionResult {
  connected: boolean;
  latencyMs: number;
  status: DeviceStatus;
  message: string;
  diagnostics?: Record<string, any>;
}

export interface SyncDeviceResult {
  success: boolean;
  deviceId: string;
  syncedAt: string;
  status: DeviceStatus;
  message: string;
  details?: Record<string, any>;
}

export interface DeviceMetrics {
  totalDevices: number;
  onlineDevices: number;
  biometricDevices: number;
  printerDevices: number;
}
