// Gate derivation and task parsing (pure functions; inputs mimic GitHub API shapes).
// Run from the repo root:  node --test ui/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { matchPull, deriveWorkflow, agentQueues } from '../js/model.js';
import { parseTask } from '../js/sources/github.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const task = { id: 'TASK-X-001', title: 'Example', file: 'TASK-X-001-example.md', htmlUrl: 'https://github.com/x' };
const pr = (over = {}) => ({ number: 7, title: 'TASK-X-001: Example', body: '', state: 'open', merged_at: null, html_url: 'https://github.com/pr/7', head: { sha: 'a'.repeat(40), ref: 'feature/x' }, ...over });

test('matchPull prefers merged, then open, then closed; newest first', () => {
  const pulls = [
    pr({ number: 1, state: 'closed' }),
    pr({ number: 2, state: 'open' }),
    pr({ number: 3, state: 'closed', merged_at: '2026-10-18T00:00:00Z' }),
    pr({ number: 4, title: 'unrelated' }),
  ];
  assert.equal(matchPull('TASK-X-001', pulls).number, 3);
  assert.equal(matchPull('TASK-X-001', pulls.slice(0, 2)).number, 2);
  assert.equal(matchPull('TASK-X-001', [pr({ number: 9, title: 'x', body: 'Implements TASK-X-001' })]).number, 9);
  assert.equal(matchPull('TASK-Y-002', pulls), null);
});

test('a PR naming the task in its title beats a later PR that only cites it', () => {
  // Real case: PR #6 (TASK-UI-002) mentions TASK-UI-001 in its description.
  const pulls = [
    pr({ number: 6, title: 'TASK-UI-002: Mobile', body: 'Extends the testbed from TASK-X-001', state: 'closed', merged_at: '2026-10-18T13:50:00Z' }),
    pr({ number: 3, title: 'TASK-X-001: Testbed', state: 'closed', merged_at: '2026-10-18T13:00:00Z' }),
  ];
  assert.equal(matchPull('TASK-X-001', pulls).number, 3);
});

test('no PR: implementation pending, later gates not started', () => {
  const w = deriveWorkflow(task, null, null);
  assert.deepEqual(w.gates.map((g) => g.state), ['done', 'pending', 'locked', 'untracked', 'locked']);
  assert.equal(w.status, 'Planned');
  assert.equal(w.waitingOn, 'claude');
});

test('open PR without reviews waits on the reviewer', () => {
  const w = deriveWorkflow(task, pr(), []);
  assert.deepEqual(w.gates.map((g) => g.state), ['done', 'done', 'pending', 'untracked', 'pending']);
  assert.equal(w.status, 'In Review');
  assert.equal(w.waitingOn, 'chatgpt');
});

test('open PR with a review waits on Olivier', () => {
  const w = deriveWorkflow(task, pr(), [{ state: 'COMMENTED', submitted_at: '2026-10-18T13:00:00Z', html_url: 'u' }]);
  assert.equal(w.gates[2].state, 'done');
  assert.equal(w.waitingOn, 'olivier');
});

test('reviews still loading are not reported as missing', () => {
  assert.equal(deriveWorkflow(task, pr(), null).gates[2].state, 'loading');
});

test('merged PR completes the task; closed PR is rejected', () => {
  const merged = deriveWorkflow(task, pr({ state: 'closed', merged_at: '2026-10-18T13:50:00Z' }), []);
  assert.equal(merged.status, 'Completed');
  assert.equal(merged.gates[4].state, 'done');
  assert.equal(merged.waitingOn, null);
  const closed = deriveWorkflow(task, pr({ state: 'closed' }), []);
  assert.equal(closed.status, 'Closed');
  assert.equal(closed.gates[4].state, 'rejected');
});

test('agentQueues groups open tasks by who they wait on', () => {
  const q = agentQueues([{ task: { id: 'A' }, waitingOn: 'claude' }, { task: { id: 'B' }, waitingOn: 'olivier' }, { task: { id: 'C' }, waitingOn: null }]);
  assert.deepEqual(q, { gemini: [], claude: ['A'], chatgpt: [], olivier: ['B'] });
});

test('parseTask reads the real task files, ignoring citation markers', () => {
  const md = readFileSync(join(REPO, 'tasks/active/TASK-UI-002-mobile-ui-testbed.md'), 'utf8');
  const t = parseTask(md, 'TASK-UI-002-mobile-ui-testbed.md');
  assert.equal(t.id, 'TASK-UI-002');
  assert.equal(t.title, 'Mobile-Friendly UI Testbed Implementation');
  assert.equal(t.repository, 'cryptopulse-ai-control-tower');
  assert.equal(t.author, 'Gemini (Master Orchestrator)');

  const cited = parseTask('# Task ID: TASK-Z-009 — Thing[span_1](start_span)\n- **Target Version:** V2[cite: 1]\n', 'x.md');
  assert.equal(cited.title, 'Thing');
  assert.equal(cited.version, 'V2');
  assert.equal(parseTask('no heading', 'TASK-AB-012-notes.md').id, 'TASK-AB-012');
});

test('failed review fetch is reported as unavailable, never as "no review"', () => {
  const err = new Error('HTTP 503');
  const w = deriveWorkflow(task, pr(), null, err);
  assert.equal(w.gates[2].state, 'error');
  assert.equal(w.gates[2].error, err);
  assert.ok(!/No review/i.test(w.gates[2].detail), w.gates[2].detail);
  // Unknown review state => we cannot say who the task waits on.
  assert.equal(w.waitingOn, null);
});

test('reviews still loading do not let a later gate claim the wait', () => {
  assert.equal(deriveWorkflow(task, pr(), null).waitingOn, null);
});

test('selectWorkflows keeps review errors distinct from empty reviews', async () => {
  const { selectWorkflows } = await import('../js/data.js');
  const reviewErr = Object.assign(new Error('Unreachable'), { kind: 'network' });
  const store = (reviewsEntry) => ({
    need: (key) => ({
      tasks: { status: 'ok', data: { tasks: [{ ...task }], at: 1 } },
      pulls: { status: 'ok', data: { pulls: [pr()], at: 1 } },
      'reviews:7': reviewsEntry,
    })[key],
  });
  const failed = selectWorkflows(store({ status: 'error', error: reviewErr })).items[0].workflow;
  assert.equal(failed.gates[2].state, 'error');
  assert.equal(failed.waitingOn, null);
  const empty = selectWorkflows(store({ status: 'ok', data: { reviews: [] } })).items[0].workflow;
  assert.equal(empty.gates[2].state, 'pending');
  assert.equal(empty.waitingOn, 'chatgpt');
  const loading = selectWorkflows(store({ status: 'loading' })).items[0].workflow;
  assert.equal(loading.gates[2].state, 'loading');
});
