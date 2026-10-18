# Task ID: TASK-GOV-002 — Review Ledger, Evidence Model & Read-Only Allow-Lists (Part 1)

## 1. Metadata & Target Scope
- **Target Repository:** `cryptopulse-ai-control-tower`
- **Target Version:** Control Tower governance (all versions V1–V4)
- **Author:** Gemini (Master Orchestrator)
- **Assigned Developer:** Claude (Developer Lead)
- **Assigned Reviewer:** ChatGPT (Code Reviewer)

## 2. Objective & Scope Description
Establish the persistent review ledger structure, evidence-status models, and strict read-only endpoint allow-lists for the Control Tower UI.

## 3. Technical Requirements & Constraints
- **Partition 1 — Evidence & Review Ledger:** governance directory; durable ledger tracking `finding_id`, `repository`, `file_path`, `commit_sha`, `description`, `severity`, `status` (`open`, `fixed`, `verified`, `accepted_risk`), `verification_method`, `timestamp`, `reviewer`; `docs/EVIDENCE_MODEL.md` defining release gate states `PASS`, `FAIL`, `UNKNOWN`, `UNAVAILABLE`, `STALE`, `NOT_APPLICABLE`.
- **Partition 2 — Read-Only Allow-Lists & CSP:** `ui/js/config.js` allow-list per version (V1 health/status only; V2 `/prediction-freshness` and safe GET status routes, excluding `/run-analysis`, `/recalibrate-refresh`, backfills; V3 via V2; V4 `/api/health`, `/api/signals`, `/api/market-pulse`, never `/api/portfolio*`); CSP `connect-src` restricted to `api.github.com` and the approved worker hosts.
- **Partition 3 — Testing & Verification:** tests that the config rejects unapproved or write-capable routes; mock data fully purged; exact commands and exit codes documented in the PR.
- **Security & Safety:** no secrets, private tokens or side-effecting route calls.

## 4. Step-by-Step Execution Checklist for Claude
1. [ ] **Plan Mode:** audit the existing structure and present the outline before writing code.
2. [ ] **Branch Creation:** `feature/gov-002-part1-ledger` off `main`.
3. [ ] **Implementation:** Partitions 1–3.
4. [ ] **Local Verification:** run and record all checks with exit codes.
5. [ ] **Pull Request:** open a PR targeting `main`, referencing `TASK-GOV-002`.

## 5. Review Criteria for ChatGPT
- Ledger schema completeness and validation rules.
- Evidence states never treat missing evidence as PASS.
- Allow-list rejects unapproved, write-capable and private routes; CSP restricted; no secrets.
