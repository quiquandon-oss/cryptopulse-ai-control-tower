// View-facing selectors: combine store resources into what views render.
// Pure apart from store.need(), which starts loads on first use.
import { matchPull, deriveWorkflow } from './model.js';

/** Combined loading state of several resources. */
function combine(entries) {
  const failed = entries.find((e) => e.status === 'error');
  if (failed) return { status: 'error', error: failed.error };
  if (entries.some((e) => e.status === 'loading')) return { status: 'loading' };
  return { status: 'ok' };
}

/**
 * All task files with their matched PR and derived workflow.
 * @returns {{ status, error?, items?: { task, pr, workflow }[], at? }}
 */
export function selectWorkflows(store) {
  const tasks = store.need('tasks');
  const pulls = store.need('pulls');
  const state = combine([tasks, pulls]);
  if (state.status !== 'ok') return state;
  const items = tasks.data.tasks
    .map((task) => {
      const pr = matchPull(task.id, pulls.data.pulls);
      const reviews = pr ? store.need(`reviews:${pr.number}`) : null;
      const reviewList = reviews && reviews.status === 'ok' ? reviews.data.reviews
        : reviews && reviews.status === 'error' ? [] : null;
      return { task, pr, workflow: deriveWorkflow(task, pr, reviewList), reviewsError: reviews && reviews.status === 'error' ? reviews.error : null };
    })
    .sort((a, b) => b.task.id.localeCompare(a.task.id));
  return { status: 'ok', items, at: Math.min(tasks.data.at, pulls.data.at) };
}

export const isOpen = (item) => !['Completed', 'Closed'].includes(item.workflow.status);
