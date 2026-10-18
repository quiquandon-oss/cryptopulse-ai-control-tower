// Top bar: brand, primary tabs, connection status and current user.
import { h } from '../dom.js';

const TABS = [
  { label: 'Workflow', href: '#/workflow', match: ['workflow'] },
  { label: 'Tasks', href: '#/tasks/active', match: ['tasks', 'new'] },
  { label: 'Knowledge Base', href: '#/knowledge', match: ['knowledge'] },
  { label: 'Templates', href: '#/templates', match: ['templates'] },
  { label: 'Settings', href: '#/settings', match: ['settings'] },
];

export function header(route, { onToggleMenu }) {
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
    // The real app would show GitHub connectivity; the test UI is offline by design.
    h('span', { class: 'conn', title: 'Test UI — local mock data, no network' },
      h('span', { class: 'conn__dot', 'aria-hidden': 'true' }), 'Mock mode'),
    h('span', { class: 'user' },
      h('span', { class: 'avatar avatar--blue', 'aria-hidden': 'true' }, 'O'),
      h('span', { class: 'user__text' }, h('strong', {}, 'Olivier'), h('small', {}, 'Owner'))));
}
