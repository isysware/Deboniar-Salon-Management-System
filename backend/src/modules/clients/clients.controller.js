// src/modules/clients/clients.controller.js

import * as s from './clients.service.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { notFound } from '../../lib/AppError.js';

const send = (fn, status = 200) => asyncHandler(async (req, res) => {
  res.status(status).json({ data: await fn(req) });
});

export const list    = send((req) => s.listClients(req.user, req.query));
export const search  = send((req) => s.searchClients(req.user, req.query));
export const getOne  = send(async (req) => {
  const c = await s.getClient(req.user, req.params.id);
  if (!c) throw notFound('CLIENT_NOT_FOUND', `Client '${req.params.id}' not found.`);
  return c;
});
export const create  = send((req) => s.createClient(req.body, req.user), 201);
export const update  = send((req) => s.updateClient(req.params.id, req.body, req.user));
export const archive = send((req) => s.archiveClient(req.params.id, req.body.isArchived, req.user));
