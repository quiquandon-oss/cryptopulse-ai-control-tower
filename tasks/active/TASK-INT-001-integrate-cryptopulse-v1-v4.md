# Task ID: TASK-INT-001 — Integrate CryptoPulse V1–V4 Live Read-Only Endpoints & Purge Mock Data

## 1. Metadata & Target Scope
- **Target Repository:** `cryptopulse-ai-control-tower`
- **Target Version:** Control Tower UI Integration (V1 through V4 Read-Only)
- **Author:** Gemini (Master Orchestrator)
- **Assigned Developer:** Claude (Developer Lead)
- **Assigned Reviewer:** ChatGPT (Code Reviewer)

## 2. Objective & Scope Description
Purge all static mock datasets, fake metrics, and placeholder UI states entirely from the Control Tower application. Implement the read-only integration layer for CryptoPulse V1–V4 and GitHub public metadata, adhering strictly to the static GitHub Pages security model (no secrets, safe GET routes only, and client-side caching to respect GitHub's rate limits).

## 3. Technical Requirements & Constraints
- **Data Purge:** Completely remove `state.js` mock tasks, fake CI indicators, fake deployments, and "mock mode" banners.
- **`ui/js/config.js` Setup:**
  - Define public base URLs and a strict allow-list of safe, read-only status paths per version:
    - **V1:** `sentiment-ff75.quiquandon.workers.dev` (health/status endpoints)
    - **V2:** `pulseworker-v2.quiquandon.workers.dev` (`/prediction-freshness`, safe status routes only; strictly excluding side-effect routes like `/run-analysis` or recalibration)
    - **V3:** Consumer of V2 backend (labelled clearly "via V2")
    - **V4:** `cryptopulse-v4.quiquandon.workers.dev` (`/api/health`, `/api/signals`, `/api/market-pulse`; *never* calling `/api/portfolio*` which requires private tokens)
- **Modular Design:** Implement isolated modules (`v1.js`, `v2.js`, `v3.js`, `v4.js`, `github.js`) with zero cross-version module dependencies.
- **Workflow View:** Convert action gate buttons into a read-only visual tracker reflecting real GitHub state (`tasks/active/`, open PRs, and public CI status).
- **Security & Safety:** Update Content Security Policy (`CSP`) `connect-src` explicitly to `api.github.com` and the approved worker hosts. Zero secrets or tokens in code.
- **Failure Handling:** Graceful per-source failure isolation (e.g., displaying "V1 unreachable" without crashing the dashboard or falling back to fake data).

## 4. Step-by-Step Execution Checklist for Claude
1. [ ] **Plan Mode:** Outline the file structure changes and endpoint validation mapping.
2. [ ] **Branch Creation:** Create feature branch off `main` named `feature/integrate-cryptopulse-v1-v4`.
3. [ ] **Implementation:**
   - Execute complete purge of mock data arrays and test fixtures.
   - Set up `ui/js/config.js` with public allow-listed endpoints and CSP headers.
   - Implement isolated version modules and GitHub public API fetchers with short-duration caching.
   - Convert workflow gates to read-only status displays.
4. [ ] **Local Verification:** Run local tests, verify grep checks return zero mock data strings, and execute test suite validations.
5. [ ] **Pull Request:** Push branch and open a Pull Request targeting `main`, referencing `TASK-INT-001`.

## 5. Review Criteria for ChatGPT
- Verify absolute absence of mock data arrays, seed objects, or fake fallback states.
- Confirm that no side-effecting worker routes (`/run-analysis`, write operations) or private token endpoints (`/api/portfolio`) are called by the UI.
- Audit CSP configuration and ensure zero credentials or environment secrets exist in client-side code.
