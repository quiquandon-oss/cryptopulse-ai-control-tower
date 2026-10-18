// Left navigation: new-task button, section links with counters, agent list.
import { h } from '../dom.js';
import { AGENTS, PROJECTS, taskStatus } from '../state.js';

export function sidebar(state, route, { open, onNavigate }) {
  const active = state.tasks.filter((t) => taskStatus(t) !== 'Completed');
  const history = state.tasks.filter((t) => taskStatus(t) === 'Completed');

  const links = [
    { label: 'Dashboard', href: '#/dashboard', key: 'dashboard' },
    { label: 'Active Tasks', href: '#/tasks/active', key: 'tasks:active', count: active.length, accent: true },
    { label: 'Task History', href: '#/tasks/history', key: 'tasks:history', count: history.length },
    { label: 'Repositories', href: '#/repositories', key: 'repositories', count: PROJECTS.length },
    { label: 'PR & Deployments', href: '#/prs', key: 'prs' },
    { label: 'Agent Status', href: '#/agents', key: 'agents' },
    { label: 'Knowledge Base', href: '#/knowledge', key: 'knowledge' },
    { label: 'Templates', href: '#/templates', key: 'templates' },
    { label: 'Agent Instructions', href: '#/instructions', key: 'instructions' },
    { label: 'Settings', href: '#/settings', key: 'settings' },
  ];
  const current = route.param ? `${route.view}:${route.param}` : route.view;

  return h('aside', { class: `sidebar${open ? ' is-open' : ''}`, 'aria-label': 'Sections' },
    h('div', { class: 'sidebar__block' },
      h('h2', { class: 'sidebar__heading' }, 'New Task'),
      h('a', { class: 'btn btn--primary btn--block', href: '#/new', onClick: onNavigate }, '+ Create New Task')),
    h('nav', { class: 'sidebar__nav' },
      links.map((l) => h('a', {
        class: `navlink${current === l.key ? ' is-active' : ''}`, href: l.href, onClick: onNavigate,
      },
      h('span', {}, l.label),
      l.count != null && h('span', { class: `count${l.accent ? ' count--accent' : ''}` }, l.count)))),
    h('div', { class: 'sidebar__block sidebar__agents' },
      h('h2', { class: 'sidebar__heading' }, 'Supported Agents'),
      ['gemini', 'claude', 'chatgpt'].map((k) => h('div', { class: 'agent-mini' },
        h('span', { class: `avatar avatar--${AGENTS[k].tone}`, 'aria-hidden': 'true' }, AGENTS[k].initial),
        h('span', {}, h('strong', {}, AGENTS[k].name), h('small', {}, AGENTS[k].role))))));
}
