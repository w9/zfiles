## High-level plan next

Dual-mode refactor is **complete**. Upload tray polish is **complete**. Unified in-house S3 multipart engine for fresh + resume uploads is **complete** (`@aws-sdk/lib-storage` removed). **Current cycle:** per-key shortcut chips — render shortcut surfaces (menu bar, context menu, command palette, toolbar tooltips) as per-key shadcn `Kbd` chips via `chordToKbdLabels`, gap-separated without `+`, dropping `tracking-widest` so spelled-out keys like `Enter` keep normal letter-spacing. Deferred: status-bar pill attention for unfinished sessions, dedicated preview content (text/media/EXIF), quick-actions bar, multi-select summary, palette recent-use / keybinding ranking boosts.

## TODO List

- [x] Run `pnpm test` + `cargo test`
- [x] `command.tsx`: shadcn styling — InputGroup input, muted selection, native `no-scrollbar max-h-72` list
- [x] `CommandDialog`: popover shell (`rounded-xl`, `bg-popover`) to match shadcn palette chrome
- [x] Run `pnpm test`
- [x] `AGENTS.md`: aggressive streamline — each rule stated once; fold Task tracking, AQ, scope gate, and Key references into a tighter structure; drop "Common mistakes" (unique nuances folded into the main rules)
- [x] `AGENTS.md`: approved relaxations — `cargo fmt`/`clippy` only for Rust-touching commits; patch bump only for shipped-behavior commits; Verify = suites covering what the cycle touched
- [x] Run `cargo test`; hold the AGENTS.md implementation commit for user review
- [x] `upload-queue.ts`: add required `enqueuedAt` to `UploadQueueItem` (set in `createQueueItem`/`createResumeQueueItem`); update unit tests
- [x] `uploadPanelRows.ts`: merged queue+session row model sorted newest-first by time + header segments with unfinished count; unit tests; register test file in `pnpm test` script
- [x] `UploadPanel.tsx`: render one merged list — unified rows (icon, name + dest path, right stats, action buttons, progress); session rows get "Unfinished" status word with description tooltip + started-time + Remote badge in stats; drop section header/ⓘ/loading/error/empty lines
- [x] Slim `CloudMultipartPanelProps` (drop `loading`/`error`); update `UploadIndicator` + `ExplorerApp` wiring
- [x] i18n (14 locales): add `upload.status.unfinished` + `upload.queue.header.unfinished`; remove `upload.multipart.title`/`infoLabel`/`loading`/`empty`
- [x] Run `pnpm test`; fix failures
- [x] `UploadPanel.tsx`: wrap merged `<ul>` in shadcn `ScrollArea` (`max-h-80`); drop native `overflow-y-auto` on the list
- [x] Run `pnpm test`
- [x] `uploadTrayGeometry.ts`: defaults (2× prior size), clamp, resize deltas, localStorage persistence + unit tests; register in `pnpm test`
- [x] `UploadFloatingPanel.tsx`: fixed portal shell — drag (title handle), invisible 8-edge resize, Escape close, viewport clamp on resize
- [x] `UploadPanel.tsx`: title-only drag handle prop; `h-full` flex layout so `ScrollArea` fills resizable height
- [x] `UploadIndicator.tsx`: wide → floating panel anchored to trigger; narrow (<640px) → bottom `Sheet`; drop Radix `Popover`; no outside-click close
- [x] i18n (14 locales): `upload.tray.dragHandle` (+ sheet label if needed)
- [x] Run `pnpm test`
- [x] `UploadPanel.tsx`: header × close button (`onClose` prop); wire from `UploadIndicator` (floating + sheet)
- [x] `UploadFloatingPanel.tsx`: subtle wide drop shadow on the shell
- [x] i18n (14 locales): `upload.tray.close`
- [x] Run `pnpm test`
- [x] `.gitignore`: ignore `web/tsconfig.tsbuildinfo`
- [x] `UploadPanel.tsx`: inline ~6em progress bar in queue row stats (replaces xx% + full-width row); 0-delay tooltip `xx% (uploaded / total)`; stats show total only; no bar for done/failed/cancelled
- [x] i18n (14 locales): adjust upload stats strings + add `upload.stats.progressTooltip`
- [x] Run `pnpm test`
- [x] Add `@aws-sdk/xhr-http-handler`; wire `XhrHttpHandler` on whole `S3Client` in `createS3Client`
- [x] Restore `@aws-sdk/lib-storage` `Upload` in `s3Backend.upload`; remove `multipartUploadFile` / presigned-XHR path
- [x] `resumeMultipartUpload`: parallel missing parts (queue ~4) + aggregated in-flight progress via XhrHttpHandler events; unit tests
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`
- [x] `GridListing.tsx`: selected/focus-selected card classes — outset `shadow-[0_0_0_2px_var(--primary)]` instead of inset
- [x] Run `pnpm test`

- [x] `file-system-access.d.ts`: augment `DataTransferItem`, `FileSystemHandle`, `Window` for picker/handle APIs used by drag-drop and resume
- [x] `s3XhrUploadProgress.ts` + test: import `HttpRequest` from `@smithy/core/protocols`; cast `XhrHttpHandler` for EventEmitter `on`/`off`
- [x] `upload-queue.ts` + `UploadButton.tsx`: normalize enqueue/onSelect to `DroppedUploadFile[]` (fix union destructuring + button callback)
- [x] Run `pnpm test` + `pnpm build`

- [x] `keybindings.ts`: Space → `viewer.slideshow` when `file-list` + image (grid and table); drop Space → `selection.toggle`
- [x] `builtins.ts`: remove `defaultKeybinding: "Space"` from `selection.toggle`
- [x] `keybindings.test.ts`: cover table-view slideshow + no toggle fallback
- [x] i18n (14 locales): `shortcuts.hint` — Space opens slideshow for images (not toggle)
- [x] Run `pnpm test`

- [x] `e2e/tests/smoke.spec.ts`: close slideshow with Escape instead of top-left click (chrome hover zone blocks letterbox)
- [x] Run e2e slideshow smoke test locally

- [x] `StatusBar.tsx`: render centered `shortcuts.hint` between backend status and selection/upload cluster
- [x] `e2e/tests/smoke.spec.ts`: assert status bar shows shortcut hint text
- [x] Run `pnpm test`

- [x] `keybindings.ts`: export `keyPartLabel` + `shortcutsHintParams` (platform-aware `{{shiftClick}}`, `{{commandPalette}}`)
- [x] `keybindingDisplay.ts`: reuse `keyPartLabel`; unit tests for macOS icons vs Linux Ctrl
- [x] i18n (14 locales): `shortcuts.hint` — replace hardcoded Ctrl/Shift chords with placeholders
- [x] `StatusBar.tsx`: pass `shortcutsHintParams()` into `t("shortcuts.hint")`; relax e2e assertion
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `s3MultipartUpload.ts`: unified `uploadMultipartFile` (create/list/upload missing parts/complete); PutObject fast path; checksum fields at Complete
- [x] `s3Backend.ts`: route fresh + resume through unified engine; drop lib-storage; persist session on `onUploadCreated`
- [x] Remove `@aws-sdk/lib-storage`; unit tests for upload helpers; run `pnpm test`; bump patch version

- [ ] `keybindingDisplay.test.ts`: cover spelled-out keys — `Enter` → `["Enter"]`, Linux `Shift+ArrowDown` → `["Shift", "ArrowDown"]`
- [ ] `ChordKbd.tsx` (new, `web/src/actions/`): chord → `KbdGroup` of per-key `Kbd` chips via `chordToKbdLabels`; no `+` separators; optional chip className
- [ ] Wire `ChordKbd` into `MenuBar.tsx` + `CommandPalette.tsx` (preserve selected-row foreground tweak) + `ActionToolbar.tsx` tooltip
- [ ] `ContextMenu.tsx` + `ExplorerApp.tsx`: pass raw `chord` through `ContextMenuAction` (drop preformatted `shortcut`); render `ChordKbd`
- [ ] Remove `tracking-widest` from shortcut slots: `menubar.tsx`, `dropdown-menu.tsx`, `context-menu.tsx`, `command.tsx`
- [ ] `e2e/tests/smoke.spec.ts`: assert per-key kbd chips (`Ctrl`, `P`) instead of `Ctrl+P` text; run the spec
- [ ] Run `pnpm test`; bump patch version in `Cargo.toml`
