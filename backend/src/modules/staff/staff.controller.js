// src/modules/staff/staff.controller.js

import * as service from './staff.service.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { notFound } from '../../lib/AppError.js';

export const list = asyncHandler(async (req, res) => {
  res.json({ data: await service.listStaff(req.user, req.query) });
});

export const getOne = asyncHandler(async (req, res) => {
  const staff = await service.getStaff(req.user, req.params.id);
  if (!staff) throw notFound('STAFF_NOT_FOUND', `Employee '${req.params.id}' not found.`);
  res.json({ data: staff });
});

export const create = asyncHandler(async (req, res) => {
  res.status(201).json({ data: await service.createStaff(req.body, req.user) });
});

export const update = asyncHandler(async (req, res) => {
  res.json({ data: await service.updateStaff(req.params.id, req.body, req.user) });
});

export const deactivate = asyncHandler(async (req, res) => {
  res.json({ data: await service.deactivateStaff(req.params.id, req.user, req.body?.exitDate) });
});

export const portalAccess = asyncHandler(async (req, res) => {
  res.json({ data: await service.setPortalAccess(req.params.id, req.body, req.user) });
});
