// CryptoPulse V2 — backend: pulseworker-v2 worker (PulseWorkerV2 repo, D1).
// Boundary: imports only the V2 config entry; never touches other versions.
import { V2 } from '../config.js';
import { fetchData } from '../lib/http.js';
import { result, toMs, age } from '../lib/status.js';

/** Worst prediction status across horizons/variants for one coin. */
function coinStatus(coin) {
  const statuses = Object.values(coin.horizons || {}).flatMap((h) => Object.values(h).map((v) => v && v.status));
  if (!statuses.length) return 'UNKNOWN';
  return statuses.every((s) => s === 'FRESH') ? 'FRESH' : statuses.find((s) => s !== 'FRESH');
}

export async function loadV2() {
  const fetch = await fetchData(V2.backend.base + V2.backend.paths.freshness);
  const data = fetch.data || {};
  const host = new URL(V2.backend.base).host;
  const coins = Object.entries(data.coins || {});
  if (!data.ok || !coins.length) return result('warn', 'Reachable, but freshness report is empty', [], null, fetch, host);

  const rows = coins.map(([symbol, coin]) => {
    const ageHours = coin.price_data && coin.price_data.latest_age_hours;
    return [symbol, `${coinStatus(coin)} · prices ${ageHours != null ? `${ageHours} h old` : 'n/a'}`];
  });
  const allFresh = coins.every(([, coin]) => coinStatus(coin) === 'FRESH');
  const updatedAt = toMs(data.generated_ts);
  return result(allFresh ? 'ok' : 'warn',
    allFresh ? `All predictions fresh (${coins.length} coins)` : 'Some predictions are not fresh',
    [...rows, ['Report generated', age(updatedAt)]],
    updatedAt, fetch, host);
}
