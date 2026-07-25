# zfiles — design

## 1. Overview

zfiles is a **dual-mode file explorer**: one shared React UI that browses files on the **local filesystem** (via a Rust CLI), in the **browser's own storage**, or in **S3-compatible object storage** (S3, Cloudflare R2) directly from the browser.

| Mode | Delivery | Storage | Opens |
|------|----------|---------|-------|
| **Local** | Single static binary; SPA embedded via `rust-embed` | Directory on disk | `http://127.0.0.1:<port>/` |
| **Cloud** | Static SPA hosted at `zfiles.com` (or self-hosted) | Browser storage (IndexedDB) by default; S3 / R2 once connected | Explorer immediately |

Run `zfiles` in a directory and the UI opens with no indexing step, no startup delay, and no configuration. Local mode scales from small folders to directories with millions of entries. The cloud build opens a working explorer with no credentials at all, backed by **Browser storage**; attaching a bucket is a separate "Connect to…" step. Bucket listing is paginated (S3 returns at most 1000 keys per call).

Files can be uploaded by dragging them into the browser. **Local mode:** uploads and downloads are resumable — tus on upload, HTTP Range on download. **Cloud mode:** S3 multipart upload and Range GET. Any HTTP client that supports range requests works against the local kernel, including `curl --continue-at`.

To expose a local folder on the network, run `zfiles --public --port 8080` (or `zfiles -b 0.0.0.0 -p 8080 -t -q`). The server prints a URL; pass `--qr` to include a scannable terminal QR code for other devices.

The UI is aimed at power users: keyboard shortcuts, multi-select, virtual-scrolled listings, and a preview pane. Built-in actions (navigation, delete, copy-path, view toggles) are unified through the [action system](action_system.md).

**Local mode** ships as a single static binary. No daemon or config file is required to run (XDG paths are optional; see [config_and_cache.md](config_and_cache.md)).

**Cloud mode** is a static site only — no zfiles server, no accounts. It lands in Browser storage, where files live in IndexedDB on the visitor's own device. Buckets are **connections** the user picks from the status-bar pill, the menu bar, or the command palette; their settings persist in `localStorage` while access keys are only saved when the user opts in per connection. The host never receives credentials either way. Setup: [docs/cloud-connect.md](../docs/cloud-connect.md), CORS: [docs/cors.md](../docs/cors.md).

### What we removed

Plugins and filename search are **out of scope** for the project going forward — not deferred, removed. There is no plugin supervisor, no JSON-RPC subprocess protocol, no `/api/search`, and no bundled thumbnail/search/viewer plugins. Preview is client-side and browser-native: images, video, and audio render in a fullscreen overlay fed by the file download URL (no kernel transcoding). Other types show metadata and a download link; PDF, text/source (incl. HTML as source), SVG, and sanitized Markdown preview are planned along the same browser-native path.

Implementation phases and migration checklist: [dual_mode_refactor.md](dual_mode_refactor.md).

---

## 2. Technical objectives

zfiles is engineered around these goals. Module boundaries and frontend/backend split follow from them.

