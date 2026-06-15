## High-level plan next

Dual-mode refactor is **complete**. Upload tray polish is **complete**. Pause offset rollback is **complete**. Upload-session persistence hardening is **complete**. Remote-only session copy + dismiss X icon are **complete** (uncommitted). **Current cycle:** group upload row action icon buttons in a tight cluster (`gap-0.5`) for session and queue rows. Deferred: global pause-all, status-bar pill attention for unfinished sessions, dedicated preview content (text/media/EXIF), quick-actions bar, multi-select summary, palette recent-use / keybinding ranking boosts.

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

- [x] `keybindingDisplay.test.ts`: cover spelled-out keys — `Enter` → `["Enter"]`, Linux `Shift+ArrowDown` → `["Shift", "ArrowDown"]`
- [x] `ChordKbd.tsx` (new, `web/src/actions/`): chord → `KbdGroup` of per-key `Kbd` chips via `chordToKbdLabels`; no `+` separators; optional chip className
- [x] Wire `ChordKbd` into `MenuBar.tsx` + `CommandPalette.tsx` (preserve selected-row foreground tweak) + `ActionToolbar.tsx` tooltip
- [x] `ContextMenu.tsx` + `ExplorerApp.tsx`: pass raw `chord` through `ContextMenuAction` (drop preformatted `shortcut`); render `ChordKbd`
- [x] Remove `tracking-widest` from shortcut slots: `menubar.tsx`, `dropdown-menu.tsx`, `context-menu.tsx`, `command.tsx`
- [x] `e2e/tests/smoke.spec.ts`: assert per-key kbd chips (`Ctrl`, `P`) instead of `Ctrl+P` text; run the spec
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `.github/workflows/{ci,release,nightly}.yml`: bump `actions/checkout`, `actions/setup-node`, `pnpm/action-setup` to `@v5` (Node 24 runtime)
- [x] `.github/workflows/{ci,release,nightly}.yml`: pin `Swatinem/rust-cache@v2.9.0` (Node 24 runtime)

- [x] `AGENTS.md`: add commit-scope rule under "Before every commit" — commit only this conversation's changes; never include outside edits unless the user explicitly asks

- [x] `keybindings.test.ts`: cover Delete, F2, Mod+C/X/V dispatch via `defaultKeybindings()`
- [x] `keybindings.ts`: register file.rename (F2), file.copy/cut/delete, file.paste in `defaultKeybindings()` with action `when` clauses
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `upload-queue.ts`: add `paused` status + `pauseUpload`/`resumeUpload`; pause aborts in-flight transfer without S3 session teardown; resume re-queues with preserved offset/session; unit tests
- [x] `kernelBackend.ts`: resume tus PATCH from stored upload id + checksum (skip re-hash); wire paused-item resume in upload worker
- [x] `UploadPanel.tsx` + `ExplorerApp`: per-row Pause (active only) and Resume (paused) buttons; Cancel unchanged
- [x] `uploadTray.ts` + `uploadPanelRows.ts`: track user-paused separately from `awaiting_conflict` in stats/header segments
- [x] i18n (14 locales): `upload.pause`, `upload.resume`, `upload.status.paused`, queue header key
- [x] S3 paused resume: rebuild `multipartResume` from persisted session + queue `multipartUpload` state
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `UploadPanel.tsx`: row background progress fill (primary for active/paused, muted for hashing/verifying/local multipart); remove inline + session `Progress` bars; plain bg for pending/terminal/unknown bytes
- [x] `UploadPanel.tsx`: show upload percent in queue row stats text (drop progress tooltip)
- [x] i18n (14 locales): add `upload.statsWithPercent`; adjust multipart stats if needed
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `UploadPanel.tsx`: drop Remote badge from session rows; move remote-only + progress-unknown into Unfinished tooltip (multi-paragraph); inline stats = Unfinished · started time · known progress only
- [x] i18n (14 locales): keep existing keys; remove unused `upload.multipart.remote` if no longer referenced
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `tooltip.tsx`: default `disableHoverableContent={true}` on `TooltipProvider` (and `Tooltip` root wrapper) so pointer-leave dismisses; allow per-tooltip opt-out via prop
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `truncated-text-tooltip.tsx`: shared helper — Shadcn Tooltip, 1000ms delay, break-all content (match GridListing)
- [x] `UploadPanel.tsx`: replace five `title=` hints (queue/session fileName + destPath, panel header)
- [x] `VirtualListing.tsx`: name column + modified column; `GridListing.tsx`: adopt shared helper
- [x] `FileIcon.tsx` symlink badge + `BackendStatus.tsx` conditional hint — drop native `title=`
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `UploadProgress` + multipart `onProgress`: pass committed bytes (excluding in-flight part data)
- [x] `upload-queue.ts`: track `committedUploadOffset`; `resolvePausedUploadOffset` (ListParts / HEAD / hashing→0); apply on pause
- [x] `S3Backend.getMultipartBytesUploaded` + `KernelBackend.getTusUploadOffset` helpers
- [x] Unit tests for committed progress + paused offset resolution
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `tusSessions.ts`: scoped localStorage CRUD + file-match helpers; unit tests
- [x] Kernel: `DELETE /api/upload/{id}` to drop in-progress tus spools; integration test
- [x] `useTusSessions.ts` + `KernelBackend` list/abort helpers; resume via re-select file picker
- [x] `upload-queue.ts`: persist tus on transfer session; remove on done/cancel; tus resume enqueue item
- [x] `UploadPanel` + `ExplorerApp`: show local unfinished sessions alongside cloud multipart; clear scoped multipart records on cloud disconnect
- [x] Run `pnpm test` + `cargo test`; bump patch version in `Cargo.toml`

- [x] `upload-queue.ts`: finish-path session cleanup uses active item (fresh tus + S3 multipart); unit test
- [x] `upload-queue.ts`: persist multipart `bytesUploaded` on committed-byte changes (not blocked after create)
- [x] `s3Backend.ts`: drop local-only multipart records (+ IndexedDB handles) when `ListParts` fails
- [x] Unit tests for finish-path ids + stale local record pruning behavior
- [x] Run `pnpm test` + `cargo test`; bump patch version in `Cargo.toml`

- [x] `UploadPanel.tsx`: remote-only session rows use `upload.status.startedElsewhere` instead of `upload.status.unfinished`
- [x] i18n (14 locales): add `upload.status.startedElsewhere`
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `UploadPanel.tsx`: started-elsewhere tooltip uses `upload.startedElsewhere.description` only (no multipart.description / remoteOnly / progressUnknown)
- [x] i18n (14 locales): add `upload.startedElsewhere.description` (why + abort action)
- [x] Run `pnpm test`

- [x] `UploadPanel.tsx`: session Abort buttons use X icon; plain ghost styling (match queue Cancel)
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `UploadPanel.tsx`: wrap session + queue row icon buttons in `flex gap-0.5 shrink-0` group; keep `gap-2` before the group
- [x] Run `pnpm test`
