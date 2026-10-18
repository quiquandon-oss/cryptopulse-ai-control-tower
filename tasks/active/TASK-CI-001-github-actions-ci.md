# Task ID: TASK-CI-001 — GitHub Actions CI for Control Tower Test Suites

## 1. Metadata & Target Scope
- **Target Repository:** `cryptopulse-ai-control-tower`
- **Target Version:** Control Tower governance (closes ledger finding CT-0007 once independently confirmed)
- **Author:** Olivier (Decision Maker), from ChatGPT review findings
- **Assigned Developer:** Claude (Developer Lead)
- **Assigned Reviewer:** ChatGPT (Code Reviewer)

## 2. Objective & Scope Description
Add GitHub Actions automation that runs the documented Node.js, Python/server and browser test suites on every pull request and push to `main`, and reports results as GitHub check runs, so the reviewer can independently confirm test results.

## 3. Technical Requirements & Constraints
- **Triggers:** pull requests and pushes to `main`.
- **Least privilege:** minimal workflow token permissions.
- **Supply chain:** third-party actions pinned to full commit SHAs where practical.
- **Safety:** no production credentials, no production writes or deployments.
- **Failure:** the workflow fails if any required test or ledger validation fails.
- **Documentation:** which checks are mandatory.

## 4. Step-by-Step Execution Checklist for Claude
1. [ ] **Plan Mode:** identify the suites and how each runs in CI.
2. [ ] **Branch Creation:** dedicated branch off `main`, separate from the CT-0010 fix (PR #8).
3. [ ] **Implementation:** workflow, browser smoke test, documentation.
4. [ ] **Local Verification:** run every suite locally; run the workflow on the PR and capture check results.
5. [ ] **Pull Request:** open a PR targeting `main`, referencing `TASK-CI-001`. Do not merge.

## 5. Review Criteria for ChatGPT
- Workflow permissions, pinning and absence of secrets/production access.
- Every documented suite runs and failures fail the workflow.
- Check runs visible on the PR; CT-0007 stays open until independently confirmed.
