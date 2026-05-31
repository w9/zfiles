## High-level plan next

Dual-mode refactor is **complete**. Upload queue + progress panel shipped (incl. cancel). **This cycle:** remove borders from breadcrumb and status bar cards.

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
