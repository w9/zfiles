# zfiles — design

## 1. Overview

zfiles is a local file server with a browser-based explorer. Run `zfiles` in a directory; the UI opens with no indexing step, no startup delay, and no configuration. It scales from small folders to directories with millions of entries.

Files can be uploaded by dragging them into the browser. Uploads and downloads are resumable — if the connection drops, they continue from where they stopped. Any HTTP client that supports range requests works, including `curl --continue-at`.

To expose a folder on the local network, run `zfiles --listen 0.0.0.0:8080 --token`. The server prints a URL and a QR code for other devices.

The UI is aimed at power users: keyboard shortcuts, multi-select, virtual-scrolled listings, and an extensible preview pane. Format-specific features — thumbnails, EXIF metadata, DICOM viewing, full-text search — live in plugins that can be written in any language.

Everything ships as a single static binary. No daemon, database, or config file is required to run.

## 2. Technical objectives

zfiles is engineered around six technical goals. The shape of the project — what's in the core, what's outside it, how the pieces talk to each other — falls out of these.

- **Always-instant cold start.** Under 100 ms from process spawn to first HTTP response, no matter how large the served directory is.
- **Saturate the wire on both directions.** Single-connection downloads and uploads hit gigabit Ethernet throughput. Both transfer paths resume from any interruption.
- **A genuine microkernel.** The core does not interpret file contents. Every format-specific feature — thumbnails, viewers, search, indexing — lives outside the kernel as a plugin.
- **Language-agnostic plugin protocol.** Plugins are subprocesses speaking JSON-RPC over stdio. Authoring a plugin requires only the ability to read and write JSON on stdin/stdout. Python, Go, Node, Rust, shell — anything works.
- **Single static binary.** One file, under 20 MB stripped, with the React frontend baked in. Drop it on a Linux machine and run it.
- **Cross-platform forward compatibility on a Linux-first delivery.** v1 ships Linux only, but the kernel's abstractions don't preclude macOS or Windows. The platform boundaries are explicit and behind traits.

The rest of this section unpacks each objective.

### Always-instant cold start

This is the load-bearing invariant of the project. Nothing in the startup path is allowed to block on work that scales with the size of the served directory or the state of any cache. The startup sequence is fixed:

