# Agent instructions

You are working on **zfiles**, a local file server with a browser-based explorer. Read [design/design.md](design/design.md) for architecture, invariants, and technical goals before making structural changes.

## Task tracking

[TODO.md](TODO.md) is the living implementation checklist derived from the design doc: what to build next, in what order, and what is already done.

When scope or priorities shift:

- Edit, split, or reorder **unfinished** items only.
- Add new items as needed, but keep the list focused on near-term work — not the full roadmap.
- **Append new unchecked items at the bottom** of the TODO list — after all existing items (including completed `[x]` entries). Do not insert new cycle items at the top or above the historical checklist.

## Development cycle

### Mandatory — read before any code change

**Every user request to change the codebase starts a new development cycle**, unless the user is only asking questions, reviews, or read-only investigation.

Triggers include — but are not limited to — phrases like: *implement*, *add*, *fix*, *remove*, *move*, *update*, *refactor*, *wire*, *finish*, *complete*, and concrete feature requests (e.g. "implement file deletion", "human-readable sizes", "move the breadcrumb"). **There is no small-change exemption.**

**Hard rule:** Do not edit implementation files (`src/`, `web/src/`, `plugins/`, `tests/`, `e2e/`, `web/dist`, etc.) until you have finished cycle steps **1–3** (plan → append TODOs → **commit** plan/TODOs) for **this** request. That applies even when:

- the diff looks tiny (one component, one API route, one string);
- you already discussed the idea in an earlier turn or summary;
- you believe you "know" what to build without updating `TODO.md`;
- the user did not say **"Go!"** — **"Go!"** is optional shorthand for the same cycle, not the only trigger.

On the **first tool call** of a cycle, prefer reading `design/design.md`, `TODO.md`, and `AGENTS.md` over opening implementation files. If steps 1–3 are not done yet, your first edits must be **`TODO.md` only** (plus the planning commit), not application code.

Whenever the user asks you to **do something** in chat — implement, fix, refactor, add a feature, update behavior, or otherwise change the codebase — treat that request as **one full development cycle**. Do not jump straight to code; follow the sequence below. (Pure questions, reviews, planning, and read-only investigation are not cycles.)

**"Go!"** means the same thing: run one cycle for the current near-term plan in [TODO.md](TODO.md).

### Start the cycle first

On the **first response** to a "do something" request, begin with steps 1–3 below (plan → TODO items → commit). **Do not edit implementation files** (`src/`, `web/src/`, `tests/`, `e2e/`, etc.) in that turn unless steps 1–3 are already done for this cycle.

**Self-check before editing non-TODO code:** Can you point to a planning commit in **this session** whose message reflects **this** user request, made *after* you updated `TODO.md` with the new batch? If not, you are skipping the cycle — stop and do steps 1–3 first.

Common mistakes to avoid:

- **Treating "Go!" as the only trigger** — Any implementation/fix/refactor request starts a cycle, whether or not the user said "Go!".
- **Continuing after a summary** — A summarized or continued conversation does not inherit a completed cycle. A new "implement …" message needs its own steps 1–3 unless plan/TODOs for that exact scope were already committed in the current session.
- **No size exemption** — A one-file layout tweak, a small UI move, or a "quick fix" is still a cycle. Scope does not determine whether the cycle applies.
- **Scope gate ≠ cycle skip** — The [scope gate](#scope-gate-before-implementing) "Trivial" category means you may proceed **without a separate approval dialog**; it does **not** mean skip planning, TODO updates, or verification.
- **No implicit carry-over** — Do not assume an earlier conversation already satisfied steps 1–3. Each new user request to change the codebase starts (or resumes) a cycle from step 1 unless you committed the plan/TODO batch for **this** request in the current session.
- **Append, don't prepend** — New TODO items for a cycle belong at the **bottom** of the list. Prepending breaks chronological order and buries the completed history under the active batch.
- **Implementing before commit** — Editing `src/`, `web/`, or tests before the planning commit is always wrong, even if you also updated `TODO.md` in the same uncommitted batch.

For each cycle:

1. **Update the high-level plan** — Read [design/design.md](design/design.md) and [TODO.md](TODO.md). Revise the "High-level plan next" paragraph in `TODO.md` to reflect current progress and near-term priorities (including the user's request when they gave one). If it is still accurate, leave it unchanged.
2. **Add TODO items** — Break the cycle's scope into concrete unchecked items in `TODO.md` (from the user's request and/or the plan). **Append them to the bottom** of the TODO list; never prepend them above existing entries. Use **as many items as the work warrants**, up to a **maximum of 7** per cycle — do not pad the list to hit a count, and do not exceed seven in the batch you commit before implementation. Each item should be a concrete, deliverable slice of work.
3. **Commit** — Commit the plan and new TODO items before writing implementation code.
4. **Implement** — Work through the new unfinished items. For each item:
   - Write tests first (see design/design.md §5), then implement the minimum to pass.
   - Mark the item complete when finished — **never remove completed items**.
   - Commit whenever appropriate; Update .gitignore when appropriate; follow the user's git instructions.
5. **Verify** — Before the cycle is complete, run the full test suite (`cargo test`) and fix any failures. **All tests must pass** — do not leave the cycle with a failing or skipped suite.
6. **Follow-ups (complex work only)** — If the batch was large or uncovered substantial remaining scope, suggest additional TODO items for a future cycle (in the updated "High-level plan next" paragraph and/or in your summary). Do not add more than seven items to `TODO.md` in one planning commit; list extras as suggestions until the user starts the next cycle.

Do not skip steps or reorder them. Planning and TODO updates come first; implementation follows the commit. If the [scope gate](#scope-gate-before-implementing) applies, get user authorization before step 3 — do not commit plan/TODOs for work the user has not approved.

**Cycle step 3 vs user commit preferences:** The planning commit (plan + new TODO items only) is **required** by this workflow before implementation, even when the user's general rule is to avoid unprompted commits. Implementation commits (step 4) still follow the user's git instructions — ask before committing code unless they explicitly asked you to commit or finish the cycle.

### Rust checks before git commits

Before **any** git commit you create — planning, implementation, or otherwise — run **`cargo fmt`** and **`cargo clippy -- -D warnings`**. CI runs both checks and fails on unformatted or linted Rust; do not commit a tree that would fail either step.

- Run `cargo fmt` after editing Rust files (`src/`, `tests/`, `plugins/`, `e2e/` Rust helpers, etc.) and before staging or committing.
- Run `cargo clippy -- -D warnings` on the same schedule; **fix every clippy warning** — CI treats warnings as errors via `-D warnings`.
- If the commit includes only non-Rust files, still run both commands — they are fast and catch accidental drift in the working tree.
- When the user asks you to commit, treat `cargo fmt` and `cargo clippy` as part of the commit workflow (alongside `git status` / `git diff`), not optional cleanup steps.

## Scope gate (before implementing)

**Do not implement** new behavior, features, or structural changes unless at least one of these applies:

1. **Design-aligned** — The work aligns explicitly with something described in [design/design.md](design/design.md) (architecture, invariants, goals, or documented behavior).
2. **Fix** — The work fixes a bug, regression, broken test, or clear defect in existing behavior.
3. **Trivial** — The change is trivially simple (e.g. typo, one-line config, requested doc edit with no behavioral impact). **Still run the full development cycle** when the user asked you to make the change; "trivial" only waives the approval dialog in step 3 of the scope gate, not the cycle steps.

If **none** of the three apply, **stop and ask the user first**. Present a **multiple-choice question** (via the question UI when available) that summarizes the proposed work and offers concrete options — for example: proceed as proposed, narrow scope, defer to TODO, or cancel. **Do not write implementation code** until the user chooses an option that authorizes the work.

Questions, reviews, planning, and read-only investigation are always allowed without this gate.

## Frontend (web UI)

When working on the React explorer under `web/`:

1. **Tailwind CSS** — Use Tailwind CSS for all web UI styling. Prefer utility classes and design tokens over bespoke CSS files; keep custom CSS limited to globals, third-party overrides, or cases Tailwind cannot express cleanly.
2. **shadcn/ui** — Use [shadcn/ui](https://ui.shadcn.com/) components whenever a suitable one exists. When no shadcn component fits, build custom components following shadcn conventions: composable primitives, `cn()` for class merging, accessible Radix-style patterns, and consistent variant/size APIs.
3. **i18n** — All user-visible UI strings must go through the i18n layer. Ship **English** and **Simplified Chinese** (`zh-CN`) from the start; do not hardcode display text in components.

## Key references

| File | Purpose |
|------|---------|
| [design/design.md](design/design.md) | Architecture, module layout, plugin contract, testing strategy |
| [TODO.md](TODO.md) | Implementation checklist |
| [README.md](README.md) | Quick start and API summary |
