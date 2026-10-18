# Continuous Integration (TASK-CI-001)

Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) · runs on
every **pull request**, every **push to `main`**, and on manual dispatch.
Each job reports as a GitHub **check run** on the PR (shown as
`CI / <job name>`).

## Mandatory checks

All three jobs are mandatory. A PR may be merged only when all three are green
on its latest commit.

| Check | What it runs | Fails when |
|---|---|---|
| **Node tests** | `node --check` on every tracked `.js`/`.mjs`; `node --test ui/tests/*.test.mjs` (version boundaries, allow-list, CSP, purge, gate model); **when `governance/` exists:** `node governance/validate-ledger.mjs --check-commits` and `node --test governance/tests/*.test.mjs` | Any syntax error, failing test, or invalid ledger (schema, rules R1–R9, unknown commit SHA) |
| **Python tests** | `python -m unittest ui/test_serve.py -v` | Any `serve.py` path-restriction regression |
| **Browser smoke** | `node --test ui/tests/browser/*.test.mjs` in Chromium (desktop 1440 px and Pixel 7) | Any page error, console error or CSP violation; missing heading; horizontal overflow; mock data; a data view not reporting the outage; **any outbound request that is not an allow-listed GET** |

The governance steps arrive with TASK-GOV-002 (PR #8). On refs without
`governance/` they report *skipped* with a notice; once `governance/` is on a
ref they always run and are mandatory.

## Safety

- **Least privilege:** workflow token is `contents: read`; no other scopes.
- **No secrets** are referenced; no production credentials exist in CI.
- **No production calls:** the browser smoke test serves the UI locally with
  `ui/serve.py` and **blocks every outbound request**, asserting each attempt
  is an allow-listed GET. Unit tests stub `fetch`.
- **No deployments or writes:** this workflow only reads and tests. (GitHub
  Pages deployment is a separate workflow, `pages.yml`, triggered by merges to
  `main`.)
- **Pinned actions:** `actions/checkout`, `actions/setup-node` and
  `actions/setup-python` are pinned to full commit SHAs (version in a comment);
  `checkout` runs with `persist-credentials: false`. Playwright is pinned to
  `1.56.1`.

## Enforcing the checks (Olivier — one-time)

CI reports results but cannot by itself block a merge. To make the three
checks required: **Settings → Branches → Add branch protection rule** (or
*Rulesets*) for `main` → *Require status checks to pass before merging* →
select **Node tests**, **Python tests**, **Browser smoke**. This needs repository
admin rights, which the agents do not use.

## Running the same checks locally

```bash
git ls-files '*.js' '*.mjs' | xargs -n1 node --check
node --test ui/tests/*.test.mjs
node governance/validate-ledger.mjs --check-commits      # when governance/ exists
node --test governance/tests/*.test.mjs                  # when governance/ exists
python3 -m unittest ui/test_serve.py -v
npm install --no-save --no-package-lock --ignore-scripts playwright@1.56.1
npx --no-install playwright install --with-deps chromium
node --test ui/tests/browser/*.test.mjs
```
