// Pure derivation of the five-gate workflow from real GitHub state.
// No network, no DOM: unit-tested in ui/tests/model.test.mjs.
//
// Gate evidence (SOP in docs/AI_CONTROL_TOWER_MASTER.md):
//   1 Plan (Gemini)       task file exists in tasks/active/
//   2 Implement (Claude)  a pull request references the task ID
//   3 Review (ChatGPT)    that PR has at least one review
//   4 Synthesis (Gemini)  happens outside GitHub -> shown as not tracked
//   5 Decision (Olivier)  PR merged (approved) or closed unmerged (rejected)

export const AGENTS = {
  gemini: { name: 'Gemini', role: 'Planner / Synthesizer', initial: 'G', tone: 'blue' },
  claude: { name: 'Claude', role: 'Developer', initial: 'C', tone: 'purple' },
  chatgpt: { name: 'ChatGPT', role: 'Reviewer', initial: 'R', tone: 'green' },
  olivier: { name: 'Olivier', role: 'Decision Maker', initial: 'O', tone: 'red' },
};

export const GATE_STEPS = [
  { agent: 'gemini', role: 'Planner', tone: 'blue', label: 'Plan & task file' },
  { agent: 'claude', role: 'Developer', tone: 'purple', label: 'Implementation PR' },
  { agent: 'chatgpt', role: 'Reviewer', tone: 'green', label: 'Code review' },
  { agent: 'gemini', role: 'Synthesizer', tone: 'yellow', label: 'Synthesis' },
  { agent: 'olivier', role: 'Decision Maker', tone: 'red', label: 'Final decision' },
];

/**
 * Most relevant PR for a task. A PR whose title names the task wins over one
 * that only mentions it in its description (later PRs often cite earlier
 * tasks); then merged > open > closed, newest first.
 */
export function matchPull(taskId, pulls) {
  const inTitle = (p) => (p.title || '').includes(taskId);
  const inBody = (p) => (p.body || '').includes(taskId);
  const rank = (p) => (p.merged_at ? 0 : p.state === 'open' ? 1 : 2);
  const best = (list) => list.sort((a, b) => rank(a) - rank(b) || b.number - a.number)[0] || null;
  return best(pulls.filter(inTitle)) || best(pulls.filter(inBody));
}

/**
 * @param {object} task     parsed task file
 * @param {object|null} pr  matched pull request
 * @param {object[]|null} reviews  reviews of pr, or null if not loaded
 * @returns {{ gates: object[], status: string, waitingOn: string|null }}
 */
export function deriveWorkflow(task, pr, reviews) {
  const gate = (state, detail, extra = {}) => ({ state, detail, ...extra });
  // state: done | pending | rejected | untracked | locked | loading
  const g1 = gate('done', `Task file ${task.file}`, { link: task.htmlUrl });

  const g2 = pr
    ? gate('done', `PR #${pr.number}: ${pr.title}`, { link: pr.html_url })
    : gate('pending', 'No pull request references this task yet');

  let g3;
  if (!pr) g3 = gate('locked', 'Waits for a pull request');
  else if (reviews == null) g3 = gate('loading', 'Loading reviews…');
  else if (reviews.length) {
    const last = reviews[reviews.length - 1];
    g3 = gate('done', `${reviews.length} review${reviews.length > 1 ? 's' : ''} · latest ${last.state.toLowerCase()} ${(last.submitted_at || '').slice(0, 10)}`, { link: last.html_url });
  } else g3 = gate(pr.merged_at || pr.state === 'closed' ? 'untracked' : 'pending',
    pr.merged_at || pr.state === 'closed' ? 'No review recorded on GitHub' : `No review on PR #${pr.number} yet`);

  const g4 = gate('untracked', 'Happens outside GitHub; not tracked here');

  let g5;
  if (!pr) g5 = gate('locked', 'Waits for a pull request');
  else if (pr.merged_at) g5 = gate('done', `Merged ${pr.merged_at.slice(0, 10)}`, { link: pr.html_url });
  else if (pr.state === 'closed') g5 = gate('rejected', 'Closed without merging', { link: pr.html_url });
  else g5 = gate('pending', 'Awaiting merge decision', { link: pr.html_url });

  const gates = [g1, g2, g3, g4, g5];
  const status = pr && pr.merged_at ? 'Completed'
    : pr && pr.state === 'closed' ? 'Closed'
      : pr ? 'In Review' : 'Planned';
  const firstPending = gates.findIndex((g) => g.state === 'pending');
  return { gates, status, waitingOn: firstPending >= 0 ? GATE_STEPS[firstPending].agent : null };
}

/** Which agents are waiting, derived from open tasks' workflows. */
export function agentQueues(workflows) {
  const queues = Object.fromEntries(Object.keys(AGENTS).map((k) => [k, []]));
  workflows.forEach(({ task, waitingOn }) => { if (waitingOn) queues[waitingOn].push(task.id); });
  return queues;
}
