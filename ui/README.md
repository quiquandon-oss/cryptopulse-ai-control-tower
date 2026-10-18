# Control Tower UI — Test Build (TASK-UI-001)

Static HTML/CSS/JS prototype of the Control Tower, built from
[`docs/assets/control-tower-mockup.png`](../docs/assets/control-tower-mockup.png).
It validates layout, component hierarchy and navigation only.

**Isolated by design:** no build step, no dependencies, no network calls
(enforced by a strict Content-Security-Policy), no credentials. All data is
local mock state in `js/state.js`; clicks are kept in your browser's
localStorage and can be cleared under **Settings → Reset mock data**.
Nothing here touches GitHub, Cloudflare, or any CryptoPulse repository.

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

Regression tests for those restrictions (incl. percent-encoded traversal):

```bash
python3 -m unittest ui/test_serve.py -v
```

Phone preview over `--lan` uses plain HTTP, so it runs but cannot be
*installed* (browsers require HTTPS for that). Use the GitHub Pages link to
install.

### Mobile test in desktop Chrome
1. Open the local URL, press **F12** → device toolbar (**Ctrl+Shift+M**).
2. Pick a phone (e.g. Pixel 7, iPhone SE) and reload.
3. Check: bottom tab bar, **Gates / Details & CI** switch on Workflow,
   ☰ menu, no sideways scrolling.

## Mobile behaviour (≤ 820 px)

- **Bottom tab bar:** Workflow, Tasks, Agents, Metrics, with badges for open
  tasks and agents waiting on a gate. Respects the iPhone home-indicator area.
- **Workflow pane switch:** *Gates* or *Details & CI* (task info, PR, CI,
  deployment), one at a time instead of one long scroll.
- **Touch targets** ≥ 44 px on touch screens; form fields use 16 px text so
  iOS does not zoom on focus; Gate 5 options stack vertically.
- Full section list stays available from the ☰ menu.

## Structure

```
ui/
├── index.html              # Shell + CSP + manifest link
├── manifest.webmanifest    # Installable app metadata
├── sw.js                   # Service worker (install + offline)
├── serve.py                # Restricted local preview server
├── icons/                  # App icons (192, 512, maskable)
├── css/styles.css          # Dark theme, breakpoints (1280 / 1100 / 820 px), touch sizing
└── js/
    ├── app.js              # Hash router, layout, toast, render loop
    ├── state.js            # Mock data, derived status, observable store
    ├── dom.js              # h() element builder (no innerHTML), card/pill helpers
    ├── components/
    │   ├── header.js       # Brand, primary tabs, mode indicator, user
    │   ├── sidebar.js      # Navigation with counters, supported agents
    │   ├── bottomnav.js    # Phone-only bottom tab bar
    │   └── rail.js         # Task info, Repository & PR, CI/Tests, Deployment
    └── views/
        ├── workflow.js     # Five human gates for one task (main mockup screen)
        ├── tasks.js        # Active Tasks, Task History, Create New Task
        ├── overview.js     # Dashboard, Agent Status, Repositories, PR & Deployments
        └── docs.js         # Knowledge Base, Templates, Agent Instructions, Settings
```

## Routes

| Hash | View |
|---|---|
| `#/workflow/<taskId>` | Gate workflow (default) |
| `#/dashboard` | KPIs, agent status, tasks needing a decision |
| `#/tasks/active`, `#/tasks/history` | Task tracking |
| `#/new` | Create a local mock task |
| `#/agents` | Agent status (derived from each task's current gate) |
| `#/repositories`, `#/prs` | V1–V4 scope, PRs and deployment state |
| `#/knowledge`, `#/templates`, `#/instructions`, `#/settings` | Reference pages |

## Gate behaviour (mock)

- Gates unlock strictly in order; only the current gate is editable.
- **Approve & Send** completes the gate and records a placeholder output.
  No agent is contacted.
- **Gate 5** records the decision locally. *Request changes* returns the task
  to Gate 2, *Iterate* returns it to Gate 4. Nothing is merged or deployed.

## Not in scope

Real GitHub/agent integration, authentication, persistence beyond the
browser, file attachments, and detail pages (plan/review/summary). Those
buttons show a "not implemented" notice.
