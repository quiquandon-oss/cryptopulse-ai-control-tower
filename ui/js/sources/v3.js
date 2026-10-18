// CryptoPulse V3 — no backend of its own: consumes the V2 worker.
// Shown "via V2". Boundary: imports only the V3 config entry (which points at
// the one V2 route V3 itself uses); does not import the V2 module.
import { V3 } from '../config.js';
import { fetchData } from '../lib/http.js';
import { result, toMs, age } from '../lib/status.js';

const STALE_AFTER_MS = 6 * 3600 * 1000; // challenger predictions run every 3 h

export async function loadV3() {
  const fetch = await fetchData(V3.backend.base + V3.backend.paths.challengerRecent);
  const predictions = (fetch.data && Array.isArray(fetch.data.predictions)) ? fetch.data.predictions : [];
  const host = `${new URL(V3.backend.base).host} (via ${V3.via})`;
  if (!predictions.length) return result('warn', 'Reachable via V2, but no challenger predictions returned', [], null, fetch, host);

  const updatedAt = Math.max(...predictions.map((p) => toMs(p.ts) || 0)) || null;
  const stale = updatedAt == null || Date.now() - updatedAt > STALE_AFTER_MS;
  const rows = predictions.slice(0, 3).map((p) => [
    `${p.coin} ${p.horizon_hours}h`,
    `P(up) ${Number(p.calibrated_p_up_flat ?? p.p_up_flat).toFixed(2)} · ${p.model_version || 'model n/a'}`,
  ]);
  return result(stale ? 'warn' : 'ok',
    stale ? `Latest challenger prediction is stale (${age(updatedAt)})` : `Challenger predictions ${age(updatedAt)}`,
    [...rows, ['Latest', age(updatedAt)]],
    updatedAt, fetch, host);
}
