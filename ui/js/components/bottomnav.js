// Phone-only bottom tab bar (hidden above 820px by CSS).
import { h } from '../dom.js';

const ITEMS = [
  { label: 'Workflow', icon: '◆', href: '#/workflow', views: ['workflow'] },
  { label: 'Tasks', icon: '☰', href: '#/tasks/active', views: ['tasks'] },
  { label: 'Projects', icon: '▦', href: '#/projects', views: ['projects'] },
  { label: 'Agents', icon: '●', href: '#/agents', views: ['agents'] },
  { label: 'Gate', icon: '✓', href: '#/governance', views: ['governance'] },
  { label: 'Metrics', icon: '▤', href: '#/dashboard', views: ['dashboard'] },
];

export function bottomNav(route) {
  return h('nav', { class: 'bottomnav', 'aria-label': 'Quick navigation' },
    ITEMS.map((it) => {
      const active = it.views.includes(route.view);
      return h('a', {
        class: `bottomnav__item${active ? ' is-active' : ''}`,
        href: it.href,
        'aria-current': active ? 'page' : null,
      },
      h('span', { class: 'bottomnav__icon', 'aria-hidden': 'true' }, it.icon),
      h('span', { class: 'bottomnav__label' }, it.label));
    }));
}
