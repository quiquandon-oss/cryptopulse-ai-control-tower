// Entry point: hash router, layout shell, toast, and render loop.
//
// Routes (hash-based so the app works from any static file server):
//   #/workflow[/<taskId>]  #/dashboard  #/tasks/active  #/tasks/history
//   #/projects  #/prs  #/governance  #/agents  #/knowledge  #/templates  #/instructions  #/settings
import { h } from './dom.js';
import { createStore } from './state.js';
import { header } from './components/header.js';
import { sidebar } from './components/sidebar.js';
import { bottomNav } from './components/bottomnav.js';
import { workflowView } from './views/workflow.js';
import { tasksView } from './views/tasks.js';
import { dashboardView, agentsView, projectsView, prsView } from './views/overview.js';
import { governanceView } from './views/governance.js';
import { knowledgeView, templatesView, instructionsView, settingsView } from './views/docs.js';

const VIEWS = {
  workflow: workflowView,
  dashboard: dashboardView,
  tasks: tasksView,
  projects: projectsView,
  prs: prsView,
  governance: governanceView,
  agents: agentsView,
  knowledge: knowledgeView,
  templates: templatesView,
  instructions: instructionsView,
  settings: settingsView,
};
// Old bookmarks from the earlier layout.
const ALIASES = { repositories: 'projects' };

const root = document.getElementById('app');
const toastEl = document.getElementById('toast');
const store = createStore();
let menuOpen = false;
let toastTimer;

function parseRoute() {
  const [rawView = 'workflow', param = null] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const view = ALIASES[rawView] || rawView;
  if (!VIEWS[view]) return { view: 'workflow', param: null };
  if (view === 'tasks') return { view, param: param === 'history' ? 'history' : 'active' };
  return { view, param: param ? decodeURIComponent(param) : null };
}

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 3200);
}

function navigate(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

// View-only UI state (not persisted): which Workflow pane phones show.
const ui = { workflowPane: 'gates' };
const setWorkflowPane = (pane) => { ui.workflowPane = pane; render(); };

const ctx = { store, toast, navigate, ui, setWorkflowPane, refresh: () => store.refresh() };

function render() {
  const route = parseRoute();
  // A link to a new route closes the menu via the hashchange handler. A tap on
  // the current route fires no hashchange, so close and re-render here. (Not
  // for other routes: re-rendering removes the clicked link and would cancel
  // its navigation.)
  const closeMenu = (e) => {
    if (menuOpen && e.currentTarget.getAttribute('href') === location.hash) {
      menuOpen = false;
      render();
    }
  };
  root.replaceChildren(
    header(route, { onToggleMenu: () => { menuOpen = !menuOpen; render(); }, onRefresh: () => { ctx.refresh(); toast('Refreshing live data…'); } }),
    h('div', { class: 'shell' },
      sidebar(route, { open: menuOpen, onNavigate: closeMenu }),
      // Backdrop closes the off-canvas menu on small screens.
      menuOpen && h('button', { class: 'backdrop', type: 'button', 'aria-label': 'Close navigation', onClick: () => { menuOpen = false; render(); } }),
      h('main', { class: 'content', id: 'main' }, VIEWS[route.view](route, ctx))),
    bottomNav(route));
}

// Service worker enables install + offline use of the app shell. Browsers only
// allow it on HTTPS or localhost; elsewhere the app still runs.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker not registered:', err));
}

store.subscribe(render);
window.addEventListener('hashchange', () => { menuOpen = false; render(); window.scrollTo(0, 0); });
render();
