// Phone-only bottom tab bar (hidden above 820px by CSS): one-thumb access to
// the four views used most on mobile.
import { h } from '../dom.js';
import { agentStatuses, taskStatus } from '../state.js';

export function bottomNav(state, route) {
  const open = state.tasks.filter((t) => taskStatus(t) !== 'Completed').length;
  const waitingAgents = Object.values(agentStatuses(state.tasks)).filter((s) => s.status !== 'Idle').length;
  const items = [
    { label: 'Workflow', icon: '◆', href: '#/workflow', active: route.view === 'workflow' },
    { label: 'Tasks', icon: '☰', href: '#/tasks/active', active: ['tasks', 'new'].includes(route.view), badge: open },
    { label: 'Agents', icon: '●', href: '#/agents', active: route.view === 'agents', badge: waitingAgents },
    { label: 'Metrics', icon: '▤', href: '#/dashboard', active: route.view === 'dashboard' },
  ];
  return h('nav', { class: 'bottomnav', 'aria-label': 'Quick navigation' },
    items.map((it) => h('a', {
      class: `bottomnav__item${it.active ? ' is-active' : ''}`,
      href: it.href,
      'aria-current': it.active ? 'page' : null,
    },
    h('span', { class: 'bottomnav__icon', 'aria-hidden': 'true' }, it.icon,
      it.badge ? h('span', { class: 'bottomnav__badge' }, it.badge) : null),
    h('span', { class: 'bottomnav__label' }, it.label))));
}
