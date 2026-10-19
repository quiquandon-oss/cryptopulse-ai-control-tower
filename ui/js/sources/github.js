// Public GitHub metadata (unauthenticated, read-only): task files, pull
// requests, reviews, check runs and Actions runs. No token is ever used, so
// the 60 requests/hour/IP limit applies; lib/http.js caches responses.
import { GITHUB } from '../config.js';
import { fetchData } from '../lib/http.js';

const CT = GITHUB.controlTower;
const repoApi = (repo) => `${GITHUB.api}/repos/${GITHUB.owner}/${repo}`;

/** Strip Markdown decoration and citation markers from a metadata value. */
const clean = (s) => s.replace(/\[(?:cite|span)[^\]]*\](?:\([^)]*\))?/g, '').replace(/[`*]/g, '').trim();

/** Parse a task file (tasks/TEMPLATE_TASK.md format). Tolerant of variations. */
export function parseTask(markdown, fileName) {
  const heading = markdown.match(/^#\s*Task ID:\s*([A-Za-z0-9-]+)\s*[—–-]+\s*(.+)$/m);
  const fromFile = fileName.match(/^(TASK-[A-Za-z0-9]+-\d+)/i);
  const field = (label) => {
    const m = markdown.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`));
    return m ? clean(m[1]) : null;
  };
  return {
    id: heading ? heading[1] : (fromFile ? fromFile[1].toUpperCase() : fileName.replace(/\.md$/, '')),
    title: heading ? clean(heading[2]) : fileName,
    repository: field('Target Repository'),
    version: field('Target Version'),
    author: field('Author'),
  };
}

/**
 * Task files in tasks/active, parsed. Each file loads independently (CT-0006):
 * one unreadable file becomes a task with `loadError` set (ID from its file
 * name), and the others still load. Only a failed directory listing fails
 * the whole list, since without it no task is known.
 */
export async function listTasks() {
  const listing = await fetchData(`${repoApi(CT.repo)}/contents/${CT.tasksDir}?ref=${CT.branch}`);
  const files = (Array.isArray(listing.data) ? listing.data : [])
    .filter((f) => f.type === 'file' && /\.md$/i.test(f.name));
  const results = await Promise.allSettled(files.map(async (f) => {
    // Raw file host does not count against the API rate limit.
    const raw = await fetchData(`${GITHUB.raw}/${GITHUB.owner}/${CT.repo}/${CT.branch}/${CT.tasksDir}/${encodeURIComponent(f.name)}`, { as: 'text' });
    return parseTask(raw.data, f.name);
  }));
  const tasks = results.map((r, i) => ({
    ...(r.status === 'fulfilled' ? r.value : { ...parseTask('', files[i].name), loadError: r.reason }),
    file: files[i].name,
    htmlUrl: files[i].html_url,
  }));
  return { tasks, at: listing.at, cached: listing.cached };
}

/** Recent pull requests (all states) of the Control Tower repo. */
export async function listPulls() {
  const res = await fetchData(`${repoApi(CT.repo)}/pulls?state=all&per_page=50&sort=created&direction=desc`);
  return { pulls: Array.isArray(res.data) ? res.data : [], at: res.at, cached: res.cached };
}

export async function listReviews(prNumber) {
  const res = await fetchData(`${repoApi(CT.repo)}/pulls/${Number(prNumber)}/reviews?per_page=50`);
  return { reviews: Array.isArray(res.data) ? res.data : [], at: res.at, cached: res.cached };
}

export async function listCheckRuns(sha) {
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('Invalid commit SHA');
  const res = await fetchData(`${repoApi(CT.repo)}/commits/${sha}/check-runs?per_page=50`);
  return { checks: (res.data && res.data.check_runs) || [], at: res.at, cached: res.cached };
}

/** Latest GitHub Actions run of a repo (optionally one workflow file). */
export async function latestRun(repo, workflowFile = null) {
  const path = workflowFile ? `/actions/workflows/${encodeURIComponent(workflowFile)}/runs` : '/actions/runs';
  const res = await fetchData(`${repoApi(repo)}${path}?per_page=1`);
  const run = (res.data && res.data.workflow_runs && res.data.workflow_runs[0]) || null;
  return { run, at: res.at, cached: res.cached };
}
