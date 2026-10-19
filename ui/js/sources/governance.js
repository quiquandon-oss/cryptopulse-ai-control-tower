// Review ledger (governance/ledger.json on main), read-only from the raw file
// host, which does not count against the GitHub API rate limit. The release
// gate is computed by governance/evidence.mjs, the same code CI tests, so the
// UI and the ledger tooling cannot disagree.
import { GITHUB } from '../config.js';
import { fetchData, SourceError } from '../lib/http.js';
import { findingsGate } from '../../../governance/evidence.mjs';

const CT = GITHUB.controlTower;
export const LEDGER_URL = `${GITHUB.raw}/${GITHUB.owner}/${CT.repo}/${CT.branch}/${CT.ledger}`;

const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];
const STATUSES = ['open', 'fixed', 'verified', 'accepted_risk'];

/**
 * Minimal shape check. Full validation is CI's job (validate-ledger.mjs);
 * here anything unexpected makes the source unavailable rather than guessed.
 */
export function checkLedger(ledger) {
  const ok = ledger && Array.isArray(ledger.findings) && ledger.findings.every((f) => f
    && typeof f.finding_id === 'string' && typeof f.repository === 'string'
    && SEVERITIES.includes(f.severity) && STATUSES.includes(f.status));
  if (!ok) throw new SourceError('parse', 'Ledger does not match the expected format');
  return ledger;
}

/** Ledger findings plus one findings gate per repository they cover. */
export async function loadLedger() {
  const res = await fetchData(LEDGER_URL);
  const ledger = checkLedger(res.data);
  const repos = [...new Set(ledger.findings.map((f) => f.repository))].sort();
  return {
    findings: ledger.findings,
    gates: repos.map((repository) => ({ repository, ...findingsGate(ledger, repository) })),
    at: res.at,
    cached: res.cached,
  };
}
