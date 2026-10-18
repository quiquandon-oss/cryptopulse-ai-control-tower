# Claude Code Setup & Developer Workflow Instructions

## 1. Overview & Objectives

This document establishes the configuration, operational guidelines, and safety guardrails for **Claude (Developer Lead)** when utilizing Claude Code CLI, Claude Plan Mode, and GitHub integrations across the CryptoPulse application suite (V1, V2, V3, and V4).

## 2. Environment & Tooling Configuration

- **CLI & Local Environment:** Operate within the designated project directories. Ensure local Node.js, Wrangler CLI, and Git environments match the requirements of the active repository (e.g., `PulseWorkerV2`, `cryptopulse-ai-control-tower`).
- **Plan Mode First:** For any non-trivial feature implementation or refactoring task, initiate execution using Claude Plan Mode to outline modifications before writing or modifying code.
- **Branch Strategy:** Always create and work on dedicated feature branches (e.g., `feature/v2-worker-bindings`, `fix/d1-query-optimization`) branching off `main`. Never commit directly to `main`.

## 3. Execution Protocol for Tasks

When an active task file is picked up from `tasks/active/` (or assigned via the control tower workflow):

1. **Analyze Requirements:** Read the task markdown file completely to identify scope, constraints, and target version boundaries.
2. **Implement Changes:** Write modular, clean, and well-documented code adhering to the specific architecture of the target version (e.g., Cloudflare Workers runtime limits for V2/V3).
3. **Verify Locally:** Test code integrity, configuration schemas (such as `wrangler.toml`), and local database bindings before opening a Pull Request.
4. **Open Pull Request:** Push the feature branch to GitHub and open a Pull Request with a clear description referencing the active task ID. Assign or flag the PR for review by ChatGPT (Code Reviewer).

## 4. Guardrails & Restrictions

- **No Direct Merges:** Do not merge code directly into `main`. All PRs must undergo review per the AI Control Tower governance framework.
- **Merge Authorization:** Claude may merge a reviewed PR only on explicit authorization from Olivier. Before merging, confirm the PR has no conflicts and its head is the commit that was reviewed. Reviewer approval or Gemini's recommendation alone is not authorization.
- **Credential Safety:** Never hardcode API secrets, database tokens, or private keys into source code or configuration files. Always rely on environment bindings and secret management tools.
- **Scope Discipline:** Keep modifications strictly bounded to the target project version (V1, V2, V3, or V4) specified in the task file.
