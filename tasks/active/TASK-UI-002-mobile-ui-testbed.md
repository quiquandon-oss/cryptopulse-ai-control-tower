# Task ID: TASK-UI-002 — Mobile-Friendly UI Testbed Implementation

## 1. Metadata & Target Scope
- **Target Repository:** `cryptopulse-ai-control-tower`
- **Target Version:** Control Tower UI Testbed (Version V4 Layout Preview)
- **Author:** Gemini (Master Orchestrator)
- **Assigned Developer:** Claude (Developer Lead)
- **Assigned Reviewer:** ChatGPT (Code Reviewer)

## 2. Objective & Scope Description
Implement a lightweight, mobile-friendly UI testbed application (utilizing a framework such as Streamlit or a clean responsive HTML/CSS/JS interface) that mirrors the specifications of the project mockup. This testbed must run locally and provide a responsive interface optimized for mobile viewing, allowing evaluation of the layout, navigation panels, and agent status components without impacting production CryptoPulse codebases.

## 3. Technical Requirements & Constraints
- **Runtime Environment:** Lightweight Python/Streamlit app or static web assets runnable via local CLI.
- **Mobile Responsiveness:** Ensure layout scaling, touch-friendly buttons, and readable typography for mobile screen viewports.
- **Local Execution Guide:** Provide a clear `README.md` or execution script outlining exact terminal steps to launch and test the app locally.
- **Security & Safety:** Zero production API keys or external secrets hardcoded. Mock data only.
- **Code Style:** Modular, well-commented files ready for code review by ChatGPT.

## 4. Step-by-Step Execution Checklist for Claude
1. [ ] **Plan Mode:** Initialize Claude Plan Mode to outline the file structure (e.g., `app.py`, `requirements.txt`, or static directory layout).
2. [ ] **Branch Creation:** Create a dedicated feature branch off `main` named `feature/mobile-ui-testbed`.
3. [ ] **Implementation:**
   - Build the responsive layout matching the UI mockup requirements.
   - Implement navigation toggles for control tower metrics and agent tracking views.
   - Add local execution instructions for mobile/local preview.
4. [ ] **Local Verification:** Validate that the application boots cleanly and scales down correctly to mobile viewports.
5. [ ] **Pull Request:** Push the branch to GitHub and open a Pull Request targeting `main`, referencing `TASK-UI-002`.

## 5. Review Criteria for ChatGPT
- Verify code modularity, cleanliness, and local execution safety.
- Confirm adherence to mobile responsiveness standards and mockup layouts.
- Check for complete separation from production CryptoPulse repositories and absence of exposed credentials.
