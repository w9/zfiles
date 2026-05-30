import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_LISTING_SORT_ORDER,
  parseListingSortOrder,
} from "./listingSortOrder";

test("parseListingSortOrder defaults to folders-first", () => {
  assert.equal(parseListingSortOrder(null), DEFAULT_LISTING_SORT_ORDER);
  assert.equal(parseListingSortOrder("invalid"), DEFAULT_LISTING_SORT_ORDER);
});

test("parseListingSortOrder accepts mixed", () => {
  assert.equal(parseListingSortOrder("mixed"), "mixed");
});
