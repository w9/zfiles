import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultGridThumbnailBadge,
  parseGridThumbnailBadge,
  readStoredGridThumbnailBadge,
} from "./gridThumbnailBadge";

test("defaultGridThumbnailBadge is on for local and cloud", () => {
  assert.equal(defaultGridThumbnailBadge("local"), true);
  assert.equal(defaultGridThumbnailBadge("cloud"), true);
});

test("parseGridThumbnailBadge accepts boolean strings", () => {
  assert.equal(parseGridThumbnailBadge("true"), true);
  assert.equal(parseGridThumbnailBadge("1"), true);
  assert.equal(parseGridThumbnailBadge("false"), false);
  assert.equal(parseGridThumbnailBadge("0"), false);
  assert.equal(parseGridThumbnailBadge(null), null);
  assert.equal(parseGridThumbnailBadge("maybe"), null);
});

test("readStoredGridThumbnailBadge falls back to enabled by default", () => {
  assert.equal(readStoredGridThumbnailBadge("local"), true);
  assert.equal(readStoredGridThumbnailBadge("cloud"), true);
});
