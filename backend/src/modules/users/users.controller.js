// src/modules/users/users.controller.js

import * as service from './users.service.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { notFound } from '../../lib/AppError.js';

export const list = asyncHandler(async (req, res) => {
  res.json({ data: await service.listUsers(req.user, req.query.branchId) });
});

export const getOne = asyncHandler(async (req, res) => {
  const user = await service.getUser(req.user, req.params.id);
  if (!user) throw notFound('USER_NOT_FOUND', `User '${req.params.id}' not found.`);
  res.json({ data: user });
});

export const create = asyncHandler(async (req, res) => {
  res.status(201).json({ data: await service.createUser(req.body, req.user) });
});

export const update = asyncHandler(async (req, res) => {
  res.json({ data: await service.updateUser(req.params.id, req.body, req.user) });
});

export const deactivate = asyncHandler(async (req, res) => {
  res.json({ data: await service.deactivateUser(req.params.id, req.user) });
});

export const reactivate = asyncHandler(async (req, res) => {
  res.json({ data: await service.reactivateUser(req.params.id, req.user) });
});

export const remove = asyncHandler(async (req, res) => {
  res.json({ data: await service.deleteUser(req.params.id, req.user) });
});

export const resetPassword = asyncHandler(async (req, res) => {
  res.json({ data: await service.resetUserPassword(req.params.id, req.body?.password, req.user) });
});
