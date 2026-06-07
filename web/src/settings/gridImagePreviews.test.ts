import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultGridImagePreviews,
  parseGridImagePreviews,
  readStoredGridImagePreviews,
} from "./gridImagePreviews";

test("defaultGridImagePreviews is on for local and cloud", () => {
  assert.equal(defaultGridImagePreviews("local"), true);
  assert.equal(defaultGridImagePreviews("cloud"), true);
});

test("parseGridImagePreviews accepts boolean strings", () => {
  assert.equal(parseGridImagePreviews("true"), true);
  assert.equal(parseGridImagePreviews("1"), true);
  assert.equal(parseGridImagePreviews("false"), false);
  assert.equal(parseGridImagePreviews("0"), false);
  assert.equal(parseGridImagePreviews(null), null);
  assert.equal(parseGridImagePreviews("maybe"), null);
});

test("readStoredGridImagePreviews falls back to enabled by default", () => {
  assert.equal(readStoredGridImagePreviews("local"), true);
  assert.equal(readStoredGridImagePreviews("cloud"), true);
});
