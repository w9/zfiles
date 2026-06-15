import assert from "node:assert/strict";
import test from "node:test";

import {
  BackendObjectCache,
  DOWNLOAD_URL_REFRESH_BUFFER_MS,
  isDownloadUrlFresh,
  parsePresignedUrlExpiryMs,
  pathsAffectedByAction,
} from "./backendObjectCache";

const SAMPLE_URL =
  "https://example.r2.cloudflarestorage.com/bucket/photo.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=test%2F20260615%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260615T031948Z&X-Amz-Expires=3600&X-Amz-Signature=abc&X-Amz-SignedHeaders=host&x-id=GetObject";

test("parsePresignedUrlExpiryMs reads X-Amz-Date + X-Amz-Expires", () => {
  const issuedMs = Date.UTC(2026, 5, 15, 3, 19, 48);
  assert.equal(parsePresignedUrlExpiryMs(SAMPLE_URL), issuedMs + 3_600_000);
});

test("isDownloadUrlFresh respects refresh buffer", () => {
  const expiresAtMs = 1_000_000;
  const now = expiresAtMs - DOWNLOAD_URL_REFRESH_BUFFER_MS - 1;
  assert.equal(isDownloadUrlFresh(expiresAtMs, now), true);
  assert.equal(isDownloadUrlFresh(expiresAtMs, expiresAtMs - DOWNLOAD_URL_REFRESH_BUFFER_MS), false);
});

test("BackendObjectCache reuses download URLs until refresh buffer", () => {
  const cache = new BackendObjectCache();
  const issuedMs = Date.UTC(2026, 5, 15, 3, 19, 48);
  const now = issuedMs + 1_000;
  cache.setDownloadUrl("photos/a.jpg", SAMPLE_URL, now);
  assert.equal(cache.getCachedDownloadUrl("photos/a.jpg", now), SAMPLE_URL);
  assert.equal(
    cache.getCachedDownloadUrl(
      "photos/a.jpg",
      issuedMs + 3_600_000 - DOWNLOAD_URL_REFRESH_BUFFER_MS,
    ),
    null,
  );
});

test("BackendObjectCache deduplicates in-flight stat requests", async () => {
  const cache = new BackendObjectCache();
  let calls = 0;
  const promise = cache.trackInFlightStat(
    "photos/a.jpg",
    Promise.resolve().then(() => {
      calls += 1;
      return {
        path: "photos/a.jpg",
        is_dir: false,
        size: 42,
      };
    }),
  );
  assert.equal(cache.getInFlightStat("photos/a.jpg"), promise);
  await promise;
  assert.equal(calls, 1);
  assert.equal(cache.getInFlightStat("photos/a.jpg"), null);
});

test("BackendObjectCache invalidates stat and download entries together", () => {
  const cache = new BackendObjectCache();
  cache.setStat("photos/a.jpg", { path: "photos/a.jpg", is_dir: false, size: 1 });
  cache.setDownloadUrl("photos/a.jpg", SAMPLE_URL);
  cache.invalidatePath("photos/a.jpg");
  assert.equal(cache.getCachedStat("photos/a.jpg"), null);
  assert.equal(cache.getCachedDownloadUrl("photos/a.jpg"), null);
});

test("pathsAffectedByAction covers rename, copy, and delete", () => {
  assert.deepEqual(pathsAffectedByAction({ actionId: "file.delete", paths: ["a/b.jpg"] }), [
    "a/b.jpg",
  ]);
  assert.deepEqual(
    pathsAffectedByAction({
      actionId: "file.rename",
      paths: ["a/old.jpg"],
      newName: "new.jpg",
    }),
    ["a/old.jpg", "a/new.jpg"],
  );
  assert.deepEqual(
    pathsAffectedByAction({
      actionId: "file.copy",
      paths: ["a/one.jpg", "a/two.jpg"],
      destDir: "b",
    }),
    ["a/one.jpg", "a/two.jpg", "b/one.jpg", "b/two.jpg"],
  );
});
