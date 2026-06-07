# Contributing to zfiles

Thanks for your interest in improving zfiles.

## Before you start

Read [design/design.md](design/design.md) for architecture, invariants, and testing strategy. [TODO.md](TODO.md) tracks near-term implementation work. Large or structural changes should align with that design — especially the instant cold-start rule (nothing in startup scales with directory size) and the dual-mode backend split.

## Getting set up

```bash
# Backend
cargo build
cargo test

# Frontend (from repo root)
cd web && pnpm install && pnpm test && pnpm build && cd ..
cargo build -p zfiles
```

For UI work with hot reload:

```bash
# Terminal 1
cd web && pnpm dev

# Terminal 2
cargo dev-frontend ~/Downloads --port 9000 --no-open
```

Cloud SPA development: `cd web && pnpm dev:cloud` (see [docs/cloud-connect.md](docs/cloud-connect.md)).

Run `cargo fmt` and `cargo clippy -- -D warnings` before submitting Rust changes. CI treats clippy warnings as errors.

## Pull requests

1. Open an issue first for large features so approach can be discussed.
2. Keep diffs focused; match existing naming and module boundaries.
3. Add or update tests when behavior changes (`cargo test`, `pnpm test` in `web/`).
4. User-visible UI strings need English and Simplified Chinese entries in `web/src/i18n/`.

## Questions

Use [GitHub Issues](https://github.com/w9/zfiles/issues) for bugs and feature requests.
