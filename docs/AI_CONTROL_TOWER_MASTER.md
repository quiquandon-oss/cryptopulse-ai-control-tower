# AI Control Tower — Master Project Specification & Protocol

**Target Application:** Multi-Agent Orchestration for CryptoPulse (V1, V2, V3, V4)

**Operating Model:** Mobile-First, GitHub-Driven, Zero-API-Cost Architecture

**Primary Participants:**

- **Gemini (Master Orchestrator / Planner):** Plans features, structures task breakdowns, and writes markdown instructions.
- **Claude (Developer Lead - Read/Write Access):** Implements code, refactors, creates branches, and opens Pull Requests based on GitHub instruction files.
- **ChatGPT (Code Reviewer - Read-Only Access):** Reviews PR diffs, flags edge cases, checks security, and leaves review comments.
- **Human User (Olivier - Decision Maker):** Approves every instruction, edits steps, and authorizes merges or deployments.

---

## 1. Core Principles & Governance

1. **Human-in-the-Loop Gate:** No AI-to-AI handoff or execution happens automatically. Every task, instruction, or prompt must be reviewed, edited if needed, and explicitly approved by the human before being pushed to GitHub.
2. **GitHub as the Single Source of Truth:** All handoffs, plans, code commits, reviews, and audit histories live inside the GitHub repository. Claude and ChatGPT interact strictly via their native GitHub permissions.
3. **Project Separation:** CryptoPulse V1, V2, V3, and V4 are managed as independent projects with strict environment and repository boundaries. Cross-project access is never assumed.
4. **Zero External Orchestration Costs:** No paid third-party platforms or model API keys are required for the AI agents; their existing web/project interfaces and GitHub integrations handle execution.

---

## 2. Standard Operating Procedure (SOP)

* **Step 1 (Plan):** The user submits a goal to Gemini. Gemini generates a structured implementation plan and markdown instruction file targeting the specific CryptoPulse version (V1–V4).
* **Step 2 (Approve & Push):** The user reviews and approves the instruction file, pushing it to the target repository (via the mobile control tower interface or direct commit).
* **Step 3 (Implement):** Claude detects the new task file via its GitHub Read/Write access, writes the code on a feature branch, and opens a Pull Request (PR).
* **Step 4 (Review):** ChatGPT uses its GitHub Read-Only access to analyze the PR diff, checking for logic flaws, performance bottlenecks, and edge cases, then posts feedback comments.
* **Step 5 (Authorize):** Gemini (or the user) synthesizes Claude's implementation and ChatGPT's review. The human makes the final decision (Merge, Request Changes, Iterate, or Deploy).

---

## 3. Version Scope & Ecosystem (CryptoPulse V1-V4)

* **CryptoPulse V1:** Initial market intelligence prototype and baseline logic.
* **CryptoPulseV2:** Cloudflare Worker backends and D1 database bindings (`PulseWorkerV2`).
* **CryptoPulseV3:** Advanced prediction models and data ingestion pipelines.
* **CryptoPulseV4:** Expanded web application suite, UI enhancements, and multi-asset tracking features.

---

## 4. Agent Role Constraints

### 🔴 Claude (Developer Lead)

* **Access:** Read & Write via GitHub.
* **Responsibilities:** Core code construction, Cloudflare worker updates, database migrations, and opening Pull Requests.
* **Constraints:** Never auto-merge straight to `main` without review. Always link commits to the active task/issue reference.

### 🔵 ChatGPT (Code Reviewer)

* **Access:** Read-Only via GitHub.
* **Responsibilities:** Auditing code diffs, checking edge runtime limits, D1 schema integrity, and security vulnerabilities.
* **Constraints:** Never commit code or modify repository files directly. Keep reviews structured and actionable.

### 🔷 Gemini (Master Orchestrator)

* **Access:** Chat interface / Mobile Gemini Gem.
* **Responsibilities:** Breaking down user goals into technical requirements, structuring clear markdown task files, and synthesizing multi-agent outputs.
* **Constraints:** Act strictly as planner and synthesizer; require human approval before any instruction moves forward.
