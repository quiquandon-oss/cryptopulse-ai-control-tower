// Left navigation: new task (on GitHub), section links, participants.
import { h } from '../dom.js';
import { AGENTS } from '../model.js';
import { NEW_TASK_URL } from '../views/tasks.js';

const LINKS = [
  { label: 'Metrics', href: '#/dashboard', key: 'dashboard' },
  { label: 'Active Tasks', href: '#/tasks/active', key: 'tasks:active' },
  { label: 'Task History', href: '#/tasks/history', key: 'tasks:history' },
  { label: 'CryptoPulse V1–V4', href: '#/projects', key: 'projects' },
  { label: 'Pull Requests', href: '#/prs', key: 'prs' },
  { label: 'Agent Status', href: '#/agents', key: 'agents' },
  { label: 'Knowledge Base', href: '#/knowledge', key: 'knowledge' },
  { label: 'Templates', href: '#/templates', key: 'templates' },
  { label: 'Agent Instructions', href: '#/instructions', key: 'instructions' },
  { label: 'Settings', href: '#/settings', key: 'settings' },
];

export function sidebar(route, { open, onNavigate }) {
  const current = route.param ? `${route.view}:${route.param}` : route.view;
  return h('aside', { class: `sidebar${open ? ' is-open' : ''}`, 'aria-label': 'Sections' },
    h('div', { class: 'sidebar__block' },
      h('h2', { class: 'sidebar__heading' }, 'New Task'),
      h('a', { class: 'btn btn--primary btn--block', href: NEW_TASK_URL, target: '_blank', rel: 'noopener noreferrer' }, '+ New task on GitHub')),
    h('nav', { class: 'sidebar__nav' },
      LINKS.map((l) => h('a', {
        class: `navlink${current === l.key ? ' is-active' : ''}`, href: l.href, onClick: onNavigate,
      }, h('span', {}, l.label)))),
    h('div', { class: 'sidebar__block sidebar__agents' },
      h('h2', { class: 'sidebar__heading' }, 'Participants'),
      Object.values(AGENTS).map((a) => h('div', { class: 'agent-mini' },
        h('span', { class: `avatar avatar--${a.tone}`, 'aria-hidden': 'true' }, a.initial),
        h('span', {}, h('strong', {}, a.name), h('small', {}, a.role))))));
}
