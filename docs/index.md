# zfiles — Project Index

## What It Is

zfiles is a dual-mode file explorer delivered as a single, zero-dependency static binary. It serves a local filesystem over HTTP with an embedded React UI, and the same UI can run as a standalone SPA against S3-compatible object storage (cloud mode).

**Design goals:**
- Sub-100ms cold start, no indexing or cache warm-up
- Wire-speed transfers via `sendfile(2)` and the tus resumable upload protocol
- Single ~10 MB musl binary (Linux x86_64/aarch64) with SPA embedded
- Keyboard-first UI with command palette, virtual-scrolled listings, and image slideshow
- LAN sharing via bearer token + optional QR code
- 14 locales, fullscreen image viewer, file operation conflict resolution

---

## Technology Stack

| Layer | Technology |
|---|---|
| Backend language | Rust (stable) |
| HTTP framework | Axum + Tokio |
| UI embedding | rust-embed (compiles `web/dist/` into binary) |
| File watching | notify → WebSocket push |
| Upload protocol | tus.io (resumable, atomic rename) |
| Download | HTTP Range requests (`sendfile(2)` on Linux) |
| CLI | clap |
| Frontend framework | React 19 + Vite 6 |
| Styling | Tailwind CSS 4 + shadcn/ui + Radix UI |
| Table/virtualization | TanStack React Table + React Virtual |
| Cloud storage | AWS SDK v3 (browser-side, S3/R2) |
| i18n | Custom provider, 14 locales |

---

## Folder Structure

```
zfiles/
├── src/                # Rust backend
├── web/                # React frontend (TypeScript)
│   ├── src/            # Application source
│   ├── dist/           # Local build output (embedded in binary)
│   └── dist-cloud/     # Cloud build output (static deploy)
├── tests/              # Rust integration tests
├── e2e/                # End-to-end tests
├── design/             # Architecture and design docs
├── docs/               # User-facing documentation
├── fixtures/           # Test fixtures
├── scripts/            # Build utilities
├── Cargo.toml          # Rust crate manifest (v0.2.110)
└── build.rs            # Build script
```

---

## Backend (`src/`)

| File | Role |
|---|---|
| `main.rs` | Entry point; calls `cli::Cli::parse()` |
| `cli.rs` | CLI definition (clap) |
| `commands.rs` | Command routing: serve, upload, config, daemon, status |
| `transport.rs` | Axum router; all HTTP/WS endpoints |
| `fs.rs` | `Fs` trait + `LocalFs` implementation |
| `auth.rs` | Token/cookie/bearer authentication middleware |
| `upload.rs` | tus protocol handler |
| `download.rs` | HTTP Range download |
| `watch.rs` | Filesystem watcher → WebSocket broadcast |
| `state.rs` | Upload session state persistence |
| `embed.rs` | Serves `web/dist/` as embedded static assets |
| `config.rs` | XDG config file loading |
| `daemon.rs` | Background process support |
| `banner.rs` | Startup banner and URL display |
| `vite_proxy.rs` | Dev-mode proxy to Vite HMR (feature-gated) |

### HTTP API

```
GET    /api/health             health check
GET    /api/list?path=         directory listing
POST   /api/actions            file operations (delete, mkdir, rename, copy, move)
GET    /api/metadata?path=     file/directory metadata
GET    /api/file?path=         download (Range-aware)
POST   /api/upload             create tus session
HEAD   /api/upload/:id         query tus offset
PATCH  /api/upload/:id         resume tus upload
DELETE /api/upload/:id         abort tus session
GET    /api/ws                 WebSocket (filesystem events)
GET    /api/keybindings        keyboard shortcuts list
*      /                       fallback → embedded SPA
```

---

## Frontend (`web/src/`)

| Directory | Role |
|---|---|
| `entries/` | Build entry points: `main-local.tsx`, `main-cloud.tsx` |
| `backend/` | `ExplorerBackend` trait; `KernelBackend` (local) and `S3Backend` (cloud) |
| `explorer/` | Core explorer: selection, navigation, marquee select, grid/list layout |
| `actions/` | Command palette, built-in actions, appearance toggles |
| `local/` | tus upload session management |
| `cloud/` | Cloud mode: connect dialog, S3 multipart upload, `CloudApp` |
| `settings/` | Grid size, sort order, theme, locale providers |
| `fileOperations/` | Conflict resolution dialogs for paste operations |
| `components/` | Toolbar, breadcrumb, preview pane, dialogs |
| `routing/` | URL routing and navigation state |
| `i18n/` | Internationalization (14 locales) |
| `lib/` | Utility functions |
| `generated/` | Build-generated icon mappings |

### Key Components

| Component | Purpose |
|---|---|
| `ExplorerApp.tsx` | Root explorer UI (~79 KB, the core) |
| `AppShell.tsx` | Layout wrapper for local mode |
| `CloudApp.tsx` | Cloud mode root component |
| `UploadPanel.tsx` | Upload queue manager (~41 KB) |
| `VirtualListing.tsx` | Virtualized list view |
| `GridListing.tsx` | Virtualized grid view |
| `SlideshowOverlay.tsx` | Fullscreen image viewer |
| `PreviewPane.tsx` | File preview sidebar |
| `CommandPalette.tsx` | Keyboard-driven action launcher |

---

## Dual-Mode Architecture

### Local Mode

```
Browser
  └─ React (KernelBackend)
       │  REST + WebSocket
       ▼
  Axum server (Rust binary)
       │  auth, routing, tus, watch
       ▼
  Local Filesystem
```

The React SPA is compiled into the binary via rust-embed and served from `/`. All API calls go to the same origin.

### Cloud Mode

```
Browser (static host)
  └─ React (S3Backend)
       │  AWS SDK v3 (in-browser)
       ▼
  S3 / Cloudflare R2
```

Credentials are entered in a connect dialog and stored only in `sessionStorage`. No server component needed — the SPA is deployed as static files.

---

## Build

```bash
# Frontend
cd web && pnpm install && pnpm build          # → web/dist/  (local mode)
cd web && pnpm build:cloud                     # → web/dist-cloud/  (cloud SPA)

# Backend (embeds web/dist/ at compile time)
cargo build --release                          # → target/release/zfiles
```

Development uses `cargo dev-frontend` (Vite proxy) alongside `pnpm dev` for HMR.

---

## Testing

| Suite | Command | Coverage |
|---|---|---|
| Rust unit + integration | `cargo test` | listing, upload, auth, daemon, perf SLAs |
| TypeScript unit | `pnpm test` (in `web/`) | business logic, backend adapters |
| End-to-end | `e2e/` harness | full browser flows |

Performance SLAs (e.g., startup < 100 ms, download ≥ 110 MB/s) are asserted in the Rust test suite.

---

## Performance Targets

| Metric | Target |
|---|---|
| Cold start | < 100 ms |
| Binary size | ≤ 10 MB (musl, stripped) |
| Download throughput | ≥ 110 MB/s (single connection) |
| Directory size | Unlimited (no index) |

---

## Further Reading

| Document | Path | Topic |
|---|---|---|
| Architecture & invariants | `design/design.md` | Full technical design |
| Action system | `design/action_system.md` | Keyboard commands and dispatch |
| Dual-mode refactor notes | `design/dual_mode_refactor.md` | Module layout and migration |
| Config & cache paths | `design/config_and_cache.md` | XDG paths, tus spool, state |
| Cloud connect flow | `docs/cloud-connect.md` | Credential input, URL params |
| S3 CORS setup | `docs/cors.md` | Bucket CORS for cloud mode |
