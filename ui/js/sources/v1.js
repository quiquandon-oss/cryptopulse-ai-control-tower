// CryptoPulse V1 — backend: sentiment-ff75 worker (PulseWorker repo).
// Boundary: imports only the V1 config entry; never touches other versions.
import { V1 } from '../config.js';
import { fetchData } from '../lib/http.js';
import { result, toMs, age } from '../lib/status.js';

const STALE_AFTER_MS = 36 * 3600 * 1000; // technical eval is produced daily

export async function loadV1() {
  const fetch = await fetchData(V1.backend.base + V1.backend.paths.technicalEval);
  const latest = fetch.data && fetch.data.latest;
  const host = new URL(V1.backend.base).host;
  if (!latest) return result('warn', 'Reachable, but no technical evaluation stored yet', [], null, fetch, host);

  const updatedAt = toMs(latest.ts);
  const stale = updatedAt == null || Date.now() - updatedAt > STALE_AFTER_MS;
  const text = typeof latest.evaluation === 'string' ? latest.evaluation : '';
  return result(stale ? 'warn' : 'ok',
    stale ? `Latest technical evaluation is stale (${age(updatedAt)})` : `Technical evaluation ${age(updatedAt)}`,
    [
      ['Score', latest.score ?? '—'],
      ['Evaluated', age(updatedAt)],
      ['Summary', text.length > 160 ? `${text.slice(0, 157)}…` : (text || '—')],
    ],
    updatedAt, fetch, host);
}
