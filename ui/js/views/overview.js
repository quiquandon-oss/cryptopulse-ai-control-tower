// Overview views: Dashboard (metrics), Agent Status, Projects (V1–V4), PRs.
import { h, card, pill } from '../dom.js';
import { VERSIONS } from '../config.js';
import { AGENTS, agentQueues } from '../model.js';
import { selectWorkflows, isOpen } from '../data.js';
import { githubRate } from '../lib/http.js';
import { age } from '../lib/status.js';
import { statusTone } from '../components/rail.js';
import { sourceNotice, asOf, errorText } from '../components/source.js';

const VERSION_TONE = { ok: 'green', warn: 'yellow', down: 'red' };
const VERSION_LABEL = { ok: 'Healthy', warn: 'Attention', down: 'Unreachable' };

/** Health of one version, from its own resource only (strict boundary). */
function versionHealth(store, v) {
  const entry = store.need(v.id.toLowerCase());
  if (entry.status === 'loading') return { status: 'loading' };
  if (entry.status === 'error') return { status: 'down', error: entry.error };
  return { status: entry.data.status, data: entry.data };
}

function stat(label, value, tone) {
  return h('div', { class: `stat stat--${tone}` }, h('span', { class: 'stat__value' }, value), h('span', { class: 'stat__label' }, label));
}

export function dashboardView(route, ctx) {
  const sel = selectWorkflows(ctx.store);
  const health = VERSIONS.map((v) => [v, versionHealth(ctx.store, v)]);
  const healthy = health.filter(([, hh]) => hh.status === 'ok').length;
  const loadingHealth = health.some(([, hh]) => hh.status === 'loading');
  const open = sel.status === 'ok' ? sel.items.filter(isOpen) : null;
  const n = (v) => (v == null ? '…' : v);

  return h('div', { class: 'page' },
    h('h1', { class: 'page__title' }, 'Metrics'),
    h('div', { class: 'stats' },
      stat('Open tasks', n(open && open.length), 'blue'),
      stat('Waiting on Olivier', n(open && open.filter((i) => i.workflow.waitingOn === 'olivier').length), 'yellow'),
      stat('Versions healthy', loadingHealth ? '…' : `${healthy}/${VERSIONS.length}`, healthy === VERSIONS.length ? 'green' : 'yellow'),
      stat('GitHub API calls left', n(githubRate.remaining), 'purple')),
    h('div', { class: 'grid-2' },
      card('CryptoPulse versions', h('ul', { class: 'agents' }, health.map(([v, hh]) => h('li', { class: 'agent-card' },
        h('span', { class: 'avatar avatar--lg avatar--blue', 'aria-hidden': 'true' }, v.id),
        h('div', { class: 'agent-card__body' },
          h('strong', {}, v.name),
          h('small', { class: 'muted' }, hh.status === 'loading' ? 'Loading…' : hh.status === 'down' ? errorText(hh.error) : hh.data.summary)),
        hh.status === 'loading' ? pill('…', 'neutral') : pill(VERSION_LABEL[hh.status], VERSION_TONE[hh.status])))),
      { actions: h('a', { class: 'btn btn--ghost btn--sm', href: '#/projects' }, 'Details') }),
      card('Needs a decision', sel.status !== 'ok' ? sourceNotice(sel, 'tasks', ctx.refresh)
        : open.length
          ? h('ul', { class: 'bullets' }, open.map((i) => h('li', {},
            h('a', { href: `#/workflow/${encodeURIComponent(i.task.id)}` }, `${i.task.id} ${i.task.title}`),
            i.workflow.waitingOn ? ` — waiting on ${AGENTS[i.workflow.waitingOn].name}` : '')))
          : h('p', { class: 'muted' }, 'No open tasks.'))));
}

export function agentsView(route, ctx) {
  const sel = selectWorkflows(ctx.store);
  const body = sel.status !== 'ok' ? sourceNotice(sel, 'tasks', ctx.refresh) : (() => {
    const queues = agentQueues(sel.items.filter(isOpen).map((i) => ({ task: i.task, waitingOn: i.workflow.waitingOn })));
    return h('ul', { class: 'agents' }, Object.entries(AGENTS).map(([key, a]) => h('li', { class: 'agent-card' },
      h('span', { class: `avatar avatar--lg avatar--${a.tone}`, 'aria-hidden': 'true' }, a.initial),
      h('div', { class: 'agent-card__body' },
        h('strong', {}, a.name), h('small', { class: 'muted' }, a.role),
        queues[key].length > 0 && h('ul', { class: 'bullets' }, queues[key].map((id) => h('li', {}, h('a', { href: `#/workflow/${encodeURIComponent(id)}` }, id))))),
      pill(queues[key].length ? `Waiting · ${queues[key].length}` : 'Idle', queues[key].length ? 'yellow' : 'neutral'))));
  })();
  return h('div', { class: 'page' },
    h('h1', { class: 'page__title' }, 'Agent Status'),
    h('p', { class: 'muted' }, 'Derived from GitHub: an agent is waiting when an open task’s next gate is theirs. Gemini’s synthesis step happens outside GitHub and is not tracked.'),
    card('Agents', body));
}

