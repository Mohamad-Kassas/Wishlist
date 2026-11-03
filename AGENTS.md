# AI Agent & Design Engineering Instructions (`AGENTS.md`)

Any AI coding agent (Gemini, Claude Code, Cursor, Codex) working in this repository—or in any future project where this file is copied—**must** follow this workflow when designing features or modifying UI.

---

## 1. Mandatory Pre-Flight Reading
Before designing a feature or editing any frontend code:
1. Read [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) in full.
2. If you have access to user skills, load `ui-design-engineer` and `ui-visual-critic`.

---

## 2. The "Designer Hat" Methodology (Phase 0 — Before Coding)
When asked to add a new feature, rethink a component, or improve UX, **do not write code immediately**. Run the 4-step Product Designer discovery loop first:

1. **Interrogate the Real-World Ritual & Frequency**:
   - Ask *when*, *how often*, and *why* the user performs this task (e.g., daily triage vs. 1st-and-15th payday transfers vs. one-time setup).
   - Make the **Primary Hero Metric** the exact number or action the user needs during that ritual.
   - Apply **progressive disclosure**: keep the 90% action 1-tap accessible and collapse the 10% power-user controls until requested.
2. **Inspect Real Data & Reject Brittle Automation**:
   - Check actual data distributions before inventing complex rule builders or fuzzy matchers.
   - When real data has slight natural variance where rules will misfire, propose **zero-friction 1-tap manual curation** (e.g., optimistic segmented pills) over brittle rules.
3. **Decide Spatial Architecture & Placement**:
   - Evaluate where the feature belongs in the Information Architecture (`Hero` vs. `Contextual Sub-Tab with Alert Badge` vs. `Side Sheet` vs. `Top-Level Tab`) so daily views stay calm and uncluttered.
4. **Propose Options + ASCII Wireframe & Align**:
   - Present the domain math/logic, 2–3 opinionated UX options with trade-offs, a structural **ASCII wireframe**, and 2–3 sharp clarifying questions. Wait for the user's sign-off before implementing.

---

## 3. Non-Negotiable UI & Engineering Guardrails (Phases 1–4)
- **Subtractive Hierarchy (No Box-in-Box)**: Never nest bordered cards inside bordered cards. Separate groups inside a `.card` with whitespace (`gap-6`, `gap-8`) or single hairlines (`border-t`, `border-l`).
- **One Focal Point & Max 3 Font Sizes Per Card**: Every card has 1 clear hero metric/element and uses at most 3 canonical font sizes.
- **Consumer Typography with Tabular Numerals**: Apply `tabular-nums` (`className="tabular"`) to all currency, percentages, dates, and counts in the primary sans/display font. Quarantine `font-mono` strictly to raw machine strings (bank wire text, hashes, logs).
- **Exhaustive 6-State Matrix**: Verify Ideal, Loading (geometry-matched skeletons, no spinners), Empty/Zero, Partial/Early-Period, Overflow (`truncate`, `whitespace-nowrap` on money), and Optimistic (`0ms` state updates) states.
- **Emil Kowalski Motion Physics**: `0ms` on keyboard/high-frequency triage actions, never use `ease-in`, cap micro-interactions at `100ms–240ms` `--ease-out-quint`, and gate hover styles behind `@media (hover: hover) and (pointer: fine)`.
- **Closed-Loop Visual Critique (Phase 5)**: Render desktop (`1280×800`) and mobile (`390×844`) screenshots, inspect them multimodally, and produce a `Before / After / Why` table against `docs/DESIGN_SYSTEM.md`.