- **One explorer, three backends.** A shared frontend library talks to storage through an `ExplorerBackend` interface. Local mode uses `KernelBackend` (REST + WebSocket against the embedded kernel). The cloud build starts on `BrowserBackend` (IndexedDB in the visitor's browser) and switches to `S3Backend` (AWS SDK v3 in the browser) when a bucket connection is activated. The UI never forks by mode.
- **Nothing to configure before browsing (cloud).** The hosted SPA must render a usable explorer on first paint without credentials, network access to any bucket, or a setup screen.
- **Always-instant cold start (local).** Under 100 ms from process spawn to first HTTP response, no matter how large the served directory is. Nothing in the startup path blocks on directory size or cache state.
- **Saturate the wire (local).** Single-connection downloads and uploads hit gigabit Ethernet throughput where hardware allows. Both transfer paths resume from interruption (Range + tus).
- **Small focused kernel (local).** The Rust binary serves filesystem primitives, auth, tus upload, static assets, and filesystem watch — not format interpretation, thumbnails, search, or extensibility hooks.
- **Static cloud deployment.** The hosted SPA is static files only. Bucket credentials are user-supplied, and persisting them is an explicit per-connection opt-in. A link may declare its intent (`connect=saved:<name> | new | ask`) and carry credentials in the URL **fragment**, which is stripped from the address bar as soon as it is read.
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

**Local uploads** use the tus.io protocol. The client issues a Creation request; the server allocates a spool file and JSON sidecar under `uploads/` and returns an Upload URL. PATCH with `Content-Range` appends to a spool file under XDG state (see [config_and_cache.md](config_and_cache.md)). Completion is atomic: `fsync` + `rename(2)` into the served tree (same-filesystem constraint; warn at startup on cross-mount).

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
- Tus upload metadata in per-upload JSON sidecars under `uploads/`; offset from spool file size.
- Outbound HTTP clients (tus CLI, Vite dev proxy) use plain HTTP only; production TLS terminates at a reverse proxy.
- TLS on the kernel listener (when added) is expected to use `rustls`.
- Linux delivery targets `x86_64-unknown-linux-musl` for true static linking where applicable.

Removing the plugin embed and supervisor reduces binary size; budget remains under 20 MB stripped.

### Cloud static SPA

The cloud build is the same frontend source with `VITE_BOOT_MODE=cloud` (or equivalent): no kernel API assumptions, `BrowserBackend` mounted at boot, and `S3Backend` swapped in when a connection is activated.

Security model:

- Credentials entered in the UI → validated with `HeadBucket` → held in memory for the tab.
- **Remember keys on this device** is opt-in per connection and defaults to **off**. When it is off, keys never reach any storage and the user re-enters them once per session. When it is on, they are written to `localStorage` under a dedicated key, and the dialog says so.
- Non-secret connection settings (name, provider, bucket, region, endpoint, prefix, read-only) always persist in `localStorage`, alongside preferences like theme and locale.
- **Forget saved keys** (per connection) and **delete connection** both clear stored keys; a rejected request drops the keys it used without changing the remember preference.
- Switching to Browser storage replaces the old Disconnect: no bucket stays mounted, and the browser volume needs no credentials.
- No analytics or third-party scripts on pages that handle credentials.

Because opt-in persistence writes keys to disk for that browser profile, the dialog frames it as a trade-off: convenient on a personal machine, wrong on a shared one. Short-lived scoped credentials remain the recommendation either way.

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
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌───────────────┐   ┌─────────────────┐   ┌───────────────┐
│ KernelBackend │   │ BrowserBackend  │   │   S3Backend   │
│ /api/* + ws   │   │ IndexedDB       │   │ AWS SDK       │
└───────┬───────┘   └────────┬────────┘   └───────┬───────┘
        ▼                    ▼                    ▼
┌───────────────┐   ┌─────────────────┐   ┌───────────────┐
│ zfiles kernel │   │ Browser storage │   │  S3 / R2 API  │
│ (embedded UI) │   │ (this device)   │   │               │
└───────────────┘   └─────────────────┘   └───────────────┘
```

UI components depend on `ExplorerBackend`, not on `/api/*` paths, IndexedDB, or AWS types directly. The active connection selects the adapter at runtime; there is no parallel component tree per mode.

### `ExplorerBackend` contract

```ts
type BackendMode = "local" | "s3" | "browser";

interface ExplorerBackend {
  readonly mode: BackendMode;

  list(path: string, cursor?: string): Promise<ListResult>;
  stat(path: string): Promise<FileStat>;

  downloadUrl(path: string): string | Promise<string>;

  upload(
    file: File,
    destPath: string,
    onProgress?: (progress: UploadProgress) => void,
    signal?: AbortSignal,
    callbacks?: UploadCallbacks,
    tusResume?: TusUploadResume,
  ): Promise<void>;

  runAction(params: RunActionParams): Promise<void>;
  fetchHealth(): Promise<HealthInfo | null>;
  subscribe(
    onEvent: (event: BackendEvent) => void,
    onStatus?: (status: BackendStatus) => void,
  ): () => void;
}

interface ListResult {
  entries: FileEntry[];
  nextCursor?: string;
}
```

Mutations go through `runAction` (`file.delete`, `file.mkdir`, `file.rename`, `file.copy`, `file.move`) so every backend implements the same action vocabulary the UI dispatches.

`FileEntry` shape is stable across modes: `name`, `path`, `is_dir`, `size`, `modified`. Cloud mode maps object keys to paths with `/` as the folder delimiter (`ListObjectsV2` + `Delimiter: "/"`). Listing is paginated for buckets; local `/api/list` and browser storage return whole directories.

**Local backend events:** `connected`, `filesystem_changed`, `upload_progress`.

**S3 backend events:** `connected` only; no filesystem watch.

**Browser backend events:** `connected`, plus `filesystem_changed` after its own mutations and on window focus (IndexedDB is shared by every tab on the origin, and the last write wins).

### Browser storage

Browser storage is an IndexedDB filesystem in the visitor's browser: metadata records keyed by path in a `nodes` store indexed by parent, and file bytes as `Blob`s in a separate `blobs` store, so listings never read contents. `downloadUrl` hands out object URLs from an LRU cache that revokes them when the file changes, when an entry is evicted, or on teardown. Moves rewrite node paths and keep the stored blob; copies duplicate the bytes. The first write asks for `navigator.storage.persist()`, and `QuotaExceededError` surfaces as a translated "storage is full" message rather than a generic failure. Uploads write in one shot, so a paused browser upload restarts rather than resuming.

### Module structure (local kernel)

The binary is one OS process. Cross-module dependencies are explicit and minimal.

| Module | Responsibility |
|--------|----------------|
| `transport` | axum server: embedded React assets, REST API, tus upload, Range download, WebSocket events |
| `fs` | `Fs` trait: directory listing, stat, read, write, delete; `LocalFs` via `tokio::fs` |
| `state` | Per-serve-root XDG state: tus upload spools and sidecars, config accessors |
| `auth` | In-memory bearer token, HttpOnly auth cookie, optional expiry; read-only enforcement |
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

- **Backend injection.** `useExplorerBackend()` is the only path from components to storage. `ConnectionProvider` owns the active connection, builds its backend, and remounts the explorer subtree keyed by connection id, so switching volumes resets the path to that volume's root and drops the previous backend's resources.
- **Preview.** Browser-native rendering in a fullscreen overlay: images (`<img>`: JPEG, PNG, WebP, GIF, AVIF, …), video (`<video>`: mp4, webm, mov, …), and audio (`<audio>`: mp3, flac, m4a, …), all fed by `downloadUrl` — no kernel transcoding. Double-click or Enter on a previewable file opens the overlay; non-previewable files fall back to download. With two or more files selected, prev/next (and arrow keys) step through the selection in listing order with wrap-around; zoom/pan apply to images only. Other types show a metadata panel + download link. Planned along the same path: PDF (`<iframe>`/`<embed>`), text/source (incl. HTML as source) in a size-capped `<pre>`, SVG, and sanitized Markdown. No dynamic plugin viewer imports.
- **Actions.** Built-in actions only; see [action_system.md](action_system.md). No plugin action registration or `plugin.*` context keys.
- **i18n.** All user-visible strings ship in 14 locales: English (`en`), Simplified Chinese (`zh-CN`), Traditional Chinese (`zh-TW`), Spanish (`es`), French (`fr`), Italian (`it`), Portuguese (`pt`), Russian (`ru`), German (`de`), Japanese (`ja`), Korean (`ko`), Turkish (`tr`), Indonesian (`id`), and Vietnamese (`vi`). `resolveLocale` normalizes BCP-47 tags (region/script subtags, casing) to a supported locale and falls back to English; each catalog implements the full `MessageKey` set, with English as the runtime fallback for any missing key.

### Connections

The cloud build keeps a **connection registry** in `localStorage`: `zfiles-connections` holds the saved records, `zfiles-active-connection` the last one activated, and `zfiles-connection-keys` only those keys the user chose to remember. **Browser storage** is a pinned pseudo-connection that is always present and cannot be renamed or deleted; the CLI build shows a single non-switchable `zfiles server` entry instead.

Exactly one connection is active at a time. The status-bar pill shows its name and opens the connection dialog, which also carries create, edit, duplicate, forget-keys, and delete. Two actions — `connection.switch` ("Connect to…") and `connection.create` — appear in the command palette and menu bar. There is no Disconnect: activating Browser storage is how you leave a bucket.

On load, the URL wins over the remembered connection, which wins over Browser storage. Restoring a remembered bucket only happens when its keys are still available; otherwise the user lands in Browser storage and activating the bucket prompts for keys.

### Cloud boot and URL params

`connect` states the intent; the remaining params describe the bucket.

| Param | Value | Purpose |
|-------|-------|---------|
| `connect` | `saved:<name>` | Activate the saved connection with that display name |
| `connect` | `new` | Connect to the bucket in the other params without saving it |
| `connect` | `ask` | Open the connection picker over Browser storage |
| `provider` | `aws` \| `r2` | Provider preset |
| `bucket`, `region`, `endpoint`, `prefix` | — | Bucket coordinates |
| `readonly` | `read_only`, `readOnly` | Read-only mode |

Credentials belong in the URL **fragment** (`#accessKeyId=…&secretAccessKey=…&sessionToken=…`), which browsers never send to the server, keeping keys out of static-host access logs and `Referer` headers. The legacy credential *query* params are still accepted for older links. Both forms are removed from the address bar with `history.replaceState` as soon as they are read, so they do not linger in bookmarks or visible history — but they are still in whatever link was shared, so use **short-lived** scoped credentials.

A `connect=new` connection is **ephemeral**: it is not added to the registry, it shows in the picker as a temporary row, and the UI offers "Save connection" if the user wants to keep it. When `connect=new` lacks credentials (or the endpoint R2 requires), the create form opens prefilled instead of connecting. An unknown `connect=saved:` name reports itself and leaves Browser storage active.

Connection management, credential scoping, and failure handling: [docs/cloud-connect.md](../docs/cloud-connect.md).

Explorer navigation updates the path in the URL, never the connection or its credentials.

### Config, state, and cache (local)

Kernel configuration and durable per-serve-root state live under XDG paths. The served directory is never modified for zfiles housekeeping.

Layout and resolution: [config_and_cache.md](config_and_cache.md). Tus spools and sidecars remain under per-folder state directories.

### Failure modes

**Local**

- Network interruptions: tus resume on upload; Range resume on download; upload state survives kernel restart via spool and sidecar files.
- Read-only serve root: uploads and delete rejected; `/api/health` reports `read_only`.
- Cross-mount spool: documented constraint; startup warning.

**Cloud**

- CORS misconfiguration: clear error pointing at [docs/cors.md](../docs/cors.md).
- Connection fails **before anything has loaded** (boot restore, or a `connect=` link): a dialog offers Retry or a different connection. Cancel is withheld, because there is no listing to fall back to.
- Connection fails or credentials expire **mid-session**: the explorer freezes — the last listing stays on screen, `connection.frozen` disables every storage and navigation action, and in-flight uploads pause. The same dialog appears with Cancel, which leaves the stale view in place. Rejected keys are dropped; nothing is retried silently with stale credentials.
- S3 rate limiting / 503: backoff and user-visible retry.
- List pagination incomplete: UI must expose "load more" or equivalent when `nextCursor` is present — never pretend a truncated list is complete.
- Browser storage full: `QuotaExceededError` becomes a translated message naming the cause; nothing is silently dropped.

**Both**

- Per-serve-root or session state may be cleared by the user; explorer recovers by reconnect or reload. Clearing site data also erases Browser storage, which is the only copy of those files.

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

### Public LAN access

```bash
# Public LAN preset: bind all interfaces, token auth, QR code
zfiles --public --port 8080

# Equivalent explicit flags
zfiles -b 0.0.0.0 -p 8080 -t -q

# Bind a specific address (e.g. Tailscale IP)
zfiles --bind 100.64.0.2 --port 8080 --token --qr

# Read-only public serve that auto-expires after two hours
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

No CLI. Opening the hosted SPA (or a self-hosted static build) lands in Browser storage with nothing to configure. Links can ask for something else:

```
# Open the connection picker
https://zfiles.com/?connect=ask

# Activate a connection this browser already has saved
https://zfiles.com/?connect=saved:Work%20bucket

# Offer a bucket, letting the recipient paste keys into the prefilled form
https://zfiles.com/?connect=new&provider=r2&bucket=my-data&prefix=photos/

# Same bucket, connecting straight away with short-lived keys in the fragment
https://zfiles.com/?connect=new&provider=r2&bucket=my-data#accessKeyId=…&secretAccessKey=…
```

See [Cloud boot and URL params](#cloud-boot-and-url-params).

---

## 5. Testing strategy

zfiles is built test-first. Tests are written before behavior in kernel and frontend modules where behavior changes.

### Test layers

**Unit tests (Rust)** — beside module source: Range parsing, tus state transitions, path normalization, token comparison, auth middleware helpers. Must stay fast (aggregate under ~5 s).

**Unit tests (frontend)** — `tsx --test` (Node's test runner) over the files listed in `web/package.json`: backend mapping for all three adapters (browser storage runs against `fake-indexeddb`), boot URL intent parsing, share-link round-trips, connection registry and credential-persistence rules, frozen-connection action gating, and listing formatters.

**Module integration tests (Rust)** — `tempfile` for filesystem, tus sidecar state on disk, real router tests for list/upload/delete/auth.

**Binary integration tests** — HTTP against assembled router: Range download correctness, tus conformance, auth cookie bootstrap, removed routes return 404, no subprocess spawn on startup.

**Backend contract tests (TypeScript)** — shared scenario table (list, stat, upload, delete) against mocks for both backends to prevent UI divergence.

**System tests (Playwright)** — real browser against a real `zfiles` process for local mode: navigation, upload, download, delete, absence of search UI and plugin network calls. Cloud mode: the built static bundle served locally — Browser storage create/list/persist-across-reload, the connection picker, and the `connect=` boot contract including credential stripping and the boot failure dialog. Bucket traffic itself is covered against MinIO or SDK mocks.

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
| Auth default policy | Refuse any non-loopback bind without `--token`; loopback (incl. `127.0.0.0/8`, `::1`) token-free |
| Local listing pagination | Defer until needed; cloud pagination required at launch |
| Text file preview | Planned: browser fetch into a size-capped `<pre>` (incl. HTML rendered as source) |
| Preview overlay | Browser-native images, video, audio; default double-click/Enter action; PDF/text/SVG/Markdown planned |
| Cloud CI | MinIO container or `@aws-sdk/client-mock` |
| npm publish of explorer library | Optional; monorepo path first |

---

## 7. Related documents

| Document | Purpose |
|----------|---------|
| [dual_mode_refactor.md](dual_mode_refactor.md) | Refactor phases, removal inventory, acceptance checklist |
| [action_system.md](action_system.md) | Built-in actions, palette, keybindings (plugin sections deprecated) |
| [config_and_cache.md](config_and_cache.md) | XDG layout; plugin cache sections obsolete after refactor |
