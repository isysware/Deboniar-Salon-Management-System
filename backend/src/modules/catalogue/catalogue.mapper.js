// src/modules/catalogue/catalogue.mapper.js

import { num, opt } from '../../lib/dto.js';

export const toCategoryDTO = (c) => ({ id: c.id, branchId: c.branchId, name: c.name, isActive: c.isActive });

/** Service row (with `category`) → frontend `ServiceItem` (category is the category NAME). */
export const toServiceDTO = (s) => ({
  id:                s.id,
  branchId:          s.branchId,
  code:              s.code,
  name:              s.name,
  category:          s.category?.name ?? 'General',
  categoryId:        s.categoryId,
  durationMinutes:   s.durationMinutes,
  price:             num(s.price),
  description:       opt(s.description),
  taxTreatment:      s.taxTreatment,
  specificTaxRuleId: opt(s.specificTaxRuleId),
  isActive:          s.isActive,
  taxExempt:         s.taxTreatment === 'EXEMPT',
});

/** Package row (with `components.service`) → frontend `PackageItem`. */
export const toPackageDTO = (p) => ({
  id:                p.id,
  branchId:          p.branchId,
  code:              p.code,
  name:              p.name,
  description:       opt(p.description),
  price:             num(p.price),
  components:        [...(p.components ?? [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({
      serviceId:            c.serviceId,
      serviceCode:          c.service?.code,
      serviceName:          c.service?.name,
      quantity:             c.quantity,
      allocationPercentage: num(c.allocationPercentage),
      unitPrice:            num(c.service?.price),
      durationMinutes:      c.service?.durationMinutes,
    })),
  taxTreatment:      p.taxTreatment,
  specificTaxRuleId: opt(p.specificTaxRuleId),
  isActive:          p.isActive,
});
