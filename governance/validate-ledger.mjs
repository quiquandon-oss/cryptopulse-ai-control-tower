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
const REVIEW_URL_RE = /\/pull\/(\d+)#(?:pullrequestreview-\d+|discussion_r\d+|issuecomment-\d+)$/;
const ID_RE = new RegExp(PROPS.finding_id.pattern);
const CONTROL_TOWER = 'quiquandon-oss/cryptopulse-ai-control-tower';

// Controlled identities (schema enum). Claude is the developer; Gemini plans.
// Only the reviewer or the decision maker can independently verify a fix.
const IDENTITIES = PROPS.reviewer.enum;
const INDEPENDENT_VERIFIERS = ['ChatGPT', 'Olivier'];

/** Well-formed AND a real instant that round-trips (rejects 2026-02-30, 24:00, …). */
function isRealUtc(value) {
  if (typeof value !== 'string' || !TS.test(value)) return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms) && new Date(ms).toISOString().replace('.000Z', 'Z') === value;
}

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
    if ('fix_reference' in f && (typeof f.fix_reference !== 'string' || !f.fix_reference.trim()) && f.fix_reference !== '') err(at, 'fix_reference must be a non-empty string');
    for (const key of ['timestamp', 'found_at']) {
      if (!(key in f)) continue;
      if (typeof f[key] !== 'string' || !TS.test(f[key])) err(at, `${key} must be UTC ISO 8601 (YYYY-MM-DDTHH:MM:SSZ)`);
      else if (!isRealUtc(f[key])) err(at, `${key} "${f[key]}" is not a real UTC date`);
    }
    for (const key of ['source_url', 'verification_url']) if (key in f && (typeof f[key] !== 'string' || !URL_RE.test(f[key]))) err(at, `${key} must be a github.com/quiquandon-oss URL`);
    if ('pr' in f && !(Number.isInteger(f.pr) && f.pr >= 1)) err(at, 'pr must be a positive integer');
    if ('related_prs' in f) {
      const list = f.related_prs;
      if (!Array.isArray(list) || !list.every((n) => Number.isInteger(n) && n >= 1) || new Set(list).size !== list.length) {
        err(at, 'related_prs must be an array of unique positive integers');
      } else if (list.includes(f.pr)) err(at, 'related_prs must not repeat pr');
    }
    if (typeof f.description === 'string' && f.description.length < 10) err(at, 'description too short');
    if ('reviewer' in f && !IDENTITIES.includes(f.reviewer)) err(at, `reviewer must be one of ${IDENTITIES.join(', ')} (controlled identities)`);

    // R2 — IDs are unique and never reused.
    if (typeof f.finding_id === 'string') {
      if (seen.has(f.finding_id)) err(at, 'duplicate finding_id');
      seen.add(f.finding_id);
    }

    // R3–R6 — status-dependent evidence.
    const method = typeof f.verification_method === 'string' ? f.verification_method.trim() : '';
    // A fix is a commit, or — for non-code fixes such as repository settings —
    // an explicit fix_reference (e.g. a ruleset id). Never neither.
    const hasFixRef = typeof f.fix_reference === 'string' && f.fix_reference.trim() !== '';
    if (f.status === 'open' && (f.fix_commit_sha || hasFixRef)) err(at, 'open findings must not have a fix_commit_sha or fix_reference (R3)');
    if (['fixed', 'verified'].includes(f.status)) {
      if (!f.fix_commit_sha && !hasFixRef) err(at, `${f.status} requires fix_commit_sha or fix_reference (R4)`);
      if (!method) err(at, `${f.status} requires verification_method (R4)`);
    }
    if (f.status === 'verified') {
      if (!INDEPENDENT_VERIFIERS.includes(f.reviewer)) err(at, `verified requires an independent verifier (${INDEPENDENT_VERIFIERS.join(' or ')}); the developer cannot verify their own fix (R5)`);
      const m = typeof f.verification_url === 'string' ? f.verification_url.match(REVIEW_URL_RE) : null;
      if (!f.verification_url) err(at, 'verified requires verification_url linking to the verifying review (R5)');
      else {
        // The review must be on the finding's own PR or an explicitly related one.
        const prs = [f.pr, ...(Array.isArray(f.related_prs) ? f.related_prs : [])].filter(Number.isInteger);
        const where = prs.length ? `pull/${prs.length > 1 ? `${prs.slice(0, -1).join(', ')} or ${prs.at(-1)}` : prs[0]}` : 'a pull request';
        if (!m || (prs.length && !prs.includes(Number(m[1])))) err(at, `verification_url must link to a review on ${where} (R5)`);
      }
    }
    if (f.status === 'accepted_risk') {
      if (f.reviewer !== 'Olivier') err(at, 'accepted_risk must be accepted by Olivier, the decision maker (R6)');
      if (!method) err(at, 'accepted_risk requires the rationale in verification_method (R6)');
      if (f.severity === 'critical') err(at, 'critical findings cannot be accepted as risk (R6)');
    }

    // R7 — time order.
    const t = isRealUtc(f.timestamp) ? Date.parse(f.timestamp) : null;
    const found = isRealUtc(f.found_at) ? Date.parse(f.found_at) : null;
    // No tolerance: a record dated after the validator's clock is in the future (CT-0014).
    if (t != null && t > now) err(at, 'timestamp is in the future (R7)');
    if (found != null && found > now) err(at, 'found_at is in the future (R7)');
    if (t != null && found != null && found > t) err(at, 'found_at is after timestamp (R7)');

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
