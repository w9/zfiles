## High-level plan next

Dual-mode refactor is **complete**. Quick filter in the address bar is **done** (client-side name filter with case/whole/regex toggles). **Next:** nightly perf job `web/dist` build, e2e smoke upkeep.

## TODO List

- [x] `Cargo.toml`: `reqwest` + `tokio-tungstenite` without TLS features; refresh lockfile
- [x] `vite_proxy.rs`: HTTP/WS only; tests for rejected `https` Vite URL
- [x] `upload.rs`: `resolve_location` HTTP only; reject `https://` server URLs
- [x] `design/design.md`: document plain-HTTP clients vs future listener TLS
- [x] `cargo test` and `cargo clippy -- -D warnings`
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
- [x] `VirtualListing.tsx`: remove `transition-colors` from row and body gutter classes
- [x] Run `pnpm test`
- [x] Local kernel: `LocalFs` mkdir/rename/copy/move + extended `POST /api/actions` + integration tests
- [x] `S3Backend`: mkdir, rename, copy, move via AWS SDK; extend `runAction` payload
- [x] Web: clipboard, copy/cut/paste actions, paste destination + conflict dialogs, batch/paste settings
- [x] Web: inline name editor (new folder + F2 rename) in list/grid; primary selection + focused row ops
- [x] i18n (en + zh-CN), status bar cut hint, README API table; `cargo test` + `pnpm test`
- [x] Context menu: right-click outside selection selects that row only before opening menu
- [x] Context menu: right-click empty listing area shows folder actions (new folder, paste, …)
- [x] `input-group` + `textarea` shadcn components; `quickFilter.ts` with case/whole/regex + tests
- [x] `ExplorerBreadcrumb`: Input Group filter at right with match toggles; i18n (en + zh-CN)
- [x] `ExplorerApp`: loaded-only filter, dot reveal while filtered, navigate clear, selection prune, Mod+F, overlay
- [x] `pnpm test`