function repoRun(store, repo, refresh) {
  const entry = store.need(`runs:${repo}`);
  if (entry.status !== 'ok') return h('li', {}, h('span', { class: 'mono' }, repo), ' — ', entry.status === 'loading' ? 'loading…' : errorText(entry.error));
  const run = entry.data.run;
  if (!run) return h('li', {}, h('span', { class: 'mono' }, repo), ' — no Actions runs');
  const result = run.status === 'completed' ? run.conclusion : run.status;
  return h('li', {},
    h('a', { class: 'mono', href: run.html_url, target: '_blank', rel: 'noopener noreferrer' }, repo), ' — ',
    pill(result, statusTone(result)), ` ${run.name} · ${age(Date.parse(run.updated_at))}`);
}

/** One card per version; each reads only its own resources. */
function versionCard(store, v, refresh) {
  const hh = versionHealth(store, v);
  const body = hh.status === 'loading' || hh.status === 'down'
    ? sourceNotice(hh.status === 'loading' ? { status: 'loading' } : { status: 'error', error: hh.error }, `${v.id} backend`, refresh)
    : [
      h('p', {}, hh.data.summary),
      hh.data.rows.length > 0 && h('dl', { class: 'kv' }, hh.data.rows.map(([k, val]) => [h('dt', {}, k), h('dd', {}, String(val))])),
      asOf(hh.data.fetchedAt, hh.data.cached),
    ];
  return h('section', { class: `card version version--${v.id.toLowerCase()}`, 'data-version': v.id },
    h('header', { class: 'card__head' },
      h('h2', { class: 'card__title' }, `${v.id} · ${v.name}`),
      hh.status === 'loading' ? pill('…', 'neutral') : pill(VERSION_LABEL[hh.status], VERSION_TONE[hh.status])),
    h('p', { class: 'muted' }, v.scope),
    h('p', { class: 'version__host muted mono' }, new URL(v.backend.base).host, v.via ? ` (via ${v.via})` : ''),
    body,
    h('h3', { class: 'version__sub' }, 'Repositories · latest CI'),
    h('ul', { class: 'bullets' }, v.repos.map((r) => repoRun(store, r, refresh))));
}

export function projectsView(route, ctx) {
  return h('div', { class: 'page' },
    h('h1', { class: 'page__title' }, 'CryptoPulse V1–V4'),
    h('p', { class: 'muted' }, 'Live, read-only status from each version’s own backend. Each card uses only its own data source.'),
    h('div', { class: 'versions' }, VERSIONS.map((v) => versionCard(ctx.store, v, ctx.refresh))));
}

export function prsView(route, ctx) {
  const entry = ctx.store.need('pulls');
  if (entry.status !== 'ok') {
    return h('div', { class: 'page' }, h('h1', { class: 'page__title' }, 'Pull Requests'), sourceNotice(entry, 'pull requests', ctx.refresh));
  }
  const pulls = entry.data.pulls;
  return h('div', { class: 'page' },
    h('h1', { class: 'page__title' }, 'Pull Requests'),
    pulls.length
      ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, ['PR', 'Title', 'Branch', 'State', 'Updated'].map((c) => h('th', {}, c)))),
        h('tbody', {}, pulls.map((p) => {
          const state = p.merged_at ? 'Merged' : p.state === 'open' ? 'Open' : 'Closed';
          return h('tr', {},
            h('td', {}, h('a', { href: p.html_url, target: '_blank', rel: 'noopener noreferrer' }, `#${p.number}`)),
            h('td', {}, p.title),
            h('td', { class: 'mono' }, p.head && p.head.ref),
            h('td', {}, pill(state, state === 'Merged' ? 'green' : state === 'Open' ? 'blue' : 'red')),
            h('td', {}, (p.updated_at || '').slice(0, 10)));
        }))))
      : h('p', { class: 'muted' }, 'No pull requests yet.'),
    asOf(entry.data.at, entry.data.cached));
}
