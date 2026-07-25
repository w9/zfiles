# zfiles

`zfiles` is a modern, web-based file explorer packed into a single, zero-dependency binary. Think of it as a much faster, fully-featured `python -m http.server` that also supports file uploads.

Written in Rust, the sub-10MB executable boots the UI in under 10ms, regardless of directory size. Just type `zfiles` to instantly manage your files. It features a multilingual UI that works across screen sizes and input devices, ships with basic security defaults, and plays perfectly with VSCode's Remote SSH and `xdg-open` wiring.

https://github.com/user-attachments/assets/232764c6-a090-4565-b696-3aea36209732

## Highlights

- **Single static binary (local mode)** — React UI embedded via `rust-embed`; drop a musl build on Linux and run.
- **Same explorer, three backends** — Shared React code talks to a local kernel, the browser's own IndexedDB storage, or directly to S3/R2 through one `ExplorerBackend` interface.
- **Instant cold start** — No directory scan, index build, or cache warm-up on startup; time-to-first-byte stays under the design SLA regardless of tree size.
- **Wire-speed transfers** — Linux downloads use `sendfile(2)` on the hot path; uploads use tus with atomic rename completion; cloud mode uses S3 multipart and Range GET.
- **Resumable everywhere that matters** — HTTP Range on download, tus PATCH on upload, CLI `zfiles upload --resume` for pushing files to a remote instance.
- **Virtual-scrolled listings** — List and grid views stay responsive on huge directories without loading the full tree into the DOM.
- **Works across screen sizes and input devices** — Phone through desktop layouts; mouse+keyboard and touch.
- **Keyboard-first power UI** — Command palette, J/K navigation, Shift+J/K range select, marquee rubber-band selection, copy/cut/paste file ops.
- **Fullscreen preview** — Dimmed overlay for images and other browser-native media: zoom, drag/pinch pan, metadata; with a multi-file selection, prev/next and arrow keys step through the set; Space opens preview in grid view.
- **Public LAN access built in** — Bind `0.0.0.0`, auto-generate a token, print a public URL and terminal QR code for phones and laptops on the network.
- **Live refresh** — Filesystem watch pushes `filesystem_changed` over WebSocket; the current listing updates in place.
- **Cloud mode without a zfiles server** — Static SPA only. It opens into browser storage with nothing to configure; buckets are connections you attach, and their keys are only saved if you ask.

## Install

**Linux (recommended):**

```bash
curl -fsSL https://raw.githubusercontent.com/w9/zfiles/main/scripts/install.sh | sh
```

Installs the latest musl release into `~/.local/bin` (no sudo). Ensure that directory is on your `PATH`, then run `zfiles ~/Downloads`.

