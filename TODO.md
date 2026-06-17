## High-level plan next

Show a listing loading overlay (spinner + i18n text) for initial load, navigation, and refresh — especially noticeable on local/LAN folders with tens of thousands of entries. Optimistic breadcrumb path update on navigation; ignore stale in-flight loads. Deferred: CLI banner redesign (`banner.rs`), `--verbose` gating, palette recent-use boosts.

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

- [x] Instrument `listMultipartSessions` / `mergeMultipartSessions` / `visibleUnfinishedSessions` with debug logs (sessionId `cf55cc`)
- [x] Reproduce duplicate Unfinished + Started elsewhere rows; analyze logs and fix root cause
- [x] Verify fix with post-fix logs; remove instrumentation; run `pnpm test`

- [x] `slideshowSettings.ts` + provider + Settings toggle: persisted `startAtActiveItem` (default off); unit tests
- [x] `getImagePaths` / open helper: sort slideshow paths by listing order; resolve start index (first vs active)
- [x] `SlideshowOverlay.tsx`: show `slideshow.counter` beside filename; `onCurrentPathChange` syncs explorer focus only
- [x] i18n (14 locales): `settings.slideshow.startAtActiveItem.*`
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `PreviewPane.tsx`: metadata-only for files — remove image preview, “no preview” message, and download link
- [x] `selection.copy-paths` + new `selection.download` actions: `context-menu` surface, after file ops; singular/plural copy-path label; download filters non-directories, confirms when multiple files
- [x] `downloadPaths.ts` + `ExplorerApp` wiring: `selection.file-count` context key, dynamic menu labels, multi-download confirm dialog
- [x] i18n (14 locales): `actions.selection.copyPath.name`, `actions.selection.download.*`
- [x] Update e2e preview-image test + context-menu coverage; run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `backendObjectCache.ts`: presigned URL expiry parse, stat + download URL caches (TTL, refresh buffer, in-flight dedup, invalidatePath); unit tests
- [x] `s3Backend.ts`: wire caches into `stat`/`downloadUrl`; invalidate affected paths on `upload` + `runAction`
- [x] `SlideshowOverlay.tsx`: key slideshow `<img>` by `currentPath` instead of `imageUrl`
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `BackendStatus.tsx` + `StatusBar.tsx`: dot-only indicator; status tooltips on dot; left cluster (dot, cut, selection); right (uploads, clickable kernel version); offline-only red tint
- [x] `AboutDialog.tsx` + `KeyboardShortcutsDialog.tsx`: barebone About (name, app + kernel version, tagline, MIT); shortcuts list — all merged keybindings grouped by action category with `ChordKbd`
- [x] Help actions (`help.open-about`, `help.open-keyboard-shortcuts`), `actions.help.category` in `surfaces.ts`; wire dialogs + menu in `ExplorerApp`
- [x] `vite.config.ts` + `vite.cloud.config.ts`: define app version from `Cargo.toml` for About dialog
- [x] i18n (14 locales): about, shortcuts dialog, help menu, backend status tooltips; remove status-bar `shortcuts.hint`
- [x] Update e2e smoke tests + any unit tests for status bar / shortcuts listing
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `UploadIndicator.tsx`: header icon trigger (outline, attention dot); hidden file input + `onSelect`; read-only still opens panel
- [x] `UploadPanel.tsx`: panel-header Choose files button via `onChooseFiles`
- [x] `StatusBar.tsx` + `ExplorerApp.tsx`: remove status-bar upload pill; replace header `UploadButton` with upload tray
- [x] Remove unused `UploadButton.tsx` if fully superseded
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `UploadIndicator.tsx`: accent pressed styling when panel open; `aria-pressed={open}` alongside `aria-expanded`
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `ExplorerApp.tsx`: pass `entries` (`FileEntry[]`) to `filterDownloadablePaths` instead of `listingEntriesRef`
- [x] Run `pnpm build` + `pnpm test`; bump patch version in `Cargo.toml` to 0.2.16
- [x] Publish GitHub release v0.2.16; verify Release workflow uploads musl binaries

