// Reference views: Knowledge Base, Templates, Agent Instructions, Settings.
// Links point at the Markdown files in this repository (serve the repo root
// so ../docs and ../tasks resolve; see ui/README.md).
import { h, card } from '../dom.js';

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

export function settingsView(state, route, ctx) {
  return h('div', { class: 'page' },
    h('h1', { class: 'page__title' }, 'Settings'),
    card('Test UI data', [
      h('p', { class: 'muted' }, 'All data is local mock state kept in this browser. No credentials are stored and no network calls are made.'),
      h('button', {
        class: 'btn btn--danger', type: 'button',
        onClick: () => { ctx.store.reset(); ctx.toast('Mock data reset.'); },
      }, 'Reset mock data'),
    ]));
}
