# Cloud mode — connections and credentials

Cloud mode is a **static SPA** (`web/dist-cloud/`) with no zfiles server behind it. It opens into **Browser storage** — a filesystem kept in your own browser via IndexedDB — so the explorer is usable before any bucket exists. S3-compatible buckets are **connections** you attach when you want them; credentials go straight from your browser to AWS or Cloudflare and never to the site's host.

Architecture overview: [design/design.md](../design/design.md). CORS setup: [cors.md](cors.md).

## Build and deploy

```bash
cd web
pnpm install
pnpm build:cloud
```

Deploy everything under `web/dist-cloud/` to any static host (S3 website, R2 public bucket, nginx, GitHub Pages, etc.). The cloud entry is emitted as `index.html`, so most hosts serve it at `/` automatically.

### Subpath hosting (e.g. GitHub Pages `/repo/`)

Set Vite `base` when building so asset URLs resolve correctly, then redeploy:

```bash
cd web
pnpm build:cloud -- --base=/your-repo/
```

Explorer and settings routes (`/f/...`, `/settings`) are prefixed with that base automatically via `import.meta.env.BASE_URL`. Configure your static host to serve `index.html` for all paths under that prefix (SPA fallback).

Before sharing the URL with users, configure [bucket CORS](cors.md) for your SPA origin.

## Browser storage

The landing volume needs no setup. Files you create or drop in are stored in this browser only — nothing is uploaded anywhere, and other people opening the same URL see their own empty storage.

- It is **pinned** in the connection list and cannot be renamed or deleted.
- Contents survive reloads and browser restarts. Clearing site data (or using a private window) erases them, and Browser storage is the only copy.
- Every tab on the origin shares one storage; the last write wins, and a tab re-reads the current directory when it regains focus.
- Capacity is whatever the browser grants the origin. zfiles asks for persistent storage on first write and reports a clear "storage is full" error rather than failing silently.
- Uploads write in one shot, so pausing a Browser storage upload restarts it instead of resuming.

## Connections

Exactly one connection is active at a time. The **status-bar pill** shows its name and opens the connection dialog; the same dialog is available as **Connect to…** in the command palette (`Ctrl/Cmd+P`) and the Connection menu.

