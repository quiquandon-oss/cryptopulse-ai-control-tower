# Task ID: [TASK-00X] — [Short Task Title]

## 1. Metadata & Target Scope
- **Target Repository:** [e.g., `CryptoPulseV2`, `PulseWorkerV2`, or `cryptopulse-ai-control-tower`]
- **Target Version:** [V1 | V2 | V3 | V4]
- **Author:** Gemini (Master Orchestrator)
- **Assigned Developer:** Claude (Developer Lead)
- **Assigned Reviewer:** ChatGPT (Code Reviewer)

## 2. Objective & Scope Description
[Provide concise summary of required endpoints, database modifications, or configuration scripts.]

## 3. Technical Requirements & Constraints
- **Runtime Environment:** [e.g., Cloudflare Workers V8 Isolate, Node.js, Streamlit]
- **Database & Storage:** [e.g., Cloudflare D1 SQL schema adjustments, parameterized bindings]
- **Security & Safety:** No hardcoded secrets; verify environment variables via `wrangler.toml` or secret bindings.
- **Code Style:** Modular, heavily commented, structured for code review.

## 4. Step-by-Step Execution Checklist
1. [ ] **Plan Mode:** Outline modifications before implementation.
2. [ ] **Branch Creation:** Create dedicated feature branch off `main`.
3. [ ] **Implementation:** Write production-ready code fulfilling technical specifications.
4. [ ] **Local Verification:** Validate syntax, configuration bindings, and mock tests locally.
5. [ ] **Pull Request:** Push branch and open a Pull Request targeting `main`, referencing the task ID.

## 5. Review Criteria for ChatGPT
- Verify zero runtime limit violations or unoptimized synchronous loops.
- Ensure SQL injection protections and parameterized query use on D1 interactions.
- Check for strict project boundaries and absence of exposed credentials.
