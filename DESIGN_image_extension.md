## Capability composition

The plugin registers four capabilities:

- **`thumbnailer`** for `*.jpg, *.jpeg, *.png, *.webp, *.gif, *.avif, *.tiff, *.tif, *.bmp` — generates thumbnail bytes on request
- **`viewer`** for the same globs — provides the full-image preview UI in the preview pane
- **`action`** for image-specific operations (navigation, zoom, regenerate)
- **`watcher`** subscribed to changes under the served root, used to invalidate cache when source files change

This is a useful pattern for the plugin contract: a single plugin process can multiplex many capabilities. The kernel dispatches each capability request to the right handler within the plugin.

## Implementation language

Rust. The plugin is shipped as a static binary that gets dropped into `.zfiles/plugins/image-thumbnailer/bin/`. The arguments for Rust here are concrete: the `image` crate handles every v1 format with no native dependencies, decoding performance matters, and we want zero runtime requirements on the host. Python with Pillow would work but adds a Python runtime requirement that defeats the single-binary spirit. Go is also reasonable but the Rust ecosystem is stronger for the image-specific work.

For v1 the format list is whatever the `image` crate handles natively: JPEG, PNG, WebP, GIF, AVIF, TIFF, BMP, ICO. RAW (NEF, CR2, ARW, etc.) and HEIC are deferred because they require additional dependencies (`rawler` for RAW; `libheif` for HEIC, which is C and patent-encumbered). When users need those, they install separate plugins (`zfiles-thumbnailer-raw`, `zfiles-thumbnailer-heic`) that follow the same pattern. The kernel's capability registry handles overlap fine.

## Thumbnail pipeline

Three size tiers, all WebP-encoded:

| Tier | Max dimension | Use case |
|---|---|---|
| `grid` | 256 px | File list in grid view mode |
| `preview` | 1024 px | Hover preview, inline display |
| `full` | not cached | Served from source (Range-streamed by kernel) |

WebP because it's 25–35% smaller than JPEG at equivalent quality, has alpha support, and renders everywhere. The cost is encode CPU, which only happens once per (file × tier).

The cache is **content-addressed**, not path-addressed. The cache key is `sha256(file_bytes) + tier_id`. This has two important properties: renames and moves don't invalidate the cache (the bytes haven't changed), and duplicate files share a cache entry. The cost is needing to hash the file once before generating a thumbnail — but since you're about to read the file anyway for decoding, you fold the hash into the read loop with negligible overhead.

The plugin maintains a small SQLite index at `.zfiles/plugins/image-thumbnailer/data/index.db` mapping `(source_path, mtime) → content_hash`. When a thumbnail is requested for a path, the plugin checks the index: if `mtime` matches what's recorded, it serves from the cached hash directly. If `mtime` differs, it re-hashes and updates the index. This avoids re-hashing on every request while still detecting changes.

Layout under the plugin's storage directory:

```
.zfiles/plugins/image-thumbnailer/data/
  index.db                          path→hash mapping
  cache/
    aa/bb/<full-hash>-grid.webp     two-level sharding
    aa/bb/<full-hash>-preview.webp
```

The two-level sharding avoids the "100k files in one directory" performance cliff on common filesystems.

## Decoding performance

Three non-obvious things matter here.

**Don't decode the full image.** For JPEGs, use `libjpeg-turbo`'s DCT scaling to decode directly to 1/2, 1/4, or 1/8 size — typically 4–10× faster than full decode + downsample. The `mozjpeg` or `turbojpeg` crates expose this; pure-Rust `image` crate is improving here but still slower. For PNG and AVIF, you'll typically pay full decode cost; mitigate by parallelism.

**Cap input dimensions before decode.** Images larger than ~100 megapixels can OOM a decoder, intentionally or accidentally. The plugin should sniff dimensions from the header before allocating, reject anything above a threshold (configurable, default 200 MP), and log a warning. This is the standard "image bomb" defense.

**Honor EXIF orientation.** JPEGs commonly carry an orientation tag that says "this image should be rotated 90° / mirrored / etc." Cameras write it because rotating the sensor data is more expensive than tagging it. If you generate a thumbnail without applying the orientation, portrait photos display sideways. Read the EXIF orientation, apply it during downsampling, and strip the tag from the output WebP so it isn't double-applied by the browser.

A worker pool (Rayon) sized to physical cores handles parallel generation. The plugin's JSON-RPC loop sits in front; requests get queued to the pool; results return over stdout. Cap concurrent in-flight generations to avoid runaway memory on bursts.

## Cache invalidation

The plugin subscribes to the kernel's filesystem watch service for the served root. On file events:

- **Modified**: `mtime` change in index doesn't match; next thumbnail request re-hashes
- **Moved**: index updates the path; cache entries remain valid (same content)
- **Deleted**: index removes the path; cache entries become orphans

Orphan thumbnails are collected by a periodic GC task — or on demand via a `regenerate-thumbnails --gc` action. Deferring GC is fine because the cache is small relative to source files; an extra few MB of unused thumbnails is cheap until the user explicitly cleans up.

## The viewer component

The viewer is a React component shipped as an ESM module. The plugin manifest declares a static asset directory; the kernel serves files under `/plugin/image-thumbnailer/` directly without going through the plugin process (this is the right pattern in general — proxying static assets through a JSON-RPC plugin is wasteful).

Manifest entry:

```toml
[viewer]
mime_types = ["image/*"]
component = "viewer.js"
```

The kernel injects the URL into the React shell, which dynamic-imports it and mounts the default export into the preview-pane slot:

