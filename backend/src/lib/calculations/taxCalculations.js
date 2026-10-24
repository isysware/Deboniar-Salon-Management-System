// AUTO-PORTED from frontend src/lib/taxCalculations.ts (types stripped with esbuild). Keep logic identical to the frontend.
function roundCurrency(amount) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}
function calculateTaxAndTotals(input) {
  const grossPrice = Math.max(0, roundCurrency(input.grossPrice || 0));
  const discount = Math.max(0, Math.min(grossPrice, roundCurrency(input.discount || 0)));
  const netSales = roundCurrency(grossPrice - discount);
  const tipAmount = Math.max(0, roundCurrency(input.tip || 0));
  let effectiveTaxRate = 0;
  if (input.taxTreatment === "BRANCH_DEFAULT") {
    effectiveTaxRate = Math.max(0, input.branchDefaultRate || 0);
  } else if (input.taxTreatment === "SPECIFIC_RULE") {
    effectiveTaxRate = Math.max(0, input.specificRuleRate ?? input.branchDefaultRate ?? 0);
  } else if (input.taxTreatment === "EXEMPT") {
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
    billTotal
  };
}
function allocatePackageRevenue(packagePrice, components) {
  const cleanPrice = Math.max(0, roundCurrency(packagePrice));
  if (!components || components.length === 0) {
    return { allocatedComponents: [], totalAllocated: 0, isBalanced: true };
  }
  const totalPercentage = components.reduce((sum, c) => sum + (c.allocationPercentage || 0), 0);
  const isBalanced = Math.abs(totalPercentage - 100) < 1e-3;
  let distributedSum = 0;
  const allocated = components.map((comp, idx) => {
    const pct = comp.allocationPercentage || 0;
    const amount = roundCurrency(cleanPrice * (pct / 100));
    distributedSum += amount;
    return {
      serviceId: comp.serviceId,
      serviceCode: comp.serviceCode,
      serviceName: comp.serviceName,
      quantity: comp.quantity,
      allocationPercentage: pct,
      allocatedAmount: amount
    };
  });
  if (isBalanced && allocated.length > 0) {
    const remainder = roundCurrency(cleanPrice - distributedSum);
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
    isBalanced
  };
}
export {
  allocatePackageRevenue,
  calculateTaxAndTotals,
  roundCurrency
};
