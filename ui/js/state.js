// Local mock state for the Control Tower UI test.
//
// Nothing here talks to GitHub, Cloudflare or any agent. All data below is
// illustrative; actions in the UI only change this in-memory object (and an
// optional localStorage copy so a page refresh keeps your clicks).

const STORAGE_KEY = 'ct-ui-test-state-v1';

/** The four participants defined in docs/AI_CONTROL_TOWER_MASTER.md. */
export const AGENTS = {
  gemini: { name: 'Gemini', role: 'Planner / Synthesizer', initial: 'G', tone: 'blue' },
  claude: { name: 'Claude', role: 'Developer', initial: 'C', tone: 'purple' },
  chatgpt: { name: 'ChatGPT', role: 'Reviewer', initial: 'R', tone: 'green' },
  olivier: { name: 'Olivier', role: 'Decision Maker', initial: 'O', tone: 'red' },
};

/** The five human gates of the SOP, in order. Step 5 is the final decision. */
export const GATE_STEPS = [
  { agent: 'gemini', role: 'Planner', tone: 'blue', blurb: 'Create the plan and prepare instruction for Claude' },
  { agent: 'claude', role: 'Developer', tone: 'purple', blurb: 'Implement the changes according to the plan' },
  { agent: 'chatgpt', role: 'Reviewer', tone: 'green', blurb: 'Review the implementation and provide findings' },
  { agent: 'gemini', role: 'Synthesizer', tone: 'yellow', blurb: 'Combine results and give recommendation' },
  { agent: 'olivier', role: 'Decision Maker', tone: 'red', blurb: 'Authorize next action at each stage' },
];

/** Options offered at the final gate (Human Gate 5/5). */
export const FINAL_DECISIONS = [
  { id: 'merge', label: 'Merge to main' },
  { id: 'deploy_staging', label: 'Deploy to staging' },
  { id: 'deploy_production', label: 'Deploy to production' },
  { id: 'request_changes', label: 'Request changes' },
  { id: 'iterate', label: 'Iterate (back to previous step)' },
];

/** Projects in scope, from section 3 of the master protocol. */
export const PROJECTS = [
  { version: 'V1', repo: 'quiquandon-oss/cryptopulse', scope: 'Initial market intelligence prototype and baseline logic' },
  { version: 'V2', repo: 'quiquandon-oss/pulseworkerv2', scope: 'Cloudflare Worker backends and D1 database bindings' },
  { version: 'V3', repo: 'quiquandon-oss/cryptopulsev3', scope: 'Advanced prediction models and data ingestion pipelines' },
  { version: 'V4', repo: 'quiquandon-oss/cryptopulsev4', scope: 'Web application suite, UI enhancements, multi-asset tracking' },
];

const gate = (instruction, status = 'pending', output = null) => ({ instruction, status, output });

