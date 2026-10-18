// Task tracking views: Active Tasks, Task History, and the New Task form.
import { h, card, pill, nowStamp } from '../dom.js';
import { GATE_STEPS, PROJECTS, activeGateIndex, taskStatus } from '../state.js';
import { statusTone } from '../components/rail.js';

function taskTable(tasks, emptyText) {
  if (!tasks.length) return h('p', { class: 'muted' }, emptyText);
  return h('div', { class: 'table-wrap' },
    h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, ['Task', 'Version', 'Repository', 'Current gate', 'Status'].map((c) => h('th', {}, c)))),
      h('tbody', {}, tasks.map((t) => {
        const i = activeGateIndex(t);
        const status = taskStatus(t);
        return h('tr', {},
          h('td', {}, h('a', { href: `#/workflow/${t.id}` }, h('span', { class: 'mono' }, t.id), ` ${t.title}`)),
          h('td', {}, t.version),
          h('td', { class: 'mono' }, t.repo),
          h('td', {}, status === 'Completed' || i < 0 ? '—' : `${i + 1}/5 · ${GATE_STEPS[i].role}`),
          h('td', {}, pill(status, statusTone(status))));
      }))));
}

export function tasksView(state, route) {
  const history = route.param === 'history';
  const list = state.tasks.filter((t) => (taskStatus(t) === 'Completed') === history);
  return h('div', { class: 'page' },
    h('h1', { class: 'page__title' }, history ? 'Task History' : 'Active Tasks'),
    card(history ? 'Completed tasks' : 'Open tasks',
      taskTable(list, history ? 'No completed tasks yet.' : 'No active tasks. Create one from the sidebar.'),
      { actions: !history && h('a', { class: 'btn btn--primary btn--sm', href: '#/new' }, '+ New Task') }));
}

/** New task form. Creates a local task with Gate 1 pre-filled from the goal. */
export function newTaskView(state, route, ctx) {
  const submit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const title = String(f.get('title') || '').trim();
    const goal = String(f.get('goal') || '').trim();
    if (!title || !goal) return ctx.toast('Title and goal are required.');
    const project = PROJECTS.find((p) => p.version === f.get('version'));
    const next = state.tasks.reduce((n, t) => Math.max(n, Number(t.id.split('-').pop()) || 0), 0) + 1;
    const id = `CP-2026-${String(next).padStart(3, '0')}`;
    ctx.store.update((s) => {
      s.tasks.unshift({
        id, title, project: `CryptoPulse${project.version}`, repo: project.repo, version: project.version,
        type: String(f.get('type')), created: nowStamp(), branch: '—', labels: [project.version.toLowerCase()],
        pr: null, ci: [], deployment: { staging: 'Not Deployed', production: 'Not Deployed' }, decision: null,
        gates: [{ instruction: goal, status: 'draft', output: null },
          ...[1, 2, 3, 4].map(() => ({ instruction: '', status: 'pending', output: null }))],
      });
    });
    ctx.toast(`${id} created locally. Review Gate 1 to send it to Gemini.`);
    ctx.navigate(`#/workflow/${id}`);
  };

  // form-action 'none' in the CSP blocks real submission; onSubmit handles it in-page.
  return h('div', { class: 'page' },
    h('h1', { class: 'page__title' }, 'Create New Task'),
    card('Task details', h('form', { class: 'form', onSubmit: submit },
      h('label', { class: 'field-label', for: 'nt-title' }, 'Title'),
      h('input', { id: 'nt-title', name: 'title', class: 'input', required: true, maxlength: 80, placeholder: 'e.g. Risk-Regime Scorer' }),
      h('div', { class: 'form__row' },
        h('div', {},
          h('label', { class: 'field-label', for: 'nt-version' }, 'Target version'),
          h('select', { id: 'nt-version', name: 'version', class: 'select' },
            PROJECTS.map((p) => h('option', { value: p.version }, `${p.version} — ${p.repo.split('/')[1]}`)))),
        h('div', {},
          h('label', { class: 'field-label', for: 'nt-type' }, 'Type'),
          h('select', { id: 'nt-type', name: 'type', class: 'select' },
            ['Feature Implementation', 'Bug Fix', 'Performance', 'Documentation'].map((t) => h('option', {}, t))))),
      h('label', { class: 'field-label', for: 'nt-goal' }, 'Goal (becomes the draft instruction to Gemini)'),
      h('textarea', { id: 'nt-goal', name: 'goal', class: 'textarea', rows: 5, required: true, maxlength: 2000 }),
      h('div', { class: 'btnrow' },
        h('button', { class: 'btn btn--primary', type: 'submit' }, 'Create Task'),
        h('a', { class: 'btn btn--ghost', href: '#/tasks/active' }, 'Cancel')))));
}
