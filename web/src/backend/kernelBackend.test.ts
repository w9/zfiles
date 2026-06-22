import assert from "node:assert/strict";
import { test } from "node:test";

import { assertUploadSessionFinalized, KernelBackend } from "./kernelBackend";

test("assertUploadSessionFinalized accepts 404 HEAD after finalize", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.resolve(new Response(null, { status: 404 }))) as typeof fetch;
  try {
    await assertUploadSessionFinalized("/api/upload/abc");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("assertUploadSessionFinalized rejects when tus session still exists", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(null, { status: 200, headers: { "Upload-Offset": "10" } }),
    )) as typeof fetch;
  try {
    await assert.rejects(
      () => assertUploadSessionFinalized("/api/upload/abc"),
      /upload not finalized on server/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("KernelBackend downloadUrl encodes path query param", () => {
  const backend = new KernelBackend();
  assert.equal(
    backend.downloadUrl("nested/file name.txt"),
    "/api/file?path=nested%2Ffile%20name.txt",
  );
});

test("KernelBackend list calls /api/list with encoded path", async () => {
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL) => {
    calls.push(String(input));
    return Promise.resolve(
      new Response(JSON.stringify([{ name: "a", path: "a", is_dir: false, size: 1 }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }) as typeof fetch;

  try {
    const backend = new KernelBackend();
    const result = await backend.list("my folder");
    assert.equal(calls[0], "/api/list?path=my%20folder");
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0]?.name, "a");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
