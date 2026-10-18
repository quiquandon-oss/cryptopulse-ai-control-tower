// Workflow view: the five human gates for one task, plus the right rail.
//
// Gate rules (mirrors the SOP in docs/AI_CONTROL_TOWER_MASTER.md):
// - Gates are handled strictly in order; only the first non-completed gate is editable.
// - "Approve & Send" marks the gate completed. In this test UI no agent is
//   contacted; a placeholder output is recorded instead.
// - Gate 5 records Olivier's decision locally. Nothing is merged or deployed.
import { h, pill, nowStamp } from '../dom.js';
import { AGENTS, GATE_STEPS, FINAL_DECISIONS, activeGateIndex, taskStatus } from '../state.js';
import { rail, statusTone } from '../components/rail.js';

export function workflowView(state, route, ctx) {
  const task = state.tasks.find((t) => t.id === route.param)
    ?? state.tasks.find((t) => taskStatus(t) !== 'Completed')
    ?? state.tasks[0];
  if (!task) return h('p', { class: 'muted' }, 'No tasks yet.');

  const current = activeGateIndex(task);
  return h('div', { class: 'workflow' },
    h('div', { class: 'workflow__main' },
      taskHeader(state, task, ctx),
      h('ol', { class: 'gates' },
        GATE_STEPS.map((step, i) => (i === 4
          ? finalGate(task, i, current, ctx)
          : gateRow(task, step, i, current, ctx))))),
    rail(task, ctx));
}

function taskHeader(state, task, ctx) {
  const status = taskStatus(task);
  return h('div', { class: 'task-head' },
    h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' },
      h('a', { href: '#/tasks/active' }, 'Tasks'), ' / ', task.id),
    h('div', { class: 'task-head__row' },
      h('span', { class: 'task-head__icon', 'aria-hidden': 'true' }, '✦'),
      h('h1', { class: 'task-head__title' },
        h('span', { class: 'mono' }, task.id), ' ', `${task.title} (${task.project})`),
      h('div', { class: 'task-head__actions' },
        pill(status, statusTone(status)),
        h('label', { class: 'visually-hidden', for: 'task-switch' }, 'Switch task'),
        h('select', {
          id: 'task-switch', class: 'select',
          onChange: (e) => ctx.navigate(`#/workflow/${e.target.value}`),
        }, state.tasks.map((t) => h('option', { value: t.id, selected: t.id === task.id }, `${t.id} — ${t.title}`))))),
    h('p', { class: 'task-head__meta' },
      h('span', {}, 'Repository: ', h('span', { class: 'link mono' }, task.repo)),
      h('span', {}, `Version: ${task.version}`),
      h('span', {}, `Type: ${task.type}`),
      h('span', {}, `Created: ${task.created}`)));
}

/** Left column of every gate row: step number, agent avatar and role. */
function agentCell(step, i) {
  const agent = AGENTS[step.agent];
  return h('div', { class: 'gate__agent' },
    h('span', { class: `step step--${step.tone}` }, i + 1),
    h('div', { class: 'gate__who' },
      h('span', { class: `avatar avatar--lg avatar--${step.tone}`, 'aria-hidden': 'true' }, agent.initial),
      h('div', {},
        h('strong', {}, agent.name),
        h('span', { class: `role role--${step.tone}` }, step.role),
        h('p', { class: 'gate__blurb' }, step.blurb))));
}

function gateRow(task, step, i, current, ctx) {
  const g = task.gates[i];
  const agent = AGENTS[step.agent];
  const editable = i === current;
  const statusText = { completed: 'Completed', draft: 'Draft', rejected: 'Rejected', pending: editable ? 'Awaiting you' : 'Locked' }[g.status];
  const statusToneMap = { completed: 'green', draft: 'yellow', rejected: 'red', pending: editable ? 'blue' : 'neutral' };

  const setGate = (fn) => ctx.store.update((s) => fn(s.tasks.find((t) => t.id === task.id).gates[i]));

  const approve = () => {
    if (!g.instruction.trim()) return ctx.toast('Write an instruction before approving.');
    setGate((gt) => {
      gt.status = 'completed';
      gt.output = gt.output ?? {
        time: nowStamp(),
        bullets: [`Instruction approved and queued for ${agent.name}`, 'Mock output: no agent was contacted'],
      };
    });
    ctx.toast(`Gate ${i + 1} approved (local mock only).`);
  };

  return h('li', { class: `gate gate--${step.tone}${editable ? ' is-current' : ''}` },
    agentCell(step, i),
    h('div', { class: 'gate__instruction' },
      h('p', { class: 'gate__label' }, `Human Gate ${i + 1}/5 — Review & Approve Instruction to ${agent.name}`),
      h('label', { class: 'field-label', for: `ins-${task.id}-${i}` }, `Instruction to ${agent.name} (editable)`),
      h('textarea', {
        id: `ins-${task.id}-${i}`, class: 'textarea', rows: 4, disabled: !editable,
        placeholder: editable ? `Write the instruction for ${agent.name}…` : 'Unlocks when the previous gate is approved',
        // Keep typing in state without re-rendering (which would drop focus).
        onInput: (e) => ctx.store.silent((s) => { s.tasks.find((t) => t.id === task.id).gates[i].instruction = e.target.value; }),
      }, g.instruction),
      h('button', { class: 'linkbtn', type: 'button', disabled: !editable, onClick: () => ctx.toast('Attachments are not part of the UI test.') },
        '⧉ Attach files / context (optional)'),
      h('div', { class: 'btnrow' },
        h('button', {
          class: 'btn btn--ghost', type: 'button', disabled: !editable,
          onClick: () => { setGate((gt) => { gt.status = 'draft'; }); ctx.toast('Draft saved locally.'); },
        }, 'Save Draft'),
        h('button', { class: 'btn btn--success', type: 'button', disabled: !editable, onClick: approve }, 'Approve & Send'),
        h('button', {
          class: 'btn btn--danger', type: 'button', disabled: !editable,
          onClick: () => { setGate((gt) => { gt.status = 'rejected'; }); ctx.toast(`Gate ${i + 1} rejected.`); },
        }, 'Reject'))),
    h('div', { class: 'gate__output' },
      h('div', { class: 'gate__output-head' },
        h('strong', {}, `${agent.name} Output`),
        g.output && h('span', { class: 'muted' }, g.output.time),
        pill(statusText, statusToneMap[g.status])),
      g.output
        ? [h('ul', { class: 'bullets' }, g.output.bullets.map((b) => h('li', {}, b))),
          g.output.highlight && h('p', { class: 'highlight' }, g.output.highlight),
          g.output.link && h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onClick: () => ctx.toast('Test UI: detail pages are not implemented.') }, g.output.link)]
        : h('p', { class: 'muted' }, editable ? 'Waiting for your approval.' : 'No output yet.')));
}

