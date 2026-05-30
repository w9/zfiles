# zfiles

Dual-mode file explorer: browse **local folders** via a single Rust binary, or **S3-compatible buckets** (AWS S3, Cloudflare R2) from a static cloud SPA — same UI, two backends. No indexing, no plugins, no filename search.

| Mode | How to run | Storage |
|------|------------|---------|
| **Local** | `zfiles ~/Downloads` | Filesystem via embedded kernel |
| **Cloud** | Deploy `web/dist-cloud/` (see [cloud connect guide](docs/cloud-connect.md)) | S3 / R2 from the browser |

See [design/design.md](design/design.md) for architecture, [design/dual_mode_refactor.md](design/dual_mode_refactor.md) for the migration plan, and [TODO.md](TODO.md) for current work.

## Quick start

```bash
cargo build --release
./target/release/zfiles ~/Downloads
```

Open the printed startup banner in your browser. The explorer uses **Tailwind CSS** and **shadcn/ui** components, with **English** and **简体中文** language support in the header. By default zfiles binds `127.0.0.1` on an ephemeral port and launches your desktop browser. The header shows a live **Connected** / **Offline** status pill and a **Light / Dark / Auto** theme control (preference is saved in the browser).

LAN shares (`--host 0.0.0.0 --token`) include a network share URL in the banner and print a terminal QR code other devices can scan to open the explorer.

```bash
# Pin the port (host defaults to 127.0.0.1)
zfiles --port 9000

# Bind all interfaces with auto-generated token; prints share URL and QR code
zfiles --host 0.0.0.0 --port 8080 --token

# Read-only LAN share
zfiles --host 0.0.0.0 --port 8080 --token --read-only

# Serve without opening a browser tab
zfiles --no-open

# Verbose logging (-v debug, -vv trace; RUST_LOG overrides when set)
zfiles -v ~/Downloads
zfiles -vv --port 9000
```

## CLI

```bash
# Initialize ~/.config/zfiles/ (and per-folder config when a path is given)
zfiles init
zfiles init ~/Downloads

# Show folder status (serve id, state dir)
zfiles status ~/Downloads

# Upload to a remote server
zfiles upload http://laptop:8080 ./dataset.tar.zst --token "$TOKEN" --resume

# Background daemon
zfiles daemon start ~/Downloads --port 8080
zfiles daemon status ~/Downloads
zfiles daemon stop ~/Downloads

# Multi-folder daemon config
zfiles daemon start --config ~/.config/zfiles/daemon.toml
```

Example `daemon.toml`:

```toml
[[share]]
path = "/home/you/Downloads"
port = 8080

[[share]]
path = "/home/you/Photos"
port = 8081
```

```bash
# Configuration (global defaults + per-folder overrides)
zfiles config get server.read_only
zfiles config set server.open_browser false
zfiles config get server.read_only --folder ~/Downloads
zfiles config set server.read_only true --folder ~/Downloads
```

## Config and cache layout

Kernel settings and durable state live under **`~/.config/zfiles/`**. The served directory is never modified for zfiles housekeeping.

```
~/.config/zfiles/
  config.toml              Global defaults
  folders/<serve-id>/      Per serve-root config, state.db, upload spools
```

Each absolute serve root gets a stable id (hash of the canonical path). Use `zfiles status` to see the id and paths for a folder.

## Read-only serve roots

If the served directory cannot be written (read-only mount, permission-restricted folder, etc.), zfiles automatically enables **read-only mode** (uploads and deletes are disabled). State still lives under `~/.config/zfiles/folders/<serve-id>/`; the startup banner shows `Mode: read-only …` and the state directory path.

## Symlinks outside the serve root

When serving on **localhost** (loopback bind, the default), zfiles follows symlinks whose targets resolve **outside** the served directory — for example `~/Projects` → `/Projects`. Symlinks to folders inside the serve root always work normally.

When binding to a non-loopback address (e.g. `--host 0.0.0.0 --port 8080 --token`), outbound symlinks are rejected by default (`path escapes served directory`, HTTP 400). Pass `--follow-symlinks-outside-root` to enable follow mode on public binds, or `--no-follow-symlinks-outside-root` to disable it on localhost.

The policy is read/list only; uploads and writes still cannot escape the serve root via symlinks. `/api/health` reports `follow_symlinks_outside_root`.

## Frontend (shadcn/ui)

