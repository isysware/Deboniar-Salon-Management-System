// src/lib/money.js
// All monetary arithmetic uses decimal.js to avoid IEEE-754 float errors.
// Rule: never use JS + − * / directly on money values.

import Decimal from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/** Convert any value to a Decimal instance */
export const toDec = (v) => new Decimal(v ?? 0);

/** Add two monetary values */
export const add = (a, b) => toDec(a).plus(toDec(b));

/** Subtract b from a */
export const sub = (a, b) => toDec(a).minus(toDec(b));

/** Multiply two values */
export const mul = (a, b) => toDec(a).times(toDec(b));

/** Divide a by b */
export const div = (a, b) => toDec(a).dividedBy(toDec(b));

/** Round to 2 decimal places (banker-safe) */
export const round2 = (v) => toDec(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

/** Convert Decimal to a plain JS number (for JSON responses) */
export const toNum = (v) => toDec(v).toNumber();

/** Convert Decimal to a string with exactly 2 decimal places */
export const toStr = (v) => toDec(v).toFixed(2);

/** Clamp Decimal to zero minimum */
export const max0 = (v) => {
  const d = toDec(v);
  return d.isNegative() ? toDec(0) : d;
};

/**
 * Split `total` across `weights` proportionally so that Σ parts === total exactly.
 * The rounding remainder goes to the part with the largest weight (or last on tie).
 *
 * @param {Decimal|number|string} total
 * @param {Array<Decimal|number|string>} weights  — must sum to exactly 100
 * @returns {Decimal[]}
 */
export const splitWithRemainder = (total, weights) => {
  const tot     = toDec(total);
  const sumW    = weights.reduce((s, w) => add(s, w), toDec(0));
  const parts   = weights.map((w) => round2(mul(tot, div(w, sumW))));
  const partsSum = parts.reduce((s, p) => add(s, p), toDec(0));
  const diff    = round2(sub(tot, partsSum));

  if (!diff.isZero()) {
    // Put remainder on the part with the largest weight
    let idx = 0;
    weights.forEach((w, i) => {
      if (toDec(w).greaterThan(toDec(weights[idx]))) idx = i;
    });
    parts[idx] = round2(add(parts[idx], diff));
  }

  return parts;
};
