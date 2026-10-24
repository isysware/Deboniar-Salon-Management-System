// src/modules/devices/device.routes.js
// Express routes for hardware device integration module.

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as v from './device.schema.js';
import * as c from './device.controller.js';

const ADMINS = ['SUPER_ADMIN', 'ADMIN'];
const BACK_OFFICE = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];

const router = Router();

router.use(authenticate);

router.get('/', authorize(...BACK_OFFICE), validate(v.deviceQuerySchema, 'query'), c.listDevices);
router.post('/', authorize(...ADMINS), validate(v.createDeviceSchema), c.createDevice);

router.get('/:id', authorize(...BACK_OFFICE), c.getDevice);
router.put('/:id', authorize(...ADMINS), validate(v.updateDeviceSchema), c.updateDevice);
router.delete('/:id', authorize(...ADMINS), c.deleteDevice);

router.post('/:id/toggle', authorize(...ADMINS), c.toggleDeviceStatus);
router.post('/:id/test-connection', authorize(...ADMINS), validate(v.testConnectionSchema), c.testDeviceConnection);
router.post('/:id/sync', authorize(...ADMINS), validate(v.syncDeviceSchema), c.syncDevice);
router.get('/:id/logs', authorize(...BACK_OFFICE), c.getDeviceLogs);

export default router;
