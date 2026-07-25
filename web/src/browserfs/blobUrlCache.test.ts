import assert from "node:assert/strict";
import test from "node:test";

import { BlobUrlCache } from "./blobUrlCache";

function createTracker() {
  const created: string[] = [];
  const revoked: string[] = [];
  let counter = 0;
  return {
    created,
    revoked,
    createObjectURL: () => {
      counter += 1;
      const url = `blob:test/${counter}`;
      created.push(url);
      return url;
    },
    revokeObjectURL: (url: string) => {
      revoked.push(url);
    },
  };
}

function blob(): Blob {
  return new Blob(["x"]);
}

test("set returns a cached URL that get reuses", () => {
  const tracker = createTracker();
  const cache = new BlobUrlCache(tracker);

  const url = cache.set("a.txt", blob());
  assert.equal(cache.get("a.txt"), url);
  assert.equal(tracker.created.length, 1);
  assert.deepEqual(tracker.revoked, []);
});

test("re-setting a path revokes the previous URL", () => {
  const tracker = createTracker();
  const cache = new BlobUrlCache(tracker);

  const first = cache.set("a.txt", blob());
  const second = cache.set("a.txt", blob());

  assert.notEqual(first, second);
  assert.deepEqual(tracker.revoked, [first]);
  assert.equal(cache.get("a.txt"), second);
});

test("eviction revokes the least recently used entry", () => {
  const tracker = createTracker();
  const cache = new BlobUrlCache({ ...tracker, maxEntries: 2 });

  const a = cache.set("a.txt", blob());
  cache.set("b.txt", blob());
  cache.get("a.txt");
  cache.set("c.txt", blob());

  assert.deepEqual(tracker.revoked, [tracker.created[1]]);
  assert.equal(cache.get("a.txt"), a);
  assert.equal(cache.get("b.txt"), null);
});

test("invalidate revokes the path and everything under it", () => {
  const tracker = createTracker();
  const cache = new BlobUrlCache(tracker);

  const nested = cache.set("photos/2024/a.txt", blob());
  const sibling = cache.set("photos-backup/a.txt", blob());
  cache.set("photos", blob());

  cache.invalidate("photos");

  assert.equal(cache.get("photos/2024/a.txt"), null);
  assert.equal(cache.get("photos"), null);
  assert.equal(cache.get("photos-backup/a.txt"), sibling);
  assert.ok(tracker.revoked.includes(nested));
});

test("invalidating the root clears every entry", () => {
  const tracker = createTracker();
  const cache = new BlobUrlCache(tracker);

  cache.set("a.txt", blob());
  cache.set("photos/b.txt", blob());
  cache.invalidate("");

  assert.equal(tracker.revoked.length, 2);
  assert.equal(cache.get("a.txt"), null);
});

test("clear revokes all outstanding URLs", () => {
  const tracker = createTracker();
  const cache = new BlobUrlCache(tracker);

  cache.set("a.txt", blob());
  cache.set("b.txt", blob());
  cache.clear();

  assert.equal(tracker.revoked.length, 2);
  assert.equal(cache.get("a.txt"), null);
  cache.clear();
  assert.equal(tracker.revoked.length, 2);
});
