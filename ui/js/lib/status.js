// Shared shape returned by every version source module:
//   { status: 'ok' | 'warn' | 'down', summary, rows: [[label, value]], updatedAt, fetchedAt, cached, host }
// status: 'ok' = data present and current; 'warn' = reachable but stale/partial;
// 'down' is produced by the loader when a source fails (never by a module).

/** Timestamp (ms, seconds, or ISO string) -> ms, or null if unusable. */
export function toMs(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return value < 1e12 ? value * 1000 : value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/** "3 min ago", "2.1 h ago", "4 d ago". */
export function age(ms, now = Date.now()) {
  if (ms == null) return 'unknown';
  const minutes = Math.max(0, (now - ms) / 60000);
  if (minutes < 60) return `${Math.round(minutes)} min ago`;
  if (minutes < 48 * 60) return `${(minutes / 60).toFixed(1)} h ago`;
  return `${Math.round(minutes / 1440)} d ago`;
}

export function result(status, summary, rows, updatedAt, fetch, host) {
  return { status, summary, rows, updatedAt, fetchedAt: fetch.at, cached: fetch.cached, host };
}
