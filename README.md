# zfiles

Local file server with a browser-based explorer. Run `zfiles` in a directory to browse, download, and upload files instantly — no indexing, no configuration.

See [DESIGN.md](DESIGN.md) for architecture and goals. See [TODO.md](TODO.md) for current work.

## Quick start

```bash
cargo build --release
./target/release/zfiles ~/Downloads
```

Open the printed URL in your browser. By default zfiles binds `127.0.0.1` on an ephemeral port.

```bash
# Pin the port
zfiles --port 9000

# LAN sharing with bearer-token auth
zfiles --listen 0.0.0.0:8080 --token
```

## Development

```bash
# Run tests
cargo test

# Build the embedded frontend (required before release builds)
cd web && pnpm install && pnpm build && cd ..
cargo build
```

## API (kernel)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/list?path=` | GET | Directory listing |
| `/api/stat?path=` | GET | File or directory metadata |
| `/api/file?path=` | GET | Download file (supports `Range`) |
| `/api/upload` | POST | Create tus upload |
| `/api/upload/:id` | PATCH, HEAD | Resume / query tus upload |
| `/api/ws` | GET (upgrade) | Live kernel events |