| Action | Where | What it does |
|--------|-------|--------------|
| **Connect to…** | Pill, palette, menu bar | Opens the list of connections to activate |
| **Create a new connection…** | Palette, menu bar, dialog footer | Opens the form for a new bucket |
| **Edit** / **Duplicate** / **Delete** | Row menu in the dialog | Manage a saved connection |
| **Forget saved keys** | Row menu (when keys are stored) | Removes stored keys, keeping the connection |
| **Copy Share URL** | Header, palette | Builds a link to the active bucket (see [Sharing links](#sharing-links)) |

There is no Disconnect: activate **Browser storage** to leave a bucket. Saved connections stay in the list, so switching back is one click.

### Creating a connection

1. Open **Create a new connection…**.
2. Name it (defaults to the bucket, or `bucket/prefix`). Names are unique — a collision gets a numeric suffix.
3. Choose the provider (**Amazon S3** or **Cloudflare R2**), then bucket, region, endpoint (required for R2), and an optional prefix to use as the root.
4. Optionally tick **Read-only** to disable uploads and deletes.
5. Paste temporary access keys, and decide whether to tick **Remember keys on this device**.
6. **Connect**. zfiles runs `HeadBucket` to verify the credentials and bucket access, then saves the connection and activates it.

### Where credentials live

- By default keys stay **in memory** for the tab. Reloading or reopening the page asks for them again — the settings are remembered, so you only re-paste the secrets.
- Ticking **Remember keys on this device** writes them to `localStorage` for this browser profile, so the connection reconnects automatically on reload. Convenient on a personal machine; wrong on a shared one, because anything with access to the profile (including a successful XSS) can read them.
- Connection *settings* (name, provider, bucket, region, endpoint, prefix, read-only) always persist in `localStorage`. They contain no secrets.
- A rejected request drops the keys it used, so nothing retries with credentials the bucket has already refused.
- The static host never receives credentials in either case.

### Reconnecting after a reload

zfiles remembers the last connection you activated. On load it reconnects when it still has that connection's keys; otherwise you land in Browser storage, and activating the bucket asks for keys with everything else prefilled.

## URL parameters

A link states what it wants with `connect`:

| Param | Value | Purpose |
|-------|-------|---------|
| `connect` | `saved:<name>` | Activate the saved connection with that name (URL-encode spaces) |
| `connect` | `new` | Connect to the bucket described by the other params, without saving it |
| `connect` | `ask` | Open the connection picker |
| `provider` | `aws`, `r2` | Provider preset |
| `bucket` | `my-data` | Bucket name |
| `region` | `us-east-1`, `auto` | AWS region (R2 often uses `auto`) |
| `endpoint` | `https://…r2.cloudflarestorage.com` | Custom endpoint (required for R2) |
| `prefix` | `projects/demo/` | Root prefix inside the bucket |
| `readonly` | `1`, `true` | Read-only mode (no upload/delete) |

Credentials go in the **fragment**, not the query string:

```
#accessKeyId=AKIA…&secretAccessKey=…&sessionToken=…
```

Fragments are never sent to a server, so keys stay out of the static host's access logs and out of `Referer` headers. Older links that put credentials in the query string still work, and zfiles removes credentials from the address bar (query or fragment) as soon as it reads them.

```
# Open the picker
https://files.example.com/?connect=ask

# Activate a connection this browser has saved
https://files.example.com/?connect=saved:Work%20bucket

# Offer a bucket and let the recipient paste keys into the prefilled form
https://files.example.com/?connect=new&provider=r2&bucket=photos&endpoint=https://acct.r2.cloudflarestorage.com&prefix=2024/

# Connect straight away with short-lived keys, landing in a subfolder
https://files.example.com/f/2024/album?connect=new&provider=aws&bucket=my-data&region=us-east-1#accessKeyId=AKIA…&secretAccessKey=…
```

A `connect=new` connection is **not saved**: it shows in the picker as a temporary entry, and a toast (or its row menu) offers **Save connection**. If the link is missing keys — or the endpoint R2 needs — the create form opens prefilled instead of connecting. A `connect=saved:` name that this browser does not have reports itself and leaves Browser storage active.

Anyone holding the link holds the keys in it, so use **short-lived, scoped** credentials for deep links and prefer typing keys into the form when sharing a screen.

### Sharing links

**Copy Share URL** builds one of these links for the active bucket, at your current folder. The **Include credentials in share URL** checkbox controls whether keys are appended to the fragment; leave it off to share only the bucket coordinates.

## Credential recommendations

Use **short-lived, least-privilege** credentials. Prefer session tokens or scoped API tokens over long-lived root keys.

### AWS IAM (example read/write on a prefix)

Replace `YOUR_BUCKET` and optional `prefix/path/*`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListBucket",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::YOUR_BUCKET",
      "Condition": {
        "StringLike": {
          "s3:prefix": ["prefix/path/*", "prefix/path"]
        }
      }
    },
    {
      "Sid": "ObjectAccess",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:AbortMultipartUpload",
        "s3:ListMultipartUploads",
        "s3:ListMultipartUploadParts"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET/prefix/path/*"
    }
  ]
}
```

Read-only: omit `PutObject`, `DeleteObject`, and multipart write actions; enable **Read-only** on the connection or `readonly=1` in the URL.

`HeadBucket` (the connect test) requires `s3:ListBucket` on the bucket ARN or equivalent bucket-level read permission.

### Cloudflare R2 API token

Create an R2 token with:

- **Object Read** — list, stat, download
- **Object Write** — upload, multipart (if not read-only)
- **Object Delete** — delete files (if not read-only)

Scope the token to the bucket (and prefix if your workflow supports it). Use the S3 access key ID and secret from the token, with the R2 S3 API endpoint.

## When a connection fails

**Before anything has loaded** — a link or a remembered connection that cannot connect shows a dialog offering **Retry** or **Use a different connection**. There is no Cancel, because there is no listing to fall back to; picking a different connection (including Browser storage) is the way out.

**Mid-session** — if the bucket stops answering or credentials expire, the explorer freezes: the listing you were looking at stays on screen, and everything that would touch storage or navigate elsewhere is disabled, including in-flight uploads, which pause. The same dialog appears with **Cancel**, which leaves the frozen view in place so you can read it. Retry reconnects, asking for keys again if the expired ones were dropped.

No objects are deleted when you switch or fail over. Partial multipart uploads may remain in the bucket until aborted or removed by lifecycle rules — zfiles aborts them when it can, but leaving mid-upload can leave incomplete parts.

## Local mode vs cloud mode

| | Local (`zfiles` CLI) | Cloud (static SPA) |
|--|----------------------|---------------------|
| Opens | `http://127.0.0.1:<port>/` | Hosted `index.html` at `/` |
| Default storage | The served directory | Browser storage (IndexedDB) |
| Other volumes | None | Saved S3/R2 connections |
| Storage API | Kernel `/api/*` | IndexedDB, or S3/R2 from the browser |
| Credentials | Optional LAN bearer token | User-supplied S3 keys, remembered only on request |
| CORS | Same-origin (no bucket CORS) | Bucket CORS required |

The CLI **never** opens `zfiles.com` for local browsing. Cloud and local share the same `ExplorerApp` UI with different build artifacts and backends.

## Self-hosting checklist

1. `pnpm build:cloud`
2. Upload `web/dist-cloud/` to your static host
3. Confirm the page opens into Browser storage with no credentials
4. Configure [CORS](cors.md) on the target bucket for your SPA origin
5. Create scoped credentials for users or your team
6. Share the SPA URL (with optional `connect=` params)
7. Confirm connect → list → upload → download → delete in a test prefix
