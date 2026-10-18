# AI Control Tower — Live Read-Only UI

Static HTML/CSS/JS app showing the multi-agent workflow and the live status of
CryptoPulse V1–V4. Layout follows the design reference
[`docs/assets/control-tower-mockup.png`](../docs/assets/control-tower-mockup.png).

**Live, read-only, no secrets.** The app is a public static site, so it can
only use public endpoints: every URL it may request is allow-listed in
`js/config.js`, enforced twice (by `js/lib/http.js` and by the page's
Content-Security-Policy). No credentials are stored or sent, and no route with
side effects is ever called. If a source fails, its card says so; the app never
substitutes made-up data.

## Data sources

| Source | Endpoints (GET, verified read-only in the worker code) | Never called |
|---|---|---|
| **V1** `sentiment-ff75` (PulseWorker) | `/technical-eval` | `/risk-regime` (writes when stale), POST routes, proxies, backfills |
| **V2** `pulseworker-v2` (PulseWorkerV2) | `/prediction-freshness` | `/run-analysis`, `/recalibrate-refresh*`, `*-backfill`, `/predict` |
| **V3** — no backend of its own, **via V2** | `/challenger-recent?limit=5` (the route V3 consumes) | everything else |
| **V4** `cryptopulse-v4` (own D1) | `/api/health`, `/api/signals?limit=5`, `/api/market-pulse` | `/api/portfolio*` (private), `/api/ingest` |
| **GitHub** (public API, no token) | task files in `tasks/active/`, PRs, reviews, check runs, Actions runs of the 6 CryptoPulse repos | any write |

Each version module (`js/sources/v1.js` … `v4.js`) imports only its own
config entry and requests only its own allow-listed URLs, so no data or state
crosses version boundaries.

**Rate limits and caching.** Unauthenticated GitHub API calls are limited to
60/hour per IP. Responses are cached in the browser for 5 minutes
(`CACHE_TTL_MS`); task files come from `raw.githubusercontent.com`, which does
not count. **Settings** shows the remaining budget and has *Clear cache &
reload*.

**Workflow gates are a read-only tracker** derived from GitHub:

| Gate | Evidence |
|---|---|
| 1 Plan (Gemini) | task file exists in `tasks/active/` |
| 2 Implement (Claude) | a PR whose title (or, failing that, description) names the task ID |
| 3 Review (ChatGPT) | that PR has at least one review |
| 4 Synthesis (Gemini) | happens outside GitHub → *Not tracked* |
| 5 Decision (Olivier) | PR merged (done) or closed unmerged (rejected) |

Decisions are made on GitHub; the app reflects them. *New task on GitHub*
opens GitHub's new-file page in `tasks/active/`.

## Try it

**Live (GitHub Pages):** https://quiquandon-oss.github.io/cryptopulse-ai-control-tower/ui/
Redeployed automatically on every merge to `main` that touches `ui/`, `docs/` or `tasks/`.

**Install on a phone**
- Android / Chrome: open the link → **⋮** → **Install app** (or *Add to Home screen*).
- iPhone: open the link in **Safari** → **Share** → **Add to Home Screen**.

The installed app opens full-screen and works offline (service worker in `sw.js`).

## Run locally

Requires only Python 3 (no install step). From the repo root:

```bash
python3 ui/serve.py            # http://127.0.0.1:8000/ui/  (this computer only)
python3 ui/serve.py --lan      # also prints a URL for a phone on the same Wi-Fi
python3 ui/serve.py --port 9000
```

`serve.py` serves only `ui/`, `docs/` and `tasks/`; `.git`, dotfiles, path
traversal and directory listings return 404, so `--lan` never exposes the
repository. Stop with **Ctrl+C**.

## Tests

```bash
node --test ui/tests/*.test.mjs        # boundaries, allow-list, CSP, purge, gate model
python3 -m unittest ui/test_serve.py -v  # serve.py path restrictions
```

- `boundaries.test.mjs` — each version module imports only its own config and
  requests only its own allow-listed URLs; forbidden/private routes are refused;
  CSP `connect-src` equals the configured hosts; no credentials, auth headers,
  `eval`/`innerHTML` or polling loops in client code.
