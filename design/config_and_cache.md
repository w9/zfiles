# Config and cache storage

## Overview

zfiles keeps the served directory clean. Kernel configuration and durable runtime state live under the XDG base directories — `~/.config/zfiles` and `~/.cache/zfiles` by default — not in a hidden `.zfiles/` folder inside the tree being browsed.

This matches how desktop tools behave: settings and state are per-user and per-machine; the folder you serve is just files. A fresh clone, read-only mount, or `rsync` of a project directory never picks up zfiles metadata, and browsing a directory creates no side effects on disk until something actually needs to be written (an upload or a config change).

The layout follows the [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html). Environment variables override the defaults:

| Variable | Default when unset | Used for |
|----------|-------------------|----------|
| `XDG_CONFIG_HOME` | `$HOME/.config` | Settings and durable kernel state |
| `XDG_CACHE_HOME` | `$HOME/.cache` | Reserved for future regeneratable data |

When `HOME` is unset, the kernel falls back to relative `.config` and `.cache` under the process working directory so container and test environments still work.

## Design principles

1. **No in-tree metadata.** The served directory is never modified for zfiles housekeeping. There is no `.zfiles/`, no bootstrap config, and no dot-folder relocation knob — paths are always derived from XDG locations and a stable serve-root identifier.

2. **Config vs cache.** Config holds settings and data that must survive cache eviction. If in doubt, treat kernel-owned upload spools and SQLite state as config, not cache.

3. **Lazy creation.** Directories are created on first write, not at startup. Cold start stays instant; read-only browsing of an arbitrary folder touches nothing outside memory.

4. **Per serve-root isolation.** Each absolute serve root gets a stable 16-hex-digit id (hash of the canonical path). Folder-scoped config and state live under that id so serving `~/Downloads` and `~/Photos` concurrently never collides.

5. **Same-filesystem uploads.** Tus upload completion still uses `rename(2)` into the served tree. The spool directory must sit on the same filesystem as the destination file. The kernel warns at startup when the serve root and spool path cross a mount boundary.

## Directory layout

### Config (`$XDG_CONFIG_HOME/zfiles/`)

```
~/.config/zfiles/
  config.toml                 Global defaults (browser, logging, UI)
  daemon.toml                 Multi-folder daemon definition
  folders/
    <serve-id>/               One entry per absolute serve root
      config.toml             Per-folder overrides (read_only, ui.*, …)
      state.db                SQLite WAL — tus uploads, session tokens
      uploads/                In-progress tus spool files
      logs/                   Kernel log output for this serve root
```

### Cache (`$XDG_CACHE_HOME/zfiles/`)

```
~/.cache/zfiles/
  logs/                       Optional shared diagnostic output (future)
```

The cache tree is minimal today; kernel state lives under config.

## Serve-root identity

The serve id is `format!("{:016x}", hash(canonical_absolute_path))` using the standard library hasher. Two paths that resolve to the same canonical location share state; symlinks and `..` normalization happen before hashing.

Examples:

| Serve root | Config path |
|------------|-------------|
| `/home/alice/Downloads` | `~/.config/zfiles/folders/a1b2c3d4e5f67890/config.toml` |
| Same path via symlink | Same id and paths |

The id appears in `zfiles status` and debug logs; users normally interact through `zfiles config … --folder <path>` rather than editing hashed directory names.

## Configuration resolution

On startup for serve root `R`:

1. Load `~/.config/zfiles/config.toml` if present; otherwise use built-in defaults.
2. Compute `serve-id` from `R`.
3. Load `~/.config/zfiles/folders/<serve-id>/config.toml` if present; merge over globals (folder wins on conflict).
4. Bind listener and serve.

There is no config file inside `R`. The `--folder` flag on `zfiles config get/set` selects which folder-scoped file to read or write by resolving `R` to its serve id.

Global keys cover daemon-wide and default UI behavior. Folder keys cover `server.read_only`, sort preferences, and anything that legitimately differs per served tree.

## State and uploads

The `state` module owns everything under `folders/<serve-id>/` except `config.toml`:

- **`state.db`** — tus upload offsets and auth session rows. Opened lazily on first upload or token use.
- **`uploads/`** — spool files named by upload uuid. Created lazily.
- **`logs/`** — per-folder kernel logs when file logging is enabled.

Read-only mode is inferred when the serve root is not writable (same as today), combined with explicit `server.read_only` in config or `--read-only` on the CLI. Uploads are rejected; listing and download continue.

Deleting `folders/<serve-id>/` resets that folder's kernel state. In-progress uploads are lost; the served tree is untouched.

## Interaction with cold start

The startup sequence:

1. Parse CLI args
2. Resolve serve root and load merged config from XDG paths (stat only the config files that exist — no directory scans)
3. Bind the TCP listener
4. Spawn the browser asynchronously
5. Begin serving

Still absent from startup: directory scanning, index building, cache warming, creating XDG trees upfront.

## CLI and tooling

| Command | Effect |
|---------|--------|
| `zfiles init` | Create `~/.config/zfiles/config.toml` with defaults; does not start the server |
| `zfiles config get/set … --folder PATH` | Read/write `folders/<serve-id>/config.toml` |
| `zfiles config get/set …` (no folder) | Read/write global `config.toml` |
| `zfiles status` | Print serve root, serve id, config/state paths, read-only flag |
| `zfiles daemon start --config ~/.config/zfiles/daemon.toml` | Unchanged path convention |

`zfiles init` is optional — missing config files simply mean defaults apply.

## Migration from in-tree `.zfiles/`

v1 shipped with a `.zfiles/` directory inside the serve root (and an XDG fallback when the root was read-only). That layout is **removed** from the design; new installs use XDG only.

A future `zfiles migrate` command (out of scope for the design doc itself) may:

1. Detect `<serve-root>/.zfiles/`
2. Copy `config.toml` → `folders/<serve-id>/config.toml`
3. Move `state.db` and `uploads/` into the XDG locations
4. Leave a short `MIGRATED` note or remove the old tree after confirmation

Until migration exists, users with existing in-tree state move files manually or re-create config.

## Failure modes

| Event | Behavior |
|-------|----------|
| `folders/<id>/` deleted | Upload resume state lost; config for that root resets to global defaults |
| Config unwritable | Kernel fails on first write with a clear error; read-only serve may still work |
| Serve root deleted | Orphaned XDG entries remain harmless; optional `zfiles folders prune` later |
| Cross-mount spool | Warning at startup; atomic upload completion may fail for destinations on another mount |

## Open decisions

- **`XDG_STATE_HOME`.** Some tools put SQLite under `~/.local/state`. We keep kernel state under config for simplicity and fewer roots; revisit if state files grow large.
