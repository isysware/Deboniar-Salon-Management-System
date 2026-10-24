// src/modules/appointments/appointments.routes.js

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as v from './appointments.schema.js';
import * as c from './appointments.controller.js';

const ADMINS = ['SUPER_ADMIN', 'ADMIN'];

const router = Router();
router.use(authenticate);

router.get('/',       authorize(...ADMINS), validate(v.listQuery, 'query'), c.list);
router.get('/queue',  authorize(...ADMINS, 'ACCOUNTANT'), validate(v.queueQuery, 'query'), c.queue);
router.get('/:id',    authorize(...ADMINS, 'ACCOUNTANT'), c.getOne);
router.get('/:id/confirmation-message', authorize(...ADMINS), c.confirmation);

router.post('/',                authorize(...ADMINS), validate(v.createSchema), c.create);
router.put('/:id',              authorize(...ADMINS), validate(v.updateSchema), c.update);
router.patch('/:id/status',     authorize(...ADMINS), validate(v.statusSchema), c.updateStatus);
router.post('/:id/reschedule',  authorize(...ADMINS), validate(v.rescheduleSchema), c.reschedule);

export default router;