```js
// viewer.js
export default function ImageViewer({ path, kernel, dispatch }) {
  // path: current file path
  // kernel: API for fetching files, listing siblings, getting EXIF, etc.
  // dispatch: invoke actions by id
  // React is provided as an external by the host
  ...
}
```

Zoom and pan: I'd use `react-zoom-pan-pinch` rather than rolling your own. It handles mouse wheel, pinch, double-tap-to-zoom, and constrained panning correctly across desktop and mobile. Image source is the `preview` thumbnail at first, swapped to the original full-resolution file once it streams in — gives perceived instant rendering with progressive enhancement.

## Keyboard controls via the action system

This is where the action system pays off. The viewer doesn't define its own keyboard handlers; it registers actions and lets the action system dispatch:

| Action id | Default keybinding | When |
|---|---|---|
| `plugin.image-thumbnailer.next-image` | `→` | `focus.pane == 'preview' && preview.type matches 'image/*'` |
| `plugin.image-thumbnailer.prev-image` | `←` | same |
| `plugin.image-thumbnailer.zoom-in` | `+` or `=` | same |
| `plugin.image-thumbnailer.zoom-out` | `-` | same |
| `plugin.image-thumbnailer.fit-screen` | `0` | same |
| `plugin.image-thumbnailer.actual-size` | `1` | same |
| `plugin.image-thumbnailer.toggle-fullscreen` | `F` | same |
| `plugin.image-thumbnailer.rotate-cw` | `R` | same |
| `plugin.image-thumbnailer.toggle-exif-overlay` | `I` | same |

Users can rebind any of these in their keybindings file. Power users get the palette to discover them. Touch users get on-screen controls that dispatch the same actions. One model, many surfaces.

The viewer component reads its zoom/pan state from React state and dispatches actions that mutate it; the actions are thin wrappers over `setState` calls. This keeps everything funneled through the action system for telemetry, undo (eventually), and consistency.

## Plugin-contributed actions beyond the viewer

A few actions make sense even outside the viewer:

- `plugin.image-thumbnailer.regenerate-thumbnails` — re-process selected files (or the whole tree with no selection)
- `plugin.image-thumbnailer.copy-image-to-clipboard` — for the "I need this image in another app" workflow
- `plugin.image-thumbnailer.slideshow` — opens a full-screen carousel that auto-advances

These appear in the palette under "Image" category and in the context menu when an image is selected.

## EXIF metadata

EXIF reading is in the plugin's natural domain because the plugin already decodes images. I'd surface it through the `lister` capability: when the file list asks for enrichment metadata on an image, the plugin returns parsed EXIF fields (camera, lens, ISO, shutter, focal length, date taken, GPS if present). The frontend can display these as additional columns or in a detail pane.

That said, EXIF could also justifiably be a separate `zfiles-exif-extractor` plugin that works on more file types (some video formats, some PDFs). The lightest design: this plugin handles image EXIF as a convenience; a dedicated metadata plugin handles the broader case. Both can coexist via the kernel's merge of `lister` contributions.

## Gallery / grid view

This is where I'd push back gently against doing too much. The kernel's file list should have a `grid` view mode as a built-in (it's a generic file-list rendering, not image-specific). When a thumbnailer is available for files in the grid, the kernel asks for thumbnails and displays them; when not, it shows generic file-type icons. The image plugin contributes thumbnails to whatever grid view the kernel shows.

A dedicated "gallery" or "lightbox" UI distinct from the kernel's preview pane is the `slideshow` action: a different surface entirely, opened on demand, scoped to image files in the current selection or directory.

This decomposition — grid view in the kernel, thumbnails from any thumbnailer, viewer in the preview pane, slideshow as a dedicated UI — keeps the pieces small and composable. Other plugins (a video thumbnailer, a CAD thumbnailer) benefit from the same grid view without needing to define their own.

## i18n

The plugin ships a `locales/` directory with translations for its action names, EXIF field labels, and any viewer UI strings. The kernel loads these into the plugin's i18n namespace. EXIF tag names themselves aren't translated (they're technical identifiers), but their human-readable labels are.

## Tradeoffs worth flagging

**Pre-generation vs on-demand.** v1 should be lazy — generate thumbnails only when the UI requests them as files scroll into view. Pre-generating eagerly for whole directories is a foot-gun on large photo libraries (10,000 photos × 200 ms per thumbnail = 33 minutes of CPU on first browse). The `regenerate-thumbnails` action gives users an explicit way to opt into pre-generation.

**Hash cost.** Content-addressed caching requires hashing files. For huge images this isn't free. Mitigate by hashing in chunks as you read for decoding, so the hash adds a small CPU overhead but no extra I/O. For files that change mtime but not content (rare — usually `touch`), you re-hash unnecessarily; acceptable.

**Plugin size.** A Rust binary with `image`, `webp`, `rayon`, `rusqlite`, and an EXIF parser will be 5–10 MB. That's fine for a desktop plugin; if it ever became a concern, you could split EXIF and the viewer assets into separate plugins, but I wouldn't optimize for this preemptively.

**Where exactly does video go?** Video thumbnails are a separate plugin (`zfiles-thumbnailer-video`) because the dependencies (ffmpeg or a Rust video decoder like `re_mp4`) are heavyweight and many users don't need them. Same pattern as RAW and HEIC: separate plugins for separate format families, all using the same `thumbnailer` capability shape.

If you wanted to formalize this as a plugin spec doc (similar to how the action system got its own doc), I can write it up — but the above is the substance of how I'd approach it.