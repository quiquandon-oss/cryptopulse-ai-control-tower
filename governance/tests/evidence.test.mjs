// Evidence states and release-gate aggregation (docs/EVIDENCE_MODEL.md §1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STATES, aggregate, releaseAllowed, findingsState, freshnessState, UI_STATE_MAP } from '../evidence.mjs';

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
  assert.equal(findingsState({ findings: [f('high', 'accepted_risk')] }, CT), 'PASS');
  assert.equal(findingsState({ findings: [f('critical', 'open')] }, 'quiquandon-oss/CryptoPulseV4'), 'PASS', 'scoped to repository');
});

test('current ledger: control tower findings gate is FAIL because CT-0007 (no CI) is open', () => {
  const ledger = JSON.parse(readFileSync(join(GOV, 'ledger.json'), 'utf8'));
  assert.equal(findingsState(ledger, CT), 'FAIL');
  const blockers = ledger.findings.filter((x) => x.status === 'open' && ['critical', 'high', 'medium'].includes(x.severity)).map((x) => x.finding_id);
  assert.deepEqual(blockers, ['CT-0007']);
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
