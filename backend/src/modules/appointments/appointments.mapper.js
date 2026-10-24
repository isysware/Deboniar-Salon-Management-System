// src/modules/appointments/appointments.mapper.js
// Appointment row (+ items, components, reschedules) → frontend `Appointment` type.

import { num, opt, iso } from '../../lib/dto.js';
import { ymd } from '../../lib/dates.js';

const toComponentDTO = (c) => ({
  componentInstanceId:  c.componentInstanceId,
  serviceId:            c.serviceId,
  serviceCode:          c.serviceCode,
  serviceName:          c.serviceName,
  durationMinutes:      c.durationMinutes,
  allocationPercentage: num(c.allocationPercentage),
  staffId:              c.staffId,
  staffName:            c.staffName,
  startTime:            c.startTime,
  endTime:              c.endTime,
});

const toItemDTO = (it) => ({
  lineInstanceId:  it.lineInstanceId,
  type:            it.type,
  itemId:          it.itemId,
  code:            it.code,
  name:            it.name,
  durationMinutes: it.durationMinutes,
  unitPrice:       num(it.unitPrice),
  staffId:         it.staffId,
  staffName:       it.staffName,
  startTime:       it.startTime,
  endTime:         it.endTime,
  ...(it.type === 'PACKAGE'
    ? { packageComponents: [...(it.components ?? [])].sort((a, b) => a.sortOrder - b.sortOrder).map(toComponentDTO) }
    : {}),
});

/** @param {object} a Appointment with items.components and reschedules; @param {string} [branchName] */
export const toAppointmentDTO = (a, branchName) => {
  const items = [...(a.items ?? [])].sort((x, y) => x.sortOrder - y.sortOrder).map(toItemDTO);
  const first = items[0];
  return {
    id:                    a.id,
    appointmentNumber:     a.appointmentNumber,
    branchId:              a.branchId,
    branchName:            branchName ?? a.branch?.name,
    clientId:              opt(a.clientId),
    clientName:            a.clientName,
    clientPhone:           a.clientPhone,
    clientEmail:           opt(a.clientEmail),
    customerSource:        opt(a.customerSource),
    customerSourceDetails: opt(a.customerSourceDetails),
    date:                  ymd(a.date),
    startTime:             a.startTime,
    endTime:               a.endTime,
    durationMinutes:       a.durationMinutes,
    items,
    price:                 num(a.price),
    status:                a.status,
    billingStatus:         a.billingStatus,
    linkedInvoiceId:       opt(a.linkedInvoiceId),
    linkedInvoiceNumber:   opt(a.linkedInvoiceNumber),
    notes:                 opt(a.notes),

    // Legacy fields still read by dashboards/widgets
    serviceId:   first?.itemId,
    serviceName: items.map((i) => i.name).join(' + '),
    staffId:     first?.staffId,
    staffName:   first?.staffName,
    time:        a.startTime,

    createdByUserId:   opt(a.createdById),
    createdByName:     opt(a.createdByName),
    createdAt:         iso(a.createdAt),
    updatedByUserId:   opt(a.updatedById),
    updatedByName:     opt(a.updatedByName),
    updatedAt:         iso(a.updatedAt),
    confirmedByUserId: opt(a.confirmedById),
    confirmedByName:   opt(a.confirmedByName),
    confirmedAt:       iso(a.confirmedAt),
    cancelledByUserId: opt(a.cancelledById),
    cancelledByName:   opt(a.cancelledByName),
    cancelledAt:       iso(a.cancelledAt),
    cancelReason:      opt(a.cancelReason),
    rescheduleHistory: (a.reschedules ?? [])
      .sort((x, y) => new Date(x.at) - new Date(y.at))
      .map((r) => ({
        previousDate:        ymd(r.previousDate),
        previousStartTime:   r.previousStartTime,
        previousEndTime:     r.previousEndTime,
        newDate:             ymd(r.newDate),
        newStartTime:        r.newStartTime,
        newEndTime:          r.newEndTime,
        rescheduledByUserId: r.byUserId,
        rescheduledByName:   r.byName,
        rescheduledAt:       iso(r.at),
        reason:              opt(r.reason),
      })),
  };
};
