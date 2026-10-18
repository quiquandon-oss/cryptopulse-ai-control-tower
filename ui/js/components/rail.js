// Right-hand panels of the Workflow view: task info, repository & PR,
// CI/tests and deployment status. Deployment buttons are deliberately inert.
import { h, card, pill, keyValues } from '../dom.js';
import { taskStatus } from '../state.js';

const statusTone = (s) => ({ Completed: 'green', 'In Progress': 'blue', 'Awaiting Approval': 'yellow' }[s] || 'neutral');

function taskInfo(task) {
  return card('Task Information', keyValues([
    ['Task ID', task.id],
    ['Title', task.title],
    ['Status', pill(taskStatus(task), statusTone(taskStatus(task)))],
    ['Version', task.version],
    ['Repository', h('span', { class: 'mono link' }, task.repo)],
    ['Branch', h('span', { class: 'mono' }, task.branch)],
    ['Created', task.created],
    ['Type', task.type],
    ['Labels', h('span', { class: 'tags' }, task.labels.map((l) => h('span', { class: 'tag' }, l)))],
  ]));
}

function repoAndPr(task, ctx) {
  const pr = task.pr;
  const body = pr
    ? [keyValues([
      ['Pull Request', h('span', {}, `#${pr.number} `, pill(pr.state, pr.state === 'Open' ? 'blue' : 'green'))],
      ['Branch', h('span', { class: 'mono' }, task.branch)],
      ['Commit', h('span', { class: 'mono chip' }, pr.commit)],
      ['Files changed', h('span', {}, `${pr.files} files (`, h('span', { class: 'plus' }, `+${pr.additions}`), ` / -${pr.deletions})`)],
    ]),
    h('button', { class: 'btn btn--ghost btn--block', type: 'button', onClick: () => ctx.toast('Test UI: GitHub links are disabled.') }, '→ View on GitHub')]
    : h('p', { class: 'muted' }, 'No pull request yet. Claude opens one after Gate 2 is approved.');
  return card('Repository & PR', body);
}

function ciTests(task) {
  const title = task.pr ? `CI / Tests (PR #${task.pr.number})` : 'CI / Tests';
  if (!task.ci.length) return card(title, h('p', { class: 'muted' }, 'No CI runs yet.'));
  return card(title, h('ul', { class: 'ci' },
    task.ci.map((c) => h('li', { class: 'ci__row' },
      h('span', { class: `ci__icon ${c.ok ? 'ok' : 'fail'}`, 'aria-label': c.ok ? 'passed' : 'failed' }, c.ok ? '✓' : '✕'),
      h('span', { class: 'ci__name' }, c.name),
      h('span', { class: c.ok ? 'ci__result ok' : 'ci__result fail' }, c.result),
      h('span', { class: 'ci__time' }, c.duration)))));
}

function deployment(task, ctx) {
  const row = (env, label) => h('div', { class: 'deploy__row' },
    h('span', {}, env),
    h('span', { class: 'chip' }, task.deployment[env.toLowerCase()]),
    h('button', {
      class: `btn ${env === 'Staging' ? 'btn--primary' : 'btn--ghost'} btn--sm`,
      type: 'button',
      disabled: env === 'Production',
      title: env === 'Production' ? 'Production deploys need Gate 5 authorization' : null,
      onClick: () => ctx.toast(`Test UI: "${label}" is a placeholder — nothing was deployed.`),
    }, label));
  return card('Deployment Status', h('div', { class: 'deploy' },
    row('Staging', 'Deploy to Staging'), row('Production', 'Deploy to Production')));
}

export function rail(task, ctx) {
  return h('div', { class: 'rail' },
    taskInfo(task), repoAndPr(task, ctx), ciTests(task), deployment(task, ctx));
}

export { statusTone };