- `purge.test.mjs` — shipped files contain no mock, seed, fake CI/deploy or
  placeholder data.
- `model.test.mjs` — gate derivation and task-file parsing.

Tests are not deployed to GitHub Pages.

Phone preview over `--lan` uses plain HTTP, so it runs but cannot be
*installed* (browsers require HTTPS for that). Use the GitHub Pages link to
install.

### Mobile test in desktop Chrome
1. Open the local URL, press **F12** → device toolbar (**Ctrl+Shift+M**).
2. Pick a phone (e.g. Pixel 7, iPhone SE) and reload.
3. Check: bottom tab bar, **Gates / Details & CI** switch on Workflow,
   ☰ menu, no sideways scrolling.

## Mobile behaviour (≤ 820 px)

- **Bottom tab bar:** Workflow, Tasks, Projects, Agents, Metrics. Respects the
  iPhone home-indicator area.
- **Workflow pane switch:** *Gates* or *Details & CI* (task info, PR, CI,
  deployment), one at a time instead of one long scroll.
- **Touch targets** ≥ 44 px on touch screens; the task switcher uses 16 px
  text so iOS does not zoom on focus.
- Full section list stays available from the ☰ menu.

## Structure

```
ui/
├── index.html              # Shell + CSP (connect-src = allow-listed hosts) + manifest link
├── manifest.webmanifest    # Installable app metadata
├── sw.js                   # Service worker: app shell offline; live data always from network
├── serve.py                # Restricted local preview server
├── test_serve.py           # serve.py regression tests
├── icons/                  # App icons (192, 512, maskable)
├── css/styles.css          # Dark theme, breakpoints (1280 / 1100 / 820 px), touch sizing
├── tests/                  # Node tests (not deployed)
└── js/
    ├── app.js              # Hash router, layout, toast, render loop
    ├── config.js           # THE allow-list: public base URLs + read-only paths per version
    ├── state.js            # Resource store: loads on demand, each source fails independently
    ├── data.js             # Selectors: tasks + PRs + reviews -> workflows
    ├── model.js            # Pure gate derivation (participants, gates, PR matching)
    ├── dom.js              # h() element builder (no innerHTML), card/pill helpers
    ├── lib/
    │   ├── http.js         # Single network gateway: allow-list, no credentials, timeout, cache, rate limit
    │   └── status.js       # Shared status shape + time helpers
    ├── sources/
    │   ├── v1.js … v4.js   # One module per CryptoPulse version (own backend only)
    │   └── github.js       # Public GitHub metadata + task-file parser
    ├── components/
    │   ├── header.js       # Brand, tabs, live indicator, refresh
    │   ├── sidebar.js      # Navigation, participants
    │   ├── bottomnav.js    # Phone-only bottom tab bar
    │   ├── rail.js         # Task, Pull Request, CI checks, Control Tower deploy
    │   └── source.js       # Loading / error / "fetched … ago" rendering
    └── views/
        ├── workflow.js     # Read-only five-gate tracker for one task
        ├── tasks.js        # Active Tasks, Task History
        ├── overview.js     # Metrics, Agent Status, Projects (V1–V4), Pull Requests
        └── docs.js         # Knowledge Base, Templates, Agent Instructions, Settings
```

## Routes

| Hash | View |
|---|---|
| `#/workflow/<taskId>` | Read-only gate tracker (default: first open task) |
| `#/dashboard` | Metrics: open tasks, decisions waiting, versions healthy, GitHub budget |
| `#/tasks/active`, `#/tasks/history` | Task files with live PR state |
| `#/projects` | CryptoPulse V1–V4 status cards + latest CI per repo |
| `#/agents` | Who each open task is waiting on |
| `#/prs` | Control Tower pull requests |
| `#/knowledge`, `#/templates`, `#/instructions`, `#/settings` | Reference pages, data sources, cache |

## Not in scope

Writing to GitHub or any backend (approving gates, creating tasks in-app),
authenticated/private data such as V4 portfolio, and Gemini's synthesis step
(not recorded on GitHub). These need a private backend with its own security
review.
