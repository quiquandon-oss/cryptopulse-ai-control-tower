// The single network gateway for the UI.
//
// - Refuses any URL not allow-listed in config.js (defence in depth on top of CSP).
// - GET only, no cookies/credentials, no referrer, hard timeout.
// - Short client-side cache so repeated renders and reloads stay well within
//   GitHub's unauthenticated rate limit. Cached data is real data from an
//   earlier successful request; callers label it with its fetch time.
// - Tracks GitHub's remaining rate-limit budget from response headers.
import { CACHE_TTL_MS, REQUEST_TIMEOUT_MS, FORBIDDEN_PATHS, allowedBackendUrls, allowedGithubPrefixes, allowedGithubFiles } from '../config.js';

const CACHE_PREFIX = 'ct-cache-v1:';
const BACKEND_URLS = allowedBackendUrls();
const GITHUB_PREFIXES = allowedGithubPrefixes();
const GITHUB_FILES = allowedGithubFiles();

export const githubRate = { remaining: null, limit: null, resetAt: null };

export class SourceError extends Error {
  constructor(kind, message, extra = {}) {
    super(message);
    this.kind = kind; // 'blocked' | 'timeout' | 'network' | 'http' | 'rate-limit' | 'parse'
    Object.assign(this, extra);
  }
}

/** True if the URL is on the allow-list and not a forbidden route. */
export function isAllowedUrl(url) {
  let parsed;
  try { parsed = new URL(url); } catch { return false; }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return false;
  if (FORBIDDEN_PATHS.some((p) => parsed.pathname === p || parsed.pathname.startsWith(`${p}/`))) return false;
  const normalized = parsed.origin + parsed.pathname + parsed.search;
  if (BACKEND_URLS.has(normalized) || GITHUB_FILES.has(normalized)) return true;
  // GitHub: prefix match on the normalized URL, and no traversal segments.
  if (parsed.pathname.split('/').some((seg) => seg === '..' || seg === '.')) return false;
  return GITHUB_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function readCache(url) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + url);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    return entry && typeof entry.at === 'number' && 'data' in entry ? entry : null;
  } catch {
    return null;
  }
}

function writeCache(url, data) {
  try { localStorage.setItem(CACHE_PREFIX + url, JSON.stringify({ at: Date.now(), data })); } catch { /* optional */ }
}

export function clearCache() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX)).forEach((k) => localStorage.removeItem(k));
  } catch { /* optional */ }
}

function trackRate(response) {
  if (!response.url.startsWith('https://api.github.com/')) return;
  const remaining = response.headers.get('x-ratelimit-remaining');
  if (remaining == null) return;
  githubRate.remaining = Number(remaining);
  githubRate.limit = Number(response.headers.get('x-ratelimit-limit'));
  githubRate.resetAt = Number(response.headers.get('x-ratelimit-reset')) * 1000;
}

/**
 * Fetch JSON (or text) from an allow-listed URL.
 * Resolves to { data, at, cached }; rejects with SourceError.
 * @param {string} url
 * @param {{ as?: 'json'|'text', ttl?: number }} [opts]
 */
export async function fetchData(url, { as = 'json', ttl = CACHE_TTL_MS } = {}) {
  if (!isAllowedUrl(url)) throw new SourceError('blocked', `Blocked: ${url} is not on the allow-list`);

  const cached = readCache(url);
  if (cached && Date.now() - cached.at < ttl) return { data: cached.data, at: cached.at, cached: true };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      signal: controller.signal,
      headers: url.startsWith('https://api.github.com/') ? { Accept: 'application/vnd.github+json' } : {},
    });
  } catch (err) {
    throw new SourceError(err.name === 'AbortError' ? 'timeout' : 'network',
      err.name === 'AbortError' ? 'Timed out' : 'Unreachable', { stale: cached });
  } finally {
    clearTimeout(timer);
  }

  trackRate(response);
  if (!response.ok) {
    if ((response.status === 403 || response.status === 429) && githubRate.remaining === 0) {
      throw new SourceError('rate-limit', 'GitHub rate limit reached', { resetAt: githubRate.resetAt, stale: cached });
    }
    throw new SourceError('http', `HTTP ${response.status}`, { status: response.status, stale: cached });
  }

  let data;
  try {
    data = as === 'text' ? await response.text() : await response.json();
  } catch {
    throw new SourceError('parse', 'Unexpected response format', { stale: cached });
  }
  writeCache(url, data);
  return { data, at: Date.now(), cached: false };
}
