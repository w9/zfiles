# Dual-mode explorer refactor

## Overview

This document describes a major refactor of zfiles: from a local-filesystem server with a plugin microkernel into a **dual-mode file explorer** built on one shared frontend library.

| Mode | Where it runs | Storage | Typical user |
|------|---------------|---------|--------------|
| **Local** | `zfiles` CLI embeds the SPA in the static binary and serves `/api/*` on localhost | Local filesystem | Developer sharing or browsing a folder on their machine |
| **Cloud** | Static SPA hosted at `zfiles.com` (or self-hosted) | S3 or Cloudflare R2 | Anyone with temporary bucket credentials |

Both modes render the **same UI code**. They differ only in boot configuration and the **storage backend adapter** wired at startup. There is no forked explorer, no mode-specific components, and no second copy of listing/navigation/upload logic.

Plugins and filename search are **removed from the project**, not deferred. They were the main blockers to a browser-only cloud deployment and added disproportionate complexity relative to the new product direction.

---

## Mission

1. **One explorer, two backends.** Extract the React UI into a reusable library with a stable `ExplorerBackend` interface. Local mode uses `KernelBackend` (today's REST + WebSocket contract, slimmed). Cloud mode uses `S3Backend` (AWS SDK v3 in the browser against S3-compatible APIs).

2. **Local mode stays embedded.** The CLI continues to ship a single static binary with the frontend baked in via `rust-embed`. `zfiles ~/projects` opens `http://127.0.0.1:<port>/` — same origin, no cross-origin calls to `zfiles.com`, no dependency on the public website for local use.

3. **Cloud mode is a static SPA tool.** Like other open-source browser utilities (JSON formatters, password generators), the hosted site runs entirely in the client. Users paste **temporary** credentials into a connect dialog. Credentials never appear in URL params, never touch server-side logs, and live only in `sessionStorage` for the tab lifetime.

4. **Shrink the kernel.** Remove the plugin supervisor, JSON-RPC subprocess protocol, plugin routes, search endpoint, thumbnail/preview plugin pipeline, and bundled-plugin build. The kernel becomes a focused local HTTP server: list, stat, read (Range), write (tus upload), delete, auth, filesystem watch, and static asset serving.

5. **Document cloud prerequisites.** CORS setup for S3/R2 is a user-facing requirement for cloud mode and must be documented with copy-paste examples.

---

## Constraints and requirements

### Non-negotiable

| # | Requirement |
|---|-------------|
| C1 | **Single shared UI library.** All explorer behavior (listing, breadcrumb, selection, upload, preview shell, actions, i18n, theming) lives in one package consumed by both deployment modes. |
| C2 | **No UI divergence.** Local and cloud modes differ only by backend adapter and boot config — not by parallel component trees or `#ifdef`-style forks. |
| C3 | **Local mode: embedded binary.** SPA assets ship inside the Rust binary; the CLI serves them on localhost. Do not require `zfiles.com` or network access for local browsing. |
| C4 | **Cloud mode: no backend for secrets.** The hosted site is static files only. Bucket credentials are pasted in the browser and stored in `sessionStorage`. No analytics, error reporters, or third-party scripts may capture credential fields. |
| C5 | **URL params: non-secrets only.** Allowed: provider (`aws` / `r2`), bucket name, endpoint, region, prefix path, read-only flag. Forbidden: access keys, secret keys, session tokens. |
| C6 | **Remove plugins.** Delete the plugin supervisor, manifests, bundled plugins, plugin routes, viewer/thumbnail/search/action plugin integration, and plugin-related CLI subcommands. |
| C7 | **Remove search.** Delete the search box, `/api/search`, searcher plugin support, and `zfiles search` CLI. |
| C8 | **Do not break local-first SLAs where they still apply.** Local mode retains instant cold start, resumable tus upload, and Range download for the served directory. |

### Security and privacy (cloud mode)

- Credentials are entered via a connect dialog, validated with a minimal harmless API call (`HeadBucket` or `ListObjectsV2` with `MaxKeys=1`), then held in memory / `sessionStorage`.
- A prominent **Disconnect** control clears credentials and resets application state.
- Optional `localStorage` persistence is limited to **non-secret** preferences (last provider, bucket name, endpoint, theme, locale) — never keys or tokens.
- Privacy copy on the connect screen: credentials stay in the browser; the static host never receives them.

### Security and privacy (local mode)

- Existing bearer-token / session-cookie auth model is preserved for LAN shares (`--token`, `--read-only`, `--expire`).
- Local mode never sends filesystem credentials to `zfiles.com`.

### Cross-origin boundary

- A page loaded from `https://zfiles.com` **must not** be the integration point for a local CLI backend. Browser mixed-content and Private Network Access rules make public-site → localhost unreliable.
- The CLI opens **`http://127.0.0.1:<port>/`**, not `zfiles.com`, when serving a local directory.

### Cloud storage semantics

- Object keys map to explorer paths using `/` as the folder delimiter (`ListObjectsV2` with `Prefix` + `Delimiter: "/"`).
- Listing is **paginated** (S3 returns at most 1000 keys per call). The UI and `S3Backend` must support continuation tokens; unbounded single-shot listing is not acceptable.
- Upload uses S3 multipart upload (via `@aws-sdk/lib-storage`), replacing tus in cloud mode. Local mode keeps tus against the kernel.
- Delete, copy, and move follow S3 semantics (delete object; "move" = copy + delete). Empty prefix "folders" may not exist as objects — the UI treats common prefixes as directories without requiring placeholder objects.
- CORS must be configured on the bucket. Document required methods and headers for AWS S3 and Cloudflare R2.

### Preview and thumbnails (post-plugin)

- No server-side thumbnail pipeline in v1 of this refactor.
- Cloud mode: client-side preview for common image types (JPEG, PNG, WebP, GIF) via browser decode; other types show metadata + download link.
- Local mode: same client-side preview where feasible; optional future kernel `/api/preview` for text files is out of scope unless explicitly added later.

### Internationalization

- All user-visible strings continue to go through the i18n layer (English + Simplified Chinese minimum).
- Remove plugin catalog i18n loading (`/api/plugins/i18n`, manifest locale bundles).

---

## Architecture (target)

```
┌─────────────────────────────────────────────────────────────────┐
│                     @zfiles/explorer (shared)                   │
│  App shell · listing · breadcrumb · upload UI · preview shell   │
│  action system (built-ins only) · i18n · theming                │
└────────────────────────────┬────────────────────────────────────┘
                             │ ExplorerBackend
              ┌──────────────┴──────────────┐
              ▼                             ▼
   ┌─────────────────────┐       ┌─────────────────────┐
   │   KernelBackend     │       │     S3Backend       │
   │ fetch /api/* + ws   │       │ @aws-sdk/client-s3  │
   └──────────┬──────────┘       └──────────┬──────────┘
              ▼                             ▼
   ┌─────────────────────┐       ┌─────────────────────┐
   │  zfiles kernel      │       │  S3 / R2 API        │
   │  (embedded SPA)     │       │  (direct from browser)│
   └─────────────────────┘       └─────────────────────┘
```

### `ExplorerBackend` (contract sketch)

The shared library depends on this interface — not on `/api/*` paths or AWS SDK types directly in UI components.

```ts
interface ExplorerBackend {
  /** Provider label for status UI */
  readonly mode: "local" | "s3";

  connect?(): Promise<void>;           // cloud: validate creds; local: no-op or health check
  disconnect?(): Promise<void>;       // cloud: clear session creds

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

type BackendEventHandler = (event: BackendEvent) => void;
// local: filesystem_changed, upload_progress, connected
// cloud: optional polling tick or omitted
```

`FileEntry` keeps today's shape (`name`, `path`, `is_dir`, `size`, `modified`) so listing components require minimal change.

### Kernel API (local mode, after slimming)

Retained routes:

| Route | Purpose |
|-------|---------|
| `GET /api/health` | Status, read-only flag |
| `GET /api/list` | Directory listing (may add pagination later for parity) |
| `GET /api/metadata` | Stat |
| `GET /api/file` | Range-aware download |
| `POST /api/upload`, `HEAD/PATCH /api/upload/{id}` | tus upload |
| `POST /api/actions` | Built-in actions only (`file.delete`, etc.) |
| `GET /api/ws` | Filesystem watch + connection handshake |

Removed routes:

| Route | Reason |
|-------|--------|
| `GET /api/search` | Search removed |
| `GET /api/plugins`, `/api/plugins/i18n` | Plugins removed |
| `GET /api/thumbnail`, `/api/preview` | Plugin pipeline removed |
| `GET /api/actions` (plugin-scoped listing), plugin action dispatch | Plugins removed |
| `GET /plugin/{name}/*` | Plugin static assets removed |

### Action system

Keep the action system for **built-in actions only** (navigation, selection, delete, copy-path, view toggles, theme). Remove plugin action registration, `plugin.*` context keys, and `/api/actions/catalog` plugin entries. Update `design/action_system.md` in a follow-up pass to reflect the reduced scope.

---

## What gets removed

### Rust kernel

- `plugins` module and supervisor
- Plugin discovery, bundled plugins (`build.rs` plugin staging, `bundled_plugins`, `rust-embed` plugin assets)
- JSON-RPC stdio protocol and conformance suite (or reduce conformance to a archived reference)
- `/api/search`, `/api/thumbnail`, `/api/preview`, `/api/plugins*`, `/plugin/*`
- Plugin-scoped action dispatch
- `zfiles plugin *` and `zfiles search` CLI subcommands

### Frontend

- Search input, search results state, `searcher.ready` context key
- Plugin loading (`/api/plugins`), plugin viewers, plugin thumbnails, plugin context menu actions
- `PreviewPane` dynamic ESM import / iframe sandbox viewer pipeline (replace with simple preview)
- Slideshow tied to plugin thumbnail tiers (may keep slideshow over client-decodable images only, or remove)
- `/api/plugins/i18n` and plugin catalog i18n

### Repository directories

- `plugins/` (entire tree, including `image-thumbnailer`, `thumbnailer-raw`, etc.)
- Plugin-related tests and E2E scenarios
- Plugin documentation in README

### Documentation debt (follow-up, not blocking this plan)

- Revise `design/design.md` microkernel / plugin sections
- Revise `design/config_and_cache.md` plugin cache layout
- Revise or retire `design/image_extension.md`

---

## Practical high-level steps

Work proceeds in ordered phases. Each phase should leave the tree in a buildable, testable state. Prefer deleting dead code aggressively once the replacement path exists — do not maintain parallel plugin and non-plugin code paths.

### Phase 0 — Design lock and inventory

- [x] Review and approve this document.
- [x] Append implementation TODO items to `TODO.md` (implementation cycles follow separately).
- [x] Inventory all plugin/search touchpoints (`grep` audit across `src/`, `web/`, `tests/`, `e2e/`, `README`).

### Phase 1 — Introduce `ExplorerBackend` in the frontend

- [x] Define `ExplorerBackend`, `FileEntry`, `FileStat`, event types in a dedicated module (e.g. `web/src/backend/`).
- [x] Implement `KernelBackend` as a thin wrapper over today's `apiFetch` / WebSocket calls — no behavior change yet.
- [x] Refactor `App.tsx`, `PreviewPane`, `upload.ts`, and `useBackendStatus.ts` to call the backend interface instead of raw `/api/*` URLs.
- [x] Gate all backend access through a React context or hook (`useExplorerBackend()`).
- [x] Existing local embedded mode must behave identically after this phase.

### Phase 2 — Remove search

- [x] Remove search UI, debounced `/api/search` calls, and related context keys / actions.
- [x] Remove `GET /api/search` handler and any searcher plugin dispatch.
- [x] Remove `zfiles search` CLI.
- [x] Update i18n strings and README.

### Phase 3 — Remove plugins (frontend first, then kernel)

- [x] Replace `PreviewPane` plugin viewer with a minimal preview: image (client decode), text (optional later), fallback metadata + download.
- [x] Remove thumbnail WebSocket events, grid thumbnail URLs from `/api/thumbnail`, and plugin-ready gating.
- [x] Remove plugin context menu actions and plugin action catalog loading.
- [x] Remove kernel plugin supervisor, routes, and subprocess spawning.
- [x] Remove `plugins/` directory, bundled plugin build, and plugin CLI.
- [x] Delete or rewrite plugin integration tests.

### Phase 4 — Slim kernel and simplify WebSocket events

- [x] Reduce WebSocket event set to: `connected`, `filesystem_changed`, `upload_progress`.
- [x] Ensure built-in delete (and any remaining kernel actions) work through `/api/actions` without plugin dispatch.
- [x] Remove dead dependencies from `Cargo.toml` and shrink binary where measurable.

### Phase 5 — Implement `S3Backend` and cloud boot path

- [x] Add `@aws-sdk/client-s3` and `@aws-sdk/lib-storage` to the web package.
- [x] Implement `S3Backend` with paginated listing, multipart upload, delete, HeadObject stat, presigned or direct GetObject download.
- [x] Build connect dialog: provider preset (AWS / R2), endpoint, region, bucket, credential fields, test connection, disconnect.
- [x] Parse non-secret boot params from URL (`provider`, `bucket`, `prefix`, `endpoint`, `region`, `readonly`).
- [x] Store credentials in `sessionStorage` after successful connect.
- [x] Add boot mode detection: local (default when served from kernel) vs cloud (static host build flag or empty `/api/health`).

### Phase 6 — Package layout and dual build targets

- [x] Restructure `web/` so the explorer core is importable as a library entry point (`ExplorerApp` + backend injection).
- [x] **Local build:** Vite build → `web/dist` → embedded by Rust (unchanged pipeline).
- [x] **Cloud build:** Same source, different Vite config or env (`VITE_BOOT_MODE=cloud`) producing a static deploy artifact with no kernel API assumptions.
- [x] Document self-hosting and reproducible build expectations for the cloud SPA.

### Phase 7 — Documentation and CORS guides

- [x] Add `docs/cors.md` (or README section): AWS S3 and Cloudflare R2 CORS rules required for list/get/put/delete/multipart.
- [x] Document connect flow, credential scope recommendations (least-privilege IAM / R2 token), and disconnect behavior.
- [x] Update README product description: dual-mode explorer, plugins/search no longer supported.
- [x] Update `design/design.md` to point at this document as the current architectural direction.

### Phase 8 — Cleanup and verification

- [x] Remove stale design references to plugins as a v1 feature.
- [x] Run full test suite; fix or delete obsolete tests.
- [x] Measure binary size delta after plugin removal (see note below).
- [ ] Manual smoke: local CLI + cloud static build against a test R2 bucket.

**Release binary size (May 2026, Linux x86_64):** `target/release/zfiles` ≈ **16 MB** with embedded local SPA and no plugin supervisor or bundled plugin assets. Pre-refactor baseline was not recorded in-repo; the plugin embed and subprocess machinery are gone.

---

## Testing strategy

Tests prove the refactor succeeded. The bar is: **both modes work end-to-end; nothing plugin- or search-related remains; the shared library has a single code path.**

### Unit tests (frontend)

| Area | What to test |
|------|--------------|
| `KernelBackend` | Maps list/stat/upload/delete to correct `/api/*` calls; parses kernel JSON shapes |
| `S3Backend` | Prefix/delimiter listing logic, cursor pagination merge, path ↔ key conversion, error mapping |
| Boot config | URL param parsing accepts allowed keys only; rejects unknown secret-like params in docs/tests |
| Credential storage | Connect writes to `sessionStorage`; disconnect clears it; nothing written to `localStorage` |
| Preview | Image path detection routes to client preview; unknown extension shows fallback |
| Action system | Built-in actions invoke backend methods; no `searcher.ready` / `plugin.*` context keys remain |

Run: `pnpm test` in `web/`.

### Unit / integration tests (Rust kernel)

| Area | What to test |
|------|--------------|
| Slim router | `/api/list`, `/api/file`, `/api/upload`, `/api/actions`, `/api/health`, `/api/ws` respond; removed routes return 404 |
| Delete action | Integration test deletes file via `file.delete` action |
| Auth | Cookie and bearer token auth unchanged for local mode |
| No plugin spawn | Starting server does not spawn subprocesses; no plugin discovery logs |

Run: `cargo test`.

### Contract tests (backend interface)

Add a small **backend conformance suite** in TypeScript: a table of scenarios (`list root`, `list nested prefix`, `upload small file`, `delete file`, `stat missing`) run against mock HTTP (MSW or similar) for both backends. This guards against divergence without requiring live S3 in CI.

### E2E tests (Playwright)

| Scenario | Mode |
|----------|------|
| Navigate folders, select files, download | Local (existing fixture dir) |
| Upload file via drag-and-drop, verify appears in listing | Local |
| Delete file, listing refreshes | Local |
| Search box absent; `/api/search` not called | Local |
| No plugin viewer/thumbnail network requests | Local |
| Connect dialog → enter mock creds → list bucket | Cloud (mock S3 with `@aws-sdk/client-mock` or local MinIO in CI) |
| Pagination: folder with >1000 keys shows load-more or pages | Cloud |
| Disconnect clears session; reconnect required after reload | Cloud |

Local E2E continues to drive a real `zfiles` process. Cloud E2E uses a static build against MinIO or mocked fetch — document which in CI config.

### Manual acceptance checklist

Before calling the refactor complete, a human (or scripted browser walkthrough) verifies:

**Local mode**
- [ ] `zfiles .` cold-starts in under 100 ms to first byte (informal check).
- [ ] Browser opens localhost URL; no request to `zfiles.com`.
- [ ] LAN share with `--token` still works.
- [ ] tus upload resumes after simulated disconnect.

**Cloud mode**
- [ ] Static build hosted locally (`pnpm preview`) connects to R2 or MinIO with pasted temp creds.
- [ ] CORS misconfiguration shows a clear, actionable error pointing at documentation.
- [ ] URL with `?bucket=foo&prefix=bar/` pre-fills connect form but still requires credential paste.
- [ ] Reload after connect requires re-paste (sessionStorage) or re-connect flow.

**Both modes**
- [ ] Same listing, breadcrumb, and keyboard navigation behavior.
- [ ] English and zh-CN strings present on connect screen and explorer chrome.
- [ ] No remaining references to plugins or search in UI.

### Success metrics

| Metric | Target |
|--------|--------|
| Plugin code in `src/` | 0 references |
| Search code in `web/` and `src/` | 0 user-facing references |
| UI components importing `/api/` directly | 0 (all via `ExplorerBackend`) |
| `cargo test` | All pass |
| `pnpm test` | All pass |
| Playwright local suite | Pass |
| Binary size | Smaller than pre-refactor (plugin embed removed) — record before/after |

### Explicitly out of scope for "success"

- Feature parity with the old plugin ecosystem (RAW/HEIC thumbnails, custom viewers, filename search).
- Presigned-URL auth service or Cognito integration.
- macOS/Windows kernel ports.
- Pagination on local `/api/list` (desirable later; not required for initial success unless a test fixture demands it).

---

## Open decisions

Defaults leanings noted for implementation cycles:

| Decision | Default leaning |
|----------|-----------------|
| Library package name | `@zfiles/explorer` (private monorepo path initially; npm publish optional later) |
| Slideshow without plugin thumbnails | Keep for client-decodable images in cwd/selection; remove if it blocks shipping |
| Text file preview in local mode | Omit in v1 of refactor; metadata + download only |
| Local listing pagination | Defer unless large-directory fixture regresses |
| MinIO in CI for cloud E2E | Use `@smithy/node-http-handler` mock or MinIO service container |
| `design/design.md` rewrite | Separate doc pass after code stabilizes; this document is authoritative until then |

---

## Related documents

| Document | Relationship |
|----------|--------------|
| [design/design.md](design.md) | Previous architecture; microkernel/plugin sections become historical after refactor |
| [design/action_system.md](action_system.md) | Still applies to built-in actions; plugin sections to be trimmed |
| [design/config_and_cache.md](config_and_cache.md) | Plugin cache layout becomes obsolete; kernel state.db / tus spool remain |
| [AGENTS.md](../AGENTS.md) | Development cycle rules apply when implementation begins |
