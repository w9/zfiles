## High-level plan next

Raise collapsed menubar breakpoint to `md` (768px). Follow-up: unified focus-ring treatment across inputs.

## TODO List

- [x] `listingEmpty.ts`: export `LISTING_LOADING_OVERLAY_DELAY_MS` (300); `listingPaneOverlayKey` takes `showListingLoadingOverlay`
- [x] `ExplorerApp.tsx`: delay listing overlay/spinner until 300ms into load; reset timer per load generation; breadcrumb refresh spin unchanged
- [x] Update overlay helper tests; run `pnpm test`; bump patch version in `Cargo.toml`
- [x] `infoPanelGeometry.ts`: resizable limits (min 320×240, default 480×560); persist full geometry like upload tray
- [x] `MetadataValueRow.tsx`: shared label/value row with optional copy button (icon flash to checkmark); skip when no copy text
- [x] Wire copy rows into `PreviewPane.tsx` and `InfoDialog` aggregate summary; enable `FloatingPanel` resize
- [x] i18n (14 locales): `preview.copyValue` aria label; run `pnpm test`; bump patch version in `Cargo.toml`
- [x] `ChordKbd.tsx`: render platform-native label (`formatKeybindingLabel`) as `text-xs text-muted-foreground` span; tooltip contrast override
- [x] Delete `web/src/components/ui/kbd.tsx`; remove `keybindingDisplay.ts` + tests (superseded by `formatKeybindingLabel`)
- [x] `CommandPalette.tsx`: drop kbd-chip-specific className tweaks; rely on `CommandShortcut` + span override for selected row
- [x] `e2e/tests/smoke.spec.ts`: assert plain `Ctrl+P` shortcut text instead of per-key kbd slots
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`
- [x] Shortcut slots (`dropdown-menu`, `context-menu`, `menubar`, `command`): widen min gap between label and shortcut (`ms-3 flex-1 justify-end`)
- [x] Run `pnpm test`
- [x] `icons.ts`: add `Keyboard` for `help.open-keyboard-shortcuts`, `CircleHelp` for `help.open-about`
- [x] `icons.test.ts`: assert every registered action id has a mapped icon
- [x] Run `pnpm test`
- [x] `GridListing.tsx`: remove card border/background/rounded corners and name divider; keep hover + selection ring/tint
- [x] `GridCardPreview.tsx`: remove preview-area muted background
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`
- [x] `ExplorerApp.tsx`: block background-click selection clear while Get Info is open
- [x] `InfoDialog.tsx`: ignore Sheet `onOpenChange(false)` from outside overlay clicks
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`
- [x] Drop selection requirement from `preview.get-info` action and ⌘I keybinding
- [x] `InfoDialog.tsx`: empty-state body when `paths.length === 0`; remove auto-close on empty selection
- [x] Update `previewActions.test.ts`; run `pnpm test`; bump patch version in `Cargo.toml`
- [x] `builtins.ts`: set Command Palette `categoryKey` to `actions.help.category` (first Help item via registry order)
- [x] `shortcutDialogRows.ts`: add Help to `SHORTCUT_DIALOG_CATEGORY_ORDER`; update unit tests
- [x] `e2e/tests/smoke.spec.ts`: open Command Palette from Help menu instead of View
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`
- [x] `GridListing.tsx`: center filename label; keep inline rename full-width left-aligned; end ellipsis when truncated
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`
- [x] `useGridCardResize.ts`: track the grabbed card path while resizing; clear on pointer up/cancel
- [x] `GridListing.tsx`: apply lighter primary ring to the resizing card only; suppress selection chrome on that card during drag
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`
- [x] `StatusBar.tsx` + `ExplorerApp.tsx`: persistent read-only badge (Lock + label) with tooltip when `readOnly`
- [x] `UploadPanel.tsx` + `UploadIndicator.tsx`: pass `readOnly`; empty tray shows existing `upload.readOnly` string
- [x] i18n (14 locales): `statusBar.readOnly` + `statusBar.readOnlyTooltip`
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`
- [x] `BackendStatus.tsx`: replace dot + label with outline badge (status dot + text) and tooltip; drop `showLabel`
- [x] `StatusBar.tsx`: remove `showConnectionStatus` / `showLabel` wiring
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`
- [x] `BackendStatus.tsx`: swap status dots for lucide icons (Wifi / Loader2 / WifiOff)
- [x] Run `pnpm test`
- [x] `BackendStatus.tsx`: use Globe / GlobeOff instead of Wifi / WifiOff for connected/offline
- [x] Run `pnpm test`
- [x] `StatusBar.tsx`: use generic `selection.count` i18n key instead of file-only `selection.fileSelected` / `selection.filesSelected`
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`
- [x] `BackendStatus.tsx` + `StatusBar.tsx` + `ExplorerApp.tsx`: connected tooltip uses `backend` + `version` params (kernel locally, provider in cloud)
- [x] i18n (14 locales): update `backend.connectedTooltip`; add `backend.connectedBackend.kernel` and `backend.connectedTooltipBackendOnly`
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`
- [x] Rename `backend.connectedBackend.kernel` → `backend.connectedBackend.zfilesServer` ("zfiles server" locally); wire `BackendStatus.tsx`
- [x] i18n (14 locales): natural translations aligned with `backend.connectedBrief`
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`
- [x] `StatusBar.tsx`: show `v{{version}}` in bottom-right link; local mode only; update `statusBar.openAbout` aria label
- [x] i18n (14 locales): replace `backend.kernelVersion` with `statusBar.serverVersion`; drop kernel from `statusBar.openAbout`
- [x] Update e2e status-bar version assertion; run `pnpm test`; bump patch version in `Cargo.toml`
- [x] `selectionStatusText.ts`: file/folder count helpers + `formatSelectionStatusLabel` / `formatCutStatusLabel`; unit tests; register in `pnpm test`
- [x] `ExplorerApp.tsx` + `StatusBar.tsx`: precomputed selection/cut status strings via helper (drop `selectedCount` prop)
- [x] i18n (14 locales): `selection.folderSelected`, `selection.foldersSelected`, `selection.breakdownSelected`; `clipboard.cutManyFiles`, `clipboard.cutManyFolders`, `clipboard.cutBreakdown`
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`
- [x] `selectionStatusText.ts`: `formatFileUnit` / `formatFolderUnit` and compose breakdown labels (1 vs 2+); update tests
- [x] `InfoDialog.tsx`: use unit helpers for aggregate breakdown
- [x] i18n (14 locales): `selection.fileUnit.one/many`, `selection.folderUnit.one/many`; retemplate breakdown keys to `{{files}}, {{folders}}`
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`
- [x] `VirtualListing.tsx`: drop `border-b` from data row class; keep header `border-b`
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`
- [x] `listingMarqueeSelect.ts`: `shouldClearMultiSelectionOnEmptyClick` helper (plain click, not on entry, no drag); unit tests
- [x] `useListingMarqueeSelect.ts`: invoke `onEmptyClick` on pointer-up when helper passes; run empty-click path even when marquee disabled
- [x] `ExplorerApp.tsx`: `clearMultiSelection` (selectedPaths only); wire `onEmptyClick`; respect `blockSelectionClearRef`
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`
- [x] Explorer-only icon buttons → ghost: `UploadIndicator`, `ShowDotEntriesToggle`, `ListingViewToggle`, `ActionToolbar`, `DisconnectButton`
- [x] Shared toggles: optional `variant` prop on `ThemeToggle`, `LanguageToggle`, `ShareUrlButton` (default outline); pass `variant="ghost"` from `ExplorerApp` (+ inline settings button)
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`
- [x] `floatingPanelStack.ts` + tests: in-memory stack (register/unregister, bring-to-front, z-index, is-topmost)
- [x] `FloatingPanel.tsx`: subscribe to stack — dynamic z-index; pointer-down + open bring to front; Escape closes only when topmost
- [x] Register stack tests in `pnpm test`; run `pnpm test`; bump patch version in `Cargo.toml`
- [x] `ExplorerApp.tsx`: context menu download label — "Download" for one file, "Download {{count}} files" for multiple; drop filename branch
- [x] i18n (14 locales): add `actions.selection.download.nameWithCount`; remove `actions.selection.download.nameWithFile` and legacy `selection.download`
- [x] `e2e/tests/smoke.spec.ts`: update context menu download assertion
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`
- [x] `imagePaths.ts` + `imagePaths.test.ts`: add `previewKind(path)` → `"image" | "video" | "audio" | null` (video: mp4/webm/mov/m4v/ogv; audio: mp3/wav/flac/m4a/aac/ogg/oga) and `isPreviewable(path)`; keep `isImagePath`/`isBrowserPreview*` as-is; cover new extension lists + predicates
- [x] `slideshowPathOrder.ts` + test: rename `resolveViewerImagePaths` → `resolveViewerPreviewPaths` (filter `isPreviewable` instead of `isImagePath`); keep listing-order sort + `resolveSlideshowStartIndex`; port unit tests to mixed image/video/audio sets
- [x] Rename action to `viewer.preview` across `previewViewerActions.ts` (renamed from `imageViewerActions.ts`; `when viewer.preview-count > 0`, nameKey `viewer.preview.name`), `keybindings.ts` (Space), `icons.ts` (`Eye`), `useActionSystem.ts` + `ExplorerApp.tsx` (context key `viewer.image-count` → `viewer.preview-count`, dep `getImagePaths` → `getPreviewPaths`, `openSlideshow` → `openPreview`), `contextKeys.ts`; update `keybindings.test.ts`, `icons.test.ts`, `explainWhenFailure.test.ts`
- [x] `SlideshowOverlay.tsx`: render `<video controls>` / `<audio controls>` by `previewKind`; gate zoom/pan + zoom controls + autoplay auto-advance to images only; reuse top/bottom chrome (filename, counter, metadata, download/open/close); aria labels for media
- [x] Default file activation = Preview: new `fileActivation.ts` + test (`resolveFileActivation`: previewable → preview, else download); wire into `ExplorerApp.tsx` `onActivate`; route `VirtualListing.tsx`/`GridListing.tsx` double-click through `onActivate` (Enter already flows via `navigation.open` → `activateSelected`); drop unused listing `href`
- [x] i18n (14 locales): rename `viewer.slideshow.name` → `viewer.preview.name`, set `viewer.category` → "Preview"; `design/design.md` §1/§3/§6 — replace "images-only" preview wording with the generalized image/video/audio direction + deferred roadmap; `e2e/tests/smoke.spec.ts` palette "Slideshow" → "Preview"
- [x] Run `pnpm test` + `pnpm build`; fix failures; bump patch version in `Cargo.toml`
- [x] `imagePaths.ts` + test: extend `PreviewKind` with `pdf`, `text`, `markdown`; add `.svg` to image extensions; define extension sets (pdf: `.pdf`; markdown: `.md`/`.markdown`; text: common source/log/data incl. `.html`/`.htm` as source-only); update `previewKind`/`isPreviewable` tests
- [x] `previewTextContent.ts` + test: `fetchPreviewText(url, maxBytes)` — fetch via download URL, UTF-8 decode, truncate with flag when over cap (default 512 KiB); register in `pnpm test`
- [x] Add `marked` + `dompurify`; `renderMarkdown.ts` + test: parse markdown to HTML, sanitize (strip scripts/event handlers/unsafe URLs); register in `pnpm test`
- [x] `SlideshowOverlay.tsx`: render `pdf` via full-viewport `<iframe>`; `text` via scrollable monospace `<pre>`; `markdown` via sanitized HTML scroll pane; loading/error/truncated UI wired to fetch helper
- [x] i18n (14 locales): add `preview.textTruncated`, `preview.textLoadError`, `preview.textTooLarge` (or equivalent) for text/markdown fetch states
- [x] Update `fileActivation.test.ts` + `slideshowPathOrder.test.ts` for pdf/text/markdown/svg paths
- [x] Run `pnpm test` + `pnpm build`; bump patch version in `Cargo.toml`

- [x] `slideshowPathOrder.ts` + test: `resolveViewerPreviewPaths` includes all non-directory files (drop `isPreviewable` filter); update tests for `.zip` and mixed sets
- [x] `fileActivation.ts` + test: files always activate to Preview; update `ExplorerApp.tsx` `onActivate` — open overlay with listing/selection playlist (same path helper), drop local download fallback
- [x] `SlideshowOverlay.tsx`: unsupported kind (`previewKind === null`) shows centered `preview.noPreview` + **View as text** button; button triggers existing text fetch/`pre` UI (reset on slide change); reuse truncation/error strings
- [x] i18n (14 locales): add `preview.viewAsText` button label; wire `preview.noPreview` in overlay
- [x] `ExplorerApp.tsx` + context keys: `viewer.preview-count` counts all non-dir files via updated path helper (Space/context menu available for any file selection)
- [x] Update `fileActivation.test.ts`, `slideshowPathOrder.test.ts`, `keybindings.test.ts` if needed
- [x] Run `pnpm test` + `pnpm build`; bump patch version in `Cargo.toml`

- [x] `quickFilter.ts`: replace `isPlainQuickFilterLetterKey` with `isQuickFilterTypeaheadKey` — printable chars except `\` and Space, plus `/`; Shift allowed; no Ctrl/Meta/Alt
- [x] `ExplorerApp.tsx`: wire type-to-filter handler to new helper
- [x] `quickFilter.test.ts`: cover digits, symbols, `/`, Shift symbols, rejects Space/`\`/modifiers/control keys
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `quickFilter.ts`: parse regex mode like JS `/pattern/flags` — first unescaped closing `/` delimits pattern; `i` flag for case-insensitivity; no closing `/` keeps open-ended pattern
- [x] `quickFilter.test.ts`: closing `/`, `/i/`, `//`, escaped trailing slash, `/foo/i/` flag edge cases
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `SlideshowOverlay.tsx`: center PDF iframe (shared stage flex centering + max-width wrapper like text preview)
- [x] Run `pnpm test` + `pnpm build`; bump patch version in `Cargo.toml`