function finalGate(task, i, current, ctx) {
  const step = GATE_STEPS[i];
  const enabled = current === i && !task.decision;
  const decided = task.decision && FINAL_DECISIONS.find((d) => d.id === task.decision.id);
  const draft = task.decisionDraft ?? { id: 'deploy_staging', comment: '' };
  const editDraft = (fn) => ctx.store.silent((s) => {
    const t = s.tasks.find((x) => x.id === task.id);
    t.decisionDraft = t.decisionDraft ?? { id: 'deploy_staging', comment: '' };
    fn(t.decisionDraft);
  });

  const authorize = () => ctx.store.update((s) => {
    const t = s.tasks.find((x) => x.id === task.id);
    const choice = t.decisionDraft ?? { id: 'deploy_staging', comment: '' };
    if (choice.id === 'request_changes') {
      // Send the task back to Claude: gates 2-4 must be redone.
      [1, 2, 3].forEach((k) => { t.gates[k].status = 'pending'; t.gates[k].output = null; });
      ctx.toast('Changes requested: task returned to Gate 2 (local mock).');
    } else if (choice.id === 'iterate') {
      t.gates[3].status = 'pending'; t.gates[3].output = null;
      ctx.toast('Iterating: task returned to Gate 4 (local mock).');
    } else {
      t.decision = { ...choice, at: nowStamp() };
      if (choice.id === 'deploy_staging') t.deployment.staging = 'Requested (mock)';
      if (choice.id === 'deploy_production') t.deployment.production = 'Requested (mock)';
      ctx.toast('Decision recorded locally. Nothing was merged or deployed.');
    }
    delete t.decisionDraft;
  });

  // Pin the URL to this task first: once it completes, the bare #/workflow
  // route would otherwise jump to the next open task.
  const authorizeHere = () => { history.replaceState(null, '', `#/workflow/${task.id}`); authorize(); };

  return h('li', { class: `gate gate--final gate--${step.tone}${enabled ? ' is-current' : ''}` },
    agentCell(step, i),
    h('div', { class: 'gate__final' },
      h('p', { class: 'gate__label' }, 'Human Gate 5/5 — Final Authorization'),
      decided
        ? h('p', {}, 'Decision: ', h('strong', {}, decided.label), ` · ${task.decision.at}`,
          task.decision.comment && h('span', { class: 'muted' }, ` — “${task.decision.comment}”`))
        : [
          h('fieldset', { class: 'radios', disabled: !enabled },
            h('legend', {}, 'Decide next action:'),
            FINAL_DECISIONS.map((d) => h('label', { class: 'radio' },
              h('input', {
                type: 'radio', name: `decision-${task.id}`, value: d.id, checked: draft.id === d.id,
                onChange: () => editDraft((dr) => { dr.id = d.id; }),
              }), d.label))),
          h('div', { class: 'final__row' },
            h('label', { class: 'visually-hidden', for: `cmt-${task.id}` }, 'Comment (optional)'),
            h('input', {
              id: `cmt-${task.id}`, class: 'input', type: 'text', disabled: !enabled,
              placeholder: 'Add a comment (optional)', value: draft.comment,
              onInput: (e) => editDraft((dr) => { dr.comment = e.target.value; }),
            }),
            h('button', { class: 'btn btn--success', type: 'button', disabled: !enabled, onClick: authorizeHere }, 'Authorize & Execute')),
          !enabled && h('p', { class: 'muted' }, 'Available once Gates 1–4 are completed.'),
        ]));
}
