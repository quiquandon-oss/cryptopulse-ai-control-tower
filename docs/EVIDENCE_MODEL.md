# Evidence Model & Review Ledger (TASK-GOV-002)

How the Control Tower records review findings and decides whether the evidence
for a release is good enough. Implemented by `governance/evidence.mjs` (states,
aggregation) and `governance/validate-ledger.mjs` (ledger rules); both are
unit-tested in `governance/tests/`.

## 1. Evidence states

Every check that feeds a release decision (tests, CI, review findings, backend
freshness, …) resolves to exactly one state:

| State | Meaning | Release effect |
|---|---|---|
| `PASS` | The check ran on the current evidence and succeeded. | Allows |
| `FAIL` | The check ran and found a defect, or a blocking finding is open. | **Blocks** |
| `UNKNOWN` | No result yet, or the result exists but is not independently confirmed (e.g. a high-severity fix not yet re-reviewed). | **Blocks** until resolved |
| `UNAVAILABLE` | The source could not be queried (network error, rate limit, HTTP error). Says nothing about the system itself. | **Blocks** until retried |
| `STALE` | A result exists but is older than the check's freshness limit, or the source reports itself stale/degraded. | **Blocks** until refreshed |
| `NOT_APPLICABLE` | The check does not apply here (e.g. no CI checks for a docs-only change). | Ignored |

Rules that keep the model honest:

- **Missing evidence is never `PASS`.** A failed fetch is `UNAVAILABLE`, not
  "nothing found"; a check not yet run is `UNKNOWN`. (This is the bug fixed in
  PR #7, finding CT-0005.)
- **No substitute data.** If a state cannot be established, it is reported as
  such; nothing is filled in with defaults or examples.

### Aggregation (release gate)

`aggregate(states)` combines checks, worst first:

1. any `FAIL` → **`FAIL`**
2. else any `UNAVAILABLE` → **`UNAVAILABLE`**
3. else any `STALE` → **`STALE`**
4. else any `UNKNOWN` → **`UNKNOWN`**
5. else (all applicable checks `PASS`) → **`PASS`**

`NOT_APPLICABLE` is ignored; if every check is `NOT_APPLICABLE` (or there are
none) the result is `NOT_APPLICABLE`. **A release may proceed only on `PASS`**
(`releaseAllowed`). Any other result goes to Olivier as the decision maker, who
can merge anyway — that is a human decision, recorded on the PR, not a `PASS`.

### Review-findings check

`findingsState(ledger, repository)`:

| Condition | State |
|---|---|
| Ledger missing or unreadable | `UNAVAILABLE` |
| Any **open** finding of severity `critical`, `high` or `medium` | `FAIL` |
| Any `critical`/`high` finding that is only `fixed` (not yet `verified`) | `UNKNOWN` |
| Otherwise (open `low`/`info` findings are allowed but listed) | `PASS` |

### Mapping from the Control Tower UI

| UI state | Where | Evidence state |
|---|---|---|
| gate `done` | Workflow | `PASS` |
| gate `rejected` (PR closed unmerged) | Workflow | `FAIL` |
| gate `pending`, `loading`, `untracked` | Workflow | `UNKNOWN` |
| gate `locked` (earlier step not reached) | Workflow | `NOT_APPLICABLE` |
| gate `error` (GitHub query failed) | Workflow | `UNAVAILABLE` |
| version `ok` | Projects | `PASS` |
| version `warn` (stale, empty or degraded backend) | Projects | `STALE` |
| version `down` (unreachable) | Projects | `UNAVAILABLE` |

## 2. Review ledger

**File:** `governance/ledger.json` · **Schema:** `governance/ledger.schema.json` ·
**Validate:** `node governance/validate-ledger.mjs [--check-commits]`

One entry per review finding, across all CryptoPulse repositories. Entries are
**append-only by convention**: a finding changes status but is never deleted,
and an ID is never reused.

| Field | Required | Meaning |
|---|---|---|
| `finding_id` | ✔ | `CT-NNNN`, unique, never reused |
| `repository` | ✔ | `quiquandon-oss/<repo>` — one of the 7 suite repositories |
| `file_path` | ✔ | Repo-relative file, or a directory for repository-level findings |
| `commit_sha` | ✔ | Full 40-hex SHA of the commit the finding was observed on |
| `description` | ✔ | What is wrong and its effect |
| `severity` | ✔ | `critical` · `high` · `medium` · `low` · `info` |
| `status` | ✔ | `open` · `fixed` · `verified` · `accepted_risk` |
| `verification_method` | ✔ | How the current status was established (tests, re-review, rationale). Empty only while `open`. |
| `timestamp` | ✔ | UTC time the current status was recorded (`YYYY-MM-DDTHH:MM:SSZ`) |
| `reviewer` | ✔ | Who established the current status |
| `found_at` |  | UTC time the finding was first raised |
| `fix_commit_sha` |  | Full SHA of the fixing commit, or `null` |
| `pr` |  | Pull request number |
| `source_url` |  | Link to the review comment that raised it |
| `verification_url` |  | Link to the review that verified it |

### Status lifecycle

```
open ──fix pushed──▶ fixed ──independent re-review──▶ verified
  │                    │
  └────── Olivier accepts the risk ──────▶ accepted_risk
```

- **`open`** — raised, not yet fixed.
- **`fixed`** — a fix is committed and checked by its author (tests listed in
  `verification_method`), but **not yet independently confirmed**.
- **`verified`** — someone other than the developer (normally ChatGPT on
  re-review) confirmed the fix on the fixing commit.
- **`accepted_risk`** — Olivier decided not to fix; the rationale is recorded.

### Validation rules

| Rule | Check |
|---|---|
| R1 | Shape: required fields present, no unknown fields, types, enums and patterns as in the schema |
| R2 | `finding_id` unique |
| R3 | `open` ⇒ no `fix_commit_sha` |
| R4 | `fixed` / `verified` ⇒ `fix_commit_sha` and a non-empty `verification_method` |
| R5 | `verified` ⇒ reviewer is not `Claude` (a developer cannot verify their own fix) |
| R6 | `accepted_risk` ⇒ reviewer is `Olivier`, rationale given, severity not `critical` |
| R7 | `found_at` ≤ `timestamp`; `timestamp` not in the future |
| R8 | `fix_commit_sha` ≠ `commit_sha` |
| R9 | No credential-like strings (tokens, keys, private keys) in any field |
| `--check-commits` | Control-tower SHAs exist in local git history |

### How entries are added

1. A reviewer raises a finding on a PR.
2. The developer adds (or updates) the entry in the same PR that fixes it —
   `fixed` with the fix SHA and the tests run — or as `open` if deferred.
3. After an independent re-review confirms it, the entry moves to `verified`
   with `verification_url`.
4. `node governance/validate-ledger.mjs --check-commits` must pass before merge.

The ledger currently holds the real findings from ChatGPT's reviews of
PRs #3, #6 and #7 (CT-0001 … CT-0007).
