#!/usr/bin/env node
// Validates governance/ledger.json against ledger.schema.json plus the
// cross-field rules R1–R9 in docs/EVIDENCE_MODEL.md. No dependencies.
//
//   node governance/validate-ledger.mjs                 # validate, exit 0/1
//   node governance/validate-ledger.mjs --check-commits # also confirm SHAs exist in local git
//   node governance/validate-ledger.mjs path/to/ledger.json
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMA = JSON.parse(readFileSync(join(HERE, 'ledger.schema.json'), 'utf8'));
const FINDING = SCHEMA.$defs.finding;

export const REQUIRED = FINDING.required;
const PROPS = FINDING.properties;
const SHA = new RegExp(SCHEMA.$defs.sha.pattern);
const TS = new RegExp(SCHEMA.$defs.timestamp.pattern);
const URL_RE = new RegExp(PROPS.source_url.pattern);
const ID_RE = new RegExp(PROPS.finding_id.pattern);
const CONTROL_TOWER = 'quiquandon-oss/cryptopulse-ai-control-tower';

// Credential-shaped strings must never be recorded in the ledger (R9).
const SECRET_PATTERNS = [
  /gh[pousr]_[A-Za-z0-9]{20,}/, /github_pat_[A-Za-z0-9_]{20,}/, /AKIA[0-9A-Z]{16}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\bBearer\s+[A-Za-z0-9._-]{20,}/i,
  /(api[_-]?key|token|secret|password)\s*[:=]\s*['"]?[A-Za-z0-9/+_-]{16,}/i,
];

/**
 * @param {unknown} ledger  parsed ledger.json
 * @param {{ now?: number, commitExists?: (sha: string) => boolean }} [opts]
 * @returns {string[]} error messages (empty = valid)
 */
export function validateLedger(ledger, { now = Date.now(), commitExists = null } = {}) {
  const errors = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);

  if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) return ['ledger: must be a JSON object'];
  for (const key of Object.keys(ledger)) if (!(key in SCHEMA.properties)) err('ledger', `unknown property "${key}"`);
  if (ledger.schema_version !== 1) err('ledger', 'schema_version must be 1');
  if (!Array.isArray(ledger.findings)) return [...errors, 'ledger: findings must be an array'];

  const seen = new Set();
  ledger.findings.forEach((f, i) => {
    const at = `findings[${i}]${f && f.finding_id ? ` (${f.finding_id})` : ''}`;
    if (!f || typeof f !== 'object' || Array.isArray(f)) { err(at, 'must be an object'); return; }

    // R1 — shape: required fields, no unknown fields, types, enums, patterns.
    for (const key of REQUIRED) if (!(key in f)) err(at, `missing required "${key}"`);
    for (const key of Object.keys(f)) if (!(key in PROPS)) err(at, `unknown property "${key}"`);
    for (const key of ['finding_id', 'repository', 'file_path', 'commit_sha', 'description', 'severity', 'status', 'verification_method', 'timestamp', 'reviewer']) {
      if (key in f && typeof f[key] !== 'string') err(at, `"${key}" must be a string`);
    }
    if (typeof f.finding_id === 'string' && !ID_RE.test(f.finding_id)) err(at, 'finding_id must match CT-NNNN');
    if ('repository' in f && !PROPS.repository.enum.includes(f.repository)) err(at, `unknown repository "${f.repository}"`);
    if ('severity' in f && !PROPS.severity.enum.includes(f.severity)) err(at, `severity must be one of ${PROPS.severity.enum.join(', ')}`);
    if ('status' in f && !PROPS.status.enum.includes(f.status)) err(at, `status must be one of ${PROPS.status.enum.join(', ')}`);
    if (typeof f.commit_sha === 'string' && !SHA.test(f.commit_sha)) err(at, 'commit_sha must be a full 40-hex SHA');
    if (f.fix_commit_sha != null && (typeof f.fix_commit_sha !== 'string' || !SHA.test(f.fix_commit_sha))) err(at, 'fix_commit_sha must be a full 40-hex SHA or null');
    for (const key of ['timestamp', 'found_at']) if (key in f && (typeof f[key] !== 'string' || !TS.test(f[key]))) err(at, `${key} must be UTC ISO 8601 (YYYY-MM-DDTHH:MM:SSZ)`);
    for (const key of ['source_url', 'verification_url']) if (key in f && (typeof f[key] !== 'string' || !URL_RE.test(f[key]))) err(at, `${key} must be a github.com/quiquandon-oss URL`);
    if ('pr' in f && !(Number.isInteger(f.pr) && f.pr >= 1)) err(at, 'pr must be a positive integer');
    if (typeof f.description === 'string' && f.description.length < 10) err(at, 'description too short');
    if (typeof f.reviewer === 'string' && !f.reviewer.trim()) err(at, 'reviewer must not be empty');

    // R2 — IDs are unique and never reused.
    if (typeof f.finding_id === 'string') {
      if (seen.has(f.finding_id)) err(at, 'duplicate finding_id');
      seen.add(f.finding_id);
    }

    // R3–R6 — status-dependent evidence.
    const method = typeof f.verification_method === 'string' ? f.verification_method.trim() : '';
    if (f.status === 'open' && f.fix_commit_sha) err(at, 'open findings must not have a fix_commit_sha (R3)');
    if (['fixed', 'verified'].includes(f.status)) {
      if (!f.fix_commit_sha) err(at, `${f.status} requires fix_commit_sha (R4)`);
      if (!method) err(at, `${f.status} requires verification_method (R4)`);
    }
    if (f.status === 'verified' && f.reviewer === 'Claude') err(at, 'verified requires an independent reviewer; the developer cannot verify their own fix (R5)');
    if (f.status === 'accepted_risk') {
      if (f.reviewer !== 'Olivier') err(at, 'accepted_risk must be accepted by Olivier, the decision maker (R6)');
      if (!method) err(at, 'accepted_risk requires the rationale in verification_method (R6)');
      if (f.severity === 'critical') err(at, 'critical findings cannot be accepted as risk (R6)');
    }

    // R7 — time order.
    const t = Date.parse(f.timestamp);
    const found = Date.parse(f.found_at);
    if (!Number.isNaN(t) && t > now + 5 * 60 * 1000) err(at, 'timestamp is in the future (R7)');
    if (!Number.isNaN(t) && !Number.isNaN(found) && found > t) err(at, 'found_at is after timestamp (R7)');

    // R8 — a fix is a different commit from the one the finding was seen on.
    if (f.fix_commit_sha && f.fix_commit_sha === f.commit_sha) err(at, 'fix_commit_sha equals commit_sha (R8)');

    // R9 — no credentials in any field.
    for (const [key, value] of Object.entries(f)) {
      if (typeof value === 'string' && SECRET_PATTERNS.some((re) => re.test(value))) err(at, `"${key}" contains a credential-like string (R9)`);
    }

    // Optional: commits of this repository must exist in local history.
    if (commitExists && f.repository === CONTROL_TOWER) {
      for (const key of ['commit_sha', 'fix_commit_sha']) {
        if (typeof f[key] === 'string' && SHA.test(f[key]) && !commitExists(f[key])) err(at, `${key} ${f[key].slice(0, 7)} not found in local git history`);
      }
    }
  });
  return errors;
}

function gitCommitExists(sha) {
  try {
    execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd: HERE, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--')) || join(HERE, 'ledger.json');
  let ledger;
  try {
    ledger = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`✖ cannot read ${file}: ${e.message}`);
    process.exit(1);
  }
  const errors = validateLedger(ledger, { commitExists: args.includes('--check-commits') ? gitCommitExists : null });
  if (errors.length) {
    errors.forEach((e) => console.error(`✖ ${e}`));
    console.error(`${errors.length} problem(s) in ${file}`);
    process.exit(1);
  }
  const counts = {};
  ledger.findings.forEach((f) => { counts[f.status] = (counts[f.status] || 0) + 1; });
  console.log(`✔ ${file}: ${ledger.findings.length} findings valid (${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')})`);
}
