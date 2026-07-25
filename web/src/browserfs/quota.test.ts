import assert from "node:assert/strict";
import test from "node:test";

import {
  isQuotaExceededError,
  readStorageEstimate,
  requestPersistentStorage,
} from "./quota";

test("isQuotaExceededError recognizes browser quota failures", () => {
  assert.equal(
    isQuotaExceededError(new DOMException("full", "QuotaExceededError")),
    true,
  );
  assert.equal(
    isQuotaExceededError(new DOMException("full", "NS_ERROR_DOM_QUOTA_REACHED")),
    true,
  );
  assert.equal(isQuotaExceededError({ name: "QuotaExceededError" }), true);
  assert.equal(isQuotaExceededError(new Error("disk full")), false);
  assert.equal(isQuotaExceededError(null), false);
});

test("requestPersistentStorage skips the prompt when storage is already persisted", async () => {
  let persistCalls = 0;
  const granted = await requestPersistentStorage({
    persisted: () => Promise.resolve(true),
    persist: () => {
      persistCalls += 1;
      return Promise.resolve(true);
    },
  });

  assert.equal(granted, true);
  assert.equal(persistCalls, 0);
});

test("requestPersistentStorage returns the persist() decision", async () => {
  assert.equal(
    await requestPersistentStorage({
      persisted: () => Promise.resolve(false),
      persist: () => Promise.resolve(false),
    }),
    false,
  );
  assert.equal(
    await requestPersistentStorage({
      persisted: () => Promise.resolve(false),
      persist: () => Promise.resolve(true),
    }),
    true,
  );
});

test("requestPersistentStorage tolerates unsupported or failing storage managers", async () => {
  assert.equal(await requestPersistentStorage(undefined), false);
  assert.equal(await requestPersistentStorage({}), false);
  assert.equal(
    await requestPersistentStorage({
      persisted: () => Promise.reject(new Error("denied")),
      persist: () => Promise.resolve(true),
    }),
    false,
  );
});

test("readStorageEstimate normalizes usage and quota", async () => {
  assert.deepEqual(
    await readStorageEstimate({
      estimate: () => Promise.resolve({ usage: 1024, quota: 4096 }),
    }),
    { usage: 1024, quota: 4096 },
  );
  assert.deepEqual(
    await readStorageEstimate({ estimate: () => Promise.resolve({}) }),
    { usage: 0, quota: 0 },
  );
  assert.equal(await readStorageEstimate(undefined), null);
  assert.equal(await readStorageEstimate({}), null);
  assert.equal(
    await readStorageEstimate({ estimate: () => Promise.reject(new Error("nope")) }),
    null,
  );
});
