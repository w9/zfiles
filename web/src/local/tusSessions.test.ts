import assert from "node:assert/strict";
import { test } from "node:test";

import {
  fileMatchesTusRecord,
  readScopedTusRecords,
  removeTusRecord,
  TUS_SESSIONS_STORAGE_KEY,
  tusSessionScopeId,
  tusUploadIdFromLocation,
  type TusSessionRecord,
  upsertTusRecord,
} from "./tusSessions";

const scopeId = "http://127.0.0.1:8080";

const sampleRecord: TusSessionRecord = {
  uploadId: "abc-123",
  tusLocation: "/api/upload/abc-123",
  destPath: "photos/a.jpg",
  fileName: "a.jpg",
  fileSize: 1024,
  fileLastModified: 1_700_000_000_000,
  checksumSha256Base64: "digest",
  createdAt: "2026-01-01T00:00:00.000Z",
};

test("tusSessionScopeId uses window origin", () => {
  assert.equal(tusSessionScopeId("http://127.0.0.1:9000"), "http://127.0.0.1:9000");
});

test("tusUploadIdFromLocation parses upload id", () => {
  assert.equal(tusUploadIdFromLocation("/api/upload/abc-123"), "abc-123");
});

test("upsert and remove tus records per scope", () => {
  const storage = new Map<string, string>();
  const original = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: globalThis,
  });

  try {
    upsertTusRecord(scopeId, sampleRecord);
    assert.equal(readScopedTusRecords(scopeId).length, 1);
    removeTusRecord(scopeId, sampleRecord.uploadId);
    assert.equal(readScopedTusRecords(scopeId).length, 0);
    assert.equal(storage.has(TUS_SESSIONS_STORAGE_KEY), false);
  } finally {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: original,
    });
  }
});

test("fileMatchesTusRecord compares name, size, and lastModified", () => {
  const file = new File(["x"], "a.jpg", { lastModified: sampleRecord.fileLastModified });
  Object.defineProperty(file, "size", { value: sampleRecord.fileSize });
  assert.equal(fileMatchesTusRecord(file, sampleRecord), true);
  const mismatch = new File(["x"], "b.jpg", { lastModified: sampleRecord.fileLastModified });
  Object.defineProperty(mismatch, "size", { value: sampleRecord.fileSize });
  assert.equal(fileMatchesTusRecord(mismatch, sampleRecord), false);
});