The explorer UI lives in `web/` and uses [shadcn/ui](https://ui.shadcn.com/docs/components) components configured via `web/components.json`.

To add or refresh a registry component:

```bash
cd web
pnpm dlx shadcn@latest add <component> --overwrite
pnpm test && pnpm build
```

After CLI updates, reconcile wrappers under `web/src/components/ui/` with any zfiles-specific styling (for example `CommandDialog` uses `p-0` content padding, confirm dialogs hide the close button). Rebuild `web/dist` before `cargo build` so embedded assets stay in sync.

### File icons

Listing file and folder icons come from [Material Icon Theme](https://github.com/material-extensions/vscode-material-icon-theme) (MIT). `pnpm build` runs `scripts/generate-file-icons.mts`, which calls the `material-icon-theme` npm package to emit association metadata and copy referenced SVGs into `web/public/file-icons/` for embedding in the static binary.

Image preview in the explorer uses the browser to decode common formats (JPEG, PNG, WebP, GIF, AVIF, BMP, ICO) via `/api/file`; other types show metadata and a download link.

Sortable listing columns are intentionally deferred: the virtual-scrolled table would need `@tanstack/react-table` integrated with `@tanstack/react-virtual` in a follow-up pass.

## Development

```bash
# Run tests
cargo test

# Generate test fixtures (small, unicode, deep)
./scripts/generate-fixtures.sh ./fixtures

# Build the embedded frontend (required before release builds)
cd web && pnpm install && pnpm build && cd ..

cargo build -p zfiles

# Cloud SPA (static deploy artifact, separate from the embedded binary)
cd web && pnpm build:cloud
# Serve locally: pnpm preview:cloud — open / (emitted as index.html)
# Deploy the contents of web/dist-cloud/ to any static host (S3, R2, nginx, …)

# Install to ~/.cargo/bin
./scripts/install-local.sh
# Or manually:
# cargo install --path .
```

### Frontend HMR (dev-frontend)

For interactive UI work without rebuilding `web/dist` or recompiling embedded assets, run Vite and zfiles with the dev proxy:

```bash
# Terminal 1 — Vite dev server (port 5173)
cd web && pnpm install && pnpm dev

# Terminal 2 — zfiles proxies UI to Vite; API stays on zfiles
cargo dev-frontend ~/Downloads --port 9000 --no-open
# equivalent to: cargo run --features dev-frontend -- ~/Downloads --dev-frontend --port 9000 --no-open
```

Open the zfiles URL from the startup banner (e.g. `http://127.0.0.1:9000/`). React/TS/CSS changes hot-reload through Vite; `/api/*` and WebSocket events are served by zfiles as in production. `/file-icons/*` is served from the embedded `web/dist` build (run `pnpm build` once if icons are missing).

Optional: `--vite-url http://127.0.0.1:5173` if Vite listens elsewhere.

### Cloud SPA (self-hosted)

The explorer core lives in `web/src/explorer/` and is imported by two Vite entry points:

| Entry | Build | Output | Use |
|-------|-------|--------|-----|
| `src/entries/main-local.tsx` | `pnpm build` | `web/dist/` | Embedded in the Rust binary (kernel backend) |
| `src/entries/main-cloud.tsx` | `pnpm build:cloud` | `web/dist-cloud/` | Static deploy against S3/R2 |

Cloud builds omit kernel-only boot code; local builds omit the AWS SDK. Interactive cloud development:

```bash
cd web && pnpm dev:cloud
```

Open the connect dialog, paste temporary bucket credentials, and browse. Non-secret URL params (`provider`, `bucket`, `region`, `endpoint`, `prefix`, `readonly`) pre-fill the form. Credentials stay in `sessionStorage` for the tab lifetime only.

Documentation:

- [Cloud connect flow and credentials](docs/cloud-connect.md)
- [Bucket CORS setup (required)](docs/cors.md)

## API (kernel)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check (`read_only`, `follow_symlinks_outside_root`) |
| `/api/list?path=` | GET | Directory listing |
| `/api/actions` | POST | Run action on `paths[]` (kernel `file.delete`) |
| `/api/metadata?path=` | GET | File or directory metadata |
| `/api/file?path=` | GET | Download file (supports `Range`) |
| `/api/upload` | POST | Create tus upload |
| `/api/upload/:id` | PATCH, HEAD | Resume / query tus upload |
| `/api/ws` | GET (upgrade) | Live kernel events |