- [x] `gridListingLayout.ts` + tests: virtual rows (headers + card rows), section folder count, section-aware grid index moves, entry content positions for marquee
- [x] `listingMarqueeSelect.ts` + tests: grid marquee/hit-test via shared layout metrics (sectioned + flat)
- [x] `GridListing.tsx` + `ExplorerApp.tsx`: folders-first two-section grid; pass sort order; wire section folder count into keyboard nav deps
- [x] `listingGridNavigation.ts`: optional section folder count for arrow keys at section boundaries
- [x] i18n (14 locales): `listing.grid.sectionFolders` and `listing.grid.sectionFiles`
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `GridListing.tsx`: use bold styling for folder/file section headers; bump patch version in `Cargo.toml`

- [x] `GridListing.tsx`: dim grid section header labels; bump patch version in `Cargo.toml`

- [x] `gridListingLayout.ts`: `GridListingLayoutMetrics.virtualRows` → `readonly GridVirtualRow[]` (fix cloud build TS4104)
- [x] Run `pnpm test` + `pnpm build:cloud`

- [x] `asyncVisualDelay.ts` + `useOperationPending.ts`: shared 300ms delayed visual flag; unit tests
- [x] `operationPendingGuard.ts` + `contextKeys`: `operation.pending` key; invoke guard for blocked async actions
- [x] `invoke.ts` + `useActionSystem` + `ActionConfirmDialog`: confirm stays open with delayed spinner
- [x] `ExplorerApp.tsx`: wire pending hook into contextKeys, action system, download/rename-replace paths
- [x] `useExplorerFileOps.ts`: wrap inline rename commit; expose `renameCommittingPath`
- [x] `InlineNameInput` + listings: disabled input + row spinner while committing
- [x] i18n (14 locales): `actions.confirm.working`; run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `upload-queue.ts`: `removeDoneUploadItem` helper + `clearDone` callback (done rows only)
- [x] `UploadPanel.tsx` + `UploadIndicator.tsx` + `ExplorerApp.tsx`: per-row dismiss X on Done queue rows; wire `onClearDone`
- [x] i18n (14 locales): `upload.clearDone` aria label; unit test for `removeDoneUploadItem`; run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `icons.ts`: map `selection.copy-paths` to `CopySlash` (replace `ListFilter`)
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `ActionConfirmDialog.tsx`: delay "Working…" label until `showExecutingVisual` (300ms); keep Confirm disabled immediately
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `ExplorerBreadcrumb.tsx`: quick-filter tooltip on inline-end `?` only (× then `?`); remove whole-input trigger; help text always
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `ExplorerBreadcrumb.tsx`: shrink inline-end × and `?` slot widths
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `ExplorerBreadcrumb.tsx`: replace help `?` text with `CircleQuestionMark` icon
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `QuestionMarkIcon.tsx`: custom quick-filter help SVG (Lucide-like props)
- [x] `ExplorerBreadcrumb.tsx`: swap `CircleQuestionMark` for `QuestionMarkIcon`
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `ExplorerApp.tsx`: render `<Toaster />` as a sibling of `<main>`, not inside the flex column
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `StatusBar.tsx`: remove card surface (`bg-card`, `rounded-xl`, `px-3`) and offline `bg-destructive/10` tint
- [x] `e2e/tests/smoke.spec.ts`: drop status-bar `bg-destructive` class assertion; offline still via BackendStatus role
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `StatusBar.tsx`: flatten to two-child root (`justify-between`, `w-full min-w-0`, no `h-9`); left cluster + right version wrapper
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `listingSwipeRangeSelect.ts` + tests: swipe-range helpers (touch + selection mode gate, anchor→target index range)
- [x] `useListingSwipeRangeSelect.ts`: touch swipe range in selection mode; suppress post-swipe click
- [x] `useListingMarqueeSelect.ts`: skip marquee drag on `pointerType === "touch"`; gate empty-click clear via option
- [x] `ExplorerApp.tsx`: `selectionMode` state + header Select/Done; tap toggles in mode; compose swipe + marquee handlers; exit on navigate
- [x] i18n (14 locales): `selection.mode.enter` / `selection.mode.done`
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `cli.rs`: add `--share-host` (`ServeArgs`); hostname only (no port)
- [x] `browser.rs` + tests: wildcard share-host resolution (CLI → `$HOSTNAME` → external IP → localhost note)
- [x] `transport.rs`: pass `share_host` into `public_share_url` for banner, QR, and browser-open
- [x] Integration tests: banner shows `--share-host` and `$HOSTNAME` fallback on `0.0.0.0` + `--token`
- [x] Run `cargo test`; bump patch version in `Cargo.toml`