**Manual download** — static musl tarballs (x86_64 and aarch64) are on [GitHub Releases](https://github.com/w9/zfiles/releases):

```bash
curl -fsSL -o zfiles-linux-x86_64.tar.gz \
  https://github.com/w9/zfiles/releases/latest/download/zfiles-linux-x86_64.tar.gz
tar -xzf zfiles-linux-x86_64.tar.gz
./zfiles ~/Downloads
```

**From source:**

```bash
cargo build --release
./target/release/zfiles ~/Downloads
```

Optional: `./scripts/install-local.sh` installs a local build to `~/.cargo/bin`.

**Cloud SPA:** build with `cd web && pnpm install && pnpm build:cloud`, then deploy `web/dist-cloud/` to any static host. See [docs/cloud-connect.md](docs/cloud-connect.md) for credentials and [docs/cors.md](docs/cors.md) for bucket CORS.

Open the URL from the startup banner (local mode opens your browser by default). The header includes connection status, theme (light / dark / auto), and a language selector for 14 locales — English, Simplified and Traditional Chinese, Spanish, French, Italian, Portuguese, Russian, German, Japanese, Korean, Turkish, Indonesian, and Vietnamese. Switch in the menu or pass `?lang=` in the URL (for example `?lang=fr` or `?lang=zh-TW`).

## More features

- UI i18n — 14 locales in the header language menu; preference saved in `localStorage`; `?lang=` overrides on load
- Quick filter in the address bar — type for case-insensitive substring, `/pat` for case-sensitive regex, `/pat/i` for case-insensitive regex; `?` icon shows syntax help (including `/^name$` for whole-name); Mod+F focus, ESC clears; no separate toggles or fade mode
- Inline rename (F2) and new-folder creation in list and grid views
- Context menu on rows and empty folder background; right-click outside selection retargets before open
- Clipboard copy/cut/paste with conflict and destination dialogs; batch paste settings
- Drag-and-drop — move or copy items in the explorer; drop files from your OS to upload
- Image preview for common formats in the preview pane; other types show metadata and download
- Fullscreen preview — open from the context menu or Space on a file; fit/1:1 zoom with live percentage, drag and pinch pan; with two or more files selected, prev/next (and arrows) step through the selection; download and open-in-new-tab; optional start-at-active-item setting
- Material Icon Theme file-type icons (generated at build time)
- Read-only mode when the serve root is not writable; explicit `--read-only` for public LAN serves
- Symlink policy: follow outbound symlinks on localhost by default; stricter defaults on public binds
- Token auth for non-loopback binds; bearer token, query token, or auth cookie
- Background daemon — single folder or multi-share `daemon.toml`
- Per-folder and global config via `zfiles config` under `~/.config/zfiles/` (XDG; nothing written into the served tree)
- `zfiles upload` CLI for resumable push to a remote zfiles server
- Frontend dev loop — Vite HMR via `cargo dev-frontend` without rebuilding embedded assets each edit
- Performance and integration test suites with fixture corpora and SLA baselines

## Dual-mode architecture

Local mode ships as one process: axum serves REST, tus upload, WebSocket events, and the embedded SPA from a single musl-friendly binary. Cloud mode is the same React explorer with no kernel in the request path: it mounts `BrowserBackend` (IndexedDB on your device) on first paint and swaps in `S3Backend` when you activate a bucket connection. Credentials are validated with `HeadBucket`, kept in memory unless you tick **Remember keys on this device**, and sent only to the cloud provider’s API. The UI, action system, selection model, and preview pane are shared; mode differences live behind the backend interface and build entry points (`main-local.tsx` vs `main-cloud.tsx`).

Because a public HTTPS page cannot reliably call `http://127.0.0.1:<port>` (mixed content and Private Network Access), local filesystem mode always opens the embedded app on localhost. Cloud mode is meant for self-hosted static deploys or a future hosted origin — not as a remote control panel for your laptop’s disk.

## Instant cold start and the no-index kernel

The load-bearing invariant for the CLI is that startup never scales with directory size. The sequence is parse args, merge XDG config if present, bind the listener, optionally spawn the browser, and serve — no scan, no subprocess farm, no SQLite warm-up beyond what tus needs on first upload. XDG directories are created lazily on first write, so pointing zfiles at a fresh git clone or read-only mount leaves the tree untouched.

Listings are raw `read_dir` results returned in tens of milliseconds; the WebSocket watch layer notifies the UI when something changes on disk. Plugins, filename search, thumbnails, and content sniffing were deliberately removed from scope — the kernel interprets paths and bytes on the wire, not file formats.

## High-throughput resumable transfers

Downloads expose HTTP Range; on Linux the kernel uses `sendfile(2)` for zero-copy file-to-socket transfer on whole-file or single-range requests, falling back to streaming reads for multi-range cases. Uploads use tus: the client creates an upload, appends with PATCH and `Content-Range`, and completion is an `fsync` plus atomic `rename` into the served tree (same-filesystem spool required; the kernel warns on cross-mount setups).

Cloud uploads run S3 multipart from the browser via `@aws-sdk/lib-storage`; downloads use Range GET. Any HTTP client that speaks Range or tus can talk to the local kernel — including `curl --continue-at` and the bundled `zfiles upload` command with `--resume`.

## Public LAN access and auth

To expose a folder on the network, use the public preset: `zfiles --public -p 8080` (binds `0.0.0.0`, enables token auth and a terminal QR code). Equivalent: `zfiles -b 0.0.0.0 -p 8080 -t -q`. The startup banner prints a public URL; clients authenticate with the token in the query string, `Authorization: Bearer`, or an HTTP-only cookie set on first visit. Add `--read-only` (or `-r`) for public serves that should list and download but not mutate.

Non-loopback binds reject symlinks that escape the serve root by default (`follow_symlinks_outside_root` is off unless you opt in). `/api/health` reports `read_only` and symlink policy. Session tokens for auth are in-memory with expiry — no session table on disk.

## FAQ

**Why is there no filename search?** Search implied an index or recursive scan that fights the instant-start and no-metadata-in-your-repo goals. Quick filter narrows the *current* listing client-side; it is not a global search.

**Why no plugins?** The previous plugin supervisor and JSON-RPC model were removed to keep the kernel small and the security surface predictable. Built-in file actions (`delete`, `mkdir`, `rename`, `copy`, `move`) cover explorer workflows; preview stays client-side for common media types.

**Local mode or cloud mode?** Use the binary when the files live on a machine you control and you want public LAN access, tus upload, or a single artifact to copy around. Use the cloud SPA when objects already live in S3 or R2 and you only need temporary credentials in the browser — or when you just want a scratch filesystem in the browser with nothing to install.

**Is it safe to expose on my LAN?** Use `--token` on any non-loopback bind, prefer `--read-only` when writes are not needed, and treat the printed URL like a password. There is no built-in TLS on the kernel listener yet — terminate TLS at a reverse proxy if you expose beyond a trusted network.

**What platforms are supported?** v1 targets Linux (x86_64 and aarch64 musl releases). The kernel routes filesystem work through an `Fs` trait so macOS and Windows ports can land without rewriting the center.

**Where does zfiles store its state?** Under XDG paths — typically `~/.config/zfiles/` for config and tus spools, not inside the folder you serve. See [design/config_and_cache.md](design/config_and_cache.md).

**Can I browse multiple folders at once?** Yes — run separate instances on different ports, or use `zfiles daemon start --config ~/.config/zfiles/daemon.toml` with multiple `[[share]]` entries.

## Documentation

| Topic | Location |
|-------|----------|
| Architecture, invariants, testing strategy | [design/design.md](design/design.md) |
| Dual-mode migration and module layout | [design/dual_mode_refactor.md](design/dual_mode_refactor.md) |
| XDG config, tus spools, per-folder state | [design/config_and_cache.md](design/config_and_cache.md) |
| Action system and keyboard commands | [design/action_system.md](design/action_system.md) |
| Browser storage, connections, URL params, credentials | [docs/cloud-connect.md](docs/cloud-connect.md) |
| Bucket CORS for the cloud SPA | [docs/cors.md](docs/cors.md) |

### Kernel HTTP API (local mode)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check (`read_only`, `follow_symlinks_outside_root`) |
| `/api/list?path=` | GET | Directory listing |
| `/api/actions` | POST | Built-in file actions (`file.delete`, `file.mkdir`, `file.rename`, `file.copy`, `file.move`) |
| `/api/metadata?path=` | GET | File or directory metadata |
| `/api/file?path=` | GET | Download file (supports `Range`) |
| `/api/upload` | POST | Create tus upload |
| `/api/upload/:id` | PATCH, HEAD | Resume / query tus upload |
| `/api/ws` | GET (upgrade) | Live kernel events |

## Authors, license, contributing

**Author:** Xun Zhu

**License:** [MIT](LICENSE)

**Contributing:** Bug reports and pull requests are welcome on [GitHub](https://github.com/w9/zfiles). Read [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and expectations.
