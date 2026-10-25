// src/modules/branches/branches.controller.js

import * as service from './branches.service.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { notFound } from '../../lib/AppError.js';

export const list = asyncHandler(async (req, res) => {
  res.json({ data: await service.listBranches(req.user) });
});

export const getOne = asyncHandler(async (req, res) => {
  const branch = await service.getBranch(req.params.id, req.user);
  if (!branch) throw notFound('BRANCH_NOT_FOUND', `Branch '${req.params.id}' not found.`);
  res.json({ data: branch });
});

export const create = asyncHandler(async (req, res) => {
  res.status(201).json({ data: await service.createBranch(req.body, req.user) });
});

export const update = asyncHandler(async (req, res) => {
  res.json({ data: await service.updateBranch(req.params.id, req.body, req.user) });
});

export const assignAdmin = asyncHandler(async (req, res) => {
  res.json({ data: await service.assignBranchAdmin(req.params.id, req.body.adminUserId, req.user, req.body) });
});

export const unassignAdmin = asyncHandler(async (req, res) => {
  res.json({ data: await service.unassignBranchAdmin(req.params.id, req.body.adminUserId, req.user) });
});

export const blockers = asyncHandler(async (req, res) => {
  res.json({ data: await service.checkDeactivationBlockers(req.params.id) });
});

export const deactivate = asyncHandler(async (req, res) => {
  res.json({ data: await service.deactivateBranch(req.params.id, req.user) });
});

export const remove = asyncHandler(async (req, res) => {
  res.json({ data: await service.deleteBranch(req.params.id, req.user) });
});

