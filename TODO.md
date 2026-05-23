## High-level plan next

Polish explorer listing UX: thumbnails replace file-type icons where available, tighten table layout after the Extra column removal, and keep bundled-plugin preview polish stable.

## TODO List

- [x] Kernel: pass `tier` through `thumbnailer/generate` and `/api/thumbnail?tier=`; prefetch grid tier
- [x] Rust `image-thumbnailer` plugin: JSON-RPC loop, WebP grid/preview pipeline, SHA-256 cache, SQLite index
- [x] Plugin: EXIF orientation, megapixel cap, watcher index invalidation, lister EXIF in `extra`
- [x] Plugin manifest, `viewer.js` image viewer, and manifest actions (regenerate, copy-path context)
- [x] Frontend: PreviewPane mounts image viewer without text preview; listing uses grid-tier thumbnails
- [x] Integration tests with real image fixture; conformance passes; rebuild `web/dist`
- [x] Run full `cargo test`, web unit tests, and E2E smoke
- [x] Kernel + frontend: load plugin `locales/` bundles and resolve manifest action labels
- [x] Explorer grid view mode with thumbnail tiles and table/grid toggle
- [x] Image viewer bridge + manifest keyboard actions (next/prev, zoom, fullscreen, slideshow)
- [x] Slideshow full-screen overlay action for images in directory or selection
- [x] `thumbnailer-raw` sibling plugin (RAW globs, rawloader decode, WebP cache)
- [x] `thumbnailer-heic` sibling plugin (HEIC globs, libheif decode, WebP cache)
- [x] Tests, E2E smoke for grid toggle and slideshow; rebuild `web/dist`
- [x] Table listing: clip/truncate cell text so columns do not bleed into neighbors
- [x] Align header row column widths with body; verify long names, dates, and extra labels
- [x] Rebuild `web/dist` after listing layout fix
- [x] Writable probe helper and XDG fallback path for relocated dot-folders
- [x] `plan_serve_layout`: auto read-only when serve root is not writable; pick effective dot-folder
- [x] Wire layout into `transport::serve`, startup banner, and mount warning when dot-folder is missing
- [x] Unit tests for layout planning (writable root vs read-only root with XDG fallback)
- [x] Integration test: read-only serve root lists successfully and `/api/health` reports `read_only: true`
- [x] Document automatic read-only + relocated state in README
- [x] `build.rs`: stage `image-thumbnailer` (manifest, viewer.js, locales, binary) into `bundled/`
- [x] `bundled_plugins` module: rust-embed, extract to `~/.cache/zfiles/bundled/`, discover after folder/home plugins
- [x] Wire bundled discovery into `PluginSupervisor::discover` behind default `bundled-plugins` feature
- [x] Tests: materialize idempotency + integration test discovers bundled viewer without manual install
- [x] Document bundled plugin build order and cache location in README
- [x] `listingIconPrefix`: omit file/folder emoji when a thumbnail URL is present
- [x] VirtualListing name cell: show thumbnail only (no emoji); fix 4-column grid template
- [x] Unit tests for `listingIconPrefix` (thumbnail, file, directory)
- [x] Rebuild `web/dist` after listing icon change
- [x] Run full `cargo test` and web unit tests
