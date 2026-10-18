// CryptoPulse V4 — backend: cryptopulse-v4 worker (CryptoPulseV4 repo, own D1).
// Boundary: imports only the V4 config entry; never touches other versions.
// Never requests /api/portfolio* (private, token-protected).
import { V4 } from '../config.js';
import { fetchData } from '../lib/http.js';
import { result, toMs, age } from '../lib/status.js';

const STATUS = { LIVE: 'ok', DEGRADED: 'warn', OFFLINE: 'warn' };

export async function loadV4() {
  const base = V4.backend.base;
  const host = new URL(base).host;
  // Health decides reachability; signals and market pulse are best-effort extras.
  const health = await fetchData(base + V4.backend.paths.health);
  const [signals, pulse] = await Promise.allSettled([
    fetchData(base + V4.backend.paths.signals),
    fetchData(base + V4.backend.paths.marketPulse),
  ]);

  const overall = (health.data && health.data.overall) || 'UNKNOWN';
  const components = Array.isArray(health.data && health.data.components) ? health.data.components : [];
  const rows = [['Health', `${overall} (${components.length} components)`]];

  let updatedAt = null;
  if (signals.status === 'fulfilled') {
    const list = (signals.value.data && signals.value.data.signals) || [];
    updatedAt = Math.max(0, ...list.map((s) => toMs(s.ts) || 0)) || null;
    const latestPerAsset = new Map();
    list.forEach((s) => { if (!latestPerAsset.has(s.asset_id)) latestPerAsset.set(s.asset_id, s); });
    latestPerAsset.forEach((s, asset) => rows.push([asset, `${s.direction} · score ${s.score} · ${s.regime}`]));
  } else {
    rows.push(['Signals', 'unavailable']);
  }
  if (pulse.status === 'fulfilled' && pulse.value.data) {
    const p = pulse.value.data;
    rows.push(['Market Pulse', p.marketPulse != null ? `${p.marketPulse} · ${p.label || ''}`.trim() : (p.reason || 'n/a')]);
  } else {
    rows.push(['Market Pulse', 'unavailable']);
  }
  rows.push(['Latest signal', age(updatedAt)]);

  return result(STATUS[overall] || 'warn', `Health: ${overall}`, rows, updatedAt, health, host);
}
