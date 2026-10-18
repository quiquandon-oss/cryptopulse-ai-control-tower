// Task tracking: task files in tasks/active/ with their live workflow state.
// Active = PR not merged/closed yet; History = merged or closed.
import { h, card, pill } from '../dom.js';
import { GATE_STEPS } from '../model.js';
import { GITHUB } from '../config.js';
import { selectWorkflows, isOpen } from '../data.js';
import { statusTone } from '../components/rail.js';
import { sourceNotice, asOf } from '../components/source.js';

export const NEW_TASK_URL = `https://github.com/${GITHUB.owner}/${GITHUB.controlTower.repo}/new/${GITHUB.controlTower.branch}/${GITHUB.controlTower.tasksDir}`;

function table(items) {
  return h('div', { class: 'table-wrap' },
    h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, ['Task', 'Target', 'Pull request', 'Waiting on', 'Status'].map((c) => h('th', {}, c)))),
      h('tbody', {}, items.map(({ task, pr, workflow }) => h('tr', {},
        h('td', {}, h('a', { href: `#/workflow/${encodeURIComponent(task.id)}` }, h('span', { class: 'mono' }, task.id), ` ${task.title}`)),
        h('td', {}, task.repository || '—'),
        h('td', {}, pr ? h('a', { href: pr.html_url, target: '_blank', rel: 'noopener noreferrer' }, `#${pr.number}`) : '—'),
        h('td', {}, workflow.waitingOn ? GATE_STEPS.find((s) => s.agent === workflow.waitingOn).role : '—'),
        h('td', {}, pill(workflow.status, statusTone(workflow.status))))))));
}

export function tasksView(route, ctx) {
  const history = route.param === 'history';
  const title = history ? 'Task History' : 'Active Tasks';
  const sel = selectWorkflows(ctx.store);
  if (sel.status !== 'ok') {
    return h('div', { class: 'page' }, h('h1', { class: 'page__title' }, title),
      sourceNotice(sel, 'tasks from GitHub', ctx.refresh));
  }
  const items = sel.items.filter((i) => isOpen(i) !== history);
  return h('div', { class: 'page' },
    h('h1', { class: 'page__title' }, title),
    card(history ? 'Merged or closed' : 'Open', [
      items.length ? table(items) : h('p', { class: 'muted' }, history ? 'No completed tasks yet.' : 'No open tasks.'),
      asOf(sel.at),
    ], { actions: !history && h('a', { class: 'btn btn--primary btn--sm', href: NEW_TASK_URL, target: '_blank', rel: 'noopener noreferrer' }, '+ New task on GitHub') }));
}
