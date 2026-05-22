# Agent instructions

You are working on **zfiles**, a local file server with a browser-based explorer. Read [DESIGN.md](DESIGN.md) for architecture, invariants, and technical goals before making structural changes.

## Task tracking

[TODO.md](TODO.md) is the living implementation checklist derived from the design doc: what to build next, in what order, and what is already done.

When scope or priorities shift:

- Edit, split, or reorder **unfinished** items only.
- Add new items as needed, but keep the list focused on near-term work — not the full roadmap.

## Development cycle

When the user says **"Go!"**, complete one full development cycle:

1. **Update the high-level plan** — Read [DESIGN.md](DESIGN.md) and [TODO.md](TODO.md). Revise the "High-level plan next" paragraph in `TODO.md` to reflect current progress and near-term priorities. If it is still accurate, leave it unchanged.
2. **Add TODO items** — Based on the updated plan, append **5–7** new unchecked items to the TODO list. Each item should be a concrete, deliverable slice of work for the next batch.
3. **Commit** — Commit the plan and new TODO items before writing implementation code.
4. **Implement** — Work through the new unfinished items. For each item:
   - Write tests first (see DESIGN.md §5), then implement the minimum to pass.
   - Mark the item complete when finished — **never remove completed items**.
   - Commit whenever appropriate; Update .gitignore when appropriate; follow the user's git instructions.
5. **Verify** — Before the cycle is complete, run the full test suite (`cargo test`) and fix any failures. **All tests must pass** — do not leave the cycle with a failing or skipped suite.

Do not skip steps or reorder them. Planning and TODO updates come first; implementation follows the commit.

## Scope gate (before implementing)

**Do not implement** new behavior, features, or structural changes unless at least one of these applies:

1. **Design-aligned** — The work aligns explicitly with something described in [DESIGN.md](DESIGN.md) (architecture, invariants, goals, or documented behavior).
2. **Fix** — The work fixes a bug, regression, broken test, or clear defect in existing behavior.
3. **Trivial** — The change is trivially simple (e.g. typo, one-line config, requested doc edit with no behavioral impact).

If **none** of the three apply, **stop and ask the user first**. Present a **multiple-choice question** (via the question UI when available) that summarizes the proposed work and offers concrete options — for example: proceed as proposed, narrow scope, defer to TODO, or cancel. **Do not write implementation code** until the user chooses an option that authorizes the work.

Questions, reviews, planning, and read-only investigation are always allowed without this gate.

## Key references

| File | Purpose |
|------|---------|
| [DESIGN.md](DESIGN.md) | Architecture, module layout, plugin contract, testing strategy |
| [TODO.md](TODO.md) | Implementation checklist |
| [README.md](README.md) | Quick start and API summary |
