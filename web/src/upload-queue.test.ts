import assert from "node:assert/strict";
import { test } from "node:test";

import {
  activeMultipartUploadIds,
  applyProgressUpdate,
  countUploadsByStatus,
  createQueueItem,
  createResumeQueueItem,
  formatEtaSeconds,
  isUploadAbortError,
  isUploadPauseError,
  multipartResumeFromRecord,
  PROGRESS_UI_MIN_INTERVAL_MS,
  resolvePausedUploadOffset,
  shouldCommitProgressUi,
  uploadPercent,
  uploadProgressVariant,
  uploadStatusForProgress,
  type UploadQueueItem,
} from "./upload-queue";

test("createQueueItem starts pending with file size as total", () => {
  const file = new File(["hello"], "a.txt", { type: "text/plain" });
  const before = Date.now();
  const item = createQueueItem(file, "dir/a.txt");
  assert.equal(item.status, "pending");
  assert.equal(item.total, 5);
  assert.equal(item.destPath, "dir/a.txt");
  assert.ok(item.enqueuedAt >= before && item.enqueuedAt <= Date.now());
});

test("uploadProgressVariant uses local styling for hashing and verifying", () => {
  assert.equal(uploadProgressVariant("hashing"), "local");
  assert.equal(uploadProgressVariant("verifying"), "local");
  assert.equal(uploadProgressVariant("cancelled"), "local");
  assert.equal(uploadProgressVariant("failed"), "local");
  assert.equal(uploadProgressVariant("active"), "upload");
  assert.equal(uploadProgressVariant("done"), "upload");
});

test("uploadStatusForProgress maps synthetic and upload progress ids", () => {
  assert.equal(uploadStatusForProgress("hashing"), "hashing");
  assert.equal(uploadStatusForProgress("verifying"), "verifying");
  assert.equal(uploadStatusForProgress("photos/big.iso"), "active");
});

test("uploadPercent clamps to 100", () => {
  const file = new File(["x"], "b.txt");
  const item = createQueueItem(file, "b.txt");
  item.offset = 50;
  item.total = 100;
  assert.equal(uploadPercent(item), 50);
  item.offset = 200;
  assert.equal(uploadPercent(item), 100);
});

test("applyProgressUpdate computes speed and eta from samples", () => {
  const file = new File([new Uint8Array(10_000)], "big.bin");
  const item = createQueueItem(file, "big.bin");
  const t0 = 1_000;
  const first = applyProgressUpdate(item, 0, 10_000, t0, []);
  const second = applyProgressUpdate(first.item, 5_000, 10_000, t0 + 1_000, first.samples);
  assert.equal(second.item.offset, 5_000);
  assert.ok(second.item.speedBps != null && second.item.speedBps >= 4_900);
  assert.ok(second.item.etaSeconds != null && second.item.etaSeconds > 0);
});

test("applyProgressUpdate stores committed upload offset when provided", () => {
  const file = new File([new Uint8Array(10_000)], "big.bin");
  const item = createQueueItem(file, "big.bin");
  const { item: updated } = applyProgressUpdate(item, 900, 10_000, 1_000, [], undefined, 500);
  assert.equal(updated.offset, 900);
  assert.equal(updated.committedUploadOffset, 500);
});

test("resolvePausedUploadOffset rolls hashing and verifying to zero", async () => {
  const file = new File(["x"], "a.txt");
  const base = createQueueItem(file, "a.txt");
  const backend = { mode: "local" as const };
  assert.equal(
    await resolvePausedUploadOffset({ ...base, status: "hashing", offset: 500 }, backend),
    0,
  );
  assert.equal(
    await resolvePausedUploadOffset({ ...base, status: "verifying", offset: 500 }, backend),
    0,
  );
});

test("resolvePausedUploadOffset uses ListParts for s3 multipart uploads", async () => {
  const file = new File(["x"], "a.txt");
  const item: UploadQueueItem = {
    ...createQueueItem(file, "a.txt"),
    status: "active",
    offset: 900,
    committedUploadOffset: 500,
    multipartUpload: { uploadId: "u1", objectKey: "photos/a.txt" },
  };
  const backend = {
    mode: "s3" as const,
    getMultipartBytesUploaded: async () => 524_288,
  };
  assert.equal(await resolvePausedUploadOffset(item, backend as never), 524_288);
});

test("resolvePausedUploadOffset falls back to committed bytes when ListParts fails", async () => {
  const file = new File(["x"], "a.txt");
  const item: UploadQueueItem = {
    ...createQueueItem(file, "a.txt"),
    status: "active",
    offset: 900,
    committedUploadOffset: 500,
    multipartUpload: { uploadId: "u1", objectKey: "photos/a.txt" },
  };
  const backend = {
    mode: "s3" as const,
    getMultipartBytesUploaded: async () => {
      throw new Error("network");
    },
  };
  assert.equal(await resolvePausedUploadOffset(item, backend as never), 500);
});

