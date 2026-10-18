// Workflow view: read-only tracker of the five human gates for one task,
// derived from real GitHub state (see model.js). There are no action buttons:
// decisions are made on GitHub, and this view reflects them.
import { h, pill } from '../dom.js';
import { AGENTS, GATE_STEPS } from '../model.js';
import { selectWorkflows, isOpen } from '../data.js';
import { rail, statusTone } from '../components/rail.js';
import { sourceNotice, asOf, errorText } from '../components/source.js';

const GATE_PILL = {
  done: ['Done', 'green'],
  pending: ['Waiting', 'yellow'],
  rejected: ['Rejected', 'red'],
  untracked: ['Not tracked', 'neutral'],
  locked: ['Not started', 'neutral'],
  loading: ['Loading', 'neutral'],
  error: ['Unavailable', 'red'],
};

export function workflowView(route, ctx) {
  const sel = selectWorkflows(ctx.store);
  if (sel.status !== 'ok') {
    return h('div', { class: 'page' },
      h('h1', { class: 'page__title' }, 'Workflow'),
      sourceNotice(sel, 'tasks and pull requests from GitHub', ctx.refresh));
  }
  if (!sel.items.length) {
    return h('div', { class: 'page' },
      h('h1', { class: 'page__title' }, 'Workflow'),
      h('p', { class: 'muted' }, 'No task files in tasks/active/ yet.'));
  }

  const item = sel.items.find((i) => i.task.id === route.param)
    ?? sel.items.find(isOpen)
    ?? sel.items[0];
  const pane = ctx.ui.workflowPane;
  const paneSwitch = h('div', { class: 'segmented', role: 'tablist', 'aria-label': 'Workflow sections' },
    [['gates', 'Gates'], ['details', 'Details & CI']].map(([id, label]) => h('button', {
      class: `segmented__btn${pane === id ? ' is-active' : ''}`,
      type: 'button', role: 'tab', 'aria-selected': String(pane === id),
      onClick: () => ctx.setWorkflowPane(id),
    }, label)));

  return h('div', { class: `workflow workflow--pane-${pane}` },
    h('div', { class: 'workflow__main' },
      taskHeader(sel, item, ctx),
      paneSwitch,
      h('ol', { class: 'gates gates--readonly' },
        GATE_STEPS.map((step, i) => gateRow(step, i, item.workflow.gates[i], ctx))),
      asOf(sel.at)),
    rail(item, ctx));
}

function taskHeader(sel, item, ctx) {
  const { task, workflow } = item;
  return h('div', { class: 'task-head' },
    h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' },
      h('a', { href: '#/tasks/active' }, 'Tasks'), ' / ', task.id),
    h('div', { class: 'task-head__row' },
      h('span', { class: 'task-head__icon', 'aria-hidden': 'true' }, '✦'),
      h('h1', { class: 'task-head__title' }, h('span', { class: 'mono' }, task.id), ' ', task.title),
      h('div', { class: 'task-head__actions' },
        pill(workflow.status, statusTone(workflow.status)),
        h('label', { class: 'visually-hidden', for: 'task-switch' }, 'Switch task'),
        h('select', {
          id: 'task-switch', class: 'select',
          onChange: (e) => ctx.navigate(`#/workflow/${encodeURIComponent(e.target.value)}`),
        }, sel.items.map((i) => h('option', { value: i.task.id, selected: i.task.id === task.id }, `${i.task.id} — ${i.task.title}`))))),
    h('p', { class: 'task-head__meta' },
      task.repository && h('span', {}, 'Repository: ', h('span', { class: 'mono' }, task.repository)),
      task.version && h('span', {}, `Version: ${task.version}`),
      workflow.waitingOn && h('span', {}, `Waiting on: ${AGENTS[workflow.waitingOn].name}`),
      !workflow.waitingOn && workflow.gates.some((g) => g.state === 'error') && h('span', {}, 'Waiting on: unknown (GitHub data unavailable)')));
}

function gateRow(step, i, gate, ctx) {
  const agent = AGENTS[step.agent];
  const [pillText, tone] = GATE_PILL[gate.state];
  return h('li', { class: `gate gate--${step.tone}${gate.state === 'pending' ? ' is-current' : ''}` },
    h('div', { class: 'gate__agent' },
      h('span', { class: `step step--${step.tone}` }, i + 1),
      h('div', { class: 'gate__who' },
        h('span', { class: `avatar avatar--lg avatar--${step.tone}`, 'aria-hidden': 'true' }, agent.initial),
        h('div', {},
          h('strong', {}, agent.name),
          h('span', { class: `role role--${step.tone}` }, step.role)))),
    h('div', { class: 'gate__status' },
      h('p', { class: 'gate__label' }, `Gate ${i + 1}/5 — ${step.label}`),
      h('p', { class: 'gate__detail' }, gate.detail),
      gate.state === 'error' && h('p', { class: 'notice notice--error' },
        h('span', {}, errorText(gate.error)),
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onClick: ctx.refresh }, 'Retry')),
      gate.link && h('a', { class: 'linkbtn', href: gate.link, target: '_blank', rel: 'noopener noreferrer' }, 'Open on GitHub ↗')),
    h('div', { class: 'gate__state' }, pill(pillText, tone)));
}
