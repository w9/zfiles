import assert from "node:assert/strict";
import { test } from "node:test";

import {
  computeMultipartPartSize,
  fileMatchesMultipartRecord,
  fileMatchesMultipartRecordByHandle,
  multipartSessionScopeId,
  type MultipartSessionRecord,
} from "./multipartSessions";
import {
  mergeMultipartSessions,
  multipartBytesUploaded,
  multipartPercent,
  filterMultipartLocalRecords,
  type ListedPart,
} from "./s3Multipart";

test("multipartSessionScopeId keys by provider bucket and prefix", () => {
  assert.equal(
    multipartSessionScopeId({ provider: "aws", bucket: "b", prefix: "p/" }),
    "aws:b:p/",
  );
});

test("computeMultipartPartSize uses 5 MiB minimum", () => {
  assert.equal(computeMultipartPartSize(1024), 5 * 1024 * 1024);
  assert.equal(computeMultipartPartSize(60 * 1024 * 1024), 5 * 1024 * 1024);
});

test("fileMatchesMultipartRecordByHandle matches name and size only", () => {
  const record: MultipartSessionRecord = {
    uploadId: "u1",
    objectKey: "prefix/a.txt",
    destPath: "a.txt",
    fileName: "a.txt",
    fileSize: 3,
    fileLastModified: 42,
    partSize: 5 * 1024 * 1024,
    checksumValidation: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  const file = new File(["abc"], "a.txt", { type: "text/plain" });
  Object.defineProperty(file, "lastModified", { value: 99 });
  assert.equal(fileMatchesMultipartRecordByHandle(file, record), true);
  assert.equal(fileMatchesMultipartRecord(file, record), false);
});

test("fileMatchesMultipartRecord requires name size and lastModified", () => {
  const record: MultipartSessionRecord = {
    uploadId: "u1",
    objectKey: "prefix/a.txt",
    destPath: "a.txt",
    fileName: "a.txt",
    fileSize: 3,
    fileLastModified: 42,
    partSize: 5 * 1024 * 1024,
    checksumValidation: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  const file = new File(["abc"], "a.txt", { type: "text/plain" });
  Object.defineProperty(file, "lastModified", { value: 42 });
  assert.equal(fileMatchesMultipartRecord(file, record), true);
  const wrongSize = new File(["ab"], "a.txt");
  Object.defineProperty(wrongSize, "lastModified", { value: 42 });
  assert.equal(fileMatchesMultipartRecord(wrongSize, record), false);
});

test("multipartBytesUploaded sums part sizes", () => {
  const parts: ListedPart[] = [
    { PartNumber: 1, ETag: '"a"', Size: 100 },
    { PartNumber: 2, ETag: '"b"', Size: 50 },
  ];
  assert.equal(multipartBytesUploaded(parts), 150);
});

test("multipartPercent returns rounded percent or null when size unknown", () => {
  assert.equal(multipartPercent({ bytesUploaded: 250, totalBytes: 1000 }), 25);
  assert.equal(multipartPercent({ bytesUploaded: 999, totalBytes: 1000 }), 100);
  assert.equal(multipartPercent({ bytesUploaded: 2000, totalBytes: 1000 }), 100);
  assert.equal(multipartPercent({ bytesUploaded: null, totalBytes: 1000 }), null);
  assert.equal(multipartPercent({ bytesUploaded: 10, totalBytes: null }), null);
  assert.equal(multipartPercent({ bytesUploaded: 10, totalBytes: 0 }), null);
});

test("mergeMultipartSessions marks resume only with local records", () => {
  const listed = [
    {
      uploadId: "remote-only",
      objectKey: "data/remote.bin",
      initiated: new Date("2026-01-02T00:00:00.000Z"),
    },
    {
      uploadId: "tracked",
      objectKey: "data/tracked.bin",
      initiated: new Date("2026-01-03T00:00:00.000Z"),
    },
  ];
  const localRecords: MultipartSessionRecord[] = [
    {
      uploadId: "tracked",
      objectKey: "data/tracked.bin",
      destPath: "tracked.bin",
      fileName: "tracked.bin",
      fileSize: 1_000,
      fileLastModified: 1,
      partSize: 5 * 1024 * 1024,
      checksumValidation: false,
      createdAt: "2026-01-03T00:00:00.000Z",
    },
  ];
  const bytes = new Map([
    ["remote-only", 10],
    ["tracked", 250],
  ]);
  const merged = mergeMultipartSessions(listed, localRecords, "data/", bytes);
  assert.equal(merged.length, 2);
  const remote = merged.find((session) => session.uploadId === "remote-only");
  const tracked = merged.find((session) => session.uploadId === "tracked");
  assert.equal(remote?.canResume, false);
  assert.equal(tracked?.canResume, true);
  assert.equal(tracked?.bytesUploaded, 250);
  assert.equal(tracked?.totalBytes, 1_000);
});

test("mergeMultipartSessions includes stale local records without S3 listing", () => {
  const localRecords: MultipartSessionRecord[] = [
    {
      uploadId: "stale",
      objectKey: "data/stale.bin",
      destPath: "stale.bin",
      fileName: "stale.bin",
      fileSize: 500,
      fileLastModified: 2,
      partSize: 5 * 1024 * 1024,
      checksumValidation: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ];
  const merged = mergeMultipartSessions([], localRecords, "data/", new Map());
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.canResume, true);
  assert.equal(merged[0]?.bytesUploaded, null);
});

test("mergeMultipartSessions falls back to stored local bytes when S3 map is empty", () => {
  const localRecords: MultipartSessionRecord[] = [
    {
      uploadId: "local-only",
      objectKey: "data/local.bin",
      destPath: "local.bin",
      fileName: "local.bin",
      fileSize: 1_000,
      fileLastModified: 2,
      partSize: 5 * 1024 * 1024,
      checksumValidation: false,
      bytesUploaded: 250,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ];
  const merged = mergeMultipartSessions([], localRecords, "data/", new Map());
  assert.equal(merged[0]?.bytesUploaded, 250);
  assert.equal(merged[0]?.totalBytes, 1_000);
});

test("filterMultipartLocalRecords drops removed upload ids before merge", () => {
  const localRecords: MultipartSessionRecord[] = [
    {
      uploadId: "keep",
      objectKey: "data/keep.bin",
      destPath: "keep.bin",
      fileName: "keep.bin",
      fileSize: 100,
      fileLastModified: 1,
      partSize: 5 * 1024 * 1024,
      checksumValidation: false,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      uploadId: "gone",
      objectKey: "data/gone.bin",
      destPath: "gone.bin",
      fileName: "gone.bin",
      fileSize: 200,
      fileLastModified: 2,
      partSize: 5 * 1024 * 1024,
      checksumValidation: false,
      createdAt: "2026-01-02T00:00:00.000Z",
    },
  ];
  const filtered = filterMultipartLocalRecords(localRecords, new Set(["gone"]));
  const merged = mergeMultipartSessions([], filtered, "data/", new Map());
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.uploadId, "keep");
});
