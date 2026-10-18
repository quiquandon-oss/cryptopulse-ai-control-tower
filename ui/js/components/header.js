// Top bar: brand, primary tabs, data mode, refresh, current user.
import { h } from '../dom.js';

const TABS = [
  { label: 'Workflow', href: '#/workflow', match: ['workflow'] },
  { label: 'Tasks', href: '#/tasks/active', match: ['tasks'] },
  { label: 'Projects', href: '#/projects', match: ['projects'] },
  { label: 'Knowledge Base', href: '#/knowledge', match: ['knowledge'] },
  { label: 'Settings', href: '#/settings', match: ['settings'] },
];

export function header(route, { onToggleMenu, onRefresh }) {
  return h('header', { class: 'topbar' },
    h('button', {
      class: 'topbar__menu', type: 'button', 'aria-label': 'Open navigation', onClick: onToggleMenu,
    }, '☰'),
    h('a', { class: 'brand', href: '#/workflow' },
      h('span', { class: 'brand__mark', 'aria-hidden': 'true' }, '▲'),
      h('span', { class: 'brand__text' },
        h('strong', {}, 'AI Control Tower'),
        h('small', {}, 'Multi-Agent Orchestration for CryptoPulse'))),
    h('nav', { class: 'tabs', 'aria-label': 'Primary' },
      TABS.map((t) => h('a', {
        class: `tabs__item${t.match.includes(route.view) ? ' is-active' : ''}`,
        href: t.href,
      }, t.label))),
    h('span', { class: 'conn', title: 'Live data from public, read-only sources' },
      h('span', { class: 'conn__dot', 'aria-hidden': 'true' }), 'Live · read-only'),
    h('button', { class: 'btn btn--ghost btn--sm topbar__refresh', type: 'button', onClick: onRefresh, 'aria-label': 'Refresh data' }, '⟳'),
    h('span', { class: 'user' },
      h('span', { class: 'avatar avatar--blue', 'aria-hidden': 'true' }, 'O'),
      h('span', { class: 'user__text' }, h('strong', {}, 'Olivier'), h('small', {}, 'Owner'))));
}
