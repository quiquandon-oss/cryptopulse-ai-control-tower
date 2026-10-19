// Evidence states and release-gate aggregation (docs/EVIDENCE_MODEL.md §1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STATES, aggregate, releaseAllowed, findingsState, findingsGate, freshnessState, UI_STATE_MAP } from '../evidence.mjs';

const GOV = join(dirname(fileURLToPath(import.meta.url)), '..');
const CT = 'quiquandon-oss/cryptopulse-ai-control-tower';

test('the six states are exactly as specified', () => {
  assert.deepEqual([...STATES], ['PASS', 'FAIL', 'UNKNOWN', 'UNAVAILABLE', 'STALE', 'NOT_APPLICABLE']);
});

test('aggregate: worst state wins; NOT_APPLICABLE ignored', () => {
  assert.equal(aggregate(['PASS', 'PASS']), 'PASS');
  assert.equal(aggregate(['PASS', 'FAIL', 'UNAVAILABLE']), 'FAIL');
  assert.equal(aggregate(['PASS', 'UNKNOWN', 'STALE', 'UNAVAILABLE']), 'UNAVAILABLE');
  assert.equal(aggregate(['PASS', 'UNKNOWN', 'STALE']), 'STALE');
  assert.equal(aggregate(['PASS', 'UNKNOWN']), 'UNKNOWN');
  assert.equal(aggregate(['PASS', 'NOT_APPLICABLE']), 'PASS');
  assert.equal(aggregate(['NOT_APPLICABLE']), 'NOT_APPLICABLE');
  assert.equal(aggregate([]), 'NOT_APPLICABLE');
  assert.throws(() => aggregate(['OK']), /Unknown evidence state/);
});

test('only PASS allows a release; missing evidence never passes', () => {
  for (const s of STATES) assert.equal(releaseAllowed(s), s === 'PASS', s);
  assert.notEqual(aggregate(['UNAVAILABLE']), 'PASS');
  assert.notEqual(aggregate(['UNKNOWN']), 'PASS');
});

test('findingsState rules', () => {
  const f = (severity, status) => ({ repository: CT, severity, status });
  assert.equal(findingsState(null, CT), 'UNAVAILABLE');
  assert.equal(findingsState({ findings: [] }, CT), 'PASS');
  assert.equal(findingsState({ findings: [f('medium', 'open')] }, CT), 'FAIL');
  assert.equal(findingsState({ findings: [f('low', 'open')] }, CT), 'PASS');
  assert.equal(findingsState({ findings: [f('high', 'fixed')] }, CT), 'UNKNOWN');
  assert.equal(findingsState({ findings: [f('high', 'verified')] }, CT), 'PASS');
  assert.equal(findingsState({ findings: [f('high', 'accepted_risk')] }, CT), 'FAIL', 'accepted risk is not a technical PASS');
  assert.equal(findingsState({ findings: [f('critical', 'open')] }, 'quiquandon-oss/CryptoPulseV4'), 'PASS', 'scoped to repository');
});

test('current ledger: control tower findings gate is PASS (every medium+ finding independently verified)', () => {
  const ledger = JSON.parse(readFileSync(join(GOV, 'ledger.json'), 'utf8'));
  const gate = findingsGate(ledger, CT);
  // CT-0006 and CT-0015 verified by ChatGPT (PR #12 review 5568180084).
  assert.equal(gate.state, 'PASS');
  assert.deepEqual(gate.blocking, []);
  // Low-severity fixes stay listed until verified, never hidden.
  assert.deepEqual(gate.unverified, ['CT-0004']);
  assert.deepEqual(gate.openLow, []);
});

test('freshnessState', () => {
  const now = Date.parse('2026-10-18T12:00:00Z');
  assert.equal(freshnessState(now - 60_000, 3_600_000, now), 'PASS');
  assert.equal(freshnessState(now - 7_200_000, 3_600_000, now), 'STALE');
  assert.equal(freshnessState(null, 3_600_000, now), 'UNKNOWN');
});

test('every UI state maps to a valid evidence state; failures never map to PASS', () => {
  for (const [ui, state] of Object.entries(UI_STATE_MAP)) assert.ok(STATES.includes(state), ui);
  for (const ui of ['error', 'down', 'loading', 'pending', 'untracked', 'warn', 'rejected']) assert.notEqual(UI_STATE_MAP[ui], 'PASS', ui);
});

// --- ChatGPT review of PR #8 (findings 1–3) ---------------------------------

