# zfiles — design

## 1. Overview

zfiles is a **dual-mode file explorer**: one shared React UI that browses files either on the **local filesystem** (via a Rust CLI) or in **S3-compatible object storage** (S3, Cloudflare R2) directly from the browser.

| Mode | Delivery | Storage | Opens |
|------|----------|---------|-------|
| **Local** | Single static binary; SPA embedded via `rust-embed` | Directory on disk | `http://127.0.0.1:<port>/` |
| **Cloud** | Static SPA hosted at `zfiles.com` (or self-hosted) | S3 / R2 bucket | Connect dialog → explorer |

Run `zfiles` in a directory and the UI opens with no indexing step, no startup delay, and no configuration. Local mode scales from small folders to directories with millions of entries. Cloud mode uses paginated object listing (S3 returns at most 1000 keys per call).

Files can be uploaded by dragging them into the browser. **Local mode:** uploads and downloads are resumable — tus on upload, HTTP Range on download. **Cloud mode:** S3 multipart upload and Range GET. Any HTTP client that supports range requests works against the local kernel, including `curl --continue-at`.

To expose a local folder on the network, run `zfiles --listen 0.0.0.0:8080 --token`. The server prints a URL and a QR code for other devices.

The UI is aimed at power users: keyboard shortcuts, multi-select, virtual-scrolled listings, and a preview pane. Built-in actions (navigation, delete, copy-path, view toggles) are unified through the [action system](action_system.md).

**Local mode** ships as a single static binary. No daemon or config file is required to run (XDG paths are optional; see [config_and_cache.md](config_and_cache.md)).

**Cloud mode** is a static site only — no zfiles server, no accounts. Users paste **temporary** bucket credentials into a connect dialog. Credentials stay in the browser (`sessionStorage`); the host never receives them. Setup: [docs/cloud-connect.md](../docs/cloud-connect.md), CORS: [docs/cors.md](../docs/cors.md).

### What we removed

Plugins and filename search are **out of scope** for the project going forward — not deferred, removed. There is no plugin supervisor, no JSON-RPC subprocess protocol, no `/api/search`, and no bundled thumbnail/search/viewer plugins. Preview is client-side for common image types; everything else shows metadata and a download link.

Implementation phases and migration checklist: [dual_mode_refactor.md](dual_mode_refactor.md).

---

## 2. Technical objectives

zfiles is engineered around these goals. Module boundaries and frontend/backend split follow from them.

- **One explorer, two backends.** A shared frontend library talks to storage through an `ExplorerBackend` interface. Local mode uses `KernelBackend` (REST + WebSocket against the embedded kernel). Cloud mode uses `S3Backend` (AWS SDK v3 in the browser). The UI never forks by mode.
- **Always-instant cold start (local).** Under 100 ms from process spawn to first HTTP response, no matter how large the served directory is. Nothing in the startup path blocks on directory size or cache state.
- **Saturate the wire (local).** Single-connection downloads and uploads hit gigabit Ethernet throughput where hardware allows. Both transfer paths resume from interruption (Range + tus).
- **Small focused kernel (local).** The Rust binary serves filesystem primitives, auth, tus upload, static assets, and filesystem watch — not format interpretation, thumbnails, search, or extensibility hooks.
- **Static cloud deployment.** The hosted SPA is static files only. Bucket credentials are user-supplied and ephemeral. URL params carry **non-secrets** only (bucket, prefix, provider, endpoint, region, read-only flag).
- **Single static binary (local).** One file, with the React frontend baked in. Drop it on a Linux machine and run it.
- **Cross-platform forward compatibility (local kernel).** v1 ships Linux only, but filesystem operations go through an `Fs` trait so macOS and Windows ports don't rewrite the center.

### Always-instant cold start (local mode)

This is the load-bearing invariant for the CLI. Nothing in the startup path may block on work that scales with directory size. The startup sequence is fixed:

1. Parse CLI args (`clap`, sub-millisecond)
2. Load merged config from XDG paths if present; otherwise use defaults (see [config_and_cache.md](config_and_cache.md))
3. Bind the TCP listener
4. Spawn the browser (`xdg-open`, async — we don't wait for it)
5. Begin serving

Conspicuously absent: directory scanning, index building, subprocess spawning, hashing, any filesystem stat work beyond the requested-directory listing. XDG config directories are created lazily on first write, so browsing an arbitrary folder — including a fresh clone — has zero side effects on disk.

A directory listing returns in tens of milliseconds with raw `fs::read_dir` results. The WebSocket may push `filesystem_changed` when the watch service detects changes; the UI refreshes the current listing in place.

Target time-to-first-byte on a modern x86_64 Linux machine: well under 50 ms in practice, leaving headroom on the 100 ms SLA.

### High-throughput resumable transfers

**Local downloads** use HTTP Range requests. The response body is a streaming reader over the file. On Linux, the hot path uses `sendfile(2)` for zero-copy file-to-socket transfer when the request is for a whole file or a single contiguous range; multi-range or transformed responses fall back to `ReaderStream` over `tokio::fs`.

Target throughput: 110+ MB/s sustained on a single connection from local SSD over gigabit.

**Local uploads** use the tus.io protocol. The client issues a Creation request; the server allocates state in `state.db` and returns an Upload URL. PATCH with `Content-Range` appends to a spool file under XDG state (see [config_and_cache.md](config_and_cache.md)). Completion is atomic: `fsync` + `rename(2)` into the served tree (same-filesystem constraint; warn at startup on cross-mount).

**Cloud uploads** use S3 multipart upload via `@aws-sdk/lib-storage` in the browser. **Cloud downloads** use Range GET on `GetObject`. CORS must be configured on the bucket; see [docs/cors.md](../docs/cors.md).

### Small focused kernel (local mode)

The kernel does not interpret file contents. It ships none of:

- thumbnails, viewers, or transcoding
- filename or content search
- file indexing
- content-based MIME sniffing (extension-based guessing only, for `Content-Type` headers)
- plugin lifecycle, JSON-RPC, or bundled extensions

What the kernel ships: HTTP transport, embedded SPA, filesystem primitives (`read_dir`, `stat`, `read`, `write`, delete), tus upload, authentication, per-folder configuration, filesystem watch over WebSocket, and built-in action dispatch (`file.delete`, etc.).

### Single static binary with embedded UI (local mode)

The deliverable for local use is one file: `zfiles`. The React frontend (built by Vite) is embedded via `rust-embed`; axum serves the uncompressed assets from the binary.

Static linking strategy:

- Rust standard library statically links by default.
- SQLite via `rusqlite` `bundled` feature (tus upload state, session tokens).
- TLS (when added) uses `rustls`.
- Linux delivery targets `x86_64-unknown-linux-musl` for true static linking where applicable.

Removing the plugin embed and supervisor reduces binary size; budget remains under 20 MB stripped.

### Cloud static SPA

The cloud build is the same frontend source with `VITE_BOOT_MODE=cloud` (or equivalent): no kernel API assumptions, `S3Backend` wired at boot, connect screen before explorer.

Security model:

- Credentials pasted in UI → validated with `HeadBucket` or minimal `ListObjectsV2` → stored in `sessionStorage`.
- **Disconnect** clears credentials and state.
- `localStorage` may persist non-secret preferences (provider, bucket name, endpoint, theme, locale) — never keys or tokens.
- No analytics or third-party scripts on pages that handle credentials.

The CLI **does not** open `zfiles.com` for local filesystem mode. A public HTTPS page cannot reliably call `http://127.0.0.1:<port>` (mixed content, Private Network Access). Local mode always opens localhost with the embedded SPA.

### Forward-compatible cross-platform foundation (local kernel)

The load-bearing abstraction is the `Fs` trait. Every filesystem operation the kernel performs goes through it. v1 implements Linux; later platforms supply equivalent implementations.

Other portable boundaries: `notify` for watching, `std::path::Path` for all path manipulation, platform-specific browser launch and `sendfile` behind fallbacks.

Unicode normalization differs by OS; the fixture corpus includes NFC, NFD, and mixed cases for future ports.

---

## 3. Architecture

### Dual-mode diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Shared explorer (web/)                      │
│  Listing · breadcrumb · upload UI · preview · actions · i18n  │
└────────────────────────────┬────────────────────────────────────┘
                             │ ExplorerBackend
              ┌──────────────┴──────────────┐
              ▼                             ▼
   ┌─────────────────────┐       ┌─────────────────────┐
   │   KernelBackend     │       │     S3Backend       │
   │ /api/* + WebSocket  │       │ AWS SDK in browser  │
   └──────────┬──────────┘       └──────────┬──────────┘
              ▼                             ▼
   ┌─────────────────────┐       ┌─────────────────────┐
   │  zfiles kernel      │       │  S3 / R2 API        │
   │  (embedded SPA)     │       │                     │
   └─────────────────────┘       └─────────────────────┘
```

UI components depend on `ExplorerBackend`, not on `/api/*` paths or AWS types directly. Boot configuration selects the adapter; there is no parallel component tree per mode.

### `ExplorerBackend` contract

```ts
interface ExplorerBackend {
  readonly mode: "local" | "s3";

  connect?(): Promise<void>;
  disconnect?(): Promise<void>;

  list(path: string, cursor?: string): Promise<ListResult>;
  stat(path: string): Promise<FileStat>;

  downloadUrl(path: string): string | Promise<string>;
  preview?(path: string): Promise<PreviewResult | null>;

  upload(file: File, destPath: string, onProgress?: UploadProgressFn): Promise<void>;
  delete(paths: string[]): Promise<void>;

  subscribe?(handler: BackendEventHandler): () => void;
}

interface ListResult {
  entries: FileEntry[];
  nextCursor?: string;
}
```

`FileEntry` shape is stable across modes: `name`, `path`, `is_dir`, `size`, `modified`. Cloud mode maps object keys to paths with `/` as the folder delimiter (`ListObjectsV2` + `Delimiter: "/"`). Listing is paginated in cloud mode; local `/api/list` may add pagination later for parity.

**Local backend events:** `connected`, `filesystem_changed`, `upload_progress`.

**Cloud backend events:** optional polling; no filesystem watch.

### Module structure (local kernel)

The binary is one OS process. Cross-module dependencies are explicit and minimal.

| Module | Responsibility |
|--------|----------------|
| `transport` | axum server: embedded React assets, REST API, tus upload, Range download, WebSocket events |
| `fs` | `Fs` trait: directory listing, stat, read, write, delete; `LocalFs` via `tokio::fs` |
| `state` | Per-serve-root XDG state: `state.db` (tus uploads, session tokens), config accessors |
| `auth` | Bearer token + session cookie middleware; read-only enforcement |
| `watch` | Filesystem watch → `filesystem_changed` on WebSocket |
| `cli` | `clap` entry point: serve, init, config, status, upload, etc. |

There is no `plugins` module.

### Kernel HTTP API (local mode)

| Route | Purpose |
|-------|---------|
| `GET /api/health` | Status, read-only flag |
| `GET /api/list` | Directory listing |
| `GET /api/metadata` | Stat |
| `GET /api/file` | Range-aware download |
| `POST /api/upload`, `HEAD/PATCH /api/upload/{id}` | tus upload |
| `POST /api/actions` | Built-in actions (`file.delete`, …) |
| `GET /api/ws` | Connection handshake, filesystem watch, upload progress |

Removed: `/api/search`, `/api/plugins*`, `/api/thumbnail`, `/api/preview`, `/plugin/*`, plugin-scoped action routes.

### Request flow (local listing)

1. Handler calls `fs.read_dir` — returns immediately with names, sizes, dates.
2. JSON response to the client; no secondary enrichment pipeline.
3. If `watch` fires for the current path subtree, WebSocket sends `filesystem_changed`; UI reloads listing.

### Frontend strategy

The React UI is compiled by Vite. **Local:** output embedded in the binary; dev mode may proxy to Vite HMR via the `dev-frontend` feature. **Cloud:** static build deployed to CDN or object storage.

- **Backend injection.** `useExplorerBackend()` (or equivalent context) is the only path from components to storage.
- **Preview.** Client-side decode for common images (JPEG, PNG, WebP, GIF). Other types: metadata panel + download link. No dynamic plugin viewer imports.
- **Actions.** Built-in actions only; see [action_system.md](action_system.md). No plugin action registration or `plugin.*` context keys.
- **i18n.** English and Simplified Chinese (`zh-CN`) for all user-visible strings.

### Cloud boot and URL params

Allowed query params (non-secret): `provider` (`aws` / `r2`), `bucket`, `endpoint`, `region`, `prefix`, `readonly`.

Forbidden in URLs: access keys, secret keys, session tokens.

Connect flow, credential scoping, and disconnect: [docs/cloud-connect.md](../docs/cloud-connect.md).

After connect, explorer navigation may update the URL for bucket/prefix only.

### Config, state, and cache (local)

Kernel configuration and durable per-serve-root state live under XDG paths. The served directory is never modified for zfiles housekeeping.

Layout and resolution: [config_and_cache.md](config_and_cache.md). Tus spool and `state.db` remain under per-folder state directories.

### Failure modes

**Local**

- Network interruptions: tus resume on upload; Range resume on download; upload state survives kernel restart via `state.db`.
- Read-only serve root: uploads and delete rejected; `/api/health` reports `read_only`.
- Cross-mount spool: documented constraint; startup warning.

**Cloud**

- CORS misconfiguration: clear error pointing at [docs/cors.md](../docs/cors.md).
- Expired or revoked credentials: connect dialog or inline re-auth; no silent retry with stale keys.
- S3 rate limiting / 503: backoff and user-visible retry.
- List pagination incomplete: UI must expose "load more" or equivalent when `nextCursor` is present — never pretend a truncated list is complete.

**Both**

- Per-serve-root or session state may be cleared by the user; explorer recovers by reconnect or reload.

---

## 4. Example CLI invocations

Local mode only unless noted.

### Local serving

```bash
# Serve current directory, bind 127.0.0.1, open browser
zfiles

# Serve a specific directory
zfiles ~/Downloads

# Pin the port
zfiles --port 9000 ~/projects
```

### LAN sharing

```bash
# Bind all interfaces with auto-generated token; prints URL and QR code
zfiles --listen 0.0.0.0:8080 --token

# Bind a specific interface by name (Tailscale, etc.)
zfiles --listen tailscale0:8080 --token

# Read-only share that auto-expires after two hours
zfiles ~/talks/keynote-prep --read-only --token --expire 2h
```

### Headless and scripting

```bash
# Serve only a curated set of files
find . -name "*.raw" | zfiles --from-stdin --read-only --token

# Upload to a remote zfiles server with resume
zfiles upload http://laptop:8080 ./dataset.tar.zst --resume
```

### Configuration and status

```bash
zfiles config get
zfiles config set ui.sort_default size_desc --folder ~/downloads
zfiles status
```

### Initialization and daemon

```bash
# Create ~/.config/zfiles/ with defaults but do not start the server
zfiles init

# Long-running mode watching multiple folders on separate ports
zfiles daemon start --config ~/.config/zfiles/daemon.toml
```

### Cloud mode

No CLI. User opens the hosted SPA (or self-hosted static build), connects with temporary bucket credentials, and browses. Example bookmark (non-secret params only):

```
https://zfiles.com/?provider=r2&bucket=my-data&prefix=photos/
```

---

## 5. Testing strategy

zfiles is built test-first. Tests are written before behavior in kernel and frontend modules where behavior changes.

### Test layers

**Unit tests (Rust)** — beside module source: Range parsing, tus state transitions, path normalization, token comparison, auth middleware helpers. Must stay fast (aggregate under ~5 s).

**Unit tests (frontend)** — Vitest: `KernelBackend` and `S3Backend` mapping, boot URL param parsing, credential storage rules, action context keys without plugin/search gates, listing formatters.

**Module integration tests (Rust)** — `tempfile` for filesystem, in-memory or file SQLite for state, real router tests for list/upload/delete/auth.

**Binary integration tests** — HTTP against assembled router: Range download correctness, tus conformance, auth cookie bootstrap, removed routes return 404, no subprocess spawn on startup.

**Backend contract tests (TypeScript)** — shared scenario table (list, stat, upload, delete) against mocks for both backends to prevent UI divergence.

**System tests (Playwright)** — real browser against real `zfiles` process for local mode: navigation, upload, download, delete, absence of search UI and plugin network calls. Cloud mode: static build against MinIO or SDK mocks — connect, paginated list, disconnect clears session.

**Performance tests** — separate CI job: cold-start latency, download/upload throughput baselines for local mode; regressions >5% fail the build.

### Property-based tests

`proptest` where the input space is large:

- HTTP Range header parsing and response math
- Path normalization (Unicode, `..`, symlinks)
- Tus state machine transitions
- S3 prefix/key ↔ explorer path conversion (frontend)

### Fixture corpus

Representative directories for local tests:

- `small/` — mixed types, general behavior
- `large/` — 100k files, listing performance
- `deep/` — nested directories, traversal
- `unicode/` — NFC/NFD, emoji, edge-case names
- `huge-files/` — sparse large files, transfer performance

Cloud tests use generated key sets or MinIO fixtures for pagination (>1000 keys).

### CI gates

Every pull request must pass:

- `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`, `cargo deny check`
- `pnpm test` (and lint when configured)
- Playwright local suite
- Binary integration tests

Cloud E2E may run in a separate job (MinIO container or mocks).

### What we deliberately do not test

- Former plugin behavior or plugin conformance (removed)
- Browsers other than recent Chromium and Firefox; Safari best-effort
- Non-Linux kernel targets in v1
- Live AWS/R2 accounts in CI (use MinIO/mocks)

### TDD workflow

Write a failing test, implement the minimum to pass, refactor while green. UI polish (CSS, layout) is exempt from strict TDD; behavior is not.

Detailed acceptance checklist and success metrics for the refactor: [dual_mode_refactor.md](dual_mode_refactor.md) § Testing strategy.

---

## 6. Open decisions

| Topic | Default leaning |
|-------|-----------------|
| Default port (local) | Ephemeral with browser auto-open |
| Auth default policy | Refuse `--listen 0.0.0.0` without `--token`; localhost without token |
| Local listing pagination | Defer until needed; cloud pagination required at launch |
| Text file preview | Omit in v1; metadata + download |
| Slideshow | Keep for client-decodable images in selection/cwd, or cut if blocking |
| Cloud CI | MinIO container or `@aws-sdk/client-mock` |
| npm publish of explorer library | Optional; monorepo path first |

---

## 7. Related documents

| Document | Purpose |
|----------|---------|
| [dual_mode_refactor.md](dual_mode_refactor.md) | Refactor phases, removal inventory, acceptance checklist |
| [action_system.md](action_system.md) | Built-in actions, palette, keybindings (plugin sections deprecated) |
| [config_and_cache.md](config_and_cache.md) | XDG layout; plugin cache sections obsolete after refactor |