- [x] `BackendStatus.tsx` + `StatusBar.tsx`: short connection label when no cut/selection text; muted styling; no dot tooltip while label shown
- [x] Update e2e status-bar connected test for idle connection text
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] Frontend tests: cover removal of h/j/k/l list navigation, letter-to-filter routing, filtered focus/Enter/arrow behavior, and fade-nonmatches mode
- [x] Remove h/j/k/l movement shortcuts so list navigation uses arrow keys only
- [x] Route plain unmodified letter keys in the explorer/list area to the filter box without stealing input/dialog typing
- [x] Keep filter-driven focus on the first matching item; make Enter in the filter open the focused match; make Up/Down move between matches while retaining input focus
- [x] Add a persisted fade-nonmatches filter display option beside case-insensitive filtering; default it off and skip faded nonmatches during filter navigation
- [x] i18n (14 locales): add labels/help text for the new fade-nonmatches setting
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `quickFilter.ts` + `quickFilter.test.ts`: remove `QuickFilterOptions` type, defaults, storage key/helpers/parse/read/store, and all toggle fields; rewrite `entryMatchesQuickFilter`/`buildRegex`/`filterEntriesByQuickFilter` (and call sites) to be option-less and syntax-driven: plain text = case-insensitive substring `includes`; query starting with `/` (slash consumed) = case-sensitive regex; query starting with `/` and ending with `/i` = case-insensitive regex (strip suffix); support whole-name via user-supplied `/^name$/`; invalid regex after `/` → no match; keep `normalize`, `first/nextQuickFilterMatchIndex`, `isPlainQuickFilterLetterKey` etc. as-is where still valid
- [x] `quickFilter.test.ts`: port existing tests to new no-options signatures; add cases for: plain ci substring, `/pat` (cs regex), `/pat/i` (ci regex), mixed case, "foo/i" without leading / is literal substring, `/^exact$/` whole-name, invalid `/[` yields no-match, trimming, empty query returns all
- [x] `ExplorerBreadcrumb.tsx`: remove the four toggle buttons (CaseSensitive/Eye/WholeWord/Regex), `toggleOption`, the four `quickFilter*Label` props, and related aria/pressed wiring; retain only the clear (X) button when value present; add a small persistent `HelpCircle` "?" as the right-most `InputGroupAddon` item (after clear when present); wire shadcn `Tooltip` (0 delay, hover) containing the usage help text; when the value starts with `/` and the regex is invalid, apply destructive/error styling to the input group and surface a "pop up" tooltip explaining the error (e.g. on the input or a transient indicator)
- [x] `ExplorerApp.tsx` (and props wiring): remove `quickFilterOptions` state, `setQuickFilterOptions`, `readStored...`/`store...` calls and effect; delete all `fadeUnmatched` branches (visibleEntries, quickFilteredEntries, selectAll warnings, listingEntry flags); stop computing/passing the four label strings; call breadcrumb with filter value/onChange/onKeyDown/ref only; update `quickMatchedEntries`, `entryMatchesQuickFilter` calls, and `quickFilterMatched` computations to the new no-options functions; simplify related memos/effects
- [x] i18n (14 locales): delete the four toggle keys (`quickFilter.caseSensitive`, `.fadeUnmatched`, `.wholeWord`, `.regex`) and their values from `en.ts` + all other locale files; add one or more new keys (e.g. `quickFilter.help` for the tooltip body describing the three rules + whole-name anchors + ESC; `quickFilter.regexError` for the invalid-regex message); supply complete translations for all 14 locales; remove the now-unused label props from ExplorerApp → breadcrumb call site
- [x] `README.md`: update the quick-filter bullet under "More features" (previously mentioned toggles) to describe the unified syntax-driven filter and the "?" help icon
- [x] Run `pnpm test` + `pnpm build`; fix failures; the commit that lands the UX behavior change also bumps the patch version in `Cargo.toml` (web-only, no fmt/clippy gate)