test('#1 accepted risk is a human override, never a technical PASS', () => {
  const f = (severity) => ({ repository: CT, severity, status: 'accepted_risk', finding_id: `X-${severity}` });
  for (const sev of ['high', 'medium']) {
    const gate = findingsGate({ findings: [f(sev)] }, CT);
    assert.notEqual(gate.state, 'PASS', sev);
    assert.equal(gate.state, 'FAIL', sev);
    assert.deepEqual(gate.acceptedRisks, [`X-${sev}`], sev);
  }
});

test('#2 every severity x status combination has a defined, non-silent result', () => {
  const expected = {
    open:          { critical: 'FAIL',    high: 'FAIL',    medium: 'FAIL',    low: 'PASS', info: 'PASS' },
    fixed:         { critical: 'UNKNOWN', high: 'UNKNOWN', medium: 'UNKNOWN', low: 'PASS', info: 'PASS' },
    verified:      { critical: 'PASS',    high: 'PASS',    medium: 'PASS',    low: 'PASS', info: 'PASS' },
    accepted_risk: { critical: 'FAIL',    high: 'FAIL',    medium: 'FAIL',    low: 'PASS', info: 'PASS' },
  };
  for (const [status, bySeverity] of Object.entries(expected)) {
    for (const [severity, state] of Object.entries(bySeverity)) {
      const gate = findingsGate({ findings: [{ finding_id: 'X', repository: CT, severity, status }] }, CT);
      assert.equal(gate.state, state, `${status}/${severity}`);
      // Anything that passes while not verified is still listed, never silent.
      if (state === 'PASS' && status !== 'verified') {
        assert.equal(gate.blocking.length + gate.unverified.length + gate.acceptedRisks.length + gate.openLow.length, 1, `${status}/${severity} listed`);
      }
    }
  }
});

test('#3 (CT-0010) any future or invalid freshness timestamp is UNKNOWN, never PASS', () => {
  const now = Date.parse('2026-10-18T12:00:00Z');
  assert.equal(freshnessState(now + 3_600_000, 3_600_000, now), 'UNKNOWN');
  assert.equal(freshnessState(now + 60_000, 3_600_000, now), 'UNKNOWN', 'no clock-skew tolerance (CT-0010)');
  assert.equal(freshnessState(now + 1, 3_600_000, now), 'UNKNOWN', 'even 1 ms ahead');
  assert.equal(freshnessState(now, 3_600_000, now), 'PASS', 'exactly now is not future');
  assert.equal(freshnessState(Infinity, 3_600_000, now), 'UNKNOWN');
  assert.equal(freshnessState(NaN, 3_600_000, now), 'UNKNOWN');
  assert.equal(freshnessState('2026-10-18', 3_600_000, now), 'UNKNOWN');
});

test('CT-0010 acceptance: freshnessState boundary and input matrix', () => {
  const now = Date.parse('2026-10-18T12:00:00Z');
  const maxAge = 3_600_000;
  // Future by any amount never passes.
  assert.equal(freshnessState(now + 1, maxAge, now), 'UNKNOWN', '+1 ms');
  assert.equal(freshnessState(now + 60_000, maxAge, now), 'UNKNOWN', '+1 min');
  assert.equal(freshnessState(now + 3_600_000, maxAge, now), 'UNKNOWN', '+1 h');
  // Documented boundaries: exactly now is not future; age exactly maxAge is still fresh.
  assert.equal(freshnessState(now, maxAge, now), 'PASS', 'timestamp === now');
  assert.equal(freshnessState(now - maxAge, maxAge, now), 'PASS', 'age === maxAge');
  assert.equal(freshnessState(now - maxAge - 1, maxAge, now), 'STALE', 'age === maxAge + 1 ms');
  // Valid past timestamps keep PASS / STALE.
  assert.equal(freshnessState(now - 60_000, maxAge, now), 'PASS', 'recent');
  assert.equal(freshnessState(now - 7_200_000, maxAge, now), 'STALE', 'expired');
  // Missing, non-numeric and non-finite inputs.
  for (const [label, value] of [['undefined', undefined], ['null', null], ['string', '2026-10-18T11:00:00Z'],
    ['numeric string', String(now - 60_000)], ['NaN', NaN], ['Infinity', Infinity], ['-Infinity', -Infinity], ['object', {}]]) {
    assert.equal(freshnessState(value, maxAge, now), 'UNKNOWN', label);
  }
});
