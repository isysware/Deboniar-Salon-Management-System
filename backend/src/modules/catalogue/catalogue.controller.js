// src/modules/catalogue/catalogue.controller.js

import * as s from './catalogue.service.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { notFound } from '../../lib/AppError.js';

const send = (fn, status = 200) => asyncHandler(async (req, res) => {
  res.status(status).json({ data: await fn(req) });
});

export const listCategories = send((req) => s.listCategories(req.user, req.query.branchId));
export const createCategory = send((req) => s.createCategory(req.body, req.user), 201);

export const listServices  = send((req) => s.listServices(req.user, req.query.branchId));
export const getService    = send(async (req) => {
  const svc = await s.getService(req.user, req.params.id);
  if (!svc) throw notFound('SERVICE_NOT_FOUND', `Service '${req.params.id}' not found.`);
  return svc;
});
export const createService = send((req) => s.createService(req.body, req.user), 201);
export const bulkImportServices = send((req) => s.bulkImportServices(req.body, req.user));
export const updateService = send((req) => s.updateService(req.params.id, req.body, req.user));
export const toggleService = send((req) => s.toggleService(req.params.id, req.user));

export const listPackages  = send((req) => s.listPackages(req.user, req.query.branchId));
export const getPackage    = send(async (req) => {
  const p = await s.getPackage(req.user, req.params.id);
  if (!p) throw notFound('PACKAGE_NOT_FOUND', `Package '${req.params.id}' not found.`);
  return p;
});
export const createPackage = send((req) => s.createPackage(req.body, req.user), 201);
export const bulkImportPackages = send((req) => s.bulkImportPackages(req.body, req.user));
export const updatePackage = send((req) => s.updatePackage(req.params.id, req.body, req.user));
export const togglePackage = send((req) => s.togglePackage(req.params.id, req.user));

