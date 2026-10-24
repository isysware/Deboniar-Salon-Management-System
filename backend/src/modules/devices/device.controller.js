// src/modules/devices/device.controller.js
// Controller actions for Device Integration.

import * as s from './device.service.js';
import { asyncHandler } from '../../lib/asyncHandler.js';

const send = (fn, status = 200) => asyncHandler(async (req, res) => {
  res.status(status).json({ data: await fn(req) });
});

export const listDevices = send((req) => s.listDevices(req.user, req.query));

export const getDevice = send((req) => s.getDeviceById(req.params.id, req.user));

export const createDevice = send((req) => s.createDevice(req.body, req.user), 201);

export const updateDevice = send((req) => s.updateDevice(req.params.id, req.body, req.user));

export const toggleDeviceStatus = send((req) => s.toggleDeviceStatus(req.params.id, req.user));

export const deleteDevice = send((req) => s.deleteDevice(req.params.id, req.user));

export const testDeviceConnection = send((req) => s.testDeviceConnection(req.params.id, req.body, req.user));

export const syncDevice = send((req) => s.syncDevice(req.params.id, req.body, req.user));

export const getDeviceLogs = send((req) => s.getDeviceLogs(req.params.id, req.user, req.query.limit));
