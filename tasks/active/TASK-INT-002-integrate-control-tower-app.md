# Task ID: TASK-INT-002 — Integrate Control Tower Core Architecture into Application Suite

## 1. Metadata & Target Scope
- **Target Repository:** `cryptopulse-ai-control-tower`
- **Target Version:** Control Tower & Version Management Core (V1–V4 Integration)
- **Author:** Gemini (Master Orchestrator)
- **Assigned Developer:** Claude (Developer Lead)
- **Assigned Reviewer:** ChatGPT (Code Reviewer)

## 2. Objective & Scope Description
Integrate the Control Tower operational framework directly into the application interface, establishing a unified dashboard that links project management views, evidence ledgers, real GitHub PR/task states, and read-only version health checks (V1–V4). All static mockup components must be purged and replaced with real structural data bindings adhering to our strict static GitHub Pages security model.

## 3. Technical Requirements & Constraints
- **Zero Mock Data:** Complete and permanent removal of placeholder arrays, seed states, and "mock mode" banners.
- **Read-Only Security Model:** Adhere strictly to static hosting rules (no secrets, no server-side environment variables, safe GET routes only via `ui/js/config.js`).
- **Version Isolation:** Maintain strict boundaries between V1, V2, V3, and V4 modules with zero cross-contamination of state or unapproved backend calls.
- **CSP & Allow-Lists:** Maintain explicit Content Security Policy headers restricting network connections to `api.github.com` and approved read-only worker endpoints.

## 4. Step-by-Step Execution Checklist for Claude
1. [ ] **Plan Mode:** Initialize Claude Plan Mode to audit existing UI files, verify the absence of mock dependencies, and map out the integrated dashboard layout.
2. [ ] **Branch Creation:** Create a dedicated feature branch off `main` named `feature/integrate-control-tower-app`.
3. [ ] **Implementation:**
   - Wire the UI views to real GitHub public API metrics and allow-listed worker endpoints.
   - Integrate the evidence ledger and governance review status panels into the main navigation.
   - Implement isolated per-source error handling (e.g., graceful display of "Unreachable" or "Unknown" states without crashing).
4. [ ] **Local Verification:** Run local syntax checks, verify grep searches return zero mock data artifacts, and execute UI layout tests.
5. [ ] **Pull Request:** Push the branch to GitHub and open a Pull Request targeting `main`, referencing `TASK-INT-002`.

## 5. Review Criteria for ChatGPT
- Verify absolute absence of fake fallback datasets or unverified mock metrics.
- Confirm that no side-effecting worker endpoints or private token routes (`/api/portfolio*`) are accessed by the client-side code.
- Audit CSP configuration, allow-lists, and structural version isolation.
