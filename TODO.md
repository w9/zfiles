## High-level plan next

Kernel hardening and first-wave plugin dispatch are done. Next: close gaps between design and implementation (wire sendfile into the download path, pre-compressed embed with content negotiation), mature the frontend into a real explorer (WebSocket enrichment, resumable tus client, virtual-scrolled listing), add headless `upload` CLI, and extend plugins beyond `lister` with one second capability end-to-end (searcher or thumbnailer). Follow with keyboard shortcuts, preview pane slots, `search` CLI, fixture corpus, Playwright E2E, and performance baselines in CI.

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
- [ ] Frontend: handle WebSocket `listing_enrichment`, `upload_progress`, and `plugin_ready`; merge lister `extra` into the listing
- [ ] Resumable tus client: chunked PATCH uploads with HEAD-based resume and progress UI
- [ ] Wire Linux sendfile fast path into download handler (ReaderStream fallback for multi-range)
- [ ] Pre-compressed embedded assets: Vite gzip/brotli output and `Accept-Encoding` negotiation in embed handler
- [ ] Virtual-scrolled file listing (replace plain `<ul>`; add generated large fixture for validation)
- [ ] CLI `zfiles upload`: headless tus client with `--resume` and bearer token support
- [ ] Searcher capability end-to-end: kernel dispatch, REST API, fixture plugin, conformance extension, frontend search box
