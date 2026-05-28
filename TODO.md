## High-level plan next

Dual-mode refactor ([design/dual_mode_refactor.md](design/dual_mode_refactor.md)): one shared explorer UI with `ExplorerBackend` adapters — `KernelBackend` for the embedded local binary, `S3Backend` for the cloud SPA later. Plugins and search will be removed in later phases. **Current cycle:** Phase 5 — `S3Backend`, connect dialog, cloud boot path, and list pagination. Phase 4 kernel slimming is largely done (WebSocket events, plugin removal). Next: Phase 6 — package layout and dual build targets.

## TODO List

- [x] Run full `cargo test` (lib + listing pass; capabilities thumbnail tests fail in this environment — unrelated to symlink fix)
- [x] Add `--follow-symlinks-outside-root` to `ServeArgs`; unit test CLI parsing
- [x] `LocalFs`: strict `resolve()` by default; opt-in follow outside root; restore write-path escape check
- [x] Wire flag into `transport::serve`; expose on `/api/health`
- [x] Unit tests: strict rejects outside symlink; flag enables follow + logical listing paths
- [x] Document flag in README
- [x] Run full `cargo test` (91 lib unit tests pass; integration tests OOM in this environment)
- [x] `apiError`: map `path escapes served directory` response body to i18n message (no CLI mention)
- [x] Wire into `loadListing` (and search fetch errors); add en + zh-CN strings
- [x] Unit test for error body mapping
- [x] Run web unit tests
- [x] Add shadcn Sonner (`Toaster` in app shell)
- [x] Explorer errors: toast via Sonner instead of inline red text; keep `messageFromApiResponse` mapping
- [x] Preview pane: map `/api/metadata` errors; show Alert-style helpful message (not raw HTTP status)
- [x] Run web unit tests; rebuild `web/dist`
- [x] Move search input into header toolbar (compact, left of view/theme/action buttons)
- [x] Run web unit tests
- [x] Merge breadcrumb, file list, and status bar into one card with single borders between sections
- [x] Strip per-section card chrome from listing and status bar when embedded in explorer card
- [x] Run web unit tests; rebuild `web/dist`
- [x] Restructure explorer card: breadcrumb and status bar span listing + preview columns
- [x] Embed preview pane beside file list with a single vertical divider; strip preview card chrome
- [x] Run web unit tests; rebuild `web/dist`
- [x] Cap explorer middle row height to match listing; preview pane scrolls internally with `overflow-auto`
- [x] Run web unit tests; rebuild `web/dist`
- [x] Define `ExplorerBackend` types, events, and `ExplorerBackendProvider` / `useExplorerBackend()`
- [x] Implement `KernelBackend` wrapping `/api/*` REST and WebSocket (list, stat, upload, actions, plugins, search, health)
- [x] Refactor `App.tsx`, `PreviewPane.tsx`, `upload.ts`, and `useBackendStatus.ts` to use the backend (no `/api/` in components)
- [x] Wire `SlideshowDialog` thumbnail URLs through `KernelBackend.thumbnailUrl`
- [x] Unit tests for `KernelBackend` request mapping and URL helpers
- [x] Rebuild `web/dist`; run `pnpm test` and `cargo test`
- [x] Remove search UI, state, and `searcher.ready` from App and action context keys
- [x] Remove `search()` from `ExplorerBackend` / `KernelBackend` and related unit test
- [x] Remove `navigation.focus-search` builtin, `/` keybinding, and unused i18n strings
- [x] Remove `GET /api/search`, plugin searcher dispatch, `src/search.rs`, and `zfiles search` CLI
- [x] Delete `tests/search.rs`; move sendfile smoke test; update README
- [x] Rebuild `web/dist`; run `pnpm test` and `cargo test`
- [x] Replace PreviewPane with client-side image preview; metadata + download fallback
- [x] Remove plugin/thumbnail UI, WebSocket events, action catalog, and plugin i18n from frontend
- [x] Remove kernel plugin supervisor, `/api/plugins*`, thumbnail/preview/plugin routes
- [x] Remove plugin CLI, `plugins/` tree, bundled build, and plugin integration tests
- [x] Simplify WebSocket events to connected, filesystem_changed, upload_progress
- [x] Rebuild `web/dist`; run `pnpm test` and `cargo test`
- [ ] Add AWS SDK deps; S3 config, credential sessionStorage, and boot URL param parsing
- [ ] Implement `S3Backend` (paginated list, stat, presigned download, multipart upload, delete)
- [ ] Build connect dialog with AWS/R2 presets, test connection, and disconnect
- [ ] Cloud boot path: detect mode, gate explorer behind connect, wire `ExplorerBackendProvider`
- [ ] Async download URLs in preview/slideshow; load-more when listing returns `nextCursor`
- [ ] Unit tests for S3 path/key mapping and boot params; rebuild `web/dist`; run `pnpm test`