1. Parse CLI args (`clap`, sub-millisecond)
2. Load merged config from XDG paths if present; otherwise use defaults (see [config_and_cache.md](config_and_cache.md))
3. Bind the TCP listener
4. Spawn the browser (`xdg-open`, async — we don't wait for it)
5. Begin serving

Conspicuously absent: directory scanning, index building, plugin startup, hashing, any filesystem stat work beyond the requested-directory listing. XDG config and cache directories are created lazily on first write, so browsing an arbitrary folder — including a fresh clone — has zero side effects on disk.

The plugin supervisor begins discovering and spawning plugins in parallel in the background once the listener is up. Plugins reach ready state asynchronously. Until they are ready, capability requests for them return "unavailable" and the UI degrades gracefully.

The same principle extends to every request: the kernel returns the fast answer immediately, plugin contributions arrive later over the WebSocket and update the UI in place. A directory listing returns in tens of milliseconds with raw `fs::read_dir` results; if a `lister` plugin is registered, its enrichment data (icons, metadata columns) follows over the websocket and the UI mutates. The UI is built to handle this — no waiting, no flickering.

Target time-to-first-byte on a modern x86_64 Linux machine: well under 50 ms in practice, leaving headroom on the 100 ms SLA.

### High-throughput resumable transfers

Downloads use HTTP Range requests for resumability. The response body is a streaming reader over the file. On Linux, the hot path uses `sendfile(2)` for zero-copy file-to-socket transfer when the request is for a whole file or a single contiguous range; multi-range or transformed responses fall back to `ReaderStream` over `tokio::fs`. Buffer sizes start at 256 KiB and are tuned against benchmarks; TCP send buffers are left to the kernel to autotune unless we measure problems.

Target throughput: 110+ MB/s sustained on a single connection from local SSD over gigabit. This is well within `sendfile`'s capability — modern Linux moves several GB/s with `sendfile` on local hardware — so we're bounded by the network, not the kernel.

Uploads use the tus.io protocol. The client issues a Creation request describing the upload (size, metadata); the server allocates a state row in `state.db` and returns an Upload URL. The client sends PATCH requests with `Content-Range`; the server appends to a spool file under the serve root's XDG state directory (see [config_and_cache.md](config_and_cache.md)) and updates the recorded offset. On disconnect, the client queries the server's current offset with a HEAD request and resumes from there. Tus has mature implementations in JS, Go, Python, and Rust, including the canonical browser client (`tus-js-client`) we use in the frontend.

Completion is atomic: the spool file is `fsync`'d and `rename(2)`'d into place. This is atomic on the same filesystem; we document the same-filesystem constraint and warn at startup if the served directory and upload spool cross a mount point.

### Microkernel architecture

The core does not interpret file contents. Stated concretely, the kernel ships none of:

- thumbnails of any format
- viewers of any format
- filename search (yes, even filename search — it's a plugin)
- content search
- file indexing
- content-based MIME sniffing (extension-based guessing only, for `Content-Type` headers)
- syntax highlighting, markdown rendering, image decoding, PDF parsing, video processing

What the kernel does ship: HTTP transport, filesystem primitives (`read_dir`, `stat`, `read`, `write`, atomic move), plugin lifecycle and capability dispatch, authentication, per-folder configuration, a filesystem watch service, and a storage primitive (each plugin gets a writable subdirectory).

The reasoning: file handling is a permanently moving target. New formats appear constantly. The quality bar varies wildly by domain — a bioinformatician wants `.bam` preview; a designer wants `.psd` thumbnails; a photographer wants RAW. A kernel that tried to handle this in-tree would either be enormous and slow to release, or thin and inadequate. By pushing file-handling out, the kernel stays small and stable, the official plugin set covers 80% of users, and the long tail is unblocked.

The honest downside is that v1 with no plugins is austere: file names, sizes, dates, raw downloads. We mitigate by bundling a curated set of official plugins with the installer; the kernel doesn't know about them, but `brew install zfiles` results in image thumbnails, filename search, and text preview working out of the box.

### Language-agnostic plugin protocol

JSON-RPC 2.0 over stdio with LSP-style framing (`Content-Length` header followed by JSON body). Each choice earns its place:

- JSON-RPC 2.0 is small, well-specified, and easy to implement in any language.
- LSP framing handles the "where does one message end?" problem cleanly, without the streaming-parser fragility of newline-delimited JSON.
- Stdio means no port management, no kernel-to-plugin authentication, no risk of plugins accidentally exposing themselves to the network.
- Any language with subprocess and JSON support can write a plugin: Python, Go, Rust, Node, shell with `jq`.

The startup handshake exchanges protocol version (we maintain multiple in parallel during transitions), plugin-declared capabilities and supported file patterns, kernel-offered services (filesystem watch subscriptions, plugin storage path), and resource limits (max concurrent requests, max response size).

The kernel never trusts plugin output blindly. Responses are validated against the protocol schema. Stdout output that doesn't parse as a valid message is logged and discarded; stderr is captured to the plugin's log file. The kernel can kill and restart a misbehaving plugin without affecting anything else.

Sandboxing in v1 is subprocess isolation alone: plugins inherit the kernel's user and have full filesystem access, the same as if you ran them yourself. This is appropriate when users install plugins they trust. v2 will add WASM-based sandboxing via `wasmtime` for untrusted plugins, with the same JSON-RPC contract — the transport changes, the protocol does not.

### Single static binary with embedded UI

The deliverable is one file: `zfiles`. No installer, no package manager required, no companion files.

The React frontend (built by Vite) is embedded via `rust-embed`. Vite emits assets pre-compressed (gzip and brotli) alongside the originals; `rust-embed` bundles all three; axum's response handler does content negotiation on `Accept-Encoding` and ships the right encoding without decompressing first.

Static linking strategy:

- The Rust standard library statically links by default.
- SQLite is bundled via `rusqlite`'s `bundled` feature, which compiles a vendored SQLite source.
- TLS (when added) uses `rustls`, pure Rust, no OpenSSL dependency.
- libc resolves through the `x86_64-unknown-linux-musl` target for true static linking with no glibc dependency.

Size budget: under 20 MB stripped. Vite output for an app of this scope is typically 200–500 KB after brotli; the bulk of the binary is Rust + SQLite + axum + dependencies.

### Forward-compatible cross-platform foundation

v1 ships Linux only. The kernel is structured so v2 can add macOS and Windows without rewriting anything central.

The load-bearing abstraction is the `Fs` trait. Every filesystem operation the kernel performs goes through it. The v1 implementation is Linux-only; later platforms supply equivalent implementations. Test suites are written against the trait, so adding a platform means writing the impl and inheriting most coverage for free.

Other platform-specific concerns sit behind portable abstractions:

- File watching uses the `notify` crate in portable mode (inotify on Linux; FSEvents on macOS; ReadDirectoryChangesW on Windows).
- All path manipulation uses `std::path::Path` and `PathBuf`. We never concatenate strings with `/`.
- Browser launch (`xdg-open` on Linux, `open` on macOS, `start` on Windows) sits behind a function with platform-specific implementations.
- Linux-specific fast paths (`sendfile`, `splice`) are optimizations behind portable fallbacks (`ReaderStream`), not contracts.

The biggest cross-platform footgun is Unicode normalization. macOS HFS+/APFS normalizes filenames to NFD; Linux filesystems store whatever bytes you wrote; Windows NTFS normalizes case but not Unicode. Our v1 fixture corpus includes a `unicode/` directory with NFC, NFD, and mixed cases so the eventual macOS port doesn't get surprised.

## 3. How do we achieve all of this?

This section is the concrete design: the modules inside the binary, the plugin contract details, the request flow, and the failure model. Implementation choices are called out where they matter; routine ones are left to the engineer.

### Module structure

The binary is one OS process organized into the following Rust modules. Each is independently testable; cross-module dependencies are explicit and minimal.

`transport` owns the axum HTTP server. It hosts the embedded React assets, the REST API for directory and file operations, the tus upload endpoint, the Range-aware download handler, and a WebSocket channel for live events (filesystem changes, upload progress, plugin status, plugin-contributed enrichments).

`fs` is the cross-platform filesystem abstraction. It exposes directory listing, stat, read, write, atomic move, and a watch service. The v1 implementation uses `tokio::fs` for I/O and `notify` for watching, configured to use inotify on Linux.

`state` manages per-serve-root runtime state under XDG config paths. It creates directories on demand (not at startup), owns the kernel's `state.db` (SQLite in WAL mode for in-progress tus uploads and session tokens), and provides configuration accessors. See [config_and_cache.md](config_and_cache.md) for layout.

`plugins` is the plugin supervisor. It discovers manifests under `~/.config/zfiles/plugins/` (user-installed) and materialized copies under `~/.cache/zfiles/bundled/` (official), spawns enabled plugins as child processes, performs the handshake, maintains the capability registry, routes capability requests to the right plugin, and restarts crashed plugins with exponential backoff. Process groups ensure plugins die when the kernel exits.

`auth` is bearer-token middleware applied to every route. It generates tokens, performs constant-time comparison, and enforces read-only mode at the handler layer.

`cli` is the entry point. It uses `clap` for argument parsing and dispatches to either the serving path or one of the headless subcommands.

Plugins live as child processes outside this structure. They communicate with the supervisor exclusively over stdin and stdout.

### The plugin contract

Plugins are the central extensibility mechanism, so this contract is the most important interface in the system. It has four parts: manifest, protocol, capabilities, and storage.

**Manifest.** Each plugin ships a `plugin.toml` declaring its name, version, executable path, arguments, required protocol version, declared capabilities, and supported file patterns (globs). The supervisor reads the manifest before spawning anything.

**Protocol.** Plugins speak JSON-RPC 2.0 over stdio with LSP-style framing. The startup handshake exchanges protocol version, capabilities, supported globs, and resource limits.

**Capabilities.** Each plugin declares one or more of:

- `lister`: augments directory listings with additional metadata (icons, tags, computed columns)
- `searcher`: provides a search interface over a path subtree
- `thumbnailer`: takes a file path, returns image bytes for files matching its globs
- `viewer`: registers UI components (served as ESM modules) for previewing files of a given type
- `action`: registers context-menu actions for files or selections
- `route`: serves additional HTTP endpoints reverse-proxied under `/plugin/<name>/`
- `watcher`: subscribes to filesystem events for a path subtree

When the kernel needs a capability (the UI asks for a thumbnail, say), it queries the registry for plugins matching the file type, dispatches the request with a per-call timeout, and returns a structured "no capability available" response if nothing matches or the timeout expires. The UI degrades gracefully in every such case.

**Storage.** Each plugin gets a private subdirectory at `~/.cache/zfiles/plugins/<name>/data/` it can read and write freely. The kernel makes no assumptions about contents. This is where a search plugin would put its index, a thumbnailer would put its cache, an EXIF extractor would put a metadata database. Config and cache layout is specified in [config_and_cache.md](config_and_cache.md).

### Request flow

A directory listing request illustrates the kernel-plus-plugin pattern that runs throughout the system.

The handler asks `fs` for the listing — a direct `read_dir` returning immediately. If a `lister` plugin is installed and ready, the handler concurrently asks the plugin for augmenting metadata. Two things can happen:

1. The plugin returns within the timeout (default 50 ms). The handler merges plugin metadata into the response and returns the enriched listing.
2. The plugin doesn't return in time. The handler returns the raw filesystem listing without augmentation. The plugin's response, when it arrives, gets pushed to the UI over the WebSocket, which patches the displayed listing in place.

This pattern — kernel responds immediately, plugins enhance asynchronously — applies everywhere a plugin might contribute. Thumbnails follow the same flow: the listing returns with placeholder thumbnails, the actual thumbnails arrive over the WebSocket as the thumbnailer produces them. Search is the one operation that has no useful kernel-only answer; if no `searcher` is installed, the search box is hidden in the UI entirely.

### Config, state, and cache

Kernel configuration, durable per-serve-root state, and plugin caches live under `~/.config/zfiles` and `~/.cache/zfiles` by default. The served directory is never modified for zfiles housekeeping.

Full layout, resolution order, CLI mapping, and failure modes: [config_and_cache.md](config_and_cache.md).

### Frontend strategy

The React UI is compiled by Vite into static assets, embedded into the binary via `rust-embed` with pre-compressed gzip and brotli variants, and served by axum with content negotiation. In development, a feature flag swaps the embedded handler for a proxy to `vite dev` so HMR works without rebuilding the Rust binary.

The UI is built to render usefully without any plugins. The file list, navigation, upload area, and download flows work entirely against the kernel's REST API. Plugins extend the UI through three mechanisms:

- **Conditional rendering.** The search box appears only if a `searcher` is installed and ready. Thumbnail tiles appear only where a `thumbnailer` has produced one. The preview pane shows a "no viewer for this type" placeholder unless a matching `viewer` is registered.
- **Slot mounts.** Viewer plugins register ESM URLs the React shell dynamically imports and mounts into named slots in the preview pane. Trusted plugins mount directly; untrusted plugins are sandboxed in iframes with a `postMessage` bridge.
- **Context menu contributions.** Action plugins contribute entries to the right-click menu, scoped to file types they declared.

### Failure modes and graceful degradation

The system is built around the assumption that any plugin can be missing, slow, or crashed at any moment.

Plugin crashes are isolated. The supervisor restarts crashed plugins with exponential backoff. The kernel and other plugins continue serving. The UI shows the affected capability as unavailable until the plugin returns.

Plugin slowness is bounded. Every capability call has a per-call timeout. Exceeding it returns "unavailable" rather than blocking the response. Slow plugins do not slow down the kernel.

Plugin storage corruption is the plugin's problem. The kernel does not back up or repair plugin data. The plugin must handle its own state recovery; the worst case is the plugin throws away its cache and rebuilds.

Network interruptions are recovered by tus on uploads and HTTP Range resumption on downloads. The kernel persists upload state to `state.db` so resume works across kernel restarts.

Per-serve-root state under XDG config may be deleted at any time; the kernel recreates it lazily on next write. Plugin cache under XDG cache may be cleared; plugins rebuild. In-progress uploads in deleted state are lost, which is acceptable.

## 4. Example CLI invocations

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
# Search the index from the CLI (requires a search plugin installed)
zfiles search ~/notes "transformer attention"

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

### Plugin management

```bash
zfiles plugin install ./zfiles-thumbnailer-images
zfiles plugin install github.com/zfiles/search-filename
zfiles plugin list
zfiles plugin remove zfiles-thumbnailer-images
zfiles plugin run exif-extractor ~/photos/IMG_0042.jpg
zfiles plugin test ./my-plugin    # run the conformance suite against a plugin
```

### Initialization and daemon

```bash
# Create ~/.config/zfiles/ with defaults but do not start the server
zfiles init

# Long-running mode watching multiple folders on separate ports
zfiles daemon start --config ~/.config/zfiles/daemon.toml
```

## 5. Testing strategy

zfiles is built test-first. Tests are written before behavior in every kernel module, and the architecture is structured to make testing cheap at every layer. Plugin internals are the plugin author's responsibility; the kernel ships a conformance suite they can run against their plugins.

### Test layers

Five layers, ordered by speed and cost. The pyramid skews heavily toward the cheaper layers.

**Unit tests** sit beside each module's source in the Rust convention (`#[cfg(test)] mod tests`). They cover pure functions, parsers, and state machines without I/O: HTTP Range header parsing, tus upload state transitions, manifest validation, plugin protocol message framing, path normalization, token comparison. These are the bulk of the test count and must run in under five seconds in aggregate.

**Module integration tests** live under each crate's `tests/` directory. They exercise a module's public API against real dependencies — a `tempfile::TempDir` for filesystem tests, an in-memory SQLite for state tests, a fixture plugin binary for plugin host tests. Example: spawning the echo plugin, sending a structured request, asserting on the response and on the plugin's exit code after shutdown.

**Binary integration tests** drive the assembled binary end to end through HTTP. They use axum's testing utilities against the real router. Examples: byte-exact range download correctness, tus protocol conformance against the upstream test suite, auth middleware behavior, plugin capability dispatch with fixture plugins running, timeout behavior when plugins are slow.

**System tests** use Playwright to drive a real browser against a real `zfiles` process serving a real directory of test fixtures. Examples: drag-and-drop upload, kill-the-network resume, navigation, plugin-provided UI elements rendering when their plugin is enabled, graceful degradation when their plugin crashes.

**Performance tests** are benchmarks gated as a separate CI job. They establish baselines for the SLAs in section 2 and fail the build if they regress more than 5% from the previous release. Throughput is measured with `wrk` for download and upload; cold-start latency with a small Rust harness that times from process spawn to first response byte.

### Property-based tests

A handful of areas warrant property testing with `proptest`. These are areas where the input space is large and edge cases are easy to miss in example-based tests:

- HTTP Range header parsing and response math (single and multipart ranges, suffix ranges, off-by-one boundaries, malformed inputs)
- Path normalization (relative resolution, Unicode NFC/NFD, symlink loops, `..` traversal, mixed separators)
- Tus state machine transitions (for any sequence of valid client operations, the server ends in a valid state)
- Plugin protocol message framing (malformed length prefixes, truncated bodies, embedded null bytes don't crash the parser)

### The plugin conformance suite

Because plugins are the extensibility surface and the project's promise is "any language," the kernel ships a conformance test suite that plugin authors run their plugin against. It exercises every protocol message the plugin claims to support and validates response shapes against the protocol schema. Authors invoke it as `zfiles plugin test ./my-plugin`. It also runs in our CI against every official plugin.

### Fixture corpus

A separate fixtures repository contains representative test directories used across all test layers:

- `small/` — 100 files, mixed types, for general behavior
- `large/` — 100k files in a single directory, for listing performance
- `deep/` — 1000 directories nested 20 levels deep, for traversal
- `unicode/` — filenames with NFC/NFD, emoji, RTL scripts, control characters, for path edge cases
- `huge-files/` — sparse files up to 10 GB, for transfer performance

Large and huge fixtures are generated by scripts at test time rather than version-controlled.

### Frontend testing

Component tests use Vitest with React Testing Library and cover individual components in isolation, including conditional rendering paths that depend on plugin availability (plugins are mocked at the API layer). E2E tests use Playwright against a containerized zfiles instance, covering the full upload, download, navigation, and preview flows. Visual regression tests are advisory only — failures don't block merges, since they're inherently flaky.

### CI gates

Every pull request must pass:

- `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`, `cargo deny check`
- `pnpm lint`, `pnpm test`
- Playwright suite against a containerized zfiles with the official fixture plugins enabled
- Binary integration tests

A nightly job runs the performance suite against the most recent tagged release as baseline and posts a regression report. Pre-release builds run cross-target smoke tests on all supported triples (only `x86_64-unknown-linux-gnu` for v1).

### What we deliberately do not test

- Plugin behavior beyond protocol conformance — that's the plugin author's job
- Browsers other than recent Chromium and Firefox; Safari is best-effort
- Filesystem behavior on non-Linux targets in v1
- Network conditions beyond a small fixed set: clean LAN, lossy connection simulation, mid-transfer disconnect

### TDD workflow expectations

The team writes tests before behavior. A typical task cycle: write a failing test capturing the desired behavior, implement the minimum to pass it, refactor while green. Pull requests that add behavior without a corresponding test are rejected during review. Pull requests that add test coverage to existing behavior are encouraged.

Two practical concessions: exploratory spikes don't need tests (but the spike branch doesn't get merged — its findings get rewritten test-first). And UI polish (CSS, layout) is exempt from strict TDD; only behavior is.

## 6. Open decisions

A few choices are deliberately deferred to the implementation team, with a default leaning noted:

- **Default port.** Lean toward an ephemeral port with browser auto-open, rather than a fixed default that may conflict with other services.
- **Auth default policy.** Lean toward refusing `--listen 0.0.0.0` without `--token`; localhost binding doesn't require a token.
- **Plugin distribution format.** Lean toward a tarball containing `plugin.toml` plus a `bin/` directory. The plugin installer extracts to the appropriate plugins directory and validates the manifest.
- **Plugin registry mechanics.** v1 supports local paths and direct git URLs. A centralized registry is a v2 concern.
- **Whether the kernel's filesystem watch service is exposed to the WebSocket channel for the UI.** Lean toward yes, with a debounce, so the UI updates when files change without needing a watcher plugin. This is a borderline case — it interprets filesystem events without interpreting file contents.
- **Bundled official plugins.** v1 installer should drop `zfiles-thumbnailer-images`, `zfiles-search-filename`, and `zfiles-viewer-text` into `~/.config/zfiles/plugins/` by default so the out-of-the-box experience isn't austere. The kernel doesn't know about them; the installer does.