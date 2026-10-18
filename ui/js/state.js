// Live data store. Holds only what sources returned; nothing is bundled or
// synthesized. Each resource is loaded on demand by the views that need it
// and fails independently of the others.
//
// Resource keys:
//   tasks, pulls, pages, v1, v2, v3, v4, runs:<repo>, reviews:<pr>, checks:<sha>
import { GITHUB, VERSIONS } from './config.js';
import { listTasks, listPulls, listReviews, listCheckRuns, latestRun } from './sources/github.js';
import { loadV1 } from './sources/v1.js';
import { loadV2 } from './sources/v2.js';
import { loadV3 } from './sources/v3.js';
import { loadV4 } from './sources/v4.js';

const STATIC_LOADERS = {
  tasks: listTasks,
  pulls: listPulls,
  pages: () => latestRun(GITHUB.controlTower.repo, GITHUB.controlTower.pagesWorkflow),
  v1: loadV1,
  v2: loadV2,
  v3: loadV3,
  v4: loadV4,
};

const KNOWN_REPOS = new Set(VERSIONS.flatMap((v) => v.repos));

function loaderFor(key) {
  if (STATIC_LOADERS[key]) return STATIC_LOADERS[key];
  const [kind, arg] = key.split(':');
  if (kind === 'runs' && KNOWN_REPOS.has(arg)) return () => latestRun(arg);
  if (kind === 'reviews' && /^\d+$/.test(arg)) return () => listReviews(arg);
  if (kind === 'checks' && /^[0-9a-f]{40}$/.test(arg)) return () => listCheckRuns(arg);
  return null;
}

/**
 * Observable resource store.
 * need(key)  -> current entry ({ status: 'loading'|'ok'|'error', data, error }),
 *               starting a load if the key has not been requested yet.
 * refresh()  -> drop all entries so the next render re-requests them
 *               (lib/http.js still serves anything inside its cache TTL).
 */
export function createStore() {
  const entries = new Map();
  const subscribers = new Set();
  const notify = () => subscribers.forEach((fn) => fn());

  function need(key) {
    if (entries.has(key)) return entries.get(key);
    const loader = loaderFor(key);
    if (!loader) {
      const entry = { status: 'error', error: new Error(`Unknown resource ${key}`) };
      entries.set(key, entry);
      return entry;
    }
    const entry = { status: 'loading' };
    entries.set(key, entry);
    // Resolve asynchronously so a render never triggers a synchronous re-render.
    Promise.resolve()
      .then(loader)
      .then((data) => entries.set(key, { status: 'ok', data }))
      .catch((error) => entries.set(key, { status: 'error', error }))
      .finally(notify);
    return entry;
  }

  return {
    need,
    refresh() { entries.clear(); notify(); },
    subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
  };
}
