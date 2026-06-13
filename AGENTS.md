# Agent instructions

You are working on **zfiles**, a local file server with a browser-based explorer. Read [design/design.md](design/design.md) for architecture, invariants, and technical goals before structural changes; [TODO.md](TODO.md) is the implementation checklist; [README.md](README.md) has the quick start and API summary.

## Development cycle

**Every user request to change the codebase — implement, add, fix, move, refactor, etc. — runs one development cycle.** There is no exemption for small diffs, for scope already discussed in earlier turns or summaries, or for requests without **"Go!"** ("Go!" is just shorthand for: run one cycle on the current near-term plan in `TODO.md`). Only questions, reviews, planning, and read-only investigation are not cycles.

**Hard rule:** do not edit implementation files (`src/`, `web/`, `tests/`, `e2e/`, …) until steps 2–4 are **committed** for *this* request, in *this* session. Nothing carries over: a summarized conversation, an earlier discussion, or TODO edits sitting uncommitted in the same batch do not satisfy steps 2–4. Start a cycle by reading `design/design.md`, `TODO.md`, and `AGENTS.md`; until the planning commit exists, edit only `TODO.md`.

0. **Dirty worktree** — Before AQ, check whether the git worktree is dirty (`git status` shows uncommitted or untracked changes). If it is, use **AskQuestion** to confirm how to proceed:
   - **(A) Commit outside this conversation** — Pause; the user commits or otherwise clears the worktree on their own. When done, they choose this option again (or otherwise signal ready); re-check `git status` and continue the cycle only if clean.
   - **(B) Commit in this conversation** — Commit the outstanding changes in this chat (respecting [commit-scope rules](#before-every-commit)), then continue the cycle.
   - **(C) Stop** — End this cycle without further edits.
   Skip this step when the worktree is clean.
1. **AQ (ask before planning)** — When the user appends **"AQ"** to a request, or the request has meaningful behavioral/edge-case ambiguity even without it, use the **AskQuestion** tool to confirm behavior and edge cases before planning. Never skip a triggered AQ, however trivial the change. AQ confirms *what* to build; the [scope gate](#scope-gate) authorizes the work.
2. **Plan** — Revise the "High-level plan next" paragraph in `TODO.md` to reflect current progress and the request; leave it unchanged if still accurate.
3. **TODO items** — Append the cycle's scope as concrete unchecked items at the **bottom** of the TODO list (below all existing entries, including completed `[x]` ones). As many items as the work warrants, **maximum 7** per cycle — extras wait for a future cycle. Edit, split, or reorder **unfinished** items only; never remove completed ones. Keep the list near-term, not a roadmap.
4. **Planning commit** — Commit the plan and new TODO items before writing any implementation code. This commit is required even when the user otherwise prefers no unprompted commits. If the scope gate requires approval, get it before this commit.
5. **Implement** — Work through the new items: write tests first (design/design.md §5), implement the minimum to pass, and mark each item `[x]` when done. Update `.gitignore` when appropriate. Implementation commits follow the user's git instructions — ask first unless they explicitly asked you to commit or finish the cycle.
6. **Verify** — Run the test suites covering what the cycle touched — `cargo test` for Rust, `pnpm test` for `web/`, both when unsure — and fix all failures before the cycle ends.
7. **Follow-ups** — After a large batch, suggest further TODO items for a future cycle in the plan paragraph and/or your summary instead of exceeding the 7-item cap.

Do not skip or reorder steps.

### Before every commit

- **Commit scope** — commit only changes made in the current chat conversation. Never include edits made outside it (by the user or another session) unless the user explicitly asks.
- **Commits touching Rust** (`src/`, `tests/`, `Cargo.*`, Rust helpers under `e2e/`): run `cargo fmt` and `cargo clippy -- -D warnings` first and fix every warning — CI fails on either. Doc-, TODO-, and web-only commits may skip both.
- **Commits changing shipped behavior** (code or assets, not docs/TODO): bump the **patch** version in [Cargo.toml](Cargo.toml) `[package].version` in the same commit, so `zfiles --version` tracks the latest released change. Patch only, unless the user explicitly asks for minor/major; no standalone version-only commits.

## Frontend (web UI)

For the React explorer under `web/`:

1. **Tailwind CSS** — Style with Tailwind utilities and design tokens; keep custom CSS to globals, third-party overrides, or what Tailwind cannot express.
2. **shadcn/ui** — Prefer [shadcn/ui](https://ui.shadcn.com/) components whenever applicable; check the [components index](https://ui.shadcn.com/docs/components) before building custom, and consult the latest docs for stock styling and APIs (training data may be outdated). Custom components follow shadcn conventions: composable primitives, `cn()` merging, accessible Radix-style patterns, consistent variant/size APIs.
3. **i18n** — Every user-visible string goes through the i18n layer and ships in **all supported locales** (14 — see design/design.md § Frontend strategy); never hardcode display text.
