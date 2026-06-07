# zfiles

zfiles is a file explorer written in Rust. Local mode ships as a statically linked musl binary under 10 MB — embedded UI included, no runtime dependencies — that you point at a folder and open in the browser. Cloud mode is the same UI built as a static SPA for S3-compatible buckets (AWS S3, Cloudflare R2). There is no indexing step, no plugin host, and no filename search; listings come straight from the filesystem or object store, and the kernel cold-starts in milliseconds even when the served tree holds millions of entries. If you want a Finder-style shell that respects `sendfile(2)`, tus resume, and “don’t touch my repo with dot-metadata,” this is the shape of tool.

## Highlights

- **Single static binary (local mode)** — React UI embedded via `rust-embed`; drop a musl build on Linux and run.
- **Same explorer, two backends** — Shared React code talks to a local kernel or directly to S3/R2 through one `ExplorerBackend` interface.
- **Instant cold start** — No directory scan, index build, or cache warm-up on startup; time-to-first-byte stays under the design SLA regardless of tree size.
- **Wire-speed transfers** — Linux downloads use `sendfile(2)` on the hot path; uploads use tus with atomic rename completion; cloud mode uses S3 multipart and Range GET.
- **Resumable everywhere that matters** — HTTP Range on download, tus PATCH on upload, CLI `zfiles upload --resume` for pushing files to a remote instance.
- **Virtual-scrolled listings** — List and grid views stay responsive on huge directories without loading the full tree into the DOM.
- **Keyboard-first power UI** — Command palette, J/K navigation, Shift+J/K range select, marquee rubber-band selection, copy/cut/paste file ops.
- **LAN sharing built in** — Bind `0.0.0.0`, auto-generate a token, print a share URL and terminal QR code for phones and laptops on the network.
- **Live refresh** — Filesystem watch pushes `filesystem_changed` over WebSocket; the current listing updates in place.
- **Cloud mode without a zfiles server** — Static SPA only; temporary bucket credentials stay in `sessionStorage` and go straight to AWS/Cloudflare.

## Install

