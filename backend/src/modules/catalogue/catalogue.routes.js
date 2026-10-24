// src/modules/catalogue/catalogue.routes.js
// Reads are open to every logged-in role (scoped to their branch); writes are admin-only.

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as v from './catalogue.schema.js';
import * as c from './catalogue.controller.js';

const ADMINS = ['SUPER_ADMIN', 'ADMIN'];

export const categoryRoutes = Router();
categoryRoutes.use(authenticate);
categoryRoutes.get('/',  validate(v.branchQuery, 'query'), c.listCategories);
categoryRoutes.post('/', authorize(...ADMINS), validate(v.createCategorySchema), c.createCategory);

export const serviceRoutes = Router();
serviceRoutes.use(authenticate);
serviceRoutes.get('/',            validate(v.branchQuery, 'query'), c.listServices);
serviceRoutes.post('/bulk-import', authorize(...ADMINS), validate(v.bulkImportServicesSchema), c.bulkImportServices);
serviceRoutes.get('/:id',         c.getService);
serviceRoutes.post('/',           authorize(...ADMINS), validate(v.createServiceSchema), c.createService);
serviceRoutes.put('/:id',         authorize(...ADMINS), validate(v.updateServiceSchema), c.updateService);
serviceRoutes.post('/:id/toggle', authorize(...ADMINS), c.toggleService);

export const packageRoutes = Router();
packageRoutes.use(authenticate);
packageRoutes.get('/',            validate(v.branchQuery, 'query'), c.listPackages);
packageRoutes.post('/bulk-import', authorize(...ADMINS), validate(v.bulkImportPackagesSchema), c.bulkImportPackages);
packageRoutes.get('/:id',         c.getPackage);
packageRoutes.post('/',           authorize(...ADMINS), validate(v.createPackageSchema), c.createPackage);
packageRoutes.put('/:id',         authorize(...ADMINS), validate(v.updatePackageSchema), c.updatePackage);
packageRoutes.post('/:id/toggle', authorize(...ADMINS), c.togglePackage);