- [x] `ExplorerBreadcrumb.tsx`: quick-filter `InputGroup` — no border, `bg-background`, no shadow; leave focus ring unchanged
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `ExplorerBreadcrumb.tsx`: address-bar edit mode uses same flat `InputGroup` styling as quick filter; shared class constant
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `ExplorerBreadcrumb.tsx`: below `sm`, stack quick filter full-width on second row; row 1 nav + breadcrumb only
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `listingTouchSelect.ts` + tests: `shouldTouchTapActivate` / `shouldClearTouchSelectionOnBrowse`
- [x] `ExplorerApp.tsx`: track last listing `pointerType`; touch browse → single-tap activate, no selection; clear selection on Done (touch)
- [x] `GridListing.tsx` + `VirtualListing.tsx`: skip `onDoubleClick` activate when last pointer is touch
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `ExplorerBreadcrumb.tsx`: narrow collapsed ListFilter icon on address row; focus/typeahead expands filter over breadcrumb; active icon when filtered
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `MenuBar.tsx`: below `sm`, hide horizontal menubar; show ghost size-7 `Menu` icon with tooltip (`actions.menuBar.label`); dropdown uses category submenus with same items, icons, shortcuts, and empty-category hiding as desktop
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [x] `breadcrumbCollapse.ts` + tests: middle-segment collapse helpers
- [x] `ExplorerBreadcrumb.tsx`: ResizeObserver progressive collapse, … dropdown for hidden segments, truncate last segment
- [x] i18n (14 locales): `breadcrumb.hiddenSegmentsMenu`; wire label in `ExplorerApp.tsx`
- [x] Run `pnpm test`; bump patch version in `Cargo.toml`

- [ ] `MenuBar.tsx`: switch collapsed menu icon breakpoint from `sm` to `md` (768px)
- [ ] Run `pnpm test`; bump patch version in `Cargo.toml`