**Pre-built Linux binaries** (static musl, x86_64 and aarch64) are on [GitHub Releases](https://github.com/w9/zfiles/releases):

```bash
chmod +x zfiles-linux-x86_64
./zfiles-linux-x86_64 ~/Downloads
```

**From source:**

```bash
cargo build --release
./target/release/zfiles ~/Downloads
```

Optional: `./scripts/install-local.sh` installs to `~/.cargo/bin`.

**Cloud SPA:** build with `cd web && pnpm install && pnpm build:cloud`, then deploy `web/dist-cloud/` to any static host. See [docs/cloud-connect.md](docs/cloud-connect.md) for credentials and [docs/cors.md](docs/cors.md) for bucket CORS.

Open the URL from the startup banner (local mode opens your browser by default). The header includes connection status, theme (light / dark / auto), and language (English or 简体中文).

## More features

- Quick filter in the address bar — case-sensitive toggle, whole-word match, regex mode, Mod+F focus
- Inline rename (F2) and new-folder creation in list and grid views
- Context menu on rows and empty folder background; right-click outside selection retargets before open
- Clipboard copy/cut/paste with conflict and destination dialogs; batch paste settings
- Image preview for common formats in the preview pane; other types show metadata and download
- Material Icon Theme file-type icons (generated at build time)
- Read-only mode when the serve root is not writable; explicit `--read-only` for LAN shares
- Symlink policy: follow outbound symlinks on localhost by default; stricter defaults on public binds
- Token auth for non-loopback binds; bearer token, query token, or auth cookie
- Background daemon — single folder or multi-share `daemon.toml`
- Per-folder and global config via `zfiles config` under `~/.config/zfiles/` (XDG; nothing written into the served tree)
- `zfiles upload` CLI for resumable push to a remote zfiles server
- Frontend dev loop — Vite HMR via `cargo dev-frontend` without rebuilding embedded assets each edit
- Performance and integration test suites with fixture corpora and SLA baselines

## Dual-mode architecture

Local mode ships as one process: axum serves REST, tus upload, WebSocket events, and the embedded SPA from a single musl-friendly binary. Cloud mode is the same React explorer compiled with `S3Backend` instead of `KernelBackend` — no kernel in the request path for object storage. Credentials entered in the connect dialog are validated with `HeadBucket`, stored in tab-scoped `sessionStorage`, and sent only to the cloud provider’s API. The UI, action system, selection model, and preview pane are shared; mode differences live behind the backend trait and build entry points (`main-local.tsx` vs `main-cloud.tsx`).

Because a public HTTPS page cannot reliably call `http://127.0.0.1:<port>` (mixed content and Private Network Access), local filesystem mode always opens the embedded app on localhost. Cloud mode is meant for self-hosted static deploys or a future hosted origin — not as a remote control panel for your laptop’s disk.

## Instant cold start and the no-index kernel

The load-bearing invariant for the CLI is that startup never scales with directory size. The sequence is parse args, merge XDG config if present, bind the listener, optionally spawn the browser, and serve — no scan, no subprocess farm, no SQLite warm-up beyond what tus needs on first upload. XDG directories are created lazily on first write, so pointing zfiles at a fresh git clone or read-only mount leaves the tree untouched.

Listings are raw `read_dir` results returned in tens of milliseconds; the WebSocket watch layer notifies the UI when something changes on disk. Plugins, filename search, thumbnails, and content sniffing were deliberately removed from scope — the kernel interprets paths and bytes on the wire, not file formats.

## High-throughput resumable transfers

Downloads expose HTTP Range; on Linux the kernel uses `sendfile(2)` for zero-copy file-to-socket transfer on whole-file or single-range requests, falling back to streaming reads for multi-range cases. Uploads use tus: the client creates an upload, appends with PATCH and `Content-Range`, and completion is an `fsync` plus atomic `rename` into the served tree (same-filesystem spool required; the kernel warns on cross-mount setups).

Cloud uploads run S3 multipart from the browser via `@aws-sdk/lib-storage`; downloads use Range GET. Any HTTP client that speaks Range or tus can talk to the local kernel — including `curl --continue-at` and the bundled `zfiles upload` command with `--resume`.

## LAN sharing and auth

To expose a folder on the network, bind all interfaces and require a token: `zfiles --host 0.0.0.0 --port 8080 --token`. The startup banner prints a share URL and a scannable terminal QR code; clients authenticate with the token in the query string, `Authorization: Bearer`, or an HTTP-only cookie set on first visit. Add `--read-only` for shares that should list and download but not mutate.

Non-loopback binds reject symlinks that escape the serve root by default (`follow_symlinks_outside_root` is off unless you opt in). `/api/health` reports `read_only` and symlink policy. Session tokens for auth are in-memory with expiry — no session table on disk.

## FAQ

**Why is there no filename search?** Search implied an index or recursive scan that fights the instant-start and no-metadata-in-your-repo goals. Quick filter narrows the *current* listing client-side; it is not a global search.

**Why no plugins?** The previous plugin supervisor and JSON-RPC model were removed to keep the kernel small and the security surface predictable. Built-in file actions (`delete`, `mkdir`, `rename`, `copy`, `move`) cover explorer workflows; preview stays client-side for common images.

**Local mode or cloud mode?** Use the binary when the files live on a machine you control and you want LAN sharing, tus upload, or a single artifact to copy around. Use the cloud SPA when objects already live in S3 or R2 and you only need temporary credentials in the browser.

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
| Cloud connect flow, URL params, credentials | [docs/cloud-connect.md](docs/cloud-connect.md) |
| Bucket CORS for the cloud SPA | [docs/cors.md](docs/cors.md) |
| Implementation checklist | [TODO.md](TODO.md) |

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