- [x] `ExplorerBreadcrumb.tsx`: remove the `HelpCircle` import and the entire "?" icon affordance (its Tooltip, span, aria-label from quickFilterHelpLabel, and the addon item); make the whole filter `<InputGroup>` the `TooltipTrigger asChild` (0-delay hover) for the help/error tooltip; choose content dynamically (regexErrorLabel when the query starts with / and is invalid per isValidQuickFilterRegex, else the helpText); keep the input's aria-invalid for the group's red/destructive styling on bad regex; the clear X (when present) is inside the hover surface; simplify the prior conditional input-wrapping IIFE for error; drop the quickFilterHelpLabel prop from the component type and usage.
- [x] `ExplorerApp.tsx`: stop passing `quickFilterHelpLabel` to ExplorerBreadcrumb (the helpText and regexErrorLabel props stay, now used for the box-level tooltip content).
- [x] Run `pnpm test` + `pnpm build` (suites covering the breadcrumb/explorer filter UI and quick filter logic); no patch version bump (refinement of the prior cycle's help presentation, not a new shipped behavior change).

- [x] `index.css`: hide Sonner `[data-close-button]` by default; show on toast `:hover` / `:focus-within` under `@media (hover: hover) and (pointer: fine)`; touch devices stay hidden
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] Instrument slideshow trigger path (`getImagePaths`, action when, Space keybinding) with debug logs; reproduce mixed selection bug and analyze logs
- [x] Fix slideshow availability: enable when selection/listing has image paths, not only when focused item is an image; update action `when`, Space keybinding, context-menu keys
- [x] Unit tests for new context key / when expressions; verify with post-fix logs; remove instrumentation; run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `truncated-text-tooltip.tsx`: default tooltip `side` to `"bottom"` so filename (and other truncated-text) tooltips appear below the label
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `folderViewSettings.ts` + test: per-folder override map in localStorage; global column-sort key; read effective settings (override → global); write/clear helpers
- [x] `view.toggle-listing-mode` + `view.apply-global-listing-settings` actions; i18n (14 locales); toolbar Shift+toggle invokes global action
- [x] `ExplorerApp.tsx`: apply effective settings on `currentPath` change; persist view/column-sort/grid-size changes per folder
- [x] `ListingViewToggle.tsx`: stop writing global directly; pass `{ global: shiftKey }` to parent
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `VirtualListing.tsx`: increase table virtualizer overscan enough to keep rows mounted ahead of fast wheel/trackpad scroll
- [x] `GridListing.tsx`: increase grid virtualizer overscan by virtual rows so whole card bands are ready before entering the viewport
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] Add cloud S3/R2 auth-error classification with tests for expired/revoked credentials and non-auth empty-success responses
- [x] Split cloud session handling so expired credentials clear secrets while preserving provider, bucket, region, endpoint, prefix, and read-only settings
- [x] Wire auth-expired handling through all S3 operations, including list/stat/download URL/upload/multipart/file actions, without treating HTTP 200 empty listings as errors
- [x] Add inline explorer reconnect banner and actionable toast for expired/revoked cloud credentials
- [x] Update connect dialog/reconnect flow to prefill preserved non-secret settings after credential expiration
- [x] Update cloud credential troubleshooting docs for automatic detection, preserved settings, and reconnect behavior
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [ ] Instrument cloud connect/session/auth-classifier/listing flow for expired-token reproduction (sessionId `7fe669`)
- [ ] Reproduce expired-token no-error case and classify hypotheses from runtime logs
- [ ] Fix only the proven root cause while keeping instrumentation active
- [ ] Verify with post-fix logs, then remove instrumentation
- [ ] Run targeted web verification for the touched cloud auth path

- [x] `banner.rs`: Vite-style startup output — `zfiles vX.Y.Z is running`, arrow rows (`Local`/`Share`, `Token`, `Serving`, `Access`, `Mode`, optional dimmed `State`/`Frontend`, public `QR`), raw URL without box; subtle ANSI on TTY
- [x] `banner.rs` unit tests: cover local/share wording, token row, read-only mode, dev-frontend dimmed rows, no-color render path
- [x] `tests/browser_open.rs` + `tests/qr.rs`: update integration assertions for new banner lines
- [x] Run `cargo fmt`, `cargo clippy -- -D warnings`, and `cargo test`; bump patch version in `Cargo.toml`

- [x] `e2e/tests/smoke.spec.ts`: scope keyboard-shortcuts assertion to the shortcuts dialog (avoid command-palette title collision)
- [x] `e2e/tests/smoke.spec.ts`: zh-CN locale smoke asserts visible upload tray button (`上传`), not panel-only “选择文件”
- [x] Run e2e smoke (`pnpm test` in `e2e/`) and confirm both tests pass

- [x] `cli.rs` `ServeArgs::validate()`: gate the `--token` requirement on `!ip.is_loopback()` (covers `0.0.0.0`/`::` plus specific routable IPs) instead of `is_unspecified()`; reword the bail message to "binding to a non-loopback address requires --token"
- [x] `cli.rs` tests: rename `public_bind_requires_token` coverage to assert a specific non-loopback IP (`192.168.1.50`) without token fails, with `--token` passes, the `0.0.0.0` wildcard without token still fails, and a loopback alias (`127.0.0.2`) without token passes
- [x] `design/design.md` §6: update the "Auth default policy" row to "Refuse non-loopback bind without `--token`; loopback (incl. `127.0.0.0/8`) token-free"
- [x] Run `cargo fmt`, `cargo clippy -- -D warnings`, and `cargo test`; bump patch version in `Cargo.toml`
- [x] Add Rust tests for replacing `0.0.0.0` share/QR host with the default-route IPv4 address and for localhost fallback messaging when detection fails
- [x] Implement default-route IPv4 detection for wildcard bind share output without changing the actual listener bind address
- [x] Wire the resolved display host into startup Share URL and QR code generation; include a clear fallback explanation when detection fails
- [x] Run `cargo fmt`, `cargo clippy -- -D warnings`, and `cargo test`; bump patch version in `Cargo.toml`

