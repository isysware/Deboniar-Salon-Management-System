import {
  StaffMember,
  Invoice,
  CommissionStatementRecord,
  CommissionAttributionLine,
} from '../types/salon';
import { roundCurrency } from './taxCalculations';

export interface EvaluateStaffCommissionResult {
  statement: Omit<CommissionStatementRecord, 'id' | 'commissionRunId' | 'statementNumber' | 'status' | 'payments'>;
  isEligible: boolean;
  consumedAttributionIds: string[];
}

/**
 * Checks whether a compensation type is eligible for service commission.
 */
export function isCompensationEligibleForCommission(compensationType: string): boolean {
  return (
    compensationType === 'MONTHLY_PLUS_COMMISSION' ||
    compensationType === 'DAILY_PLUS_COMMISSION' ||
    compensationType === 'COMMISSION_ONLY'
  );
}

/**
 * Evaluates commission statements for a single staff member across completed POS invoices.
 */
export function evaluateStaffCommission(
  staff: StaffMember,
  startDate: string, // YYYY-MM-DD
  endDate: string, // YYYY-MM-DD
  invoices: Invoice[],
  consumedLineItemIds: Set<string> = new Set()
): EvaluateStaffCommissionResult {
  const isEligible = isCompensationEligibleForCommission(staff.compensationType);

  if (!isEligible) {
    return {
      isEligible: false,
      consumedAttributionIds: [],
      statement: {
        staffId: staff.id,
        staffName: staff.name,
        employeeCode: staff.employeeCode,
        designation: staff.designation || staff.roleTitle,
        branchId: staff.branchId,
        startDate,
        endDate,
        compensationType: staff.compensationType,
        commissionRatePercent: staff.commissionRate || 0,
        servicesCompletedCount: 0,
        attributedNetSales: 0,
        grossCommissionEarned: 0,
        refundAdjustments: 0,
        netCommissionPayable: 0,
        paidAmount: 0,
        outstandingAmount: 0,
        lineItems: [],
      },
    };
  }

  // Filter valid invoices in branch and date range
  const relevantInvoices = invoices.filter((inv) => {
    if (inv.branchId !== staff.branchId) return false;
    if (inv.date < startDate || inv.date > endDate) return false;
    return true;
  });

  const attributionLines: CommissionAttributionLine[] = [];
  const newlyConsumedIds: string[] = [];
  let attributedNetSales = 0;
  let grossCommissionEarned = 0;
  let refundAdjustments = 0;
  let servicesCompletedCount = 0;

  for (const inv of relevantInvoices) {
    // Check if this is a previous dues collection invoice without new services
    const isDuesOnly = (inv.lineItems || []).length === 0;
    if (isDuesOnly) continue;

    const isVoided = !!(inv.notes && inv.notes.toLowerCase().includes('void'));

    (inv.lineItems || []).forEach((item, itemIdx) => {
      // 1. Direct Service (without custom multi-staff allocation)
      if (item.type === 'SERVICE' && (!item.assignedStaff || item.assignedStaff.length === 0) && item.staffId === staff.id) {
        const lineKey = item.id || (item as any).lineInstanceId || `idx-${itemIdx}-${item.itemId || 'svc'}`;
        const attributionId = `${inv.id}-li-${lineKey}`;
        if (consumedLineItemIds.has(attributionId)) {
          // Already consumed in a finalized commission run
          return;
        }

        // Net sales after discount, excluding tax and tips
        const lineGross = item.unitPrice * (item.quantity || 1);
        let discountAllocation = typeof item.discountAllocated === 'number' ? item.discountAllocated : 0;
        if (!discountAllocation && inv.discount && inv.subtotal > 0) {
          discountAllocation = roundCurrency((lineGross / inv.subtotal) * inv.discount);
        }

        const netServiceSales =
          typeof item.netSales === 'number'
            ? item.netSales
            : roundCurrency(lineGross - discountAllocation);

        const rawRate = typeof item.staffCommissionRate === 'number'
          ? item.staffCommissionRate
          : (typeof (item as any).commissionRate === 'number' ? (item as any).commissionRate : (staff.commissionRate || 0));
        const effectiveRatePercent = rawRate > 0 && rawRate <= 1 ? roundCurrency(rawRate * 100) : rawRate;
        const earned = roundCurrency(netServiceSales * (effectiveRatePercent / 100));

        if (isVoided) {
          refundAdjustments -= earned;
        } else {
          attributedNetSales += netServiceSales;
          grossCommissionEarned += earned;
          servicesCompletedCount += (item.quantity || 1);
        }

        newlyConsumedIds.push(attributionId);
        attributionLines.push({
          id: attributionId,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          date: inv.date,
          clientName: inv.clientName,
          serviceOrPackageId: item.itemId || item.id,
          serviceOrPackageName: item.name,
          itemType: 'SERVICE',
          isPackageComponent: false,
          cataloguePrice: lineGross,
          discountAllocation,
          netAttributedAmount: isVoided ? -netServiceSales : netServiceSales,
          commissionRatePercent: effectiveRatePercent,
          commissionEarned: isVoided ? -earned : earned,
        });
      }

      // 2. Bundled Package or Multi-Staff Service (Multi-staff divided or custom allocated)
      if (item.type === 'PACKAGE' || (item.type === 'SERVICE' && item.assignedStaff && item.assignedStaff.length > 0)) {
        const assignedStaffList = item.assignedStaff && item.assignedStaff.length > 0
          ? item.assignedStaff
          : undefined;

        if (assignedStaffList) {
          const isStaffAssigned = assignedStaffList.some((st: any) => st.staffId === staff.id);
          if (isStaffAssigned) {
            const numStaff = assignedStaffList.length;
            const lineGross = item.unitPrice * (item.quantity || 1);
            let discountAllocation = typeof item.discountAllocated === 'number' ? item.discountAllocated : 0;
            if (!discountAllocation && inv.discount && inv.subtotal > 0) {
              discountAllocation = roundCurrency((lineGross / inv.subtotal) * inv.discount);
            }
            const netPackageSales =
              typeof item.netSales === 'number'
                ? item.netSales
                : roundCurrency(lineGross - discountAllocation);

            const staffEntry = assignedStaffList.find((st: any) => st.staffId === staff.id);
            const customAmount = typeof staffEntry?.allocatedAmount === 'number' && staffEntry.allocatedAmount > 0 ? staffEntry.allocatedAmount : null;
            const hasCustom = customAmount !== null;
            const discountRatio = lineGross > 0 ? netPackageSales / lineGross : 1;
            const staffShareGross: number = hasCustom ? customAmount : roundCurrency(lineGross / numStaff);
            const staffShareNet: number = hasCustom ? roundCurrency(customAmount * discountRatio) : roundCurrency(netPackageSales / numStaff);
            const staffShareDiscount: number = roundCurrency(Math.max(0, staffShareGross - staffShareNet));

            const rawRate = typeof staffEntry?.staffCommissionRate === 'number'
              ? staffEntry.staffCommissionRate
              : (staff.commissionRate || 0);
            const effectiveRatePercent = rawRate > 0 && rawRate <= 1 ? roundCurrency(rawRate * 100) : rawRate;
            const earned = roundCurrency(staffShareNet * (effectiveRatePercent / 100));

            const lineKey = item.id || (item as any).lineInstanceId || `idx-${itemIdx}-${item.itemId || 'pkg'}`;
            const attributionId = `${inv.id}-pkg-${lineKey}-${staff.id}`;
            if (!consumedLineItemIds.has(attributionId)) {
              if (isVoided) {
                refundAdjustments -= earned;
              } else {
                attributedNetSales += staffShareNet;
                grossCommissionEarned += earned;
                servicesCompletedCount += (item.quantity || 1);
              }

              newlyConsumedIds.push(attributionId);
              attributionLines.push({
                id: attributionId,
                invoiceId: inv.id,
                invoiceNumber: inv.invoiceNumber,
                date: inv.date,
                clientName: inv.clientName,
                serviceOrPackageId: item.itemId || item.id,
                serviceOrPackageName: item.name,
                itemType: 'PACKAGE',
                isPackageComponent: false,
                componentPackageName: item.name,
                cataloguePrice: staffShareGross,
                discountAllocation: staffShareDiscount,
                netAttributedAmount: isVoided ? -staffShareNet : staffShareNet,
                commissionRatePercent: effectiveRatePercent,
                commissionEarned: isVoided ? -earned : earned,
              });
            }
          }
        } else {
          // Fallback legacy component-level assignment
          const comps = item.packageComponents || (item as any).components;
          if (Array.isArray(comps)) {
            comps.forEach((comp: any, compIdx: number) => {
              if (comp.staffId === staff.id) {
                const lineKey = item.id || (item as any).lineInstanceId || `idx-${itemIdx}-${item.itemId || 'pkg'}`;
                const compKey =
                  comp.componentInstanceId ||
                  comp.id ||
                  (comp.serviceId && compIdx === 0 ? comp.serviceId : `${comp.serviceId || 'comp'}-${compIdx}`);
                const attributionId = `${inv.id}-comp-${lineKey}-${compKey}`;
                if (consumedLineItemIds.has(attributionId)) {
                  return;
                }

                // Component net revenue allocated after package discount (immutable from invoice snapshot)
                let allocatedAmount = 0;
                let rawAllocated = comp.allocatedAmount || 0;
                let compDiscount = 0;
                if (typeof comp.netAllocatedAmount === 'number') {
                  allocatedAmount = comp.netAllocatedAmount;
                  rawAllocated = comp.allocatedAmount || allocatedAmount;
                  compDiscount = roundCurrency(Math.max(0, rawAllocated - allocatedAmount));
                } else if (typeof comp.netSales === 'number') {
                  allocatedAmount = comp.netSales;
                  rawAllocated = comp.allocatedAmount || allocatedAmount;
                  compDiscount = roundCurrency(Math.max(0, rawAllocated - allocatedAmount));
                } else {
                  rawAllocated = comp.allocatedAmount || 0;
                  if (inv.discount && inv.subtotal > 0) {
                    compDiscount = roundCurrency((rawAllocated / inv.subtotal) * inv.discount);
                  }
                  allocatedAmount = roundCurrency(rawAllocated - compDiscount);
                }

                const rawCompRate = typeof comp.staffCommissionRate === 'number'
                  ? comp.staffCommissionRate
                  : (typeof comp.commissionRate === 'number' ? comp.commissionRate : (staff.commissionRate || 0));
                const compRatePercent = rawCompRate > 0 && rawCompRate <= 1 ? roundCurrency(rawCompRate * 100) : rawCompRate;
                const earned = roundCurrency(allocatedAmount * (compRatePercent / 100));

                if (isVoided) {
                  refundAdjustments -= earned;
                } else {
                  attributedNetSales += allocatedAmount;
                  grossCommissionEarned += earned;
                  servicesCompletedCount += (comp.quantity || 1);
                }

                newlyConsumedIds.push(attributionId);
                attributionLines.push({
                  id: attributionId,
                  invoiceId: inv.id,
                  invoiceNumber: inv.invoiceNumber,
                  date: inv.date,
                  clientName: inv.clientName,
                  serviceOrPackageId: comp.serviceId,
                  serviceOrPackageName: comp.serviceName,
                  itemType: 'PACKAGE',
                  isPackageComponent: true,
                  componentPackageName: item.name,
                  cataloguePrice: rawAllocated,
                  discountAllocation: compDiscount,
                  netAttributedAmount: isVoided ? -allocatedAmount : allocatedAmount,
                  commissionRatePercent: compRatePercent,
                  commissionEarned: isVoided ? -earned : earned,
                });
              }
            });
          }
        }
      }
    });
  }

  attributedNetSales = roundCurrency(attributedNetSales);
  grossCommissionEarned = roundCurrency(grossCommissionEarned);
  refundAdjustments = roundCurrency(refundAdjustments);
  const netCommissionPayable = roundCurrency(Math.max(0, grossCommissionEarned + refundAdjustments));

  return {
    isEligible: true,
    consumedAttributionIds: newlyConsumedIds,
    statement: {
      staffId: staff.id,
      staffName: staff.name,
      employeeCode: staff.employeeCode,
      designation: staff.designation || staff.roleTitle,
      branchId: staff.branchId,
      startDate,
      endDate,
      compensationType: staff.compensationType,
      commissionRatePercent: staff.commissionRate || 0,
      servicesCompletedCount,
      attributedNetSales,
      grossCommissionEarned,
      refundAdjustments,
      netCommissionPayable,
      paidAmount: 0,
      outstandingAmount: netCommissionPayable,
      lineItems: attributionLines,
    },
  };
}
