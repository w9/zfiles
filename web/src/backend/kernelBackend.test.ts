import assert from "node:assert/strict";
import { test } from "node:test";

import { KernelBackend, encodePathForQuery } from "./kernelBackend";

test("encodePathForQuery preserves slash segments", () => {
  assert.equal(encodePathForQuery("photos/summer/a.jpg"), "photos/summer/a.jpg");
});

test("KernelBackend downloadUrl encodes path query param", () => {
  const backend = new KernelBackend();
  assert.equal(
    backend.downloadUrl("nested/file name.txt"),
    "/api/file?path=nested%2Ffile%20name.txt",
  );
});

test("KernelBackend thumbnailUrl includes tier", () => {
  const backend = new KernelBackend();
  assert.equal(
    backend.thumbnailUrl("photos/a.jpg", "preview"),
    "/api/thumbnail?path=photos/a.jpg&tier=preview",
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

test("KernelBackend search builds query string", async () => {
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL) => {
    calls.push(String(input));
    return Promise.resolve(new Response("[]", { status: 200 }));
  }) as typeof fetch;

  try {
    const backend = new KernelBackend();
    await backend.search("notes", "projects/foo");
    assert.equal(calls[0], "/api/search?q=notes&path=projects%2Ffoo");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
