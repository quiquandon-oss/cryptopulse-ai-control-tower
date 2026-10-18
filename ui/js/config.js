// Data source configuration — the ONLY place endpoints are defined.
//
// The UI is a public static site (GitHub Pages): anything here is visible to
// everyone, so it holds public base URLs only. No keys, tokens or private
// endpoints may ever be added. Every path below was checked in the owning
// worker's source to be GET-only with no side effects (see docs in each entry).
//
// lib/http.js refuses any request whose URL is not allow-listed here.

const deepFreeze = (o) => {
  Object.values(o).forEach((v) => { if (v && typeof v === 'object') deepFreeze(v); });
  return Object.freeze(o);
};

export const GITHUB = deepFreeze({
  api: 'https://api.github.com',
  raw: 'https://raw.githubusercontent.com',
  owner: 'quiquandon-oss',
  controlTower: { repo: 'cryptopulse-ai-control-tower', branch: 'main', tasksDir: 'tasks/active', pagesWorkflow: 'pages.yml' },
});

// One entry per CryptoPulse version. Each version module imports only its own.
export const V1 = deepFreeze({
  id: 'V1',
  name: 'CryptoPulse V1',
  scope: 'Initial market intelligence prototype and baseline logic',
  repos: ['CryptoPulse', 'PulseWorker'],
  backend: {
    base: 'https://sentiment-ff75.quiquandon.workers.dev',
    // /technical-eval: single SELECT ... LIMIT 1 on technical_eval.
    // NOT /risk-regime: it recomputes and writes when the stored reading is stale.
    paths: { technicalEval: '/technical-eval' },
  },
});

export const V2 = deepFreeze({
  id: 'V2',
  name: 'CryptoPulse V2',
  scope: 'Cloudflare Worker backend and D1 bindings (PulseWorkerV2)',
  repos: ['CryptoPulseV2', 'PulseWorkerV2'],
  backend: {
    base: 'https://pulseworker-v2.quiquandon.workers.dev',
    // getPredictionFreshness(): D1 reads only.
    // Never: /run-analysis (spends Gemini quota), /recalibrate-refresh*, *-backfill.
    paths: { freshness: '/prediction-freshness' },
  },
});

export const V3 = deepFreeze({
  id: 'V3',
  name: 'CryptoPulse V3',
  scope: 'Advanced prediction models and research dashboards',
  repos: ['CryptoPulseV3'],
  // V3 has no backend of its own; it consumes the V2 worker. Shown "via V2".
  via: 'V2',
  backend: {
    base: 'https://pulseworker-v2.quiquandon.workers.dev',
    // The route V3's api/pulseworker.js consumes; getChallengerRecent() is read-only.
    paths: { challengerRecent: '/challenger-recent?limit=5' },
  },
});

export const V4 = deepFreeze({
  id: 'V4',
  name: 'CryptoPulse V4',
  scope: 'Independent terminal: own Worker + D1, multi-asset signals',
  repos: ['CryptoPulseV4'],
  backend: {
    base: 'https://cryptopulse-v4.quiquandon.workers.dev',
    // D1 reads only, except market-pulse which also reads public exchange candles.
    // Never: /api/portfolio* (private token), /api/ingest (POST).
    paths: { health: '/api/health', signals: '/api/signals?limit=5', marketPulse: '/api/market-pulse' },
  },
});

export const VERSIONS = deepFreeze([V1, V2, V3, V4]);

// Routes that must never be requested from the browser (enforced by tests).
export const FORBIDDEN_PATHS = deepFreeze([
  '/run-analysis', '/recalibrate-refresh', '/recalibrate-refresh-challenger',
  '/btc-backfill', '/btc-backfill-hourly', '/eth-backfill-history', '/risk-regime',
  '/api/portfolio', '/api/ingest', '/predict',
]);

// Client-side cache lifetime. Unauthenticated GitHub API allows 60 requests
// per hour per IP; a full refresh of every view uses about 15.
export const CACHE_TTL_MS = 5 * 60 * 1000;
export const REQUEST_TIMEOUT_MS = 10 * 1000;

/** Every exact backend URL the UI may request (GitHub is checked by prefix). */
export function allowedBackendUrls() {
  return new Set(VERSIONS.flatMap((v) => Object.values(v.backend.paths).map((p) => v.backend.base + p)));
}

/** GitHub URL prefixes the UI may request (public, read-only GETs). */
export function allowedGithubPrefixes() {
  const repos = [GITHUB.controlTower.repo, ...VERSIONS.flatMap((v) => v.repos)];
  return [
    ...repos.map((r) => `${GITHUB.api}/repos/${GITHUB.owner}/${r}/`),
    `${GITHUB.raw}/${GITHUB.owner}/${GITHUB.controlTower.repo}/${GITHUB.controlTower.branch}/${GITHUB.controlTower.tasksDir}/`,
  ];
}
