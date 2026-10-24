// Allocate from persisted demo state, never timestamps, array length or a UI preview.
export function nextReference(store: object, prefix: string): string {
  const label = /^(srv|svr)$/i.test(prefix) ? 'Svr' : prefix.toUpperCase();
  const state = store as { referenceSequenceCounters?: Record<string, number> };
  const counters = state.referenceSequenceCounters ??= {};
  let max = counters[label] || 0;
  const pattern = new RegExp(`^${label}-(\\d+)$`, 'i');
  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      const match = value.match(pattern);
      if (match) max = Math.max(max, Number(match[1]));
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(store);
  counters[label] = max + 1;
  return `${label}-${String(max + 1).padStart(4, '0')}`;
}
