// src/lib/stock.js
// Stock engine shared by Inventory, POS and Refunds.
//  • Every quantity change is a StockMovement row with a cost snapshot (spec §5).
//  • InventoryBatch.remainingQuantity is a cache updated in the SAME transaction under a row lock.
//  • Cost-layer selection: FEFO for expiry-tracked items, FIFO (received date) otherwise.
//    Expired and quarantined layers are never picked for sale/consumption.

import { badRequest, conflict } from './AppError.js';
import { toDec, round2 } from './money.js';
import { nextSequence } from './sequence.js';
import { dateOnly } from './dates.js';

export const IN_TYPES = new Set([
  'OPENING_STOCK', 'PURCHASE_IN', 'SALES_RETURN_IN', 'SUPPLIER_REFUND_RESTOCK', 'POS_RETURN_IN',
  'POSITIVE_ADJUSTMENT', 'BRANCH_TRANSFER_IN',
]);

/** Quantities use 4 decimals (ml/gram stock). */
export const qty = (v) => toDec(v).toDecimalPlaces(4);

/**
 * Pick cost layers for an OUT movement and row-lock them.
 * @returns {Promise<Array<{ batch: object, quantity: Decimal }>>}
 */
export const pickBatches = async (tx, { itemId, branchId, quantity, businessDate, itemName = 'item', allowExpired = false }) => {
  const need = qty(quantity);
  if (need.lessThanOrEqualTo(0)) throw badRequest('INVALID_QUANTITY', 'Quantity must be a positive number.');

  // Lock every candidate layer of this item in the branch for the rest of the transaction.
  await tx.$executeRaw`SELECT 1 FROM "InventoryBatch" WHERE "itemId" = ${itemId} AND "branchId" = ${branchId} FOR UPDATE`;
  const item = await tx.inventoryItem.findUnique({ where: { id: itemId } });
  const batches = await tx.inventoryBatch.findMany({
    where: {
      itemId, branchId, status: 'VALID', remainingQuantity: { gt: 0 },
      ...(allowExpired ? {} : { OR: [{ expiryDate: null }, { expiryDate: { gte: dateOnly(businessDate) } }] }),
    },
  });

  const fefo = item?.trackExpiry;
  batches.sort((a, b) => {
    if (fefo) {
      const ea = a.expiryDate ? a.expiryDate.getTime() : Infinity;
      const eb = b.expiryDate ? b.expiryDate.getTime() : Infinity;
      if (ea !== eb) return ea - eb;
    }
    return a.receivedDate - b.receivedDate || a.createdAt - b.createdAt;
  });

  const available = batches.reduce((s, b) => s.plus(b.remainingQuantity), toDec(0));
  if (available.lessThan(need)) {
    throw conflict(
      'INSUFFICIENT_STOCK',
      `Insufficient sellable stock for '${item?.name ?? itemName}'. Available: ${available.toNumber()}, Requested: ${need.toNumber()}.`
    );
  }

  const picks = [];
  let remaining = need;
  for (const batch of batches) {
    if (remaining.lessThanOrEqualTo(0)) break;
    const take = toDec(batch.remainingQuantity).lessThan(remaining) ? toDec(batch.remainingQuantity) : remaining;
    picks.push({ batch, quantity: take });
    remaining = remaining.minus(take);
  }
  return picks;
};

/**
 * Create one stock movement and update the batch cache.
 * @param {object} tx
 * @param {{ branchCode: string, branchId: string, itemId: string, batch?: object, movementType: string,
 *           quantity: any, unitCost: any, sourceReferenceType: string, sourceReferenceId: string,
 *           sourceReferenceNumber: string, reason: string, notes?: string, actor: {id,name} }} m
 */
export const postStockMovement = async (tx, m) => {
  const quantity = qty(m.quantity);
  if (quantity.lessThanOrEqualTo(0)) throw badRequest('INVALID_QUANTITY', 'Movement quantity must be positive.');
  const direction = IN_TYPES.has(m.movementType) ? 'IN' : 'OUT';

  if (m.batch) {
    await tx.$executeRaw`SELECT 1 FROM "InventoryBatch" WHERE id = ${m.batch.id} FOR UPDATE`;
    const fresh = await tx.inventoryBatch.findUnique({ where: { id: m.batch.id } });
    const next = direction === 'IN' ? toDec(fresh.remainingQuantity).plus(quantity) : toDec(fresh.remainingQuantity).minus(quantity);
    if (next.lessThan(0)) {
      throw conflict(
        'INSUFFICIENT_BATCH_STOCK',
        `Insufficient quantity in batch '${fresh.batchNumber}'. Remaining: ${toDec(fresh.remainingQuantity).toNumber()}, Requested: ${quantity.toNumber()}.`
      );
    }
    await tx.inventoryBatch.update({ where: { id: fresh.id }, data: { remainingQuantity: next } });
  }

  const unitCost = toDec(m.unitCost).toDecimalPlaces(4);
  return tx.stockMovement.create({
    data: {
      movementNumber:        await nextSequence(tx, m.branchCode, 'SM'),
      branchId:              m.branchId,
      itemId:                m.itemId,
      batchId:               m.batch?.id ?? null,
      movementType:          m.movementType,
      direction,
      quantity,
      unitCost,
      totalCost:             round2(quantity.times(unitCost)),
      sourceReferenceType:   m.sourceReferenceType,
      sourceReferenceId:     m.sourceReferenceId,
      sourceReferenceNumber: m.sourceReferenceNumber,
      reason:                m.reason,
      notes:                 m.notes ?? null,
      userId:                m.actor.id,
      userName:              m.actor.name,
    },
  });
};

/**
 * Consume stock across FEFO/FIFO layers (sale, salon use, damage…).
 * Returns the created movements; COGS = Σ movement.totalCost.
 */
export const consumeStock = async (tx, { itemId, branchId, branchCode, quantity, businessDate, movementType, source, reason, notes, actor, batchId }) => {
  let picks;
  if (batchId) {
    await tx.$executeRaw`SELECT 1 FROM "InventoryBatch" WHERE id = ${batchId} FOR UPDATE`;
    const batch = await tx.inventoryBatch.findFirst({ where: { id: batchId, itemId, branchId } });
    if (!batch) throw badRequest('BATCH_NOT_FOUND', `Batch '${batchId}' not found for this item in this branch.`);
    picks = [{ batch, quantity: qty(quantity) }];
  } else {
    picks = await pickBatches(tx, { itemId, branchId, quantity, businessDate, allowExpired: movementType === 'EXPIRED_OUT' });
  }
  const movements = [];
  for (const p of picks) {
    movements.push(await postStockMovement(tx, {
      branchCode, branchId, itemId, batch: p.batch, movementType, quantity: p.quantity, unitCost: p.batch.unitCost,
      sourceReferenceType: source.type, sourceReferenceId: source.id, sourceReferenceNumber: source.number, reason, notes, actor,
    }));
  }
  return movements;
};
