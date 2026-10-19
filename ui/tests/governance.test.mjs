// Governance view data (TASK-INT-002) and per-source failure isolation (CT-0006).
// Run from the repo root:  node --test ui/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isAllowedUrl } from '../js/lib/http.js';
import { loadLedger, checkLedger, LEDGER_URL } from '../js/sources/governance.js';
import { listTasks } from '../js/sources/github.js';
import { deriveWorkflow } from '../js/model.js';
import { findingsGate } from '../../governance/evidence.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CT = 'quiquandon-oss/cryptopulse-ai-control-tower';
const realLedger = () => JSON.parse(readFileSync(join(REPO, 'governance/ledger.json'), 'utf8'));
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Replace fetch for one test; `handler(url)` returns a Response or throws. */
function stubFetch(t, handler) {
  const real = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (url, init) => { requested.push({ url: String(url), method: init?.method }); return handler(String(url)); };
  t.after(() => { globalThis.fetch = real; });
  return requested;
}

test('ledger URL is allow-listed exactly; nothing else under governance/ or another branch', () => {
  assert.equal(LEDGER_URL, `https://raw.githubusercontent.com/${CT}/main/governance/ledger.json`);
  assert.equal(isAllowedUrl(LEDGER_URL), true);
  for (const url of [
    `https://raw.githubusercontent.com/${CT}/main/governance/ledger.schema.json`,
    `https://raw.githubusercontent.com/${CT}/main/governance/validate-ledger.mjs`,
    `https://raw.githubusercontent.com/${CT}/main/governance/`,
    `https://raw.githubusercontent.com/${CT}/feature-x/governance/ledger.json`,
    `${LEDGER_URL}?token=x`,
    `${LEDGER_URL}/x`,
    `http://raw.githubusercontent.com/${CT}/main/governance/ledger.json`,
    `https://raw.githubusercontent.com/${CT}/main/README.md`,
  ]) assert.equal(isAllowedUrl(url), false, url);
});

test('loadLedger: one GET to the ledger; gate computed by governance/evidence.mjs', async (t) => {
  const ledger = realLedger();
  const requested = stubFetch(t, () => json(ledger));
  const res = await loadLedger();
  assert.deepEqual(requested, [{ url: LEDGER_URL, method: 'GET' }]);
  assert.equal(res.findings.length, ledger.findings.length);
  const gate = res.gates.find((g) => g.repository === CT);
  assert.deepEqual(gate, { repository: CT, ...findingsGate(ledger, CT) });
});

test('loadLedger: unreachable, HTTP error or malformed ledger rejects (never a fallback gate)', async (t) => {
  let respond;
  stubFetch(t, (url) => respond(url));
  respond = () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(loadLedger(), { kind: 'network' });
  respond = () => json({}, 404);
  await assert.rejects(loadLedger(), { kind: 'http' });
  for (const bad of [{}, { findings: 'x' }, { findings: [{ finding_id: 'CT-0001', repository: CT, severity: 'urgent', status: 'open' }] },
    { findings: [{ finding_id: 'CT-0001', repository: CT, severity: 'high', status: 'done' }] }, { findings: [null] }]) {
    respond = () => json(bad);
    await assert.rejects(loadLedger(), { kind: 'parse' }, JSON.stringify(bad));
  }
});

test('checkLedger accepts the real ledger', () => {
  assert.doesNotThrow(() => checkLedger(realLedger()));
});

test('CT-0006: one unreadable task file does not fail the task list', async (t) => {
  const listing = ['TASK-A-001-ok.md', 'TASK-B-002-broken.md', 'TASK-C-003-ok.md'].map((name) => ({
    type: 'file', name, html_url: `https://github.com/${CT}/blob/main/tasks/active/${name}`,
  }));
  stubFetch(t, (url) => {
    if (url.startsWith('https://api.github.com/')) return json(listing);
    if (url.includes('broken')) return new Response('nope', { status: 500 });
    const id = url.match(/(TASK-[A-Z]-\d{3})/)[1];
    return new Response(`# Task ID: ${id} — Title ${id}\n- **Target Repository:** \`x\`\n`, { status: 200 });
  });
  const { tasks } = await listTasks();
  assert.deepEqual(tasks.map((x) => x.id), ['TASK-A-001', 'TASK-B-002', 'TASK-C-003']);
  assert.equal(tasks[0].title, 'Title TASK-A-001');
  assert.equal(tasks[0].loadError, undefined);
  assert.equal(tasks[1].loadError.kind, 'http');
  assert.equal(tasks[1].file, 'TASK-B-002-broken.md');

  // The failed task's plan gate is an error, so nobody is named as waiting.
  const wf = deriveWorkflow(tasks[1], null, null);
  assert.equal(wf.gates[0].state, 'error');
  assert.equal(wf.waitingOn, null);
  assert.equal(deriveWorkflow(tasks[0], null, null).gates[0].state, 'done');
});

test('CT-0006: a failed directory listing still fails the list (no task is known)', async (t) => {
  stubFetch(t, () => json({}, 500));
  await assert.rejects(listTasks(), { kind: 'http' });
});
