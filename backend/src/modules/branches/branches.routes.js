// src/modules/branches/branches.routes.js

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { createBranchSchema, updateBranchSchema, assignAdminSchema } from './branches.schema.js';
import * as c from './branches.controller.js';

const router = Router();
router.use(authenticate);

router.get('/',    c.list);
router.get('/:id', c.getOne);

router.post('/',                         authorize('SUPER_ADMIN'), validate(createBranchSchema), c.create);
router.put('/:id',                       authorize('SUPER_ADMIN', 'ADMIN'), validate(updateBranchSchema), c.update);
router.post('/:id/assign-admin',         authorize('SUPER_ADMIN'), validate(assignAdminSchema),  c.assignAdmin);
router.post('/:id/unassign-admin',       authorize('SUPER_ADMIN'), c.unassignAdmin);
router.get('/:id/deactivation-blockers', authorize('SUPER_ADMIN'), c.blockers);
router.post('/:id/deactivate',           authorize('SUPER_ADMIN'), c.deactivate);
router.delete('/:id',                     authorize('SUPER_ADMIN'), c.remove);

export default router;
