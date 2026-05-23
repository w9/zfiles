## High-level plan next

Fix table listing column overflow so cell text stays within column bounds; then continue explorer polish (deletion, human-readable sizes) and viewer work from design.

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
- [ ] Table listing: clip/truncate cell text so columns do not bleed into neighbors
- [ ] Align header row column widths with body; verify long names, dates, and extra labels
- [ ] Rebuild `web/dist` after listing layout fix
