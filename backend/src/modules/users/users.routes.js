// src/modules/users/users.routes.js

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { createUserSchema, updateUserSchema, listUsersQuery, resetPasswordSchema } from './users.schema.js';
import * as c from './users.controller.js';

const router = Router();
router.use(authenticate, authorize('SUPER_ADMIN', 'ADMIN'));

router.get('/',                     validate(listUsersQuery, 'query'), c.list);
router.get('/:id',                  c.getOne);
router.post('/',                    validate(createUserSchema), c.create);
router.put('/:id',                  validate(updateUserSchema), c.update);
router.post('/:id/deactivate',      c.deactivate);
router.post('/:id/reactivate',        c.reactivate);
router.delete('/:id',                 c.remove);
router.post('/:id/reset-password',  validate(resetPasswordSchema), c.resetPassword);

export default router;
