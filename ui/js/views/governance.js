// Governance view: release gate and review findings from governance/ledger.json.
// The gate comes from governance/evidence.mjs (see sources/governance.js); a
// ledger that cannot be loaded or read is UNAVAILABLE, never a pass.
import { h, card, pill } from '../dom.js';
import { GITHUB } from '../config.js';
import { sourceNotice, asOf, errorText } from '../components/source.js';
import { aggregate } from '../../../governance/evidence.mjs';

export const GATE_TONE = {
  PASS: 'green', FAIL: 'red', UNKNOWN: 'yellow', UNAVAILABLE: 'red', STALE: 'yellow', NOT_APPLICABLE: 'neutral',
};
const STATUS_TONE = { open: 'red', fixed: 'yellow', verified: 'green', accepted_risk: 'red' };
const SEVERITY_TONE = { critical: 'red', high: 'red', medium: 'yellow', low: 'neutral', info: 'neutral' };
const STATUS_ORDER = ['open', 'accepted_risk', 'fixed', 'verified'];

// Ledger text is data: only links into this owner's GitHub repos are rendered.
// The URL is parsed, not prefix-matched: '..' or encoded segments could
// otherwise normalize outside the owner (ChatGPT review, PR #12).
const OWNER_PATH = `/${GITHUB.owner}/`;

/** The URL if it is a plain https://github.com/<owner>/… link, else null. */
export function safeLink(url) {
  if (typeof url !== 'string' || url.includes('%') || url.includes('\\')) return null;
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.protocol !== 'https:' || parsed.origin !== 'https://github.com' || parsed.username || parsed.password) return null;
  // Refuse anything the parser had to rewrite (dot segments, case, etc.).
  if (parsed.href !== url || !parsed.pathname.startsWith(OWNER_PATH)) return null;
  return parsed.href;
}

const REPO_RE = new RegExp(`^${GITHUB.owner}/[A-Za-z0-9_-][A-Za-z0-9._-]*$`);
/** Commit and PR links built from ledger fields, each part validated first. */
export function fixCommitLink(f) {
  return REPO_RE.test(f.repository) && /^[0-9a-f]{40}$/.test(f.fix_commit_sha || '')
    ? safeLink(`https://github.com/${f.repository}/commit/${f.fix_commit_sha}`) : null;
}
export function prLink(f) {
  return REPO_RE.test(f.repository) && Number.isInteger(f.pr) && f.pr > 0
    ? safeLink(`https://github.com/${f.repository}/pull/${f.pr}`) : null;
}

const ext = (url, text) => {
  const href = safeLink(url);
  return href ? h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text) : null;
};

/**
 * Overall gate across every repository in the ledger, for the Metrics stat.
 * A ledger that failed to load is UNAVAILABLE; an empty one is NOT_APPLICABLE.
 * @returns {{ status: 'loading'|'ok', state?: string }}
 */
export function overallGate(store) {
  const entry = store.need('ledger');
  if (entry.status === 'loading') return { status: 'loading' };
  if (entry.status === 'error') return { status: 'ok', state: 'UNAVAILABLE' };
  return { status: 'ok', state: aggregate(entry.data.gates.map((g) => g.state)) };
}

const idList = (label, ids) => ids.length > 0 && h('p', {}, h('strong', {}, `${label}: `), h('span', { class: 'mono' }, ids.join(', ')));

function gateCard(g) {
  return card(g.repository, [
    h('p', { class: 'gate-banner' }, pill(g.state, GATE_TONE[g.state]), ' ',
      g.state === 'PASS' ? 'No open or unverified medium-or-higher findings.'
        : g.state === 'FAIL' ? 'Open or risk-accepted medium-or-higher findings block release.'
          : g.state === 'UNKNOWN' ? 'Medium-or-higher fixes await independent verification.' : ''),
    idList('Blocking', g.blocking),
    idList('Fixed, not yet verified', g.unverified),
    idList('Accepted risks', g.acceptedRisks),
    idList('Open (low/info)', g.openLow),
  ]);
}

function findingsTable(findings) {
  const rows = [...findings].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
    || a.finding_id.localeCompare(b.finding_id));
  return h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
    h('thead', {}, h('tr', {}, ['Finding', 'Severity', 'Status', 'Recorded by', 'Evidence', 'Description'].map((c) => h('th', {}, c)))),
    h('tbody', {}, rows.map((f) => h('tr', {},
      h('td', { class: 'mono' }, f.finding_id),
      h('td', {}, pill(f.severity, SEVERITY_TONE[f.severity])),
      h('td', {}, pill(f.status.replace('_', ' '), STATUS_TONE[f.status])),
      h('td', {}, f.reviewer || '—'),
      h('td', { class: 'evidence-links' },
        ext(f.source_url, 'found'),
        ext(f.verification_url, 'verified'),
        ext(fixCommitLink(f), (f.fix_commit_sha || '').slice(0, 7)),
        ext(prLink(f), `#${f.pr}`)),
      h('td', { class: 'finding-desc' }, f.description))))));
}

export function governanceView(route, ctx) {
  const entry = ctx.store.need('ledger');
  const title = h('h1', { class: 'page__title' }, 'Governance');
  const intro = h('p', { class: 'muted' }, 'Release gate and review findings from ',
    h('span', { class: 'mono' }, 'governance/ledger.json'), ' on main. Only ChatGPT or Olivier can mark a finding verified; see the evidence model in the Knowledge Base.');
  if (entry.status !== 'ok') {
    return h('div', { class: 'page' }, title, intro,
      entry.status === 'error' && h('p', { class: 'gate-banner' }, pill('UNAVAILABLE', GATE_TONE.UNAVAILABLE), ` Release gate cannot be evaluated: ${errorText(entry.error)}.`),
      sourceNotice(entry, 'review ledger', ctx.refresh));
  }
  const { findings, gates, at, cached } = entry.data;
  const counts = STATUS_ORDER.map((s) => [s, findings.filter((f) => f.status === s).length]);
  return h('div', { class: 'page' }, title, intro,
    gates.length ? gates.map(gateCard)
      : h('p', { class: 'gate-banner' }, pill('NOT_APPLICABLE', GATE_TONE.NOT_APPLICABLE), ' The ledger has no findings.'),
    card(`Findings (${findings.length})`, [
      h('p', { class: 'counts' }, counts.map(([s, n]) => [pill(`${s.replace('_', ' ')} · ${n}`, n ? STATUS_TONE[s] : 'neutral'), ' '])),
      findings.length > 0 && findingsTable(findings),
      asOf(at, cached),
    ]));
}
