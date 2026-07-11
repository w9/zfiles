import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultSlideshowStartAtActiveItem,
  parseStoredBoolean,
} from "./slideshowSettings";

test("parseStoredBoolean parses storage values", () => {
  assert.equal(parseStoredBoolean("true"), true);
  assert.equal(parseStoredBoolean("false"), false);
  assert.equal(parseStoredBoolean("1"), true);
  assert.equal(parseStoredBoolean("0"), false);
  assert.equal(parseStoredBoolean("maybe"), null);
});

test("defaultSlideshowStartAtActiveItem is false", () => {
  assert.equal(defaultSlideshowStartAtActiveItem(), false);
});
