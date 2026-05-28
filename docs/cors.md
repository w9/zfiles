# CORS for cloud mode

The cloud SPA talks to S3 or Cloudflare R2 **directly from the browser** via the AWS SDK. Your bucket must allow cross-origin requests from the host that serves the static files.

If CORS is missing or too narrow, the connect dialog or listing will fail with browser console errors such as `Access-Control-Allow-Origin` or blocked preflight requests. zfiles does not proxy object storage — CORS on the bucket is required.

## What the explorer calls

| Operation | S3 API | HTTP methods |
|-----------|--------|--------------|
| Test connection | `HeadBucket` | `HEAD` |
| List folders / files | `ListObjectsV2` | `GET` |
| File metadata | `HeadObject` | `HEAD` |
| Download / image preview | `GetObject` (presigned URL) | `GET` |
| Upload | `CreateMultipartUpload`, `UploadPart`, `CompleteMultipartUpload`, `AbortMultipartUpload` | `POST`, `PUT` |
| Delete | `DeleteObject` | `DELETE` |

Allowed methods on the bucket CORS rule: **`GET`, `PUT`, `POST`, `DELETE`, `HEAD`**.

## Recommended CORS rule

Replace the origin with your deployed SPA origin(s). For local development with `pnpm dev:cloud`, include `http://localhost:5173` (or whichever port Vite uses).

```json
[
  {
    "AllowedOrigins": [
      "https://files.example.com",
      "http://localhost:5173"
    ],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

Using `"AllowedHeaders": ["*"]` is the simplest way to cover SigV4 headers (`x-amz-date`, `x-amz-content-sha256`, `x-amz-security-token`, etc.) that the SDK sends. For tighter policies, allow at minimum:

- `Authorization`
- `Content-Type`
- `Content-Length`
- `x-amz-*`

## Amazon S3

### Console

1. Open the bucket → **Permissions** → **Cross-origin resource sharing (CORS)**.
2. Paste the JSON rule above (adjust origins).
3. Save.

### AWS CLI

Save the rule to `cors.json`, then:

```bash
aws s3api put-bucket-cors --bucket YOUR_BUCKET --cors-configuration file://cors.json
```

Verify:

```bash
aws s3api get-bucket-cors --bucket YOUR_BUCKET
```

### Notes

- CORS applies per bucket. If you use a bucket prefix in zfiles, you do not configure CORS separately for the prefix.
- Presigned `GetObject` URLs are fetched by the browser from the S3 hostname; the same bucket CORS rule applies.
- If the SPA and bucket are in different AWS accounts, CORS on the bucket still controls browser access; IAM on the credentials controls authorization.

## Cloudflare R2

R2 exposes an S3-compatible API. CORS is configured on the bucket in the Cloudflare dashboard or via the API.

### Dashboard

1. **R2** → your bucket → **Settings** → **CORS policy**.
2. Add a rule equivalent to the JSON above.
3. Set **Allowed origins** to your SPA URL(s) and localhost for dev.

### wrangler / API

R2 CORS policies use the same shape as S3. Example with the Cloudflare API (see [R2 CORS documentation](https://developers.cloudflare.com/r2/buckets/cors/) for current endpoints).

Use the **S3 API endpoint** shown in the R2 bucket settings (for example `https://<account-id>.r2.cloudflarestorage.com`) in the zfiles connect dialog. zfiles enables path-style addressing for R2.

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Connect succeeds but listing fails | CORS allows `HEAD` but not `GET`, or origin mismatch |
| Upload fails after connect | Missing `PUT` / `POST` in `AllowedMethods` |
| Preview/download image broken | `GET` blocked on presigned URL; check `ExposeHeaders` includes `Content-Type` |
| Works in curl but not browser | CORS is browser-only; curl ignores CORS |
| Intermittent failures after long idle | Session token expired — disconnect and reconnect |

Always check the browser **Network** tab: failed S3 requests show the exact origin the browser sent. That origin must appear in `AllowedOrigins`.

## Security note

CORS is not authentication. It only tells the browser whether JavaScript on your SPA origin may read S3 responses. Access still requires valid credentials with appropriate IAM or R2 token permissions. See [cloud-connect.md](cloud-connect.md) for least-privilege scoping.
