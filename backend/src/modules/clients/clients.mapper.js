// src/modules/clients/clients.mapper.js

import { opt, iso } from '../../lib/dto.js';

/**
 * @param {object} c Client row
 * @param {{ outstandingBalance?: number, totalVisits?: number, lastVisitDate?: string }} [stats]
 *        derived from invoices/appointments — never stored on the client
 */
export const toClientDTO = (c, stats = {}) => ({
  id:                 c.id,
  branchId:           c.branchId,
  name:               c.name,
  phone:              c.phone,
  email:              opt(c.email),
  loyaltyPoints:      c.loyaltyPoints,
  totalVisits:        stats.totalVisits ?? 0,
  lastVisitDate:      stats.lastVisitDate,
  source:             opt(c.source),
  sourceDetails:      opt(c.sourceDetails),
  outstandingBalance: stats.outstandingBalance ?? 0,
  isArchived:         c.isArchived,
  notes:              opt(c.notes),
  createdAt:          iso(c.createdAt)?.slice(0, 10),
});
