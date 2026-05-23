# zfiles

Local file server with a browser-based explorer. Run `zfiles` in a directory to browse, download, and upload files instantly — no indexing, no configuration.

See [DESIGN.md](DESIGN.md) for architecture and goals. See [TODO.md](TODO.md) for current work.

## Quick start

```bash
cargo build --release
./target/release/zfiles ~/Downloads
```

Open the printed startup banner in your browser. The explorer uses **Tailwind CSS** and **shadcn/ui** components, with **English** and **简体中文** language support in the header. By default zfiles binds `127.0.0.1` on an ephemeral port and launches your desktop browser. The header shows a live **Connected** / **Offline** status pill and a **Light / Dark / Auto** theme control (preference is saved in the browser).

LAN shares (`--listen 0.0.0.0 --token`) include a network share URL in the banner and print a terminal QR code other devices can scan to open the explorer.

```bash
# Pin the port
zfiles --port 9000

# Bind all interfaces with auto-generated token; prints share URL and QR code
zfiles --listen 0.0.0.0:8080 --token

# Read-only LAN share
zfiles --listen 0.0.0.0:8080 --token --read-only

# Serve without opening a browser tab
zfiles --no-open
```

## CLI

```bash
# Initialize .zfiles/ with defaults (no server)
zfiles init ~/Downloads

# Search filenames via installed searcher plugin
zfiles search ~/notes "meeting"

# Show folder status
zfiles status ~/Downloads

# Upload to a remote server
zfiles upload http://laptop:8080 ./dataset.tar.zst --token "$TOKEN" --resume

# Plugin management
zfiles plugin install ./fixtures/plugins/search-filename
zfiles plugin list
zfiles plugin remove search-filename --path ~/Downloads

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
# Configuration
zfiles config get server.read_only --folder ~/Downloads
zfiles config set server.read_only true --folder ~/Downloads

# Relocate .zfiles/ outside the served tree (bootstrap config stays in-place)
zfiles config set state.dotfolder_path /var/lib/zfiles/downloads --folder ~/Downloads
```

# Read-only or non-writable folders

If the served directory cannot be written (read-only mount, permission-restricted folder, etc.), zfiles automatically:

- enables **read-only mode** (uploads and deletes are disabled), and
- stores kernel state under **`~/.config/zfiles/dotfolders/<id>/`** instead of `<folder>/.zfiles/`.

The startup banner shows when this happens (`Mode: read-only …` and `State: …`). You can still pass `--read-only` explicitly or relocate state manually:

```bash
zfiles config set state.dotfolder_path /var/lib/zfiles/downloads --folder ~/Downloads
```

Relocated dot-folders store `state.db`, uploads, plugins, and daemon pid files under the configured path while a bootstrap `~/Downloads/.zfiles/config.toml` can point at the external location.

## Frontend (shadcn/ui)

The explorer UI lives in `web/` and uses [shadcn/ui](https://ui.shadcn.com/docs/components) components configured via `web/components.json`.

To add or refresh a registry component:

```bash
cd web
pnpm dlx shadcn@latest add <component> --overwrite
pnpm test && pnpm build
```

After CLI updates, reconcile wrappers under `web/src/components/ui/` with any zfiles-specific styling (for example `CommandDialog` uses `p-0` content padding, confirm dialogs hide the close button). Rebuild `web/dist` before `cargo build` so embedded assets stay in sync.

Sortable listing columns are intentionally deferred: the virtual-scrolled table would need `@tanstack/react-table` integrated with `@tanstack/react-virtual` in a follow-up pass.

## Plugin capabilities

Installed plugins can expose `lister`, `searcher`, `thumbnailer`, `viewer`, `action`, `route`, and `watcher` capabilities. Watcher plugins receive `watcher/notify` RPC calls when files change under the served directory (debounced, fire-and-forget).

The release binary **bundles `image-thumbnailer`** by default (JPEG/PNG/WebP thumbnails, image preview, EXIF lister columns). On first run it is extracted to `~/.cache/zfiles/bundled/image-thumbnailer/<version>/`. Folder-scoped or user-scoped installs override the bundled copy. Disable bundling with `cargo build --no-default-features`.

## Development

```bash
# Run tests
cargo test

# Generate test fixtures (small, unicode, deep)
./scripts/generate-fixtures.sh ./fixtures

# Build the embedded frontend (required before release builds)
cd web && pnpm install && pnpm build && cd ..

# Build with bundled image plugin (default; build.rs compiles image-thumbnailer first)
cargo build

# Build kernel only, without bundled plugins
cargo build --no-default-features
```

## API (kernel)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check (`read_only` flag) |
| `/api/plugins` | GET | Ready plugins and capabilities |
| `/api/list?path=` | GET | Directory listing |
| `/api/search?path=&q=` | GET | Filename search (requires searcher plugin) |
| `/api/thumbnail?path=` | GET | Thumbnail image (requires thumbnailer plugin) |
| `/api/preview?path=` | GET | File preview body (requires viewer plugin) |
| `/api/actions?path=` | GET | Context-menu actions (requires action plugin) |
| `/api/actions` | POST | Run action on `path` or `paths[]` (includes kernel `file.delete`) |
| `/plugin/:name/*path` | GET | Plugin static assets or route-plugin handlers |
| `/api/metadata?path=` | GET | File or directory metadata |
| `/api/file?path=` | GET | Download file (supports `Range`) |
| `/api/upload` | POST | Create tus upload |
| `/api/upload/:id` | PATCH, HEAD | Resume / query tus upload |
| `/api/ws` | GET (upgrade) | Live kernel events |
