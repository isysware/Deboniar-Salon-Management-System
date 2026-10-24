// src/modules/appointments/appointments.controller.js

import * as s from './appointments.service.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { notFound } from '../../lib/AppError.js';

const send = (fn, status = 200) => asyncHandler(async (req, res) => {
  res.status(status).json({ data: await fn(req) });
});

export const list   = send((req) => s.listAppointments(req.user, req.query));
export const queue  = send((req) => s.getQueue(req.user, req.query));
export const getOne = send(async (req) => {
  const a = await s.getAppointment(req.user, req.params.id);
  if (!a) throw notFound('APPOINTMENT_NOT_FOUND', `Appointment '${req.params.id}' not found.`);
  return a;
});
export const create       = send((req) => s.createAppointment(req.body, req.user), 201);
export const update       = send((req) => s.updateAppointment(req.params.id, req.body, req.user));
export const updateStatus = send((req) => s.updateStatus(req.params.id, req.body, req.user));
export const reschedule   = send((req) => s.reschedule(req.params.id, req.body, req.user));
export const confirmation = send((req) => s.confirmationMessage(req.user, req.params.id));
