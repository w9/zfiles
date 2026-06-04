## High-level plan next

Dual-mode refactor is **complete**. Frontend routing now respects Vite `BASE_URL` for subpath deploys and consistent dev/prod URLs. Next: nightly perf job `web/dist` build, e2e smoke upkeep.

## TODO List (drop rustls — current cycle)

- [x] `Cargo.toml`: `reqwest` + `tokio-tungstenite` without TLS features; refresh lockfile
- [x] `vite_proxy.rs`: HTTP/WS only; tests for rejected `https` Vite URL
- [x] `upload.rs`: `resolve_location` HTTP only; reject `https://` server URLs
- [x] `design/design.md`: document plain-HTTP clients vs future listener TLS
- [x] `cargo test` and `cargo clippy -- -D warnings`

## TODO List

- [x] Unit tests; run `pnpm test` and `cargo test --lib`
- [x] Symlink badge: use `CornerUpRight` arrow instead of chain link icon
- [x] Symlink badge: move to top-right corner of file icon
- [x] Kernel: add `is_symlink` and `symlink_target` to `FileStat`; populate in `stat()`; unit tests
- [x] Frontend: extend `FileStat`; PreviewPane shows target + symlink type label
- [x] i18n for preview symlink fields (en + zh-CN)
- [x] Run `pnpm test` and `cargo test --lib`
- [x] Add AGENTS.md rule: run `cargo clippy -- -D warnings` before any git commit
- [x] Remove `navigation.go-to-path` from default toolbar actions
- [x] Run `pnpm test`
- [x] Remove dedicated upload dropzone section from `ExplorerApp`
- [x] `useGlobalFileDrop` hook: window-level drag/drop + overlay state; unit test
- [x] `UploadButton` icon in top-right toolbar (hidden file input); i18n en + zh-CN
- [x] Wire global drop + upload button into `ExplorerApp`; update drop hint strings
- [x] Run `pnpm test`
- [x] Restructure `ExplorerApp`: breadcrumb, listing/preview, and status bar as separate cards
- [x] Update `ExplorerBreadcrumb` styling for standalone card (drop inner `border-b`)
- [x] Run `pnpm test`
- [x] Remove `rounded-xl` from main file-view card in `ExplorerApp`
- [x] Run `pnpm test`
- [x] `upload-conflict` helpers: detect existing file, suggest `name (n).ext` path
- [x] Upload queue: pause on conflict, apply resolution (incl. apply-to-all ref)
- [x] `UploadConflictDialog` + i18n (en + zh-CN); wire into `ExplorerApp`
- [x] Upload panel status for awaiting conflict; unit tests; run `pnpm test`
- [x] `countUploadsByStatus` helper + unit tests in `upload-queue`
- [x] Upload panel header: total + status summary segments; i18n en + zh-CN
- [x] Run `pnpm test`
- [x] Address bar input: remove border/padding; match breadcrumb line height in `ExplorerBreadcrumb`
- [x] Run `pnpm test`
- [x] Fixed-height address bar row in `ExplorerBreadcrumb` (view + edit modes)
- [x] Run `pnpm test`
- [x] Status bar: fixed `h-9` row to match breadcrumb address bar
- [x] Run `pnpm test`
- [x] Remove borders from breadcrumb card (`ExplorerApp`) and `StatusBar`
- [x] Run `pnpm test`
- [x] Navigation history helpers + unit tests (`push` / `back` / `forward` stacks)
- [x] `useExplorerNavigation` hook; wire into `ExplorerApp` (`navigateTo`, back/forward/up)
- [x] Address bar: back, up, forward icon buttons left of home in `ExplorerBreadcrumb`
- [x] i18n for navigation button labels (en + zh-CN)
- [x] Run `pnpm test`
- [x] Run `pnpm test`
- [x] Move click-to-edit handler off nav buttons onto path region only in `ExplorerBreadcrumb`
- [x] Run `pnpm test`
- [x] File view card: remove outer border; add `rounded-xl` to match breadcrumb/status bar
- [x] Run `pnpm test`
- [x] Explorer chrome: `mt-1` between address bar, file view, and status bar
- [x] Run `pnpm test`
- [x] Remove up button and related props/i18n from `ExplorerBreadcrumb`
- [x] Drop unused `goUp` from `useExplorerNavigation` and `ExplorerApp`
- [x] Run `pnpm test`
- [x] Remove synthetic `..` row from `ExplorerApp` listing entries
- [x] Simplify `selectedRowIndexForPath` and listing sort parent-row handling
- [x] Run `pnpm test`
- [x] `explorerUrl` helpers: `/f` pathname ↔ explorer path encode/decode; unit tests
- [x] `useExplorerNavigation`: push/replace URL on navigate; preserve query; browser back/forward
- [x] `appRoute` + settings back: recognize `/f/*`; restore explorer URL when leaving settings
- [x] Run `pnpm test`
- [x] Status bar: show "Connected" when online; kernel version in hover title only
- [x] Update e2e smoke test for connected status label
- [x] Run `pnpm test`
- [x] Rename offline status label to "Connection lost" (en + zh-CN i18n)
- [x] Update e2e smoke test for new offline aria label
- [x] Run `pnpm test`
- [x] Add hover title for "Connection lost" status (en + zh-CN i18n)
- [x] Update e2e smoke test for offline hover title
- [x] Run `pnpm test`
- [x] Remove SQLite `sessions` table and `create_session` / `session_valid` from `state.rs`
- [x] Rewrite `auth.rs`: in-memory expiry only; rename cookie helpers (`AUTH_COOKIE_NAME`, etc.)
- [x] Drop `create_session` from `transport.rs`; update `tests/auth.rs`
- [x] Rename `bootstrapSessionFromUrl` → `stripShareTokenFromUrl` in `web/src/api.ts`
- [x] Update design docs: `state.db` is tus-only (no session tokens)
- [x] Run `cargo test` and `cargo clippy -- -D warnings`

## TODO List (fix nightly perf — current cycle)

- [x] `nightly.yml`: add Node/pnpm setup and `web` build before `cargo test --test perf`
- [x] Run `cargo test`

## TODO List (fix e2e smoke — current cycle)

- [x] `smoke.spec.ts`: use `[data-listing-entry]` clicks instead of file-name links in table view
- [x] `smoke.spec.ts`: fix slideshow counter assertion for multi-select image paths
- [x] Run `cargo test`

## TODO List (app URL base — current cycle)

- [x] `appBase.ts`: normalize `BASE_URL`, strip/apply base on pathnames; unit tests
- [x] `explorerUrl.ts` + `appRoute.ts`: route parsing/building through app base
- [x] `vite.cloud.config.ts`: dev SPA fallback at `/` for cloud entry (match production root)
- [x] `appRoute.test.ts` + `explorerUrl.test.ts`: subpath (`/repo/`) cases; run `pnpm test`
