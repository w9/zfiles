# Cloud mode — connect flow and credentials

Cloud mode is a **static SPA** (`web/dist-cloud/`) that browses S3-compatible buckets from the browser. There is no zfiles server in the request path for object storage — credentials never leave the user's browser except when sent directly to AWS or Cloudflare.

Architecture overview: [design/design.md](../design/design.md). CORS setup: [cors.md](cors.md).

## Build and deploy

```bash
cd web
pnpm install
pnpm build:cloud
```

Deploy everything under `web/dist-cloud/` to any static host (S3 website, R2 public bucket, nginx, GitHub Pages, etc.). The cloud entry is emitted as `index.html`, so most hosts serve it at `/` automatically.

Before sharing the URL with users, configure [bucket CORS](cors.md) for your SPA origin.

## Connect flow

1. User opens the hosted SPA (optionally with [URL params](#url-parameters-non-secrets-only) that pre-fill the form).
2. The **connect dialog** appears until a session is established.
3. User selects provider (**Amazon S3** or **Cloudflare R2**), bucket, region, endpoint (required for R2), optional prefix, and temporary credentials.
4. User clicks **Connect**. zfiles runs `HeadBucket` to verify credentials and bucket access.
5. On success, credentials and connection settings are stored in **`sessionStorage`** (tab-scoped). The explorer loads.
6. **Disconnect** (header button) clears `sessionStorage` and returns to the connect dialog.

Credentials are **not** written to `localStorage`, URL query strings, or any server log — the static host only serves HTML/JS/CSS.

### Session lifetime

- Credentials persist for the **browser tab** until Disconnect or the tab is closed.
- Reloading the page reuses `sessionStorage` in the same tab — no re-paste until the tab ends.
- Closing the tab clears the session; the user must connect again.
- Expired or revoked credentials show API errors; use Disconnect and reconnect with fresh credentials.

## URL parameters (non-secrets only)

These query params pre-fill the connect form. They must **never** carry secrets.

| Param | Example | Purpose |
|-------|---------|---------|
| `provider` | `aws`, `r2` | Provider preset |
| `bucket` | `my-data` | Bucket name |
| `region` | `us-east-1`, `auto` | AWS region (R2 often uses `auto`) |
| `endpoint` | `https://…r2.cloudflarestorage.com` | Custom endpoint (R2) |
| `prefix` | `projects/demo/` | Root prefix inside the bucket |
| `readonly` | `1`, `true` | Read-only mode (no upload/delete) |

Example bookmark:

```
https://files.example.com/?provider=r2&bucket=photos&prefix=2024/&readonly=1
```

The user still pastes access keys in the dialog every session.

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
        "s3:ListMultipartUploadParts"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET/prefix/path/*"
    }
  ]
}
```

Read-only: omit `PutObject`, `DeleteObject`, and multipart write actions; enable **Read-only** in the connect dialog or `readonly=1` in the URL.

`HeadBucket` (connect test) requires `s3:ListBucket` on the bucket ARN or equivalent bucket-level read permission.

### Cloudflare R2 API token

Create an R2 token with:

- **Object Read** — list, stat, download
- **Object Write** — upload, multipart (if not read-only)
- **Object Delete** — delete files (if not read-only)

Scope the token to the bucket (and prefix if your workflow supports it). Use the S3 access key ID and secret from the token in the connect dialog, with the R2 S3 API endpoint.

## Disconnect behavior

**Disconnect** immediately:

1. Removes the session entry from `sessionStorage`
2. Drops the in-memory `S3Backend` instance
3. Shows the connect dialog again

No objects are deleted on disconnect. Partial multipart uploads may remain in the bucket until aborted or lifecycle rules remove them — zfiles aborts uploads when possible on failed transfers, but disconnect mid-upload may leave incomplete parts.

## Local mode vs cloud mode

| | Local (`zfiles` CLI) | Cloud (static SPA) |
|--|----------------------|---------------------|
| Opens | `http://127.0.0.1:<port>/` | Hosted `index.html` at `/` |
| Storage API | Kernel `/api/*` | S3/R2 from browser |
| Credentials | Optional LAN bearer token | User-pasted S3 keys in dialog |
| CORS | Same-origin (no bucket CORS) | Bucket CORS required |

The CLI **never** opens `zfiles.com` for local browsing. Cloud and local share the same `ExplorerApp` UI but different build artifacts and backends.

## Self-hosting checklist

1. `pnpm build:cloud`
2. Upload `web/dist-cloud/` to your static host
3. Configure [CORS](cors.md) on the target bucket for your SPA origin
4. Create scoped credentials for users or your team
5. Share the SPA URL (with optional query params)
6. Confirm connect → list → upload → download → delete in a test prefix
