# Control Tower UI — Test Build (TASK-UI-001)

Static HTML/CSS/JS prototype of the Control Tower, built from
[`docs/assets/control-tower-mockup.png`](../docs/assets/control-tower-mockup.png).
It validates layout, component hierarchy and navigation only.

**Isolated by design:** no build step, no dependencies, no network calls
(enforced by a strict Content-Security-Policy), no credentials. All data is
local mock state in `js/state.js`; clicks are kept in your browser's
localStorage and can be cleared under **Settings → Reset mock data**.
Nothing here touches GitHub, Cloudflare, or any CryptoPulse repository.

## Run locally

ES modules need an HTTP server (not `file://`). Serve the **repo root** so the
Knowledge Base links to `../docs` and `../tasks` resolve:

```bash
python3 -m http.server 8000
# open http://localhost:8000/ui/
```

## Structure

```
ui/
├── index.html              # Shell + CSP
├── css/styles.css          # Dark theme, responsive breakpoints (1280 / 1100 / 820 px)
└── js/
    ├── app.js              # Hash router, layout, toast, render loop
    ├── state.js            # Mock data, derived status, observable store
    ├── dom.js              # h() element builder (no innerHTML), card/pill helpers
    ├── components/
    │   ├── header.js       # Brand, primary tabs, mode indicator, user
    │   ├── sidebar.js      # Navigation with counters, supported agents
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
