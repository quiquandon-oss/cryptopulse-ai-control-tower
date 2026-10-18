// Ledger validator: the real ledger passes; each rule rejects a violating entry.
// Run from the repo root:  node --test governance/tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateLedger, REQUIRED } from '../validate-ledger.mjs';

const GOV = join(dirname(fileURLToPath(import.meta.url)), '..');
const ledger = JSON.parse(readFileSync(join(GOV, 'ledger.json'), 'utf8'));
const schema = JSON.parse(readFileSync(join(GOV, 'ledger.schema.json'), 'utf8'));
const inGit = (sha) => { try { execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd: GOV, stdio: 'ignore' }); return true; } catch { return false; } };

// A valid 'fixed' entry to mutate in negative tests.
const base = () => ({
  finding_id: 'CT-9999',
  repository: 'quiquandon-oss/cryptopulse-ai-control-tower',
  file_path: 'ui/js/app.js',
  commit_sha: 'a'.repeat(40),
  description: 'Example defect description',
  severity: 'medium',
  status: 'fixed',
  verification_method: 'Unit tests X and Y',
  timestamp: '2026-10-18T12:00:00Z',
  reviewer: 'Claude',
  found_at: '2026-10-18T11:00:00Z',
  fix_commit_sha: 'b'.repeat(40),
});
const check = (finding) => validateLedger({ schema_version: 1, findings: [finding] });
const rejects = (finding, re) => {
  const errors = check(finding);
  assert.ok(errors.some((e) => re.test(e)), `expected ${re}, got ${JSON.stringify(errors)}`);
};

test('the committed ledger is valid, and every SHA exists in git history', () => {
  assert.deepEqual(validateLedger(ledger, { commitExists: inGit }), []);
  assert.ok(ledger.findings.length >= 7);
});

test('validator required fields are exactly the schema\'s (no drift)', () => {
  assert.deepEqual(REQUIRED, schema.$defs.finding.required);
  assert.deepEqual([...REQUIRED].sort(), ['commit_sha', 'description', 'file_path', 'finding_id', 'repository', 'reviewer', 'severity', 'status', 'timestamp', 'verification_method']);
});

test('the base fixture itself is valid', () => assert.deepEqual(check(base()), []));

test('R1 shape: missing, unknown, enum and pattern violations', () => {
  for (const key of REQUIRED) { const f = base(); delete f[key]; rejects(f, new RegExp(`missing required "${key}"`)); }
  rejects({ ...base(), extra: 1 }, /unknown property "extra"/);
  rejects({ ...base(), severity: 'urgent' }, /severity must be one of/);
  rejects({ ...base(), status: 'closed' }, /status must be one of/);
  rejects({ ...base(), repository: 'someone/else' }, /unknown repository/);
  rejects({ ...base(), commit_sha: 'abc1234' }, /full 40-hex SHA/);
  rejects({ ...base(), finding_id: 'F-1' }, /CT-NNNN/);
  rejects({ ...base(), timestamp: '2026-10-18 12:00' }, /UTC ISO 8601/);
  rejects({ ...base(), source_url: 'https://evil.example/x' }, /github\.com\/quiquandon-oss URL/);
  assert.deepEqual(validateLedger({ schema_version: 2, findings: [] }), ['ledger: schema_version must be 1']);
  assert.ok(validateLedger([]).length > 0);
});

test('R2 duplicate IDs', () => {
  const errors = validateLedger({ schema_version: 1, findings: [base(), base()] });
  assert.ok(errors.some((e) => /duplicate finding_id/.test(e)));
});

test('R3 open findings carry no fix commit', () => rejects({ ...base(), status: 'open' }, /R3/));

test('R4 fixed/verified need a fix commit and a method', () => {
  rejects({ ...base(), fix_commit_sha: null }, /R4/);
  rejects({ ...base(), verification_method: '  ' }, /R4/);
});