- [x] `transport.rs`: pass resolved `banner_url` to `open_async` instead of raw `explorer_url` when binding `0.0.0.0`
- [x] `browser.rs`: regression test documenting that `open_url` stays raw but share URL is browser-safe for wildcard bind
- [x] Run `cargo fmt`, `cargo clippy -- -D warnings`, and `cargo test`; bump patch version in `Cargo.toml`

- [ ] `banner.rs` tests-first: rewrite/extend unit tests for the new layout — `→`-marker spotlight URL line (no `▸  Local:`/`Share:` rows), bold-cyan + OSC 8 hyperlink on TTY (assert `\x1b]8;;` wrap), condensed dim `·`-joined meta (`root · mode · access`), share-only `token` line, single dim dev footer, inline QR block + caption when `qr` present, no-ANSI/no-OSC plain path, and a `shorten_home` helper; drop obsolete `arrow_row`/label-row tests and the "is running" header assertion
- [ ] `banner.rs` impl: add `qr: Option<String>` field; header `zfiles vX.Y.Z`; spotlight URL as `  →  {url}` in bold cyan wrapped in an OSC 8 hyperlink on TTY; condense secondary info into dim `·`-joined meta (`shorten_home(root) · read/write|read-only · token required|sharing on LAN`), a share-only dim `token  {token}` line, optional dim note line, and a single dim dev footer (`shorten_home(state) · Vite dev proxy ({url})`); add `shorten_home(path, home)` helper (used for root + state); remove `arrow_row`/label scaffolding
- [ ] `transport.rs`: render the QR into the banner — compute `qr::render_url(&banner_url)` for public shares, pass `Some/None` into `ServeBanner.qr` (warn on error), and remove the separate post-banner `qr::print_url` call
- [ ] `tests/browser_open.rs` + `tests/qr.rs`: update integration assertions to the new banner — match the `→` URL line instead of `▸  Local:`/`Share:`, the new QR caption instead of `▸  QR:`/`scan below`, and parse the token from the URL line for the loopback `--token` case (no standalone token row locally)
- [ ] Run `cargo fmt`, `cargo clippy -- -D warnings`, and `cargo test`; bump patch version in `Cargo.toml`

- [x] `listingMarqueeSelect.ts` tests: content-space marquee hit-testing — retract shrinks selection; auto-scroll across pages keeps swept rows selected
- [x] `listingMarqueeSelect.ts` + layout resolvers: hit-test entries in scroll content coordinates instead of viewport-only client rects
- [x] `useListingMarqueeSelect.ts`: remove cumulative `marqueeHits`; drive selection from content-space hits each frame
- [x] Run `pnpm test` for marquee/listing tests

- [x] `InfoDialog.tsx` (new): centered shadcn `Dialog` — single-path mode reuses `PreviewPane` metadata; multi-select aggregate (item count, file/folder breakdown, total size); live-follow selection while open
- [x] `previewActions.ts`: rename `preview.open-sheet` → `preview.get-info`; always when `selection.count >= 1`; context menu + default ⌘I / Ctrl+I; drop `preview.inline-available` gate
- [x] `ExplorerApp.tsx`: remove inline `PreviewPane` split + `PreviewSheet`; wire `infoDialogOpen` + paths; drop `inlinePreviewAvailable` / resize observer / `focusPane` preview focus
- [x] Clean up preview pane infrastructure: remove or slim `PreviewSheet.tsx`, `previewLayout.ts` (+ tests); drop `preview.inline-available` / `preview.sheet-open` context keys; remove `viewer.next-image` / `viewer.prev-image` preview-pane actions
- [x] i18n (14 locales): rename preview strings to Get Info (`preview.getInfo.name`, dialog title, aggregate summary keys); update shortcut hints if needed
- [x] Unit tests: aggregate summary helper + action `when`/keybinding; run `pnpm test`; bump patch version in `Cargo.toml`

- [ ] `ExplorerApp.tsx`: `listingLoading` state + generation counter — optimistic path on navigation loads, revert on failure, ignore stale responses
- [ ] Listing pane: semi-transparent overlay with spinner + `listing.loading` while loading; spin breadcrumb refresh during load; loading takes precedence over empty overlay
- [ ] i18n (14 locales): add `listing.loading`
- [ ] Unit tests for listing overlay priority helper; run `pnpm test`; bump patch version in `Cargo.toml`
