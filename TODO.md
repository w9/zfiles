## High-level plan next

Make zfiles work on read-only served folders: detect non-writable roots at startup, auto-enable read-only mode, and relocate `.zfiles` state to a writable XDG config path. Then continue explorer polish and viewer work from design.

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
- [ ] Writable probe helper and XDG fallback path for relocated dot-folders
- [ ] `plan_serve_layout`: auto read-only when serve root is not writable; pick effective dot-folder
- [ ] Wire layout into `transport::serve`, startup banner, and mount warning when dot-folder is missing
- [ ] Unit tests for layout planning (writable root vs read-only root with XDG fallback)
- [ ] Integration test: read-only serve root lists successfully and `/api/health` reports `read_only: true`
- [ ] Document automatic read-only + relocated state in README
