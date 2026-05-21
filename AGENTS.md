# Agent instructions

You are working on **zfiles**, a local file server with a browser-based explorer. Read [DESIGN.md](DESIGN.md) for architecture, invariants, and technical goals before making structural changes.

## Task tracking

[TODO.md](TODO.md) is the living implementation checklist derived from the design doc: what to build next, in what order, and what is already done.

When picking up work:

1. Choose the next unchecked item in `TODO.md`.
2. Write tests first (see DESIGN.md §5), then implement the minimum to pass.
3. Mark the item complete when finished — **never remove completed items**.
4. Commit when appropriate; follow the user's git instructions.

When scope or priorities shift:

- Edit, split, or reorder **unfinished** items only.
- Add new items as needed, but keep the list focused on near-term work — not the full roadmap.

## Key references

| File | Purpose |
|------|---------|
| [DESIGN.md](DESIGN.md) | Architecture, module layout, plugin contract, testing strategy |
| [TODO.md](TODO.md) | Implementation checklist |
| [README.md](README.md) | Quick start and API summary |
