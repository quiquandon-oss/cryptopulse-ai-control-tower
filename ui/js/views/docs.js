// Reference views: Knowledge Base, Templates, Agent Instructions, Settings.
// Links point at the Markdown files in this repository (serve the repo root
// so ../docs and ../tasks resolve; see ui/README.md).
import { h, card } from '../dom.js';
import { GITHUB, VERSIONS, CACHE_TTL_MS } from '../config.js';
import { githubRate, clearCache } from '../lib/http.js';

const doc = (path, title, note) => h('li', { class: 'doclink' },
  h('a', { href: `../${path}`, target: '_blank', rel: 'noopener' }, title),
  h('small', { class: 'muted mono' }, path),
  note && h('p', { class: 'muted' }, note));

export function knowledgeView() {
  return h('div', { class: 'page' },
    h('h1', { class: 'page__title' }, 'Knowledge Base'),
    card('Governance', h('ul', { class: 'doclist' },
      doc('docs/AI_CONTROL_TOWER_MASTER.md', 'Master protocol', 'Roles, SOP, V1–V4 boundaries.'),
      doc('docs/AI_REVIEWER_CHARTER.md', 'Reviewer charter', 'ChatGPT review criteria and comment format.'),
      doc('docs/CLAUDE_CODE_SETUP.md', 'Claude Code setup', 'Developer workflow, Plan Mode, branch strategy.'))),
    card('Design reference', h('figure', { class: 'mockup' },
      h('img', { src: '../docs/assets/control-tower-mockup.png', alt: 'Control Tower reference mockup', loading: 'lazy' }),
      h('figcaption', { class: 'muted' }, 'docs/assets/control-tower-mockup.png'))));
}

export function templatesView() {
  return h('div', { class: 'page' },
    h('h1', { class: 'page__title' }, 'Templates'),
    card('Task templates', h('ul', { class: 'doclist' },
      doc('tasks/TEMPLATE_TASK.md', 'Standard task template', 'Used by Gemini for every new task file in tasks/active/.'))));
}

export function instructionsView() {
  return h('div', { class: 'page' },
    h('h1', { class: 'page__title' }, 'Agent Instructions'),
    card('Per-agent rules', h('ul', { class: 'doclist' },
      doc('docs/CLAUDE_CODE_SETUP.md', 'Claude — Developer Lead (read/write)'),
      doc('docs/AI_REVIEWER_CHARTER.md', 'ChatGPT — Code Reviewer (read-only)'),
      doc('docs/AI_CONTROL_TOWER_MASTER.md', 'Gemini — Master Orchestrator (planner/synthesizer)'))));
}

export function settingsView(route, ctx) {
  const rate = githubRate.remaining == null ? 'not measured yet'
    : `${githubRate.remaining}/${githubRate.limit} left, resets ${new Date(githubRate.resetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return h('div', { class: 'page' },
    h('h1', { class: 'page__title' }, 'Settings'),
    card('Data sources (read-only)', [
      h('p', { class: 'muted' }, 'Public endpoints only, defined in ui/js/config.js. No credentials are stored or sent; any URL not on this list is refused.'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, ['Version', 'Host', 'Allowed paths'].map((c) => h('th', {}, c)))),
        h('tbody', {}, VERSIONS.map((v) => h('tr', {},
          h('td', {}, v.via ? `${v.id} (via ${v.via})` : v.id),
          h('td', { class: 'mono' }, new URL(v.backend.base).host),
          h('td', { class: 'mono' }, Object.values(v.backend.paths).join('  ')))))),
      ),
      h('p', { class: 'muted' }, `GitHub: public API for ${GITHUB.owner} repositories (unauthenticated). Rate limit: ${rate}.`),
    ]),
    card('Cache', [
      h('p', { class: 'muted' }, `Responses are cached in this browser for ${CACHE_TTL_MS / 60000} minutes to stay within GitHub’s 60 requests/hour limit.`),
      h('div', { class: 'btnrow' },
        h('button', { class: 'btn btn--primary', type: 'button', onClick: () => { ctx.refresh(); ctx.toast('Refreshing (cached responses still used).'); } }, 'Refresh'),
        h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => { clearCache(); ctx.refresh(); ctx.toast('Cache cleared; reloading live data.'); } }, 'Clear cache & reload')),
    ]));
}