test('R5 the developer cannot verify their own fix', () => {
  rejects({ ...base(), status: 'verified', reviewer: 'Claude' }, /R5/);
  assert.deepEqual(check({ ...base(), status: 'verified', reviewer: 'ChatGPT', pr: 3, verification_url: 'https://github.com/quiquandon-oss/cryptopulse-ai-control-tower/pull/3#pullrequestreview-1' }), []);
});

test('R6 accepted_risk is Olivier\'s decision, with rationale, never for critical', () => {
  const risk = { ...base(), status: 'accepted_risk', fix_commit_sha: null, reviewer: 'Olivier', verification_method: 'Local-only tool; risk accepted' };
  assert.deepEqual(check(risk), []);
  rejects({ ...risk, reviewer: 'ChatGPT' }, /R6/);
  rejects({ ...risk, verification_method: '' }, /R6/);
  rejects({ ...risk, severity: 'critical' }, /R6/);
});

test('R7 time order', () => {
  rejects({ ...base(), found_at: '2026-10-19T00:00:00Z' }, /R7/);
  rejects({ ...base(), timestamp: '2999-01-01T00:00:00Z', found_at: '2999-01-01T00:00:00Z' }, /future/);
});

test('R8 fix commit differs from the observed commit', () => rejects({ ...base(), fix_commit_sha: 'a'.repeat(40) }, /R8/));

test('R9 credential-like strings are refused in any field', () => {
  rejects({ ...base(), description: 'Leaked ghp_abcdefghijklmnopqrstuvwxyz0123456789 in logs' }, /R9/);
  rejects({ ...base(), verification_method: 'api_key = "sk_live_0123456789abcdef"' }, /R9/);
  rejects({ ...base(), description: 'Found -----BEGIN RSA PRIVATE KEY----- in repo' }, /R9/);
});

test('--check-commits flags SHAs that are not in this repository', () => {
  const errors = validateLedger({ schema_version: 1, findings: [base()] }, { commitExists: inGit });
  assert.ok(errors.some((e) => /not found in local git history/.test(e)));
});

// --- ChatGPT review of PR #8 (findings 4–5) ---------------------------------

test('#4 timestamps must be real calendar instants, not just well-formed', () => {
  for (const bad of ['2026-99-99T99:99:99Z', '2026-02-30T10:00:00Z', '2026-10-18T24:00:00Z', '2026-10-18T12:60:00Z']) {
    rejects({ ...base(), timestamp: bad, found_at: '2026-01-01T00:00:00Z' }, /not a real UTC date/);
    rejects({ ...base(), found_at: bad }, /not a real UTC date/);
  }
  assert.deepEqual(check({ ...base(), timestamp: '2024-02-29T23:59:59Z', found_at: '2024-02-29T00:00:00Z' }), [], 'leap day is valid');
});

test('#5 reviewer must be a known identity; verified needs an independent reviewer and a review link', () => {
  rejects({ ...base(), reviewer: 'quiquandon-oss' }, /reviewer must be one of/);
  rejects({ ...base(), reviewer: 'claude' }, /reviewer must be one of/);
  rejects({ ...base(), reviewer: 'Claude Code' }, /reviewer must be one of/);
  const verified = { ...base(), status: 'verified', reviewer: 'ChatGPT', pr: 6, verification_url: 'https://github.com/quiquandon-oss/cryptopulse-ai-control-tower/pull/6#pullrequestreview-1' };
  assert.deepEqual(check(verified), []);
  rejects({ ...verified, reviewer: 'Claude' }, /R5/);
  rejects({ ...verified, reviewer: 'Gemini' }, /R5/);
  const { verification_url: _omit, ...noUrl } = verified;
  rejects(noUrl, /verification_url/);
  rejects({ ...verified, verification_url: 'https://github.com/quiquandon-oss/cryptopulse-ai-control-tower/commit/abc' }, /review on/);
  rejects({ ...verified, verification_url: 'https://github.com/quiquandon-oss/cryptopulse-ai-control-tower/pull/7#pullrequestreview-1' }, /pull\/6/);
});