/** Seed data. Mirrors the example task shown in docs/assets/control-tower-mockup.png. */
const SEED = {
  tasks: [
    {
      id: 'CP-2026-001',
      title: 'Risk-Regime Scorer',
      project: 'CryptoPulseV2',
      repo: 'quiquandon-oss/PulseWorkerV2',
      version: 'V2',
      type: 'Feature Implementation',
      created: '2026-10-12 09:14',
      branch: 'feature/v2-risk-regime-scorer',
      labels: ['v2', 'risk', 'scorer', 'feature'],
      pr: { number: 27, state: 'Open', commit: 'a1b2c3d', files: 12, additions: 482, deletions: 36 },
      ci: [
        { name: 'Unit Tests', result: '18/18 passed', ok: true, duration: '24s' },
        { name: 'Integration Tests', result: '6/6 passed', ok: true, duration: '41s' },
        { name: 'Lint & Format', result: 'Passed', ok: true, duration: '12s' },
        { name: 'Type Check', result: 'Passed', ok: true, duration: '18s' },
        { name: 'Build (Worker)', result: 'Passed', ok: true, duration: '31s' },
      ],
      deployment: { staging: 'Not Deployed', production: 'Not Deployed' },
      decision: null,
      gates: [
        gate('Create a detailed implementation plan for a risk-regime scorer for CryptoPulseV2. Include scope, architecture, files to modify, tests, risks and acceptance criteria. Prepare a clear instruction for Claude.',
          'completed', { time: '2026-10-12 09:16', link: 'View Full Plan', bullets: ['Scope and objectives', 'Technical approach', 'Files to modify', 'Tests and acceptance criteria', 'Risks and open questions', 'Instruction prepared for Claude'] }),
        gate('Implement the risk-regime scorer according to the approved plan from Gemini. Follow the coding standards, add unit and integration tests, and open a pull request.',
          'completed', { time: '2026-10-12 11:42', link: 'View PR #27', bullets: ['Branch: feature/v2-risk-regime-scorer', 'Commit: a1b2c3d', 'Files changed: 12 files (+482 / -36)', 'Tests: 18/18 passed', 'Implementation notes', 'Known limitations'] }),
        gate('Review PR #27 for the risk-regime scorer implementation. Focus on logic correctness, architecture, edge cases, security, performance, tests and alignment with the plan.',
          'completed', { time: '2026-10-12 13:20', link: 'View Review', bullets: ['Overall assessment: Good', '3 suggestions (minor)', 'No blocking issues', 'Tests are comprehensive'], highlight: 'Recommendation: APPROVE WITH MINOR SUGGESTIONS' }),
        gate("Synthesize Claude's implementation and ChatGPT's review. Summarize key findings, address suggestions, and give a clear recommendation (MERGE / REQUEST CHANGES / ITERATE) with next steps.",
          'completed', { time: '2026-10-12 14:05', link: 'View Summary', bullets: ['Implementation meets requirements', 'All tests pass', 'Minor suggestions to address', 'No critical risks', 'Next steps: merge to main and deploy to staging'], highlight: 'Recommendation: MERGE' }),
        gate('', 'pending'),
      ],
    },
    {
      id: 'CP-2026-002',
      title: 'D1 Hot-Path Index Review',
      project: 'CryptoPulseV2',
      repo: 'quiquandon-oss/PulseWorkerV2',
      version: 'V2',
      type: 'Performance',
      created: '2026-10-17 18:02',
      branch: '—',
      labels: ['v2', 'd1', 'perf'],
      pr: null,
      ci: [],
      deployment: { staging: 'Not Deployed', production: 'Not Deployed' },
      decision: null,
      gates: [
        gate('Plan an index review for the most frequent D1 queries in PulseWorkerV2. List candidate indexes, expected read/write cost, and a safe rollout order. Prepare an instruction for Claude.', 'draft'),
        gate(''), gate(''), gate(''), gate(''),
      ],
    },
    {
      id: 'CP-2026-000',
      title: 'Control Tower Governance Docs',
      project: 'Control Tower',
      repo: 'quiquandon-oss/cryptopulse-ai-control-tower',
      version: '—',
      type: 'Documentation',
      created: '2026-10-18 11:50',
      branch: 'claude/sleepy-hawking-e8a9e6',
      labels: ['docs'],
      pr: { number: 1, state: 'Merged', commit: 'fd9a227', files: 3, additions: 127, deletions: 0 },
      ci: [],
      deployment: { staging: 'n/a', production: 'n/a' },
      decision: { id: 'merge', comment: 'Docs approved.', at: '2026-10-18 12:07' },
      gates: [0, 1, 2, 3, 4].map(() => gate('—', 'completed', { time: '2026-10-18', bullets: ['Completed'] })),
    },
  ],
};

// --- Derived values ---------------------------------------------------------

/** Index of the first gate still waiting on the human, or -1 when all are done. */
export function activeGateIndex(task) {
  return task.gates.findIndex((g) => g.status !== 'completed');
}

/** Task lifecycle status shown in pills and lists. */
export function taskStatus(task) {
  if (task.decision && ['merge', 'deploy_staging', 'deploy_production'].includes(task.decision.id)) return 'Completed';
  return activeGateIndex(task) === 0 ? 'Awaiting Approval' : 'In Progress';
}

/**
 * What each agent is doing right now, derived from open tasks: an agent is
 * "Waiting on gate" when a task's active gate is addressed to it.
 */
export function agentStatuses(tasks) {
  const result = Object.fromEntries(Object.keys(AGENTS).map((k) => [k, { status: 'Idle', tasks: [] }]));
  for (const task of tasks) {
    if (taskStatus(task) === 'Completed') continue;
    const i = activeGateIndex(task);
    if (i < 0) continue;
    const who = GATE_STEPS[i].agent;
    result[who].status = 'Waiting on gate';
    result[who].tasks.push(`${task.id} · Gate ${i + 1}/5`);
  }
  return result;
}

// --- Store ------------------------------------------------------------------

function seed() {
  return structuredClone(SEED);
}

// Saved state must have the shape the views read; anything else (stale
// schema, hand-edited storage) falls back to the seed instead of crashing.
function isValidState(s) {
  return Array.isArray(s?.tasks) && s.tasks.every((t) =>
    typeof t?.id === 'string'
    && typeof t.title === 'string'
    && Array.isArray(t.labels)
    && Array.isArray(t.ci)
    && t.deployment && typeof t.deployment === 'object'
    && Array.isArray(t.gates) && t.gates.length === GATE_STEPS.length
    && t.gates.every((g) => typeof g?.instruction === 'string'
      && ['pending', 'draft', 'rejected', 'completed'].includes(g.status)
      && (g.output == null || Array.isArray(g.output.bullets))));
}

// localStorage can throw (private mode, blocked storage); the UI must work without it.
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return isValidState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* persistence is optional */
  }
}

/**
 * Minimal observable store.
 * - update(fn): mutate state, persist, re-render subscribers.
 * - silent(fn): mutate and persist without re-rendering (used while typing).
 */
export function createStore() {
  let state = load() ?? seed();
  const subscribers = new Set();
  const notify = () => subscribers.forEach((fn) => fn(state));
  return {
    get: () => state,
    update(fn) { fn(state); save(state); notify(); },
    silent(fn) { fn(state); save(state); },
    reset() { state = seed(); save(state); notify(); },
    subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
  };
}
