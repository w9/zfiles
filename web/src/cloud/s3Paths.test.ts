import assert from "node:assert/strict";
import { test } from "node:test";

import {
  explorerPathFromCommonPrefix,
  explorerPathFromObjectKey,
  listPrefixForPath,
  normalizeBucketPrefix,
  objectKeyForPath,
} from "./s3Paths";

test("normalizeBucketPrefix adds trailing slash", () => {
  assert.equal(normalizeBucketPrefix("data"), "data/");
  assert.equal(normalizeBucketPrefix("/data/"), "data/");
  assert.equal(normalizeBucketPrefix(""), "");
});

test("listPrefixForPath combines bucket prefix and explorer path", () => {
  assert.equal(listPrefixForPath("data", ""), "data/");
  assert.equal(listPrefixForPath("data/", "photos"), "data/photos/");
  assert.equal(listPrefixForPath("", "photos"), "photos/");
});

test("objectKeyForPath builds full keys", () => {
  assert.equal(objectKeyForPath("data", "photos", "a.jpg"), "data/photos/a.jpg");
  assert.equal(objectKeyForPath("", "", "root.txt"), "root.txt");
});

test("explorerPathFromCommonPrefix strips bucket prefix", () => {
  assert.deepEqual(explorerPathFromCommonPrefix("data/", "data/photos/"), {
    name: "photos",
    path: "photos",
  });
});

test("explorerPathFromObjectKey maps keys to explorer paths", () => {
  assert.deepEqual(explorerPathFromObjectKey("data/", "data/photos/a.jpg"), {
    name: "a.jpg",
    path: "photos/a.jpg",
  });
});
