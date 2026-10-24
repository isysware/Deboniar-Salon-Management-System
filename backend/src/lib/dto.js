// src/lib/dto.js
// Small helpers used by every mapper to produce frontend-shaped JSON.

import { toDec } from './money.js';

/** Prisma Decimal | number | null → JS number (0 for null). */
export const num = (v) => (v === null || v === undefined ? 0 : toDec(v).toNumber());

/** Prisma Decimal | null → number | undefined (keeps optional fields optional). */
export const optNum = (v) => (v === null || v === undefined ? undefined : toDec(v).toNumber());

/** null → undefined so JSON omits optional fields like the mock does. */
export const opt = (v) => (v === null ? undefined : v);

/** DateTime → ISO string | undefined. */
export const iso = (d) => (d ? new Date(d).toISOString() : undefined);
