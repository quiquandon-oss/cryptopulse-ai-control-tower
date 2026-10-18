// Evidence states and release-gate aggregation (spec: docs/EVIDENCE_MODEL.md).
// Pure functions, no dependencies; unit-tested in governance/tests/.

export const STATES = Object.freeze(['PASS', 'FAIL', 'UNKNOWN', 'UNAVAILABLE', 'STALE', 'NOT_APPLICABLE']);

// Worst first. NOT_APPLICABLE never affects the result.
const PRECEDENCE = ['FAIL', 'UNAVAILABLE', 'STALE', 'UNKNOWN', 'PASS'];

/**
 * Combine check results into one gate state.
 * Any FAIL fails; otherwise the worst of UNAVAILABLE > STALE > UNKNOWN wins;
 * PASS only if every applicable check passed. No checks, or only
 * NOT_APPLICABLE ones, gives NOT_APPLICABLE.
 */
export function aggregate(states) {
  for (const s of states) if (!STATES.includes(s)) throw new Error(`Unknown evidence state: ${s}`);
  const applicable = states.filter((s) => s !== 'NOT_APPLICABLE');
  if (!applicable.length) return 'NOT_APPLICABLE';
  return PRECEDENCE.find((s) => applicable.includes(s));
}

/** A release may proceed only on PASS. Everything else blocks or needs a human. */
export const releaseAllowed = (state) => state === 'PASS';

/**
 * Evidence state of the review-findings check for one repository.
 * - Ledger missing/unreadable                       -> UNAVAILABLE
 * - Any open critical/high/medium finding           -> FAIL
 * - Any critical/high finding only 'fixed' (not yet
 *   independently verified)                         -> UNKNOWN
 * - Otherwise (open low/info allowed, listed)       -> PASS
 */
export function findingsState(ledger, repository) {
  if (!ledger || !Array.isArray(ledger.findings)) return 'UNAVAILABLE';
  const mine = ledger.findings.filter((f) => f.repository === repository);
  const blocking = ['critical', 'high', 'medium'];
  if (mine.some((f) => f.status === 'open' && blocking.includes(f.severity))) return 'FAIL';
  if (mine.some((f) => f.status === 'fixed' && ['critical', 'high'].includes(f.severity))) return 'UNKNOWN';
  return 'PASS';
}

/**
 * Freshness check: PASS if the evidence is newer than maxAgeMs, STALE if
 * older, UNKNOWN if it carries no usable timestamp.
 */
export function freshnessState(timestampMs, maxAgeMs, now = Date.now()) {
  if (typeof timestampMs !== 'number' || Number.isNaN(timestampMs)) return 'UNKNOWN';
  return now - timestampMs <= maxAgeMs ? 'PASS' : 'STALE';
}

/** Map the Control Tower UI's source/gate states onto evidence states. */
export const UI_STATE_MAP = Object.freeze({
  // gate states (ui/js/model.js)
  done: 'PASS',
  rejected: 'FAIL',
  pending: 'UNKNOWN',
  loading: 'UNKNOWN',
  locked: 'NOT_APPLICABLE',
  untracked: 'UNKNOWN',
  error: 'UNAVAILABLE',
  // version source states (ui/js/lib/status.js + loader)
  ok: 'PASS',
  warn: 'STALE',
  down: 'UNAVAILABLE',
});
