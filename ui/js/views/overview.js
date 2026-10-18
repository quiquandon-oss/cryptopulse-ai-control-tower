// Overview views: Dashboard, Agent Status, Repositories, PR & Deployments.
import { h, card, pill } from '../dom.js';
import { AGENTS, PROJECTS, activeGateIndex, agentStatuses, taskStatus } from '../state.js';

function stat(label, value, tone) {
  return h('div', { class: `stat stat--${tone}` }, h('span', { class: 'stat__value' }, value), h('span', { class: 'stat__label' }, label));
}

function agentList(state, { compact = false } = {}) {
  const statuses = agentStatuses(state.tasks);
  return h('ul', { class: `agents${compact ? ' agents--compact' : ''}` },
    Object.entries(AGENTS).map(([key, a]) => {
      const s = statuses[key];
      return h('li', { class: 'agent-card' },
        h('span', { class: `avatar avatar--lg avatar--${a.tone}`, 'aria-hidden': 'true' }, a.initial),
        h('div', { class: 'agent-card__body' },
          h('strong', {}, a.name), h('small', { class: 'muted' }, a.role),
          !compact && s.tasks.length > 0 && h('ul', { class: 'bullets' }, s.tasks.map((t) => h('li', {}, t)))),
        pill(s.status, s.status === 'Idle' ? 'neutral' : 'yellow'));
    }));
}

export function dashboardView(state) {
  const open = state.tasks.filter((t) => taskStatus(t) !== 'Completed');
  const waiting = open.filter((t) => activeGateIndex(t) >= 0).length;
  const prs = state.tasks.filter((t) => t.pr && t.pr.state === 'Open').length;
  return h('div', { class: 'page' },
    h('h1', { class: 'page__title' }, 'Dashboard'),
    h('div', { class: 'stats' },
      stat('Active tasks', open.length, 'blue'),
      stat('Gates waiting on you', waiting, 'yellow'),
      stat('Open PRs', prs, 'purple'),
      stat('Completed', state.tasks.length - open.length, 'green')),
    h('div', { class: 'grid-2' },
      card('Agent status', agentList(state, { compact: true }), { actions: h('a', { class: 'btn btn--ghost btn--sm', href: '#/agents' }, 'Details') }),
      card('Needs your decision', open.length
        ? h('ul', { class: 'bullets' }, open.map((t) => h('li', {},
          h('a', { href: `#/workflow/${t.id}` }, `${t.id} ${t.title}`), ` — Gate ${activeGateIndex(t) + 1}/5`)))
        : h('p', { class: 'muted' }, 'Nothing waiting.'))));
}

export function agentsView(state) {
  return h('div', { class: 'page' },
    h('h1', { class: 'page__title' }, 'Agent Status'),
    h('p', { class: 'muted' }, 'Derived from open tasks: an agent is waiting when a task’s current gate is addressed to it. No agent is contacted from this test UI.'),
    card('Agents', agentList(state)));
}

export function repositoriesView() {
  return h('div', { class: 'page' },
    h('h1', { class: 'page__title' }, 'Repositories'),
    h('p', { class: 'muted' }, 'Projects are isolated: each task targets exactly one version (master protocol §1.3).'),
    h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, ['Version', 'Repository', 'Scope'].map((c) => h('th', {}, c)))),
      h('tbody', {}, PROJECTS.map((p) => h('tr', {},
        h('td', {}, pill(p.version, 'blue')), h('td', { class: 'mono' }, p.repo), h('td', {}, p.scope)))))));
}

export function prsView(state) {
  const rows = state.tasks.filter((t) => t.pr);
  return h('div', { class: 'page' },
    h('h1', { class: 'page__title' }, 'PR & Deployments'),
    rows.length
      ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, ['PR', 'Task', 'Branch', 'Changes', 'Staging', 'Production'].map((c) => h('th', {}, c)))),
        h('tbody', {}, rows.map((t) => h('tr', {},
          h('td', {}, `#${t.pr.number} `, pill(t.pr.state, t.pr.state === 'Open' ? 'blue' : 'green')),
          h('td', {}, h('a', { href: `#/workflow/${t.id}` }, t.id)),
          h('td', { class: 'mono' }, t.branch),
          h('td', {}, h('span', { class: 'plus' }, `+${t.pr.additions}`), ` / -${t.pr.deletions}`),
          h('td', {}, t.deployment.staging),
          h('td', {}, t.deployment.production))))))
      : h('p', { class: 'muted' }, 'No pull requests yet.'));
}
