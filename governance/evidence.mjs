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

const BLOCKING_SEVERITIES = ['critical', 'high', 'medium'];

/**
 * Review-findings check for one repository, with the findings behind it.
 * - Ledger missing/unreadable                                  -> UNAVAILABLE
 * - Any open, or accepted-risk, critical/high/medium finding   -> FAIL
 *   (accepting a risk is Olivier's human override, recorded on the PR;
 *    it is never a technical PASS)
 * - Any critical/high/medium finding only 'fixed' (author-checked,
 *   not independently verified)                                -> UNKNOWN
 * - Otherwise                                                  -> PASS
 * Low/info findings that are open, fixed-unverified or accepted do not
 * block, but are always returned in the lists so nothing passes silently.
 * @returns {{ state: string, blocking: string[], unverified: string[], acceptedRisks: string[], openLow: string[] }}
 */
export function findingsGate(ledger, repository) {
  const empty = { blocking: [], unverified: [], acceptedRisks: [], openLow: [] };
  if (!ledger || !Array.isArray(ledger.findings)) return { state: 'UNAVAILABLE', ...empty };
  const mine = ledger.findings.filter((f) => f.repository === repository);
  const isBlocking = (f) => BLOCKING_SEVERITIES.includes(f.severity);
  const ids = (pred) => mine.filter(pred).map((f) => f.finding_id);

  const gate = {
    blocking: ids((f) => f.status === 'open' && isBlocking(f)),
    unverified: ids((f) => f.status === 'fixed'),
    acceptedRisks: ids((f) => f.status === 'accepted_risk'),
    openLow: ids((f) => f.status === 'open' && !isBlocking(f)),
  };
  let state = 'PASS';
  if (gate.blocking.length || mine.some((f) => f.status === 'accepted_risk' && isBlocking(f))) state = 'FAIL';
  else if (mine.some((f) => f.status === 'fixed' && isBlocking(f))) state = 'UNKNOWN';
  return { state, ...gate };
}

/** State only; see findingsGate() for the findings behind it. */
export const findingsState = (ledger, repository) => findingsGate(ledger, repository).state;

/**
 * Freshness check: PASS if the evidence is newer than maxAgeMs, STALE if
 * older. UNKNOWN if the timestamp is missing, not finite, or later than
 * `now` by any amount — evidence dated in the future cannot be trusted, so
 * there is deliberately no clock-skew tolerance (ChatGPT review, CT-0010).
 */
export function freshnessState(timestampMs, maxAgeMs, now = Date.now()) {
  if (typeof timestampMs !== 'number' || !Number.isFinite(timestampMs)) return 'UNKNOWN';
  if (timestampMs > now) return 'UNKNOWN';
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
