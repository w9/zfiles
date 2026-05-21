## High-level plan next

Harden the kernel and make plugins real end-to-end: wire capability dispatch (lister, thumbnailer, searcher, viewer) with per-call timeouts and WebSocket enrichment, add plugin lifecycle hardening (restart backoff, storage dirs, conformance tests, fixture echo plugin), and finish transfer/auth polish (socket-level sendfile, upload fsync/rename guarantees, token expiry, QR URL for LAN shares). Grow the CLI beyond serve — `plugin install/list`, `config get/set`, headless `upload`/`search` — and mature the frontend into a proper explorer (virtual-scrolled listing, keyboard shortcuts, preview pane with plugin slot mounts, resumable tus client). Round out quality gates with a fixture corpus, Playwright E2E, performance baselines in CI, and pre-compressed embedded assets with content negotiation.

## TODO List

- [x] Initialize Rust project with module layout (`cli`, `transport`, `fs`, `state`, `plugins`, `auth`)
- [x] Set up CI pipeline (`cargo fmt`, `clippy`, `test`, `deny check`)
- [x] Implement CLI with `clap` — serve directory, `--port`, `--listen`, `--token`
- [x] Implement `transport` — bind TCP listener and serve HTTP (cold-start path, no blocking work)
- [x] Define `Fs` trait and Linux v1 implementation with `read_dir`
- [x] Directory listing REST API (TDD: integration test first, then handler)
- [x] Write a simple README.md
- [x] File stat REST API (`/api/stat`)
- [x] Range-aware file download handler (TDD; `sendfile` on Linux)
- [x] Lazy `.zfiles/` dot-folder and `state.db` initialization
- [x] tus resumable upload endpoint
- [x] WebSocket channel for live kernel events
- [x] Vite + React frontend shell, embedded via `rust-embed`
- [x] Browser auto-open on serve (`xdg-open`, async — do not block startup)
- [x] Read `.zfiles/config.toml` at startup (defaults when missing)
- [x] Enforce LAN auth policy (`--listen 0.0.0.0` requires `--token`)
- [x] `--read-only` flag and enforcement on mutating routes
- [x] Linux `sendfile` fast path for whole-file and single-range downloads
- [x] Plugin supervisor: manifest parsing, LSP JSON-RPC framing, background spawn
- [x] Filesystem watch service (`notify`) with debounced WebSocket events
- [x] Frontend: directory navigation, downloads, and tus uploads
- [x] Plugin capability registry and dispatch (`lister` first; per-call timeout + WebSocket enrichment)
- [x] Plugin lifecycle hardening: exponential-backoff restart, stderr logs, private `data/` storage
- [x] Fixture echo plugin and `zfiles plugin test` conformance harness
- [x] Atomic upload completion: fsync spool before rename; warn if dot-folder crosses a mount point
- [x] Token expiry (`--expire`) with sessions persisted in `state.db`
- [x] LAN share UX: print QR code for the served URL when binding with `--token`
- [x] CLI subcommands: `plugin list`, `plugin install`, `config get/set`
