import assert from "node:assert/strict";
import test from "node:test";

import {
  materializeUploadFile,
  needsUploadFileMaterialization,
  prepareUploadFile,
} from "./materializeUploadFile";

test("needsUploadFileMaterialization detects iPhone user agent", () => {
  const original = navigator.userAgent;
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15",
  });
  try {
    assert.equal(needsUploadFileMaterialization(), true);
  } finally {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: original,
    });
  }
});

test("prepareUploadFile returns the same File on desktop", async () => {
  const original = navigator.userAgent;
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0",
  });
  try {
    const file = new File(["hello"], "a.txt", { type: "text/plain" });
    assert.equal(await prepareUploadFile(file), file);
  } finally {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: original,
    });
  }
});

test("materializeUploadFile copies bytes into a new File", async () => {
  const file = new File(["photo-bytes"], "photo.jpg", {
    type: "image/jpeg",
    lastModified: 1_700_000_000_000,
  });
  const materialized = await materializeUploadFile(file);
  assert.notEqual(materialized, file);
  assert.equal(materialized.name, "photo.jpg");
  assert.equal(materialized.type, "image/jpeg");
  assert.equal(materialized.size, file.size);
  assert.equal(await materialized.text(), "photo-bytes");
});
