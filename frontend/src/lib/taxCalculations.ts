import { TaxTreatment, TaxRule, PackageComponent } from '@/types/salon';

export interface TaxCalculationInput {
  grossPrice: number;
  discount: number;
  taxTreatment: TaxTreatment;
  branchDefaultRate: number; // e.g. 0.16
  specificRuleRate?: number; // e.g. 0.13
  tip?: number; // Gratuity is outside tax calculation
}

export interface TaxCalculationResult {
  grossPrice: number;
  discount: number;
  netSales: number; // Gross price minus discount (minimum 0)
  effectiveTaxRate: number; // e.g. 0.16
  effectiveTaxPercentage: number; // e.g. 16
  taxAmount: number; // Net sales * effectiveTaxRate, rounded to 2 decimals
  tipAmount: number; // Strictly segregated from revenue and tax
  billTotal: number; // Net sales + tax + tip
}

/**
 * Rounds a number to exactly 2 decimal places.
 */
export function roundCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Pure calculation function for tax-exclusive salon billing.
 * Reusable by future POS and interactive preview tools.
 *
 * Rules:
 * 1. Net price after discount = Gross - Discount (cannot be negative)
 * 2. Applicable tax = Net price * effectiveTaxRate
 * 3. Bill total = Net price + Applicable tax + Gratuity
 * 4. Gratuity/tip is 100% held outside revenue and tax
 */
export function calculateTaxAndTotals(input: TaxCalculationInput): TaxCalculationResult {
  const grossPrice = Math.max(0, roundCurrency(input.grossPrice || 0));
  const discount = Math.max(0, Math.min(grossPrice, roundCurrency(input.discount || 0)));
  const netSales = roundCurrency(grossPrice - discount);
  const tipAmount = Math.max(0, roundCurrency(input.tip || 0));

  let effectiveTaxRate = 0;
  if (input.taxTreatment === 'BRANCH_DEFAULT') {
    effectiveTaxRate = Math.max(0, input.branchDefaultRate || 0);
  } else if (input.taxTreatment === 'SPECIFIC_RULE') {
    effectiveTaxRate = Math.max(0, input.specificRuleRate ?? input.branchDefaultRate ?? 0);
  } else if (input.taxTreatment === 'EXEMPT') {
    effectiveTaxRate = 0;
  }

  const taxAmount = roundCurrency(netSales * effectiveTaxRate);
  const billTotal = roundCurrency(netSales + taxAmount + tipAmount);

  return {
    grossPrice,
    discount,
    netSales,
    effectiveTaxRate,
    effectiveTaxPercentage: roundCurrency(effectiveTaxRate * 100),
    taxAmount,
    tipAmount,
    billTotal,
  };
}

export interface AllocatedPackageComponent {
  serviceId: string;
  serviceCode: string;
  serviceName: string;
  quantity: number;
  allocationPercentage: number;
  allocatedAmount: number; // In currency PKR, rounded to 2 decimals
}

/**
 * Allocates a package net selling price across its component services based on weights.
 * Applies deterministic remainder distribution so the exact sum of allocated amounts
 * equals the package price with 0 variance.
 */
export function allocatePackageRevenue(
  packagePrice: number,
  components: PackageComponent[]
): {
  allocatedComponents: AllocatedPackageComponent[];
  totalAllocated: number;
  isBalanced: boolean;
} {
  const cleanPrice = Math.max(0, roundCurrency(packagePrice));
  if (!components || components.length === 0) {
    return { allocatedComponents: [], totalAllocated: 0, isBalanced: true };
  }

  const totalPercentage = components.reduce((sum, c) => sum + (c.allocationPercentage || 0), 0);
  const isBalanced = Math.abs(totalPercentage - 100) < 0.001;

  // Initial distribution
  let distributedSum = 0;
  const allocated = components.map((comp, idx) => {
    // For every component except the last, allocate proportional rounded amount
    const pct = comp.allocationPercentage || 0;
    const amount = roundCurrency(cleanPrice * (pct / 100));
    distributedSum += amount;
    return {
      serviceId: comp.serviceId,
      serviceCode: comp.serviceCode,
      serviceName: comp.serviceName,
      quantity: comp.quantity,
      allocationPercentage: pct,
      allocatedAmount: amount,
    };
  });

  // Reconcile deterministic remainder against the primary (highest-weight) component so the allocated total matches selling price
  if (isBalanced && allocated.length > 0) {
    const remainder = roundCurrency(cleanPrice - distributedSum);
    // Find the primary (highest-weight) component
    let primaryItem = allocated[0];
    for (let i = 1; i < allocated.length; i++) {
      if (allocated[i].allocationPercentage > primaryItem.allocationPercentage) {
        primaryItem = allocated[i];
      }
    }
    primaryItem.allocatedAmount = roundCurrency(primaryItem.allocatedAmount + remainder);
  }

  const finalSum = roundCurrency(allocated.reduce((sum, a) => sum + a.allocatedAmount, 0));

  return {
    allocatedComponents: allocated,
    totalAllocated: finalSum,
    isBalanced,
  };
}
