# zfiles

Local file server with a browser-based explorer. Run `zfiles` in a directory to browse, download, and upload files instantly — no indexing, no configuration.

See [DESIGN.md](DESIGN.md) for architecture and goals. See [TODO.md](TODO.md) for current work.

## Quick start

```bash
cargo build --release
./target/release/zfiles ~/Downloads
```

Open the printed URL in your browser. By default zfiles binds `127.0.0.1` on an ephemeral port. The explorer header shows a live **Connected** / **Offline** status pill and a **Light / Dark / Auto** theme control (preference is saved in the browser).

LAN shares (`--listen 0.0.0.0 --token`) print a **Share URL** (with embedded token) and a terminal QR code other devices can scan to open the explorer.

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

Relocated dot-folders store `state.db`, uploads, plugins, and daemon pid files under the configured path while a bootstrap `~/Downloads/.zfiles/config.toml` can point at the external location.

## Plugin capabilities

Installed plugins can expose `lister`, `searcher`, `thumbnailer`, `viewer`, `action`, `route`, and `watcher` capabilities. Watcher plugins receive `watcher/notify` RPC calls when files change under the served directory (debounced, fire-and-forget).

## Development

```bash
# Run tests
cargo test

# Generate test fixtures (small, unicode, deep)
./scripts/generate-fixtures.sh ./fixtures

# Build the embedded frontend (required before release builds)
cd web && pnpm install && pnpm build && cd ..
cargo build
```

## API (kernel)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/plugins` | GET | Ready plugins and capabilities |
| `/api/list?path=` | GET | Directory listing |
| `/api/search?path=&q=` | GET | Filename search (requires searcher plugin) |
| `/api/thumbnail?path=` | GET | Thumbnail image (requires thumbnailer plugin) |
| `/api/preview?path=` | GET | File preview body (requires viewer plugin) |
| `/api/actions?path=` | GET | Context-menu actions (requires action plugin) |
| `/api/actions` | POST | Run action on `path` or `paths[]` |
| `/plugin/:name/*path` | GET | Plugin static assets or route-plugin handlers |
| `/api/stat?path=` | GET | File or directory metadata |
| `/api/file?path=` | GET | Download file (supports `Range`) |
| `/api/upload` | POST | Create tus upload |
| `/api/upload/:id` | PATCH, HEAD | Resume / query tus upload |
| `/api/ws` | GET (upgrade) | Live kernel events |
