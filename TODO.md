# TODO

This file tracks implementation work for zfiles. It is the living task list derived from [DESIGN.md](DESIGN.md): what to build next, in what order, and what is already done.

## How to use this file

- Pick the next unchecked item when starting work.
- Write tests first (see DESIGN.md §5), then implement.
- When an item is finished, mark it complete — do not delete it.
- It is fine to edit, split, or reorder **unfinished** items when plans or priorities change.
- Add new items as scope becomes clearer; keep the list focused on near-term work rather than dumping the entire roadmap.

**We never remove items when they are done — only mark them as complete.**

---

## Checklist

- [x] Initialize Rust project with module layout (`cli`, `transport`, `fs`, `state`, `plugins`, `auth`)
- [x] Set up CI pipeline (`cargo fmt`, `clippy`, `test`, `deny check`)
- [x] Implement CLI with `clap` — serve directory, `--port`, `--listen`, `--token`
- [x] Implement `transport` — bind TCP listener and serve HTTP (cold-start path, no blocking work)
- [x] Define `Fs` trait and Linux v1 implementation with `read_dir`
- [x] Directory listing REST API (TDD: integration test first, then handler)