test("resolvePausedUploadOffset uses tus HEAD offset for local uploads", async () => {
  const file = new File(["x"], "a.txt");
  const item: UploadQueueItem = {
    ...createQueueItem(file, "a.txt"),
    status: "active",
    offset: 900,
    tusResume: { location: "/api/upload/abc", checksumSha256Base64: "digest" },
  };
  const backend = {
    mode: "local" as const,
    getTusUploadOffset: async () => 256_000,
  };
  assert.equal(await resolvePausedUploadOffset(item, backend as never), 256_000);
});

test("isUploadAbortError detects abort errors", () => {
  assert.equal(isUploadAbortError(new DOMException("x", "AbortError")), true);
  assert.equal(isUploadAbortError(new Error("x")), false);
});

test("isUploadPauseError detects pause errors", () => {
  assert.equal(isUploadPauseError(new DOMException("x", "PauseError")), true);
  assert.equal(isUploadPauseError(new DOMException("x", "AbortError")), false);
});

test("multipartResumeFromRecord copies session fields", () => {
  const record = {
    uploadId: "u1",
    objectKey: "k1",
    destPath: "f.bin",
    fileName: "f.bin",
    fileSize: 10,
    fileLastModified: 1,
    partSize: 5_242_880,
    checksumValidation: true,
    checksumSha256Base64: "digest",
    createdAt: new Date().toISOString(),
  };
  assert.deepEqual(multipartResumeFromRecord(record), {
    uploadId: "u1",
    objectKey: "k1",
    partSize: 5_242_880,
    checksumValidation: true,
    checksumSha256Base64: "digest",
  });
});

test("shouldCommitProgressUi allows first update and 1 fps thereafter", () => {
  const t0 = 10_000;
  assert.equal(shouldCommitProgressUi(undefined, t0, false), true);
  assert.equal(shouldCommitProgressUi(t0, t0 + 500, false), false);
  assert.equal(
    shouldCommitProgressUi(t0, t0 + PROGRESS_UI_MIN_INTERVAL_MS, false),
    true,
  );
  assert.equal(shouldCommitProgressUi(t0, t0 + 100, true), true);
});

test("formatEtaSeconds uses seconds, minutes, and hours", () => {
  assert.equal(formatEtaSeconds(12.2), "13s");
  assert.equal(formatEtaSeconds(90), "2m");
  assert.equal(formatEtaSeconds(7200), "2h");
  assert.equal(formatEtaSeconds(null), null);
});

test("countUploadsByStatus tallies each status", () => {
  const file = new File(["x"], "a.txt");
  const items = [
    createQueueItem(file, "a.txt"),
    { ...createQueueItem(file, "b.txt"), status: "active" as const },
    { ...createQueueItem(file, "c.txt"), status: "done" as const },
    { ...createQueueItem(file, "d.txt"), status: "done" as const },
    { ...createQueueItem(file, "e.txt"), status: "failed" as const },
  ];
  assert.deepEqual(countUploadsByStatus(items), {
    pending: 1,
    active: 1,
    done: 2,
    failed: 1,
  });
});

test("createResumeQueueItem seeds offset and carries stored checksum", () => {
  const file = new File(["x"], "big.iso");
  const record = {
    uploadId: "upload-1",
    objectKey: "prefix/big.iso",
    destPath: "big.iso",
    fileName: "big.iso",
    fileSize: 100,
    fileLastModified: 1,
    partSize: 5_242_880,
    checksumValidation: true,
    checksumSha256Base64: "abc123",
    createdAt: new Date().toISOString(),
  };
  const before = Date.now();
  const item = createResumeQueueItem(file, record, 42);
  assert.equal(item.offset, 42);
  assert.equal(item.committedUploadOffset, 42);
  assert.equal(item.multipartResume?.checksumSha256Base64, "abc123");
  assert.ok(item.enqueuedAt >= before && item.enqueuedAt <= Date.now());
});

test("activeMultipartUploadIds ignores finished queue items", () => {
  const file = new File(["x"], "big.iso");
  const active = createResumeQueueItem(file, {
    uploadId: "upload-active",
    objectKey: "k",
    destPath: "big.iso",
    fileName: "big.iso",
    fileSize: 1,
    fileLastModified: 1,
    partSize: 5_242_880,
    checksumValidation: false,
    createdAt: new Date().toISOString(),
  });
  const done = { ...active, id: "done", status: "done" as const };
  const ids = activeMultipartUploadIds([active, done]);
  assert.deepEqual([...ids], ["upload-active"]);
});
