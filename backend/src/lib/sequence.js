import { randomUUID } from 'crypto';

// Human-readable business references are global per type, never per branch/year.
// Allocate in the posting transaction; UUIDs and existing references stay intact.
const sources = {
  INV: ['invoice', 'invoiceNumber'], RCP: ['invoicePayment', 'receiptNumber'],
  SVR: ['service', 'code'], PKG: ['package', 'code'], BR: ['branch', 'code'],
  EMP: ['staff', 'employeeCode'], SKU: ['inventoryItem', 'sku'], SUP: ['supplier', 'supplierCode'],
  APT: ['appointment', 'appointmentNumber'], DFT: ['expense', 'voucherNumber'],
  EXP: ['expense', 'voucherNumber'], REV: ['expense', 'voucherNumber'],
  SET: ['settlement', 'settlementNumber'], CVA: ['cashVarianceAdjustment', 'adjustmentNumber'],
  LV: ['leaveRecord', 'leaveNumber'], OT: ['overtimeRecord', 'overtimeNumber'],
  PAY: ['payrollRun', 'payrollNumber'], PS: ['payslip', 'payslipNumber'],
  PAYMT: ['payrollPayment', 'paymentNumber'], ADV: ['salaryAdvance', 'advanceNumber'],
  COM: ['commissionRun', 'commissionNumber'], CS: ['commissionStatement', 'statementNumber'],
  COMPAY: ['commissionPayment', 'paymentNumber'], TR: ['tipReceipt', 'receiptNumber'],
  TA: ['tipAllocation', 'allocationNumber'], TP: ['tipPayout', 'payoutNumber'],
  SP: ['supplierPayment', 'paymentNumber'], PO: ['purchase', 'purchaseNumber'],
  PR: ['supplierReturn', 'returnNumber'], ST: ['stockSettlement', 'settlementNumber'],
  SM: ['stockMovement', 'movementNumber'], CXF: ['cashTransfer', 'transferNumber'],
  BAT: ['inventoryBatch', 'batchNumber'],
};

export const nextSequence = async (tx, _branchCode, prefix, _year, pad = 4) => {
  const rawKey = prefix.toUpperCase();
  const key = ['SRV', 'SVR'].includes(rawKey) ? 'SVR' : rawKey;
  if (!/^[A-Z0-9]+$/.test(key)) throw new Error('Invalid reference prefix');
  const label = key === 'SVR' ? 'Svr' : key;
  const source = sources[key] || (/^EMP\d*$/i.test(key) ? sources.EMP : undefined);
  let existingMax = 0;
  if (source) {
    const [model, field] = source;
    const records = await tx[model].findMany({
      where: { [field]: { startsWith: `${label}-`, mode: 'insensitive' } }, select: { [field]: true },
    });
    const pattern = new RegExp(`^${label}-(\\d+)$`, 'i');
    for (const record of records) {
      const match = record[field]?.match(pattern);
      if (match) existingMax = Math.max(existingMax, Number(match[1]));
    }
  }
  const start = existingMax + 1;
  const seqId = randomUUID();
  const rows = await tx.$queryRaw`
    INSERT INTO "Sequence" (id, "branchCode", prefix, year, "lastValue")
    VALUES (${seqId}, 'GLOBAL', ${key}, 0, ${start})
    ON CONFLICT ("branchCode", prefix, year)
    DO UPDATE SET "lastValue" = GREATEST("Sequence"."lastValue" + 1, ${start})
    RETURNING "lastValue"
  `;
  return `${label}-${String(rows[0].lastValue).padStart(Math.max(4, pad), '0')}`;
};

export const nextPeriodSequence = (tx, branchCode, prefix, _period, pad = 4) =>
  nextSequence(tx, branchCode, prefix, undefined, pad);
