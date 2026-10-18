// Right-hand panels of the Workflow view, all from live GitHub data:
// task file, pull request, CI check runs, Control Tower deploy.
import { h, card, pill, keyValues } from '../dom.js';
import { sourceNotice, asOf } from './source.js';

export const statusTone = (s) => ({
  Completed: 'green', 'In Review': 'blue', Planned: 'yellow', Closed: 'red',
  success: 'green', failure: 'red', cancelled: 'neutral', skipped: 'neutral',
}[s] || 'neutral');

const ext = (href, text) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text);

function taskInfo({ task, workflow }) {
  return card('Task', keyValues([
    ['Task ID', task.id],
    ['Status', pill(workflow.status, statusTone(workflow.status))],
    ['Target', task.repository || '—'],
    ['Version', task.version || '—'],
    ['Author', task.author || '—'],
    ['File', ext(task.htmlUrl, task.file)],
  ]));
}

function pullRequest({ pr }) {
  if (!pr) return card('Pull Request', h('p', { class: 'muted' }, 'No pull request references this task yet.'));
  const state = pr.merged_at ? 'Merged' : pr.state === 'open' ? 'Open' : 'Closed';
  return card('Pull Request', keyValues([
    ['PR', ext(pr.html_url, `#${pr.number}`)],
    ['State', pill(state, state === 'Merged' ? 'green' : state === 'Open' ? 'blue' : 'red')],
    ['Branch', h('span', { class: 'mono' }, pr.head && pr.head.ref)],
    ['Head', h('span', { class: 'mono chip' }, pr.head && pr.head.sha.slice(0, 7))],
    ['Opened', (pr.created_at || '').slice(0, 10)],
    pr.merged_at && ['Merged', pr.merged_at.slice(0, 10)],
  ].filter(Boolean)));
}

function checks({ pr }, ctx) {
  if (!pr) return card('CI / Checks', h('p', { class: 'muted' }, 'No pull request, so no checks.'));
  const entry = ctx.store.need(`checks:${pr.head.sha}`);
  if (entry.status !== 'ok') return card('CI / Checks', sourceNotice(entry, 'check runs', ctx.refresh));
  const runs = entry.data.checks;
  if (!runs.length) return card('CI / Checks', [h('p', { class: 'muted' }, 'No CI checks ran on this PR’s head commit.'), asOf(entry.data.at, entry.data.cached)]);
  return card('CI / Checks', [
    h('ul', { class: 'ci' }, runs.map((r) => {
      const ok = r.conclusion === 'success';
      const done = r.status === 'completed';
      return h('li', { class: 'ci__row' },
        h('span', { class: `ci__icon ${done ? (ok ? 'ok' : 'fail') : ''}`, 'aria-label': r.conclusion || r.status }, done ? (ok ? '✓' : '✕') : '…'),
        h('span', { class: 'ci__name' }, r.name),
        h('span', { class: `ci__result ${ok ? 'ok' : done ? 'fail' : ''}` }, r.conclusion || r.status),
        h('span', { class: 'ci__time' }, ''));
    })),
    asOf(entry.data.at, entry.data.cached),
  ]);
}

function deploy(ctx) {
  const entry = ctx.store.need('pages');
  if (entry.status !== 'ok') return card('Control Tower deploy', sourceNotice(entry, 'GitHub Pages runs', ctx.refresh));
  const run = entry.data.run;
  if (!run) return card('Control Tower deploy', h('p', { class: 'muted' }, 'No deploy runs yet.'));
  const result = run.status === 'completed' ? run.conclusion : run.status;
  return card('Control Tower deploy', [
    keyValues([
      ['Last run', ext(run.html_url, `#${run.run_number}`)],
      ['Result', pill(result, statusTone(result))],
      ['When', (run.updated_at || '').replace('T', ' ').slice(0, 16)],
    ]),
    asOf(entry.data.at, entry.data.cached),
  ]);
}

export function rail(item, ctx) {
  return h('div', { class: 'rail' }, taskInfo(item), pullRequest(item), checks(item, ctx), deploy(ctx));
}
