// Rendering helpers for live data: loading, error and "as of" notes.
// Errors are shown as errors — never replaced by substitute data.
import { h, pill } from '../dom.js';
import { age } from '../lib/status.js';

const ERROR_TEXT = {
  blocked: 'Request blocked by the allow-list',
  timeout: 'Timed out',
  network: 'Unreachable',
  'rate-limit': 'GitHub rate limit reached',
  http: 'Error response',
  parse: 'Unexpected response',
};

export function errorText(error) {
  if (!error) return 'Unknown error';
  const base = ERROR_TEXT[error.kind] || error.message || 'Error';
  if (error.kind === 'rate-limit' && error.resetAt) {
    return `${base} — resets at ${new Date(error.resetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return error.kind === 'http' ? `${base} (${error.status})` : base;
}

/** Notice for a resource that is loading or failed (no substitute data). */
export function sourceNotice(entry, label, onRetry) {
  if (entry.status === 'loading') return h('p', { class: 'muted notice', role: 'status' }, `Loading ${label}…`);
  return h('div', { class: 'notice notice--error', role: 'alert' },
    pill('Unavailable', 'red'),
    h('span', {}, `${label}: ${errorText(entry.error)}`),
    onRetry && h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onClick: onRetry }, 'Retry'));
}

/** "Fetched 2 min ago · cached" footnote. */
export function asOf(at, cached) {
  return h('p', { class: 'asof muted' }, `Fetched ${age(at)}${cached ? ' · from cache' : ''}`);
}
