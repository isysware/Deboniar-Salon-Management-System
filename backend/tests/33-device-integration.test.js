import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { as, app } from './helpers.js';

describe('Step 23 · Device Integration API', () => {
  let branchId;
  let testDeviceId;

  beforeAll(async () => {
    // Get Gulberg branch ID
    const branchesRes = await as('super').get('/branches');
    expect(branchesRes.status).toBe(200);
    expect(branchesRes.body.data.length).toBeGreaterThan(0);
    branchId = branchesRes.body.data[0].id;
  });

  it('1. GET /devices returns array of configured hardware devices', async () => {
    const res = await as('admin').get(`/devices?branchId=${branchId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('2. POST /devices registers a new biometric terminal', async () => {
    const payload = {
      branchId,
      name: 'Gulberg Main Gate ZKTeco',
      deviceType: 'BIOMETRIC_ATTENDANCE',
      brand: 'ZKTeco',
      model: 'iClock 880',
      serialNumber: 'ZK-TEST-9001',
      connectionType: 'ETHERNET_LAN',
      ipAddress: '192.168.1.205',
      port: 4370,
      communicationKey: '0',
      isActive: true,
      config: { autoPush: true },
    };

    const res = await as('admin').post('/devices', payload);
    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.name).toBe(payload.name);
    expect(res.body.data.deviceType).toBe('BIOMETRIC_ATTENDANCE');
    expect(res.body.data.port).toBe(4370);
    testDeviceId = res.body.data.id;
  });

  it('3. GET /devices/:id retrieves the registered device details', async () => {
    const res = await as('admin').get(`/devices/${testDeviceId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(testDeviceId);
    expect(res.body.data.brand).toBe('ZKTeco');
    expect(res.body.data.serialNumber).toBe('ZK-TEST-9001');
  });

  it('4. PUT /devices/:id updates device configuration', async () => {
    const res = await as('admin').put(`/devices/${testDeviceId}`, {
      name: 'Gulberg Main Gate ZKTeco (Updated)',
      port: 4371,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Gulberg Main Gate ZKTeco (Updated)');
    expect(res.body.data.port).toBe(4371);
  });

  it('5. POST /devices/:id/test-connection executes socket ping diagnostic', async () => {
    const res = await as('admin').post(`/devices/${testDeviceId}/test-connection`, {
      timeoutMs: 1000,
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(typeof res.body.data.connected).toBe('boolean');
    expect(res.body.data.diagnostics).toBeDefined();
  });

  it('6. POST /devices/:id/sync triggers device sync and buffer update', async () => {
    const res = await as('admin').post(`/devices/${testDeviceId}/sync`, {});
    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);
    expect(res.body.data.status).toBe('ONLINE');
    expect(res.body.data.message).toContain('Biometric sync completed');
  });

  it('7. GET /devices/:id/logs returns device diagnostic audit events', async () => {
    const res = await as('admin').get(`/devices/${testDeviceId}/logs`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('8. POST /devices/:id/toggle toggles device status', async () => {
    const res = await as('admin').post(`/devices/${testDeviceId}/toggle`);
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);

    // Toggle back
    const res2 = await as('admin').post(`/devices/${testDeviceId}/toggle`);
    expect(res2.status).toBe(200);
    expect(res2.body.data.isActive).toBe(true);
  });

  it('9. POST /devices rejects unauthenticated requests', async () => {
    const res = await request(app).post('/api/v1/devices').send({
      branchId,
      name: 'Unauth Device',
      deviceType: 'POS_PRINTER',
      brand: 'Generic',
      model: 'X1',
    });
    expect(res.status).toBe(401);
  });

  it('10. DELETE /devices/:id removes device from branch registry', async () => {
    const res = await as('admin').delete(`/devices/${testDeviceId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);

    const getRes = await as('admin').get(`/devices/${testDeviceId}`);
    expect(getRes.status).toBe(404);
  });
});
