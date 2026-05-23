## High-level plan next

Complete image extension follow-ups: explorer grid view, plugin locale bundles via kernel API, slideshow overlay, frontend image-viewer actions with keybindings, and RAW/HEIC sibling thumbnailer plugins. Then polish viewer ESM bridge (`dispatch` + zoom/fullscreen) and expand E2E coverage.

## TODO List

- [x] Kernel: pass `tier` through `thumbnailer/generate` and `/api/thumbnail?tier=`; prefetch grid tier
- [x] Rust `image-thumbnailer` plugin: JSON-RPC loop, WebP grid/preview pipeline, SHA-256 cache, SQLite index
- [x] Plugin: EXIF orientation, megapixel cap, watcher index invalidation, lister EXIF in `extra`
- [x] Plugin manifest, `viewer.js` image viewer, and manifest actions (regenerate, copy-path context)
- [x] Frontend: PreviewPane mounts image viewer without text preview; listing uses grid-tier thumbnails
- [x] Integration tests with real image fixture; conformance passes; rebuild `web/dist`
- [x] Run full `cargo test`, web unit tests, and E2E smoke
- [ ] Kernel + frontend: load plugin `locales/` bundles and resolve manifest action labels
- [ ] Explorer grid view mode with thumbnail tiles and table/grid toggle
- [ ] Image viewer bridge + manifest keyboard actions (next/prev, zoom, fullscreen, slideshow)
- [ ] Slideshow full-screen overlay action for images in directory or selection
- [ ] `thumbnailer-raw` sibling plugin (RAW globs, rawloader decode, WebP cache)
- [ ] `thumbnailer-heic` sibling plugin (HEIC globs, libheif decode, WebP cache)
- [ ] Tests, E2E smoke for grid toggle and slideshow; rebuild `web/dist`
